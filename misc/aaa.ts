// File: src/dataProcessor.ts  (1 000 **contracts** per bar, exact split + running CVD)
// ------------------------------
import axios from 'axios';
import * as readline from 'node:readline';

export interface Trade {
  hd: { ts_event: string };
  price: string; // nano‑dollars
  size: number; // contracts in this print
  side: 'B' | 'S';
}

export interface TickBar {
  timestamp: string; // first trade timestamp (ISO)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // exactly 1 000 contracts
  cvd: number; // **running** cumulative delta
  delta: number; // bar‑level delta (buy‑sell)
  cvdColor: 'green' | 'red' | 'gray'; // based on bar delta
}

const PAGE_MS = 5 * 60 * 1000; // 5‑minute paging window

async function* streamTradesPaged(
  key: string,
  dataset: string,
  schema: string,
  startUtc: string,
  endUtc: string,
  symbol: string
): AsyncGenerator<Trade> {
  let curStart = Date.parse(startUtc);
  const end = Date.parse(endUtc);

  while (curStart < end) {
    const curEnd = Math.min(curStart + PAGE_MS, end);

    const resp = await axios.get(
      'https://hist.databento.com/v0/timeseries.get_range',
      {
        params: {
          dataset,
          schema,
          symbols: symbol,
          start: new Date(curStart).toISOString(),
          end: new Date(curEnd).toISOString(),
          encoding: 'json',
        },
        auth: { username: key, password: '' },
        responseType: 'stream',
      }
    );

    const rl = readline.createInterface({ input: resp.data });
    let lastTs = curStart;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const trade = JSON.parse(line) as Trade;
      yield trade;
      lastTs = Number(BigInt(trade.hd.ts_event) / 1_000_000n);
    }

    curStart = lastTs + 1;
  }
}

/**
 * Build bars of **exactly 1 000 contracts**. If a trade overfills the
 * bar, we split it: part goes to complete current bar, remainder starts
 * the next. `cvd` is *running* cumulative delta across the session while
 * `delta` holds the bar’s own buy‑minus‑sell.
 */
export async function* stream1000TickBars(
  key: string,
  dataset: string,
  schema: string,
  startUtc: string,
  endUtc: string,
  symbol: string
): AsyncGenerator<TickBar> {
  let bar: TickBar | null = null;
  let barContracts = 0; // contracts in current bar
  let barDelta = 0; // net delta in current bar
  let runningCVD = 0; // cumulative delta over the day

  for await (let t of streamTradesPaged(
    key,
    dataset,
    schema,
    startUtc,
    endUtc,
    symbol
  )) {
    let remaining = t.size; // contracts still to allocate
    const sign = t.side === 'B' ? 1 : -1; // +buy  ‑sell
    const px = +t.price / 1_000_000_000;
    const tsMs = Number(BigInt(t.hd.ts_event) / 1_000_000n);

    while (remaining > 0) {
      // start new bar if none exists
      if (!bar) {
        bar = {
          timestamp: new Date(tsMs).toISOString(),
          open: px,
          high: px,
          low: px,
          close: px,
          volume: 0,
          cvd: 0,
          delta: 0,
          cvdColor: 'gray',
        };
        barContracts = 0;
        barDelta = 0;
      }

      // contracts we can still fit into this bar
      const space = 1_000 - barContracts;
      const fill = Math.min(space, remaining);

      // update OHLVC with the *trade price* once (price doesn’t change within split)
      bar.high = Math.max(bar.high, px);
      bar.low = Math.min(bar.low, px);
      bar.close = px;

      bar.volume += fill;
      barDelta += sign * fill;
      runningCVD += sign * fill;
      bar.cvd = runningCVD; // running value for each split

      barContracts += fill;
      remaining -= fill;

      // if bar filled exactly, emit and reset
      if (barContracts === 1_000) {
        bar.cvdColor = barDelta > 0 ? 'green' : barDelta < 0 ? 'red' : 'gray';
        yield bar;
        bar = null;
      }
    }
  }
  // discard unfinished bar (<1 000 contracts)
}
