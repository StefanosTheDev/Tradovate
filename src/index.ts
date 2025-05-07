// File: src/index.ts
import * as dotenv from 'dotenv';
import { streamOneMinuteBars } from './dataProcessor';
import { Ema } from './ema';
import { fitTrendlinesSingle } from './pivotTrendline';
import { BreakoutIndicator, BreakoutCfg } from './breakoutIndicator';

dotenv.config();
const API_KEY = process.env.DATABENTO_API_KEY!;
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T07:30:00-07:00';
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

type Logger = (msg: string) => void;

export async function Run1MinChart(logger: Logger = console.log) {
  logger(`📊 Streaming 1-min MESM5 bars`);
  let i = 0;
  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    true
  )) {
    const t = fmtPDT(new Date(bar.timestamp));
    logger(
      `#${++i}`.padEnd(4) +
        `${t} | O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
        `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)} ` +
        `Vol:${bar.volume} CVD:${bar.cvd} Color:${bar.cvdColor}`
    );
  }
  logger(`✔ 1-min stream done`);
}

export async function Run22EMAChart(logger: Logger = console.log) {
  logger(`📈 Streaming EMA-22 on 1-min closes`);
  const emaCalc = new Ema([22]);
  let i = 0;
  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    false
  )) {
    const [ema] = emaCalc.add(bar.close);
    const t = fmtPDT(new Date(bar.timestamp));
    logger(
      `#${++i}`.padEnd(4) +
        `${t} | Close:${bar.close.toFixed(2)} EMA-22:${
          ema?.toFixed(2) ?? '---'
        }`
    );
  }
  logger(`✔ EMA-22 stream done`);
}

export async function RunBreakouts(
  logger: Logger = console.log,
  cfg: BreakoutCfg = { windowSize: 5, threshold: 0, confirmBars: 1 }
) {
  logger(`🔔 Pivot breakouts (window=${cfg.windowSize})`);
  const bi = new BreakoutIndicator(cfg);
  let i = 0;
  const closes: number[] = [];
  for await (const bar of streamOneMinuteBars(
    API_KEY,
    DATASET,
    SCHEMA,
    START_UTC,
    END_UTC,
    SYMBOL,
    false
  )) {
    closes.push(bar.close);
    if (closes.length > cfg.windowSize) closes.shift();

    let out = 'waiting...';
    if (closes.length === cfg.windowSize) {
      const { supportSlope, supportIntercept, resistSlope, resistIntercept } =
        fitTrendlinesSingle(closes);
      out = bi.step(
        bar.close,
        bar.open,
        supportSlope,
        supportIntercept,
        resistSlope,
        resistIntercept
      );
    }
    const t = fmtPDT(new Date(bar.timestamp));
    logger(
      `#${++i}`.padEnd(4) + `${t} | Close:${bar.close.toFixed(2)} Signal:${out}`
    );
  }
  logger(`✔ Breakout stream done (${i} bars)`);
}
