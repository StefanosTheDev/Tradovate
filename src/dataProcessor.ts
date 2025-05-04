// File: src/dataProcessor.ts
import axios from 'axios';
import * as readline from 'node:readline';

/**  Databento trade print schema  */
export interface Trade {
  hd: { ts_event: string };
  price: string; // nano‑dollars
  size: number; // contracts
  side: 'B' | 'S';
}

export interface TickBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  cvd: number;
  cvdColor: 'green' | 'red' | 'gray';
}

/**
 * Stream raw trades from Databento.
 * Adds better error reporting (prints API error body on 4xx/5xx).
 */
async function* streamTrades(
  key: string,
  dataset: string,
  schema: string,
  start: string,
  end: string,
  symbol: string
): AsyncGenerator<Trade> {
  try {
    const resp = await axios.get(
      'https://hist.databento.com/v0/timeseries.get_range',
      {
        params: {
          dataset,
          schema,
          symbols: symbol,
          start,
          end,
          encoding: 'json',
        },
        auth: { username: key, password: '' },
        responseType: 'stream',
      }
    );

    const rl = readline.createInterface({ input: resp.data });
    for await (const line of rl) {
      if (!line.trim()) continue;
      yield JSON.parse(line) as Trade;
    }
  } catch (e: any) {
    if (e.response) {
      console.error(
        'Databento API error',
        e.response.status,
        e.response.statusText
      );
      const body = await streamToString(
        e.response.data as NodeJS.ReadableStream
      );
      console.error(body);
    }
    throw e;
  }
}

/** Convert a Node stream to string (for error bodies) */
function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((res, rej) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', rej);
  });
}

/** Aggregate every 1 000 trades into a bar */
export async function* stream1000TickBars(
  key: string,
  dataset: string,
  schema: string,
  start: string,
  end: string,
  symbol: string
): AsyncGenerator<TickBar> {
  let current: TickBar | null = null;
  let ticks = 0;
  let delta = 0;

  for await (const t of streamTrades(
    key,
    dataset,
    schema,
    start,
    end,
    symbol
  )) {
    const ms = Number(BigInt(t.hd.ts_event) / 1_000_000n);
    const price = +t.price / 1_000_000_000; // nano$ → $

    const d = t.side === 'B' ? t.size : -t.size;
    delta += d;

    if (!current) {
      current = {
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
    current.high = Math.max(current.high, price);
    current.low = Math.min(current.low, price);
    current.close = price;
    current.volume += 1;
    current.cvd = delta;

    if (++ticks >= 1000) {
      current.cvdColor = delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray';
      yield current;
      current = null;
      ticks = 0;
      delta = 0;
    }
  }
  if (current && ticks) {
    current.cvdColor = delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray';
    yield current;
  }
}
