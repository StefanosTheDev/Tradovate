// File: src/trendIndicator.ts
export interface Trendline {
  slope: number;
  intercept: number;
  support: number;
  resistance: number;
}

export class TrendlineIndicator {
  private closes: number[] = [];

  /**
   * @param windowSize  Number of bars for regression (default 5)
   * @param offsetK     σ-multiplier for support/resistance (default 1)
   */
  constructor(
    private readonly windowSize: number = 5,
    private readonly offsetK: number = 1
  ) {}

  /** Feed a new close; returns Trendline once enough data, else null */
  update(close: number): Trendline | null {
    this.closes.push(close);
    if (this.closes.length < this.windowSize) {
      return null;
    }
    // keep only windowSize closes
    if (this.closes.length > this.windowSize) {
      this.closes.shift();
    }

    const N = this.windowSize;
    // x = 0..N-1
    // compute sums
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    for (let i = 0; i < N; i++) {
      const x = i;
      const y = this.closes[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }
    // slope (m) and intercept (b)
    const m = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / N;

    // predicted at x = N-1 (current bar)
    const yhat = m * (N - 1) + b;

    // compute standard deviation of closes
    const mean = sumY / N;
    let varSum = 0;
    for (let y of this.closes) {
      varSum += (y - mean) * (y - mean);
    }
    const sigma = Math.sqrt(varSum / N);

    const support = yhat - this.offsetK * sigma;
    const resistance = yhat + this.offsetK * sigma;

    return { slope: m, intercept: b, support, resistance };
  }
}
