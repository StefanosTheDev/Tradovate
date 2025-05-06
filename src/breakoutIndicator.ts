// File: src/breakoutIndicator.ts
export type BreakoutSignal = 'BUY' | 'SELL' | 'HOLD';

export interface BreakoutCfg {
  windowSize: number; // number of bars for regression (default 5)
  offsetK: number; // σ-multiplier for support/resistance (default 1)
  threshold: number; // fraction above/below for breakout (e.g., 0.005 = 0.5%)
  confirmBars: number; // number of consecutive bars to confirm signal (default 1)
}

export interface BreakoutResult {
  timestamp: string; // bar timestamp
  close: number; // bar close price
  barColor: 'green' | 'red' | 'gray';
  slope: number;
  intercept: number;
  support: number;
  resistance: number;
  signal: BreakoutSignal;
  level: number | null; // support or resistance level of breakout
}

import { TrendlineIndicator } from './trendIndicator';

/**
 * Builds on TrendlineIndicator to detect breakouts by color & threshold.
 */
export class BreakoutIndicator {
  private ti: TrendlineIndicator;
  private lastSignal: BreakoutSignal = 'HOLD';
  private consecCount = 0;

  constructor(private cfg: BreakoutCfg) {
    this.ti = new TrendlineIndicator(cfg.windowSize, cfg.offsetK);
  }

  /**
   * Process a new bar: returns null until we have a trendline, then BreakoutResult each bar.
   */
  update(
    timestamp: string,
    open: number,
    close: number
  ): BreakoutResult | null {
    const trend = this.ti.update(close);
    if (!trend) return null;

    const { slope, intercept, support, resistance } = trend;
    const barColor = close > open ? 'green' : close < open ? 'red' : 'gray';
    let signal: BreakoutSignal = 'HOLD';
    let level: number | null = null;

    // detect breakout
    if (close > resistance * (1 + this.cfg.threshold) && barColor === 'green') {
      signal = 'BUY';
      level = resistance;
    } else if (
      close < support * (1 - this.cfg.threshold) &&
      barColor === 'red'
    ) {
      signal = 'SELL';
      level = support;
    }

    // consecutive confirmation
    if (signal === this.lastSignal) {
      this.consecCount++;
    } else {
      this.lastSignal = signal;
      this.consecCount = 1;
    }
    if (signal !== 'HOLD' && this.consecCount < this.cfg.confirmBars) {
      signal = 'HOLD';
      level = null;
    }

    return {
      timestamp,
      close,
      barColor,
      slope,
      intercept,
      support,
      resistance,
      signal,
      level,
    };
  }
}
