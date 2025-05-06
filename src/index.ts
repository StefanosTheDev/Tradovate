// File: src/index.ts
import * as dotenv from 'dotenv';
import { streamOneMinuteBars } from './dataProcessor';
import { Ema } from './ema';
import {
  BreakoutIndicator,
  BreakoutCfg,
  BreakoutResult,
} from './breakoutIndicator';

dotenv.config();
const API_KEY = process.env.DATABENTO_API_KEY ?? '';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';
// Example window: May 2, 2025, 06:30–07:30 PDT
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

type Logger = (msg: string) => void;

/**
 * Stream raw 1-minute bars: O, H, L, C, Vol, CVD, color
 */
export async function Run1MinChart(
  logger: Logger = console.log
): Promise<void> {
  logger(`📊 Streaming ${SYMBOL} 1-min bars (${START_TIME} → ${END_TIME} PDT)`);
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
    logger(
      `#${++count}`.padEnd(4) +
        `${fmtPDT(new Date(bar.timestamp))} | ` +
        `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
        `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)} | ` +
        `Vol:${bar.volume} | CVD:${bar.cvd} (${bar.cvdColor})`
    );
  }
  logger(`✔ Finished streaming ${count} bars.`);
}

/**
 * Stream 22-period EMA over 1-min closes
 */
export async function Run22EMAChart(
  logger: Logger = console.log
): Promise<void> {
  logger(`📈 Streaming 22-EMA (${START_TIME} → ${END_TIME} PDT)`);
  const emaCalc = new Ema([22]);
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
    const [ema22] = emaCalc.add(bar.close);
    logger(
      `#${++count}`.padEnd(4) +
        `${fmtPDT(new Date(bar.timestamp))} | Close:${bar.close.toFixed(
          2
        )} | ` +
        `EMA-22:${ema22 !== null ? ema22.toFixed(2) : '---'}`
    );
  }
  logger(`✔ Finished EMA for ${count} bars.`);
}

/**
 * Run breakout detection using cumulative delta trendline
 */
export async function RunBreakouts(
  logger: Logger = console.log,
  cfg: BreakoutCfg = { windowSize: 5, offsetK: 0, threshold: 0, confirmBars: 1 }
): Promise<void> {
  logger(
    `🔔 Breakout detection (window=${cfg.windowSize}, thresh=${
      cfg.threshold * 100
    }%, confirm=${cfg.confirmBars})`
  );
  const bi = new BreakoutIndicator(cfg);
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
    const time = fmtPDT(new Date(bar.timestamp));
    const res: BreakoutResult | null = bi.update(time, bar.open, bar.close);
    if (!res) {
      logger(
        `#${++count}`.padEnd(4) +
          `${time} | Close:${bar.close.toFixed(2)} | waiting...`
      );
    } else {
      const { signal, level } = res;
      logger(
        `#${++count}`.padEnd(4) +
          `${time} | Close:${bar.close.toFixed(2)} ` +
          `Signal:${signal}` +
          (signal !== 'HOLD' ? `@${level!.toFixed(2)}` : '')
      );
    }
  }
  logger(`✔ Breakout stream complete (${count} bars)`);
}
