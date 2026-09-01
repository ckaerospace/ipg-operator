export type RectView = { x0: number; x1: number; y0: number; y1: number };
export type Pt = { x: number; y: number };

export function viewsClose(a: RectView, b: RectView, eps = 1e-7): boolean {
  return (
    Math.abs(a.x0 - b.x0) <= eps &&
    Math.abs(a.x1 - b.x1) <= eps &&
    Math.abs(a.y0 - b.y0) <= eps &&
    Math.abs(a.y1 - b.y1) <= eps
  );
}

export function viewSpanX(v: RectView): number {
  return v.x1 - v.x0;
}

export function viewSpanY(v: RectView): number {
  return v.y1 - v.y0;
}

/** Smallest isotropic window: 8 mm or 2% of the fitted span, whichever is larger. */
export function isoMinSpan(bounds: RectView): number {
  const span = Math.max(viewSpanX(bounds), viewSpanY(bounds));
  return Math.max(0.008, span * 0.02);
}

export function zoomIsoAbout(view: RectView, focus: Pt, scale: number): RectView {
  const span = Math.max(viewSpanX(view), viewSpanY(view), 1e-12);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const next = span / s;
  const tx = (focus.x - view.x0) / span;
  const ty = (focus.y - view.y0) / span;
  return {
    x0: focus.x - tx * next,
    x1: focus.x + (1 - tx) * next,
    y0: focus.y - ty * next,
    y1: focus.y + (1 - ty) * next,
  };
}

/** Square window inside `bounds`. Cannot grow past bounds or shrink below `minSpan`. */
export function clampIsoView(view: RectView, bounds: RectView, minSpan: number): RectView {
  const maxSpan = Math.max(viewSpanX(bounds), viewSpanY(bounds), minSpan);
  const lo = Math.min(minSpan, maxSpan);
  let span = Math.max(viewSpanX(view), viewSpanY(view));
  span = Math.min(maxSpan, Math.max(lo, span));
  let x0 = (view.x0 + view.x1) / 2 - span / 2;
  let y0 = (view.y0 + view.y1) / 2 - span / 2;
  if (x0 < bounds.x0) x0 = bounds.x0;
  if (x0 + span > bounds.x1) x0 = bounds.x1 - span;
  if (y0 < bounds.y0) y0 = bounds.y0;
  if (y0 + span > bounds.y1) y0 = bounds.y1 - span;
  return { x0, x1: x0 + span, y0, y1: y0 + span };
}

export function zoomRectAbout(view: RectView, focus: Pt, scale: number): RectView {
  const sx = Math.max(viewSpanX(view), 1e-12);
  const sy = Math.max(viewSpanY(view), 1e-12);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const nx = sx / s;
  const ny = sy / s;
  const tx = (focus.x - view.x0) / sx;
  const ty = (focus.y - view.y0) / sy;
  return {
    x0: focus.x - tx * nx,
    x1: focus.x + (1 - tx) * nx,
    y0: focus.y - ty * ny,
    y1: focus.y + (1 - ty) * ny,
  };
}

export function clampRectView(
  view: RectView,
  bounds: RectView,
  minSpanX: number,
  minSpanY: number,
): RectView {
  const maxX = Math.max(viewSpanX(bounds), minSpanX);
  const maxY = Math.max(viewSpanY(bounds), minSpanY);
  const sx = Math.min(maxX, Math.max(Math.min(minSpanX, maxX), viewSpanX(view)));
  const sy = Math.min(maxY, Math.max(Math.min(minSpanY, maxY), viewSpanY(view)));
  let x0 = (view.x0 + view.x1) / 2 - sx / 2;
  let y0 = (view.y0 + view.y1) / 2 - sy / 2;
  if (x0 < bounds.x0) x0 = bounds.x0;
  if (x0 + sx > bounds.x1) x0 = bounds.x1 - sx;
  if (y0 < bounds.y0) y0 = bounds.y0;
  if (y0 + sy > bounds.y1) y0 = bounds.y1 - sy;
  return { x0, x1: x0 + sx, y0, y1: y0 + sy };
}

export function shiftView(view: RectView, dx: number, dy: number): RectView {
  return { x0: view.x0 - dx, x1: view.x1 - dx, y0: view.y0 - dy, y1: view.y1 - dy };
}

export function rectMinSpans(bounds: RectView, frac = 0.02): { minX: number; minY: number } {
  return {
    minX: Math.max(viewSpanX(bounds) * frac, 1e-6),
    minY: Math.max(viewSpanY(bounds) * frac, 1e-6),
  };
}

export function pinchFocusShift(
  zoomed: RectView,
  focus: Pt,
  nowWorld: Pt,
): RectView {
  return shiftView(zoomed, nowWorld.x - focus.x, nowWorld.y - focus.y);
}
