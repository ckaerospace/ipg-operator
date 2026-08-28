import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { drawCharacteristics, drawComposition, mapReadout, type MapLayout } from "../canvas/map";
import type { AxisFamily } from "../facility";
import { fmtMdot, fmtPinj, fmtPower, moleLabel } from "../format";
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
  onRunPoint,
}: Props) {
  const plotRef = useRef<HTMLCanvasElement>(null);
  const plotWrap = useRef<HTMLDivElement>(null);
  const compRef = useRef<HTMLCanvasElement>(null);
  const compWrap = useRef<HTMLDivElement>(null);
  const layRef = useRef<MapLayout | null>(null);
  const drag = useRef(false);
  const [cursor, setCursor] = useState({ pinj: initialPinj, hinj: initialHinj });
  const cursorRef = useRef(cursor);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

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

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    if (cw) ro.observe(cw);
    return () => ro.disconnect();
  }, [visible, ch, family, facility, cursor]);

  const moveCursor = (e: PE<HTMLCanvasElement>) => {
    const lay = layRef.current;
    const plot = plotRef.current;
    if (!lay || !plot || !ch) return;
    const r = plot.getBoundingClientRect();
    const [p0, p1] = ch.axes.pinj_Pa;
    const [h0, h1] = ch.axes.hinj_MJ_kg;
    const pinj = Math.min(p1, Math.max(p0, lay.fromP(e.clientX - r.left)));
    const hinj = Math.min(h1, Math.max(h0, lay.fromH(e.clientY - r.top)));
    setCursor({ pinj, hinj });
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
      <div className="map-plot" ref={plotWrap}>
        <canvas
          ref={plotRef}
          onPointerDown={(e) => {
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveCursor(e);
          }}
          onPointerMove={(e) => {
            if (drag.current) moveCursor(e);
          }}
          onPointerUp={() => {
            drag.current = false;
          }}
        />
      </div>
      <div className="map-read">
        {fmtPinj(cursor.pinj)} · {cursor.hinj.toFixed(1)} MJ/kg · {fmtMdot(readout?.mdot_mg_s ?? 0, family)} ·{" "}
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
