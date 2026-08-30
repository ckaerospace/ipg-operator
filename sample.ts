export function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function sample1d(xs: number[], ys: number[], x: number): number {
  if (xs.length === 0) return NaN;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = lowerBound(xs, x);
  if (i <= 0) return ys[0];
  const x0 = xs[i - 1];
  const x1 = xs[i];
  const t = (x - x0) / (x1 - x0 || 1);
  return ys[i - 1] * (1 - t) + ys[i] * t;
}

/** Row-major grid: index = j * nx + i, xs along x, ys along y. */
export function sampleGrid(
  field: number[],
  nx: number,
  ny: number,
  xs: number[],
  ys: number[],
  x: number,
  y: number,
): number {
  if (xs.length < 2 || ys.length < 2) return NaN;
  if (x < xs[0] || x > xs[nx - 1] || y < ys[0] || y > ys[ny - 1]) return NaN;
  let i = lowerBound(xs, x);
  let j = lowerBound(ys, y);
  if (i < 1) i = 1;
  if (j < 1) j = 1;
  if (i > nx - 1) i = nx - 1;
  if (j > ny - 1) j = ny - 1;
  const i0 = i - 1;
  const j0 = j - 1;
  const tx = (x - xs[i0]) / (xs[i] - xs[i0] || 1);
  const ty = (y - ys[j0]) / (ys[j] - ys[j0] || 1);
  const a = field[j0 * nx + i0];
  const b = field[j0 * nx + i];
  const c = field[j * nx + i0];
  const d = field[j * nx + i];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
