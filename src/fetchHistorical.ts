// deltaBars5minPST.ts

import axios from 'axios';
import * as readline from 'node:readline';

interface MBPLevel {
  bid_sz: number;
  ask_sz: number;
}
interface MBPData {
  hd: { ts_event: string };
  levels: MBPLevel[];
}

/** Stream L1 mbp-1 ticks from Databento */
async function* streamTicks(
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
        schema: 'mbp-1',
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
    yield JSON.parse(line) as MBPData;
  }
}

/** Round timestamp down to nearest interval */
function floorTime(ts: number, intervalMs: number) {
  return Math.floor(ts / intervalMs) * intervalMs;
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
  });
}

async function run() {
  const apiKey = 'db-jwUBdE8mmvGfXWXT9rUc6c8k9sDt7';
  const symbol = 'MESM5';

  // PST session: 6:30 AM → 4:15 PM PDT on April 30, 2024
  const pstStart = '2024-04-30T06:30:00-07:00';
  const pstEnd = '2024-04-30T16:15:00-07:00';

  // convert to UTC ISO for the API
  const startUtc = new Date(pstStart).toISOString();
  const endUtc = new Date(pstEnd).toISOString();

  console.log(`Streaming ${symbol} from ${pstStart} to ${pstEnd} (PDT)…`);

  const intervalMs = 5 * 60 * 1000; // 5 minutes
  let bucketStart: number | null = null;
  let cumDelta = 0; // per-bar
  let levelTotal = 0; // running total across bars
  let barCount = 0;

  for await (const tick of streamTicks(apiKey, startUtc, endUtc, symbol)) {
    // nanosecond→millisecond
    const ms = Number(BigInt(tick.hd.ts_event) / 1_000_000n);

    // start new bucket if needed
    if (bucketStart === null) {
      bucketStart = floorTime(ms, intervalMs);
    }

    // flush any completed buckets
    while (bucketStart !== null && ms >= bucketStart + intervalMs) {
      // update running level
      levelTotal += cumDelta;

      const closeTime = new Date(bucketStart + intervalMs);
      const indicator =
        cumDelta > 0 ? 'GREEN' : cumDelta < 0 ? 'RED' : 'NEUTRAL';

      barCount++;
      console.log(
        `Bar #${barCount} closes at ${formatPST(closeTime)} | ` +
          `Δ = ${cumDelta.toLocaleString().padStart(8)} | ` +
          `Level = ${levelTotal.toLocaleString().padStart(8)} | ${indicator}`
      );

      // reset for next bar
      bucketStart += intervalMs;
      cumDelta = 0;
    }

    // accumulate this tick’s delta
    const { bid_sz, ask_sz } = tick.levels[0];
    cumDelta += bid_sz - ask_sz;
  }

  // flush final partial bar
  if (bucketStart !== null) {
    levelTotal += cumDelta;
    const closeTime = new Date(bucketStart + intervalMs);
    const indicator = cumDelta > 0 ? 'GREEN' : cumDelta < 0 ? 'RED' : 'NEUTRAL';
    barCount++;
    console.log(
      `Bar #${barCount} closes at ${formatPST(closeTime)} | ` +
        `Δ = ${cumDelta.toLocaleString().padStart(8)} | ` +
        `Level = ${levelTotal.toLocaleString().padStart(8)} | ${indicator}`
    );
  }

  console.log(
    `\n✔ Done — produced ${barCount} five-minute delta bars for ${symbol}.`
  );
}

run().catch(console.error);
