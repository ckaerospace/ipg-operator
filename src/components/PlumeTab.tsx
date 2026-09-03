import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import {
  drawPlumeFrame,
  emptyView,
  fitView,
  pinchPlumeView,
  sampleProbe,
  snapStationYCss,
  wheelPlumeView,
  type View,
  type WorldMap,
} from "../canvas/plume";
import { viewsClose } from "../canvas/viewZoom";
import { cssPoint, pairStats, PlotTouch, wheelScale } from "../gestures/plotTouch";
import { fmt, fmtFixed, fmtHeatFlux, fmtPa } from "../format";
import { clampDiskXm, clampProbeYm } from "../physics";
import { THESIS_REF_IDS } from "../refs";
import type { FieldId, SolveResponse } from "../types";
import { DraftNumber } from "./DraftNumber";
import { BugReportLink, ManualLink, RefsList } from "./RefsList";

const FIELDS: { id: FieldId; lab: string }[] = [
  { id: "t_ratio", lab: "T/T0" },
  { id: "n_ratio", lab: "n/n0" },
  { id: "h_tot", lab: "h_tot" },
  { id: "speed", lab: "U" },
  { id: "mach", lab: "M" },
  { id: "e_kin", lab: "E" },
];

type Props = {
  visible: boolean;
  solve: SolveResponse | null;
  running: boolean;
  waking: boolean;
  dc: number;
  dt: number;
  de: number;
  stationX: number | null;
  stationY: number;
  onStationX: (x: number | null) => void;
  onStationY: (y: number) => void;
};

