// File: src/emaCalculator.ts

import * as dotenv from 'dotenv';
import { streamOneMinuteBars, MinuteBar } from './dataProcessor';
import { calcEMA } from './indicators';

dotenv.config();

// ==== CONFIG =====
const API_KEY =
  process.env.DATABENTO_API_KEY ?? 'db-7qYPBtxmxSWbmEXaXdffVLipnKdt4';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';

// Session window (PDT)
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T12:45:00-07:00';

if (!API_KEY) {
  console.error('❌ Missing DATABENTO_API_KEY');
  process.exit(1);
}

const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();

/**
 * Standalone EMA calculator on 1-minute bars.
 * - Streams minute bars from the dataProcessor
 * - Gathers all closes, computes 22-period EMA
 * - Prints timestamp + EMA for each minute starting at the 22nd bar
 */
async function runEMA() {
  console.log(
    `Calculating 22-period EMA on 1-minute bars for ${SYMBOL} (${START_TIME}→${END_TIME} PT)…`
  );

  const closes: number[] = [];
  const timestamps: string[] = [];

  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL
  )) {
    closes.push(bar.close);
    timestamps.push(bar.timestamp);
  }

  if (closes.length < 22) {
    console.error('Not enough data to compute 22-period EMA (<22 bars).');
    return;
  }

  const emaArr = calcEMA(closes, 22);

  // emaArr[0] corresponds to closes[21]
  console.log('Time                     | Close    | EMA22');
  console.log('-------------------------|----------|--------------');
  for (let i = 0; i < emaArr.length; i++) {
    const idx = i + 22 - 1;
    const ts = new Date(timestamps[idx]).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: false,
    });
    console.log(
      `${ts.padEnd(25)} | ${closes[idx].toFixed(2).padStart(8)} | ${emaArr[
        i
      ].toFixed(6)}`
    );
  }
}

runEMA().catch((err) => console.error(err));
