// ------------------------------
// File: src/dataProcessor.ts
// ------------------------------
import axios from 'axios';
import * as readline from 'node:readline';

export interface Trade {
  hd: { ts_event: string };
  price: string; // nano‑dollars
  size: number; // contracts in this print
  side: 'B' | 'S';
}

export interface MinuteBar {
  timestamp: string; // ISO minute start
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number; // bar-level delta
  cvd: number; // running cumulative delta
  cvdColor: 'green' | 'red' | 'gray';
}

const PAGE_MS = 5 * 60 * 1000; // 5-minute paging window

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
 * Decide bar color based on price action per Tradovate's rules.
 * - If strongUpDown=false: compare open vs close
 * - If strongUpDown=true: compare close vs previous bar's high/low
 */
function getBarColor(
  close: number,
  open: number,
  prevHigh: number | null,
  prevLow: number | null,
  strongUpDown: boolean
): 'green' | 'red' | 'gray' {
  if (!strongUpDown) {
    if (close > open) return 'green';
    if (close < open) return 'red';
    return 'gray';
  } else {
    if (prevHigh === null || prevLow === null) {
      // fallback to simple open/close
      if (close > open) return 'green';
      if (close < open) return 'red';
      return 'gray';
    }
    if (close > prevHigh) return 'green';
    if (close < prevLow) return 'red';
    return 'gray';
  }
}

/**
 * Build 1-minute bars, aggregating trades into OHLCV, delta, and running CVD.
 * Colors reflect Tradovate Cumulative Delta study behavior.
 */
export async function* streamOneMinuteBars(
  key: string,
  dataset: string,
  schema: string,
  startUtc: string,
  endUtc: string,
  symbol: string,
  strongUpDown = false // match Tradovate setting
): AsyncGenerator<MinuteBar> {
  let currentBar: MinuteBar | null = null;
  let runningCVD = 0;
  let prevCVD = 0;
  let prevHigh: number | null = null;
  let prevLow: number | null = null;

  for await (const t of streamTradesPaged(
    key,
    dataset,
    schema,
    startUtc,
    endUtc,
    symbol
  )) {
    const px = +t.price / 1_000_000_000;
    const tsMs = Number(BigInt(t.hd.ts_event) / 1_000_000n);
    const minuteStart = new Date(tsMs);
    minuteStart.setSeconds(0, 0);
    const minuteIso = minuteStart.toISOString();
    const sign = t.side === 'B' ? 1 : -1;
    const delta = sign * t.size;

    // start new bar if none or minute changed
    if (!currentBar || currentBar.timestamp !== minuteIso) {
      // emit and finalize previous bar
      if (currentBar) {
        currentBar.cvd = runningCVD;
        currentBar.cvdColor = getBarColor(
          currentBar.close,
          currentBar.open,
          prevHigh,
          prevLow,
          strongUpDown
        );
        yield currentBar;
        prevCVD = runningCVD;
        prevHigh = currentBar.high;
        prevLow = currentBar.low;
      }
      // init new bar
      currentBar = {
        timestamp: minuteIso,
        open: px,
        high: px,
        low: px,
        close: px,
        volume: t.size,
        delta,
        cvd: runningCVD + delta,
        cvdColor: 'gray',
      };
    } else {
      // update existing bar stats
      currentBar.high = Math.max(currentBar.high, px);
      currentBar.low = Math.min(currentBar.low, px);
      currentBar.close = px;
      currentBar.volume += t.size;
      currentBar.delta += delta;
    }
    runningCVD += delta;
    if (currentBar) {
      currentBar.cvd = runningCVD;
    }
  }

  // emit final bar if exists
  if (currentBar) {
    currentBar.cvd = runningCVD;
    currentBar.cvdColor = getBarColor(
      currentBar.close,
      currentBar.open,
      prevHigh,
      prevLow,
      strongUpDown
    );
    yield currentBar;
  }
}
