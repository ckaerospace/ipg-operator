export type Pt = { x: number; y: number };

/** Tap vs pan: movement under this still places the Plume station / Map cursor. */
export const PAN_SLOP_PX = 8;

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

/**
 * Tracks 1- vs 2-finger plot gestures.
 * One finger: tap until PAN_SLOP_PX, then drag. Two fingers: pinch/zoom.
 */
export class PlotTouch {
  readonly pointers = new Map<number, Pt>();
  pinchOrigin: { mid: Pt; dist: number } | null = null;
  origin: Pt | null = null;
  last: Pt | null = null;
  dragged = false;
  private one = false;
  private skipOne = false;

  get count(): number {
    return this.pointers.size;
  }

  pair(): [Pt, Pt] | null {
    if (this.pointers.size < 2) return null;
    const [a, b] = this.pointers.values();
    return [a, b];
  }

  down(id: number, pt: Pt): "one" | "pinch" {
    this.pointers.set(id, pt);
    this.last = pt;
    if (this.pointers.size === 1) {
      this.origin = pt;
      this.dragged = false;
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

  move(id: number, pt: Pt): "one" | "drag" | "pinch" | "none" {
    this.pointers.set(id, pt);
    this.last = pt;
    if (this.pointers.size >= 2) return "pinch";
    if (this.one && !this.skipOne) {
      if (this.origin && Math.hypot(pt.x - this.origin.x, pt.y - this.origin.y) >= PAN_SLOP_PX) {
        this.dragged = true;
      }
      return this.dragged ? "drag" : "one";
    }
    return "none";
  }

  up(id: number, pt: Pt): "tap" | "end" {
    const tap = this.pointers.size === 1 && this.one && !this.skipOne && !this.dragged;
    this.pointers.delete(id);
    this.last = pt;
    if (this.pointers.size < 2) this.pinchOrigin = null;
    if (this.pointers.size === 0) {
      this.one = false;
      this.skipOne = false;
      this.origin = null;
      this.dragged = false;
    }
    return tap ? "tap" : "end";
  }

  cancel(): void {
    this.pointers.clear();
    this.pinchOrigin = null;
    this.origin = null;
    this.last = null;
    this.dragged = false;
    this.one = false;
    this.skipOne = false;
  }
}
