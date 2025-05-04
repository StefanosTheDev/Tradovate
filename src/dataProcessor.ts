import axios from 'axios';
import * as readline from 'node:readline';

// Trade-print feed
type Trade = {
  hd: { ts_event: string };
  price: string; // in nano-dollars
  size: number; // number of contracts
  side: 'B' | 'S'; // aggressive Buy or Sell
};

export interface TickBar {
  timestamp: string; // ISO format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // trade count
  cvd: number; // cumulative delta for the bar
  cvdColor: 'green' | 'red' | 'gray';
}

const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';

/** Stream raw trades (prints) from Databento */
async function* streamTrades(
  apiKey: string,
  start: string,
  end: string,
  symbol: string
): AsyncGenerator<Trade> {
  const resp = await axios.get(
    'https://hist.databento.com/v0/timeseries.get_range',
    {
      params: {
        dataset: DATASET,
        schema: SCHEMA,
        symbols: symbol,
        stype_in: 'raw_symbol', // ensure raw symbol mapping
        start,
        end,
        encoding: 'json',
      },
      auth: { username: apiKey, password: '' },
      responseType: 'stream',
    }
  );

  const rl = readline.createInterface({ input: resp.data });
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as Trade;
  }
}

/** Aggregate every 1 000 trades into one TickBar */
export async function* stream1000TickBars(
  apiKey: string,
  start: string,
  end: string,
  symbol: string
): AsyncGenerator<TickBar> {
  let currentBar: TickBar | null = null;
  let tickCount = 0;
  let cumDelta = 0;

  for await (const trade of streamTrades(apiKey, start, end, symbol)) {
    const ms = Number(BigInt(trade.hd.ts_event) / 1_000_000n);
    const price = Number(trade.price) / 1_000_000_000; // nano → dollars
    const delta = trade.side === 'B' ? trade.size : -trade.size;
    cumDelta += delta;

    if (!currentBar) {
      currentBar = {
        timestamp: new Date(ms).toISOString(),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        cvd: 0,
        cvdColor: 'gray',
      };
    }

    currentBar.high = Math.max(currentBar.high, price);
    currentBar.low = Math.min(currentBar.low, price);
    currentBar.close = price;
    currentBar.volume += 1;
    currentBar.cvd = cumDelta;
    tickCount++;

    if (tickCount >= 1000) {
      currentBar.cvdColor =
        cumDelta > 0 ? 'green' : cumDelta < 0 ? 'red' : 'gray';
      yield currentBar;
      currentBar = null;
      tickCount = 0;
      cumDelta = 0;
    }
  }

  // Flush any final partial bar
  if (currentBar && tickCount > 0) {
    currentBar.cvdColor =
      cumDelta > 0 ? 'green' : cumDelta < 0 ? 'red' : 'gray';
    yield currentBar;
  }
}
