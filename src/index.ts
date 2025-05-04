// File: src/index.ts
import * as dotenv from 'dotenv';
import { stream1000TickBars, TickBar } from './dataProcessor';

// Load environment variables
dotenv.config();

/**
 * ------------------------------
 * CONFIG SECTION
 * ------------------------------
 * Change these four constants if you want a different dataset / schema / symbol.
 */
const API_KEY = process.env.DATABENTO_API_KEY ?? 'db-';
const SYMBOL = 'MESM5'; // Micro E‑mini S&P, June‑25 contract
const DATASET = 'GLBX.MDP3'; // CME Globex MDP 3.0 historical feed  // CME Market‑Printer (trade‑print) historical feed
const SCHEMA = 'trades'; // Trade prints schema

// Trading session: May 2 2025, 06:30 AM → 06:40 PM PDT
const START_TIME = '2025-05-02T06:30:00-07:00';
// First 10 minutes of the session — 06:30 → 06:40 PDT
const END_TIME = '2025-05-02T06:40:00-07:00';

// Abort early if key missing
if (!API_KEY) {
  console.error(
    '❌  DATABENTO_API_KEY is empty or missing. Export it in your shell or .env file.'
  );
  process.exit(1);
}

/** Utility */
const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();
const START_MS = Date.parse(START_UTC);
const END_MS = Date.parse(END_UTC);
function fmtPDT(d: Date) {
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Main driver */
async function run() {
  console.log(`Streaming ${SYMBOL} (${DATASET}/${SCHEMA}) 1 000‑trade bars…`);

  let barCount = 0;
  try {
    for await (const bar of stream1000TickBars(
      API_KEY,
      DATASET,
      SCHEMA,
      START_UTC,
      END_UTC,
      SYMBOL
    )) {
      const ms = Date.parse(bar.timestamp);
      if (ms < START_MS || ms > END_MS) continue; // filter

      barCount++;
      console.log(
        `Bar #${barCount}`.padEnd(10) +
          `Time: ${fmtPDT(new Date(ms))} | ` +
          `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
          `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)} ` +
          `Vol:${bar.volume} CVD:${bar.cvd.toFixed(0)} (${bar.cvdColor})`
      );
    }
    console.log(`\n✔ Printed ${barCount} bars`);
  } catch (err: any) {
    console.error('⛔  Stream error:\n', err.message);
  }
}

run();
