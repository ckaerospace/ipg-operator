import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import {
  axesView,
  drawCharacteristics,
  drawComposition,
  mapReadout,
  mapToRect,
  pinchMapView,
  wheelMapView,
  type MapLayout,
  type MapView,
} from "../canvas/map";
import { viewsClose } from "../canvas/viewZoom";
import type { AxisFamily, PinjUnit } from "../facility";
import { fmtMdot, fmtPinjUnit, fmtPower, moleLabel } from "../format";
import { PinjUnitChips } from "./PinjUnitChips";
import { cssPoint, pairStats, PlotTouch, wheelScale } from "../gestures/plotTouch";
import type { CharacteristicsResponse } from "../types";

type Props = {
  visible: boolean;
  status: "idle" | "loading" | "ready" | "updating" | "error";
  error: string | null;
  waking: boolean;
  ch: CharacteristicsResponse | null;
  family: AxisFamily;
  facility: string;
  initialPinj: number;
  initialHinj: number;
  pinjUnit: PinjUnit;
  onPinjUnit: (u: PinjUnit) => void;
  onRunPoint: (pinj: number, hinj: number) => void;
};

export function MapTab({
  visible,
  status,
  error,
  waking,
  ch,
  family,
  facility,
  initialPinj,
  initialHinj,
  pinjUnit,
  onPinjUnit,
  onRunPoint,
}: Props) {
  const plotRef = useRef<HTMLCanvasElement>(null);
  const plotWrap = useRef<HTMLDivElement>(null);
  const compRef = useRef<HTMLCanvasElement>(null);
  const compWrap = useRef<HTMLDivElement>(null);
  const layRef = useRef<MapLayout | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const fittedRef = useRef<MapView | null>(null);
  const pinchView = useRef<MapView | null>(null);
  const touch = useRef(new PlotTouch());
  const paintRef = useRef<() => void>(() => {});
  const [cursor, setCursor] = useState({ pinj: initialPinj, hinj: initialHinj });
  const [zoomed, setZoomed] = useState(false);
  const cursorRef = useRef(cursor);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (!ch) return;
    const fitted = axesView(ch, family);
    fittedRef.current = fitted;
    viewRef.current = fitted;
    pinchView.current = null;
    setZoomed(false);
  }, [ch, family]);

  useEffect(() => {
    if (!visible) return;
    const plot = plotRef.current;
    const wrap = plotWrap.current;
    const cc = compRef.current;
    const cw = compWrap.current;
    if (!plot || !wrap) return;

    const fit = (canvas: HTMLCanvasElement, el: HTMLElement) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = el.clientWidth;
      const h = el.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };

    const paint = () => {
      if (!ch) return;
      if (wrap.clientWidth < 2 || wrap.clientHeight < 2) return;
      if (!viewRef.current) viewRef.current = axesView(ch, family);
      fit(plot, wrap);
      const ctx = plot.getContext("2d");
      if (!ctx) return;
      const dpr = plot.width / Math.max(1, wrap.clientWidth);
      const marks =
        facility === "IPG6-S"
          ? [
              { pinj: 100, hinj: 15, label: "①" },
              { pinj: 100, hinj: 23, label: "②" },
              { pinj: 100, hinj: 30, label: "③" },
            ]
          : undefined;
      layRef.current = drawCharacteristics({
        ctx,
        cssW: wrap.clientWidth,
        cssH: wrap.clientHeight,
        dpr,
        ch,
        family,
        cursor: cursorRef.current,
        marks,
        view: viewRef.current,
        pinjUnit,
      });
      if (cc && cw) {
        fit(cc, cw);
        const cctx = cc.getContext("2d");
        if (cctx) {
          drawComposition({
            ctx: cctx,
            cssW: cw.clientWidth,
            cssH: cw.clientHeight,
            dpr: cc.width / Math.max(1, cw.clientWidth),
            ch,
            hinjMark: cursorRef.current.hinj,
          });
        }
      }
    };

    paintRef.current = paint;
    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    if (cw) ro.observe(cw);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fitted = fittedRef.current;
      const view = viewRef.current;
      if (!fitted || !view) return;
      viewRef.current = wheelMapView(
        view,
        wrap.clientWidth,
        wrap.clientHeight,
        { x: e.offsetX, y: e.offsetY },
        wheelScale(e.deltaY),
        fitted,
      );
      setZoomed(!viewsClose(mapToRect(viewRef.current), mapToRect(fitted)));
      paint();
    };
    plot.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      plot.removeEventListener("wheel", onWheel);
    };
  }, [visible, ch, family, facility, cursor, pinjUnit]);

  const moveCursor = (e: PE<HTMLCanvasElement>) => {
    const lay = layRef.current;
    const plot = plotRef.current;
    if (!lay || !plot || !ch) return;
    const r = plot.getBoundingClientRect();
    const view = viewRef.current ?? axesView(ch, family);
    const pinj = Math.min(view.p1, Math.max(view.p0, lay.fromP(e.clientX - r.left)));
    const hinj = Math.min(view.h1, Math.max(view.h0, lay.fromH(e.clientY - r.top)));
    setCursor({ pinj, hinj });
  };

  const applyPinch = () => {
    const pair = touch.current.pair();
    const origin = touch.current.pinchOrigin;
    const start = pinchView.current;
    const fitted = fittedRef.current;
    const wrap = plotWrap.current;
    if (!pair || !origin || !start || !fitted || !wrap) return;
    const now = pairStats(pair[0], pair[1]);
    viewRef.current = pinchMapView(
      start,
      wrap.clientWidth,
      wrap.clientHeight,
      origin.mid,
      origin.dist,
      now.mid,
      now.dist,
      fitted,
    );
    setZoomed(!viewsClose(mapToRect(viewRef.current), mapToRect(fitted)));
    paintRef.current();
  };

  const resetView = () => {
    if (fittedRef.current) viewRef.current = fittedRef.current;
    pinchView.current = null;
    setZoomed(false);
    paintRef.current();
  };

  const onDown = (e: PE<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = cssPoint(e, e.currentTarget);
    const kind = touch.current.down(e.pointerId, pt);
    if (kind === "double") {
      resetView();
      return;
    }
    if (kind === "pinch") {
      pinchView.current = viewRef.current ? { ...viewRef.current } : null;
      applyPinch();
      return;
    }
    moveCursor(e);
  };

  const onMove = (e: PE<HTMLCanvasElement>) => {
    const pt = cssPoint(e, e.currentTarget);
    const kind = touch.current.move(e.pointerId, pt);
    if (kind === "pinch") {
      if (!pinchView.current && viewRef.current) pinchView.current = { ...viewRef.current };
      applyPinch();
      return;
    }
    if (kind === "one") moveCursor(e);
  };

  const onUp = (e: PE<HTMLCanvasElement>) => {
    touch.current.up(e.pointerId, cssPoint(e, e.currentTarget));
    if (touch.current.count < 2) pinchView.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const readout = ch ? mapReadout(ch, cursor.pinj, cursor.hinj) : null;
  const majors = readout?.xs.filter((s) => s.x >= 0.02).slice(0, 4) ?? [];

  if (status === "updating") {
    return (
      <div className="center-msg">
        Map updating
        <div>Keep ṁ and pinj on Setup. Characteristics are not available from this server yet.</div>
      </div>
    );
  }
  if (status === "loading" || (status === "idle" && !ch)) {
    return (
      <div className="center-msg">
        <div className="spin" />
        {waking ? "waking chemistry server" : "Loading characteristics…"}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="center-msg">
        {waking ? "waking chemistry server" : error || "Characteristics failed"}
      </div>
    );
  }
  if (!ch) {
    return (
      <div className="center-msg">
        <div className="spin" />
        {waking ? "waking chemistry server" : "Loading characteristics…"}
      </div>
    );
  }

  return (
    <>
      <div className="map-unit-bar">
        <PinjUnitChips unit={pinjUnit} onChange={onPinjUnit} />
      </div>
      <div className="map-plot" ref={plotWrap}>
        <canvas
          ref={plotRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {zoomed && (
          <button type="button" className="plot-reset" onClick={resetView}>
            Reset
          </button>
        )}
      </div>
      <div className="map-read">
        {fmtPinjUnit(cursor.pinj, pinjUnit)} · {cursor.hinj.toFixed(1)} MJ/kg · {fmtMdot(readout?.mdot_mg_s ?? 0, family)} ·{" "}
        {fmtPower(readout?.power_W ?? 0)}
        {majors.length > 0 ? " · " : ""}
        {majors.map((s) => `${moleLabel(s.key)} ${s.x.toFixed(2)}`).join("  ")}
      </div>
      <div className="comp-wrap" ref={compWrap}>
        <canvas ref={compRef} />
      </div>
      <div className="map-act">
        <button onClick={() => onRunPoint(cursor.pinj, cursor.hinj)}>Run this point</button>
      </div>
    </>
  );
}
