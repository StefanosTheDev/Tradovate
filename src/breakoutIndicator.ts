// File: src/breakoutIndicator.ts
export interface BreakoutCfg {
  windowSize: number;
  threshold: number; // e.g. 0 = immediate, 0.001 = 0.1%
  confirmBars: number; // consecutive confirmations
}

export class BreakoutIndicator {
  private closes: number[] = [];
  private lastSignals: string[] = [];
  constructor(private cfg: BreakoutCfg) {}

  /**
   * @param close   bar close
   * @param open    bar open
   * @param mS, bS  support slope/intercept
   * @param mR, bR  resistance slope/intercept
   */
  step(
    close: number,
    open: number,
    mS: number,
    bS: number,
    mR: number,
    bR: number
  ): string {
    const x = this.cfg.windowSize - 1;
    const sup = mS * x + bS;
    const res = mR * x + bR;
    let sig: string;
    const isGreen = close > open;
    if (isGreen && close > res * (1 + this.cfg.threshold)) sig = 'BUY';
    else if (!isGreen && close < sup * (1 - this.cfg.threshold)) sig = 'SELL';
    else sig = 'HOLD';

    this.lastSignals.push(sig);
    if (this.lastSignals.length > this.cfg.confirmBars)
      this.lastSignals.shift();

    if (
      this.lastSignals.length === this.cfg.confirmBars &&
      this.lastSignals.every((s) => s === sig)
    )
      return sig;
    return 'HOLD';
  }
}
