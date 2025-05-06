// File: src/ema.ts
export class Ema {
  private values: number[] = [];
  private mas: { [period: number]: number[] } = {};

  constructor(private readonly periods: number[]) {
    for (const p of periods) {
      this.mas[p] = [];
    }
  }

  /**
   * Add a new price and get updated EMA(s).
   * @param value   Latest price (e.g. bar.close)
   * @param replace If true, drop oldest value before adding (for fixed-length windows)
   * @returns       Array of EMA values aligned with this.periods; null until enough data.
   */
  add(value: number, replace = false): (number | null)[] {
    if (replace && this.values.length) this.values.shift();
    this.values.unshift(value);

    const results: (number | null)[] = [];
    const len = this.values.length;

    for (const p of this.periods) {
      if (len >= p) {
        // initial EMA = SMA of first p values
        const prevEma = this.mas[p].length
          ? this.mas[p][0]
          : this.values.slice(0, p).reduce((a, b) => a + b, 0) / p;

        const mult = 2 / (p + 1);
        const ema = (value - prevEma) * mult + prevEma;

        if (replace && this.mas[p].length) this.mas[p].shift();
        this.mas[p].unshift(ema);
        results.push(ema);
      } else {
        results.push(null);
      }
    }

    return results;
  }
}
