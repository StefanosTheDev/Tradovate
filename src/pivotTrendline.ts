// File: src/pivotTrendline.ts
export function checkTrendLine(
  support: boolean,
  pivot: number,
  slope: number,
  y: number[]
): number {
  const intercept = -slope * pivot + y[pivot];
  let maxDiff = -Infinity;
  let minDiff = Infinity;
  let errSum = 0;
  for (let i = 0; i < y.length; i++) {
    const lineVal = slope * i + intercept;
    const diff = lineVal - y[i];
    if (diff > maxDiff) maxDiff = diff;
    if (diff < minDiff) minDiff = diff;
    errSum += diff * diff;
  }
  if (support && maxDiff > 1e-5) return -1;
  if (!support && minDiff < -1e-5) return -1;
  return errSum;
}

export function optimizeSlope(
  support: boolean,
  pivot: number,
  initSlope: number,
  y: number[]
): { slope: number; intercept: number } {
  const n = y.length;
  const yMax = Math.max(...y);
  const yMin = Math.min(...y);
  const slopeUnit = (yMax - yMin) / n;
  let currStep = 1.0;
  const minStep = 0.0001;

  let bestSlope = initSlope;
  let bestErr = checkTrendLine(support, pivot, initSlope, y);
  if (bestErr < 0) throw new Error('Initial slope invalid');

  let derivative = 0;
  let recomputeDeriv = true;

  while (currStep > minStep) {
    if (recomputeDeriv) {
      let testSlope = bestSlope + slopeUnit * minStep;
      let testErr = checkTrendLine(support, pivot, testSlope, y);
      derivative = testErr - bestErr;
      if (testErr < 0) {
        testSlope = bestSlope - slopeUnit * minStep;
        testErr = checkTrendLine(support, pivot, testSlope, y);
        derivative = bestErr - testErr;
      }
      if (testErr < 0) throw new Error('Derivative failed');
      recomputeDeriv = false;
    }

    const testSlope =
      derivative > 0
        ? bestSlope - slopeUnit * currStep
        : bestSlope + slopeUnit * currStep;
    const testErr = checkTrendLine(support, pivot, testSlope, y);

    if (testErr < 0 || testErr >= bestErr) {
      currStep *= 0.5;
    } else {
      bestErr = testErr;
      bestSlope = testSlope;
      recomputeDeriv = true;
    }
  }

  const intercept = -bestSlope * pivot + y[pivot];
  return { slope: bestSlope, intercept };
}

export function fitTrendlinesSingle(data: number[]): {
  supportSlope: number;
  supportIntercept: number;
  resistSlope: number;
  resistIntercept: number;
} {
  const n = data.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX || 1e-12;
  const initSlope = (n * sumXY - sumX * sumY) / denom;
  const initIntercept = (sumY - initSlope * sumX) / n;

  const regress = data.map((v, i) => initSlope * i + initIntercept);
  const diffs = data.map((v, i) => v - regress[i]);
  const upperPivot = diffs.indexOf(Math.max(...diffs));
  const lowerPivot = diffs.indexOf(Math.min(...diffs));

  const sup = optimizeSlope(true, lowerPivot, initSlope, data);
  const res = optimizeSlope(false, upperPivot, initSlope, data);

  return {
    supportSlope: sup.slope,
    supportIntercept: sup.intercept,
    resistSlope: res.slope,
    resistIntercept: res.intercept,
  };
}
