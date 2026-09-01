export type Pt = { x: number; y: number };

export function cssPoint(e: { clientX: number; clientY: number }, el: HTMLElement): Pt {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function pairStats(a: Pt, b: Pt): { mid: Pt; dist: number } {
  return {
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    dist: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1e-3),
  };
}

export function wheelScale(deltaY: number): number {
  return Math.exp(-deltaY * 0.0016);
}

/** Tracks 1- vs 2-finger plot gestures. One finger is pick; two is pinch/pan. */
export class PlotTouch {
  readonly pointers = new Map<number, Pt>();
  pinchOrigin: { mid: Pt; dist: number } | null = null;
  private one = false;
  private skipOne = false;
  private lastTap: { t: number; x: number; y: number } | null = null;

  get count(): number {
    return this.pointers.size;
  }

  pair(): [Pt, Pt] | null {
    if (this.pointers.size < 2) return null;
    const [a, b] = this.pointers.values();
    return [a, b];
  }

  down(id: number, pt: Pt, now = performance.now()): "double" | "one" | "pinch" {
    this.pointers.set(id, pt);
    if (this.pointers.size === 1) {
      if (
        this.lastTap &&
        now - this.lastTap.t < 340 &&
        Math.hypot(pt.x - this.lastTap.x, pt.y - this.lastTap.y) < 32
      ) {
        this.lastTap = null;
        this.skipOne = true;
        this.one = false;
        return "double";
      }
      this.one = true;
      this.skipOne = false;
      return "one";
    }
    this.one = false;
    this.skipOne = true;
    const pair = this.pair();
    this.pinchOrigin = pair ? pairStats(pair[0], pair[1]) : null;
    return "pinch";
  }

  move(id: number, pt: Pt): "one" | "pinch" | "none" {
    this.pointers.set(id, pt);
    if (this.pointers.size >= 2) return "pinch";
    if (this.one && !this.skipOne) return "one";
    return "none";
  }

  up(id: number, pt: Pt, now = performance.now()): void {
    this.pointers.delete(id);
    if (this.pointers.size < 2) this.pinchOrigin = null;
    if (this.pointers.size === 0) {
      if (this.one && !this.skipOne) this.lastTap = { t: now, x: pt.x, y: pt.y };
      this.one = false;
      this.skipOne = false;
    }
  }

  cancel(): void {
    this.pointers.clear();
    this.pinchOrigin = null;
    this.one = false;
    this.skipOne = false;
  }
}