export function PlumeTab({
  visible,
  solve,
  running,
  waking,
  dc,
  dt,
  de,
  stationX,
  stationY,
  onStationX,
  onStationY,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(emptyView(dc, dt, de));
  const fittedRef = useRef<View>(emptyView(dc, dt, de));
  const mapRef = useRef<WorldMap | null>(null);
  const fieldRef = useRef<FieldId>("n_ratio");
  const touch = useRef(new PlotTouch());
  const pinchView = useRef<View | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const [field, setField] = useState<FieldId>("n_ratio");
  const [legend, setLegend] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const probeScrollRef = useRef<HTMLDivElement>(null);
  const [probeOverflow, setProbeOverflow] = useState(false);
  const solveRef = useRef(solve);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);
  useEffect(() => {
    solveRef.current = solve;
  }, [solve]);

  useEffect(() => {
    const fitted = solve ? fitView(solve.plume, dc, dt, de) : emptyView(dc, dt, de);
    fittedRef.current = fitted;
    viewRef.current = fitted;
    pinchView.current = null;
    setZoomed(false);
  }, [solve, dc, dt, de]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const paint = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (wrap.clientWidth < 2 || wrap.clientHeight < 2) return;
      const dpr = canvas.width / Math.max(1, wrap.clientWidth);
      const s = solveRef.current;
      const frame = drawPlumeFrame({
        ctx,
        cssW: wrap.clientWidth,
        cssH: wrap.clientHeight,
        dpr,
        solve: s,
        field: fieldRef.current,
        view: viewRef.current,
        dc,
        dt,
        de,
        probe: stationX != null ? { x: stationX, y: stationY } : null,
      });
      mapRef.current = frame.map;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      paint();
    });
    ro.observe(wrap);
    paintRef.current = paint;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const css = { x: e.offsetX, y: e.offsetY };
      viewRef.current = wheelPlumeView(
        viewRef.current,
        wrap.clientWidth,
        wrap.clientHeight,
        css,
        wheelScale(e.deltaY),
        fittedRef.current,
      );
      setZoomed(!viewsClose(viewRef.current, fittedRef.current));
      paint();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    paint();
    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [visible, solve, dc, dt, de, field, stationX, stationY]);

  const toWorld = (e: PE<HTMLCanvasElement>) => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const view = viewRef.current;
    const x = map.fromX(e.clientX - r.left);
    const y = map.fromY(e.clientY - r.top);
    return {
      x: Math.min(view.x1, Math.max(view.x0, x)),
      y: Math.min(view.y1, Math.max(view.y0, y)),
    };
  };

  const placeStation = (x: number, y: number) => {
    const xmax = solve?.plume.xmax_m;
    const ymax = solve?.plume.ymax_m;
    onStationX(clampDiskXm(x, xmax));
    onStationY(clampProbeYm(y, ymax));
  };

  const placeFromPointer = (e: PE<HTMLCanvasElement>) => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const w = toWorld(e);
    if (!w || !map || !canvas) return;
    const css = cssPoint(e, canvas);
    const y = snapStationYCss(css.y, map.toY(0), w.y);
    placeStation(w.x, y);
  };

  const applyPinch = () => {
    const pair = touch.current.pair();
    const origin = touch.current.pinchOrigin;
    const start = pinchView.current;
    const wrap = wrapRef.current;
    if (!pair || !origin || !start || !wrap) return;
    const now = pairStats(pair[0], pair[1]);
    viewRef.current = pinchPlumeView(
      start,
      wrap.clientWidth,
      wrap.clientHeight,
      origin.mid,
      origin.dist,
      now.mid,
      now.dist,
      fittedRef.current,
    );
    setZoomed(!viewsClose(viewRef.current, fittedRef.current));
    paintRef.current();
  };

  const resetView = () => {
    viewRef.current = fittedRef.current;
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
      pinchView.current = { ...viewRef.current };
      applyPinch();
      return;
    }
    placeFromPointer(e);
    setLegend(false);
  };
  const onMove = (e: PE<HTMLCanvasElement>) => {
    const pt = cssPoint(e, e.currentTarget);
    const kind = touch.current.move(e.pointerId, pt);
    if (kind === "pinch") {
      if (!pinchView.current) pinchView.current = { ...viewRef.current };
      applyPinch();
      return;
    }
    if (kind !== "one") return;
    placeFromPointer(e);
  };
  const onUp = (e: PE<HTMLCanvasElement>) => {
    const pt = cssPoint(e, e.currentTarget);
    touch.current.up(e.pointerId, pt);
    if (touch.current.count < 2) pinchView.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const stationLive = stationX != null;
  const sample = solve && stationX != null ? sampleProbe(solve, stationX, stationY) : null;

  useEffect(() => {
    const el = probeScrollRef.current;
    if (!el) return;
    const measure = () => {
      setProbeOverflow(el.scrollHeight > el.clientHeight + 2 && el.scrollTop + el.clientHeight < el.scrollHeight - 3);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [visible, stationLive, legend, solve]);

  return (
    <>
      <div className="toolbar">
        {FIELDS.map((f) => (
          <button key={f.id} className={`chip${field === f.id ? " on" : ""}`} onClick={() => setField(f.id)}>
            {f.lab}
          </button>
        ))}
        <button
          className={`info-btn${legend ? " on" : ""}`}
          onClick={() => setLegend((open) => !open)}
          aria-label="Field legend"
          aria-pressed={legend}
        >
          i
        </button>
      </div>
      {running && (
        <div className="plume-status">{waking ? "waking chemistry server" : "Solving…"}</div>
      )}
      <div className="plume-slot">
        <div className="plume-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
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
      </div>
      <div className={`probe-panel${probeOverflow ? " overflow" : ""}`}>
        <div className="probe-scroll" ref={probeScrollRef}>
        <div className="probe-grid">
          <StationMm
            l="x"
            mm={stationX == null ? null : stationX * 1000}
            min={0}
            max={(solve?.plume.xmax_m ?? 2) * 1000}
            ariaLabel="station x millimetres"
            onCommitMm={(mm) => placeStation(mm / 1000, stationX == null ? 0 : stationY)}
          />
          <StationMm
            l="y"
            mm={stationX == null ? null : stationY * 1000}
            min={-(solve?.plume.ymax_m ?? 2) * 1000}
            max={(solve?.plume.ymax_m ?? 2) * 1000}
            ariaLabel="station y millimetres"
            onCommitMm={(mm) => placeStation(stationX ?? 0, mm / 1000)}
          />
          <Cell l="T" v={sample ? `${fmt(sample.T, 0)} K` : "—"} />
          <Cell l="n/n0" v={sample ? fmtFixed(sample.n_ratio, 3) : "—"} />
          <Cell l="U" v={sample ? `${fmt(sample.U, 0)} m/s` : "—"} />
          <Cell l="Mach" v={sample ? fmtFixed(sample.mach, 2) : "—"} />
          <Cell l="Kn" v={sample ? sample.kn.toPrecision(3) : "—"} />
          <Cell l="E" v={sample ? `${fmt(sample.e_kin, 2)} eV` : "—"} />
          <Cell l="E_O" v={sample?.e_O == null ? "—" : `${fmt(sample.e_O, 2)} eV`} />
          <Cell l="e_th" v={sample ? `${fmt(sample.e_th, 2)} eV` : "—"} />
          <Cell l="h_tot" v={sample ? `${fmt(sample.h_tot, 2)} MJ/kg` : "—"} />
          <Cell l="p_ram" v={sample?.p_ram_Pa == null ? "—" : fmtPa(sample.p_ram_Pa)} />
          <Cell l="q_inc" v={sample?.q_inc_W_m2 == null ? "—" : fmtHeatFlux(sample.q_inc_W_m2)} />
        </div>
        {stationLive ? null : <div className="probe-hint">Tap the jet to place a station</div>}
        {legend && (
          <div className="legend-inline">
            <p>
              T0 is the frozen nozzle-exit translational temperature (CEA station 4), not the chamber. U0 is the frozen
              exit bulk velocity. The jet is the Khasawneh–Cai 2-D planar collisionless map, mirrored about y = 0 for
              display — not axisymmetric. Color is a bilinear sample of the selected field on the nx×ny grid; faint
              n/n0 is masked so the far field stays dark. Thin isolines are marching squares of that same grid. Levels
              are ~10–12 1–2–5 steps of the selected field in the current millimetre window (log decades if that window
              spans more than 10×). Pinch packs more curves in the visible span — the colorbar stays the full-field
              range. Pinch zooms the millimetre map about the pinch. Double-tap or Reset returns to the fitted jet.
              Isoline labels reflow on the current window and skip collisions; they are not capped at 5. This does not
              re-run CEA. E is directed ½ m U² in eV; E_O is the O-atom share of that directed energy; e_th is 1.5 kT.
            </p>
            <p>
              Station: tap anywhere on the plume. That pick is a field sample at (x, y). Incident T, n, U, M, Kn, E,
              p_ram, and q_inc update at (x, |y|). p_ram = n m U² and q_inc = ½ n m U³ are free-stream fluxes. Tap sets
              station (x, y); a pick near the axis snaps y to 0. Station x and y are typed millimetres in this grid —
              not a second editor above the jet.
            </p>
            <p className="refs-head">References</p>
            <RefsList compact ids={THESIS_REF_IDS} />
            <p>
              <ManualLink />
              {" · "}
              <BugReportLink />
            </p>
          </div>
        )}
        </div>
        <div className="probe-cue" aria-hidden="true">
          <span className="probe-cue-chevron">▾</span>
        </div>
      </div>
      {!solve && (
        <div className="plume-notes">Empty nozzle field — Run a point to fill the jet</div>
      )}
    </>
  );
}

function Cell({ l, v }: { l: string; v: string }) {
  return (
    <div className="cell">
      <div className="l">{l}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function StationMm({
  l,
  mm,
  min,
  max,
  ariaLabel,
  onCommitMm,
}: {
  l: string;
  mm: number | null;
  min: number;
  max: number;
  ariaLabel: string;
  onCommitMm: (mm: number) => void;
}) {
  return (
    <div className="cell">
      <div className="l">{l}</div>
      <div className="v cell-edit">
        <DraftNumber
          value={mm}
          min={min}
          max={max}
          step={0.1}
          format={(n) => n.toFixed(1)}
          placeholder="—"
          aria-label={ariaLabel}
          onCommit={onCommitMm}
        />
        <span className="cell-unit">mm</span>
      </div>
    </div>
  );
}
