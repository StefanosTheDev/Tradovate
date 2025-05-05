// ------------------------------
// File: src/index.ts
// ------------------------------
import * as dotenv from 'dotenv';
import { streamOneMinuteBars } from './dataProcessor';

dotenv.config();

const API_KEY = process.env.DATABENTO_API_KEY ?? '';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';
// set to true if you want "Strong Up/Down" coloring
const STRONG_UP_DOWN = true; // enable "Strong Up/Down" coloring to match Tradovate pattern

// 1-minute bars for 2025-05-02 06:30→06:40 PDT
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T06:50:00-07:00';

if (!API_KEY) {
  console.error('❌ Missing DATABENTO_API_KEY');
  process.exit(1);
}

const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();

function fmtPDT(d: Date) {
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function run() {
  console.log(
    `Streaming ${SYMBOL} 1-minute bars… (${START_TIME} → ${END_TIME} PDT)`
  );
  let n = 0;
  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    STRONG_UP_DOWN
  )) {
    console.log(
      `Bar #${++n}`.padEnd(8) +
        `${fmtPDT(new Date(bar.timestamp))}  ` +
        `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
        `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)}  ` +
        `Vol:${bar.volume}  CVD:${bar.cvd} (${bar.cvdColor})`
    );
  }
  console.log(`✔ Finished — ${n} bars`);
}

run();
