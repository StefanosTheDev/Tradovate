// File: src/index.ts
import * as dotenv from 'dotenv';
import { streamOneMinuteBars } from './dataProcessor';
import { Ema } from './ema';

dotenv.config();

const API_KEY = process.env.DATABENTO_API_KEY ?? '';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';

// 1-minute bars time window (PDT)
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T07:30:00-07:00';

if (!API_KEY) {
  console.error('❌ Missing DATABENTO_API_KEY');
  process.exit(1);
}

const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();

function fmtPDT(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function Run1MinChart(): Promise<void> {
  console.log(
    `📊 Streaming ${SYMBOL} 1-min bars (${START_TIME} → ${END_TIME} PDT)`
  );
  let count = 0;

  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    true
  )) {
    console.log(
      `#${++count}`.padEnd(5) +
        `${fmtPDT(new Date(bar.timestamp))} | ` +
        `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
        `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)} | ` +
        `Vol:${bar.volume} | CVD:${bar.cvd} (${bar.cvdColor})`
    );
  }

  console.log(`✔ Finished streaming ${count} bars.`);
}

export async function Run22EMAChart(): Promise<void> {
  console.log(
    `📈 Calculating 22-EMA on 1-min bars (${START_TIME} → ${END_TIME} PDT)`
  );
  const ema = new Ema([22]);
  let count = 0;

  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    false
  )) {
    const close = bar.close;
    const [ema22] = ema.add(close);
    console.log(
      `#${++count}`.padEnd(5) +
        `${fmtPDT(new Date(bar.timestamp))} | ` +
        `Close: ${close.toFixed(2)} | ` +
        `EMA-22: ${ema22 !== null ? ema22.toFixed(2) : '---'}`
    );
  }

  console.log(`✔ Finished EMA for ${count} bars.`);
}
