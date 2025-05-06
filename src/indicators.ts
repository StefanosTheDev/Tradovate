// File: src/indicators.ts

import { MinuteBar } from './dataProcessor';

export interface StrategyBar extends MinuteBar {
  ema22: number;
  trendSlope: number;
  support5: number;
  resistance5: number;
}

/**
 * Compute 22-period EMA on an array of closes.
 */
export function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  // seed with SMA of first 'period' closes
  const sma = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  ema.push(sma);
  // subsequent EMAs
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

/**
 * Linear regression slope over last N values.
 */
export function calcSlope(values: number[], period: number): number {
  const slice = values.slice(-period);
  const n = slice.length;
  if (n < period) return 0;
  const xSum = ((period - 1) * period) / 2;
  const ySum = slice.reduce((sum, v) => sum + v, 0);
  const xySum = slice.reduce((sum, v, i) => sum + i * v, 0);
  const x2Sum = ((period - 1) * period * (2 * period - 1)) / 6;
  return (period * xySum - xSum * ySum) / (period * x2Sum - xSum * xSum);
}

/**
 * Compute support/resistance over the previous `lookback` bars (excluding current bar).
 */
export function calcSupportResistance(
  bars: MinuteBar[],
  lookback: number
): { support: number; resistance: number } {
  if (bars.length < lookback + 1) {
    return { support: Infinity, resistance: -Infinity };
  }
  const subset = bars.slice(-lookback - 1, -1);
  const lows = subset.map((b) => b.low);
  const highs = subset.map((b) => b.high);
  return {
    support: Math.min(...lows),
    resistance: Math.max(...highs),
  };
}

/**
 * Given raw TickBars, compute and return StrategyBars
 * with EMA22, trendSlope, support5, and resistance5 attached.
 */
export function applyIndicators(rawBars: MinuteBar[]): StrategyBar[] {
  const closes = rawBars.map((b) => b.close);
  const highs = rawBars.map((b) => b.high);
  const lows = rawBars.map((b) => b.low);

  // Compute full EMA22 array
  const ema22Arr = calcEMA(closes, 22);

  return rawBars.map((bar, idx) => {
    const ema22 = idx >= 21 ? ema22Arr[idx - 21] : NaN;
    const slopeHigh = idx >= 9 ? calcSlope(highs.slice(0, idx + 1), 10) : 0;
    const slopeLow = idx >= 9 ? calcSlope(lows.slice(0, idx + 1), 10) : 0;
    const trendSlope = (slopeHigh + slopeLow) / 2;

    const { support, resistance } = calcSupportResistance(
      rawBars.slice(0, idx + 1),
      5
    );

    return {
      ...bar,
      ema22,
      trendSlope,
      support5: support,
      resistance5: resistance,
    };
  });
}
