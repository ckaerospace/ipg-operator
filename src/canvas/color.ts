/** Dark-background sequential map: navy → teal → lime → yellow. */
export function colorize(t: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, t));
  const stops: [number, number, number, number][] = [
    [0, 8, 18, 36],
    [0.22, 12, 58, 92],
    [0.45, 16, 140, 150],
    [0.68, 46, 230, 160],
    [0.85, 190, 240, 90],
    [1, 250, 245, 170],
  ];
  let i = 0;
  while (i < stops.length - 2 && u > stops[i + 1][0]) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const tt = (u - a[0]) / (b[0] - a[0] || 1);
  return [
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
    Math.round(a[3] + (b[3] - a[3]) * tt),
  ];
}

export function mdotStroke(t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(20 + 80 * u);
  const g = Math.round(50 + 180 * u);
  const b = Math.round(140 + 80 * u);
  return `rgb(${r},${g},${b})`;
}
