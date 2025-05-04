// mes_15min_closes.ts

import axios from 'axios';
import * as readline from 'node:readline';

interface CandleData {
  hd: { ts_event: string };
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Format a Date in America/Los_Angeles */
function formatPST(date: Date) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Stream OHLCV candles from Databento */
async function* streamCandles(
  apiKey: string,
  start: string,
  end: string,
  symbol: string
) {
  const resp = await axios.get(
    'https://hist.databento.com/v0/timeseries.get_range',
    {
      params: {
        dataset: 'GLBX.MDP3',
        schema: 'ohlcv-1',
        symbols: symbol,
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
    yield JSON.parse(line) as CandleData;
  }
}

/** Main function */
async function run() {
  const apiKey = 'db-Lx5jVsQr9uMVTE7nertd3xr56SdDG';
  const symbol = 'MESM5';

  const pstStart = '2024-04-30T06:30:00-07:00';
  const pstEnd = '2024-04-30T16:15:00-07:00';
  const startUtc = new Date(pstStart).toISOString();
  const endUtc = new Date(pstEnd).toISOString();

  console.log(
    `Getting 15-min candle closes for ${symbol} on ${
      pstStart.split('T')[0]
    }...\n`
  );

  let count = 0;
  for await (const candle of streamCandles(apiKey, startUtc, endUtc, symbol)) {
    const closeTime = new Date(Number(BigInt(candle.hd.ts_event) / 1_000_000n));
    const minutes = closeTime.getMinutes();
    if (minutes % 15 === 0) {
      count++;
      console.log(
        `Candle ${count} closes at ${formatPST(
          closeTime
        )} | Close Price: ${candle.close.toFixed(2)}`
      );
    }
  }

  console.log(`\n✔ Done — processed ${count} candles.`);
}

run().catch(console.error);
