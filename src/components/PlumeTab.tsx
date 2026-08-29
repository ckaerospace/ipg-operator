import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import {
  drawPlumeFrame,
  emptyView,
  fitView,
  pinchPlumeView,
  sampleProbe,
  wheelPlumeView,
  type View,
  type WorldMap,
} from "../canvas/plume";
import { viewsClose } from "../canvas/viewZoom";
import { cssPoint, pairStats, PlotTouch, wheelScale } from "../gestures/plotTouch";
import { fmt, fmtFixed, fmtHeatFlux, fmtPa } from "../format";
import {
  clampDiskRmm,
  clampDiskXm,
  clampProbeTw,
  clampProbeYm,
  DISK_R_MM_MAX,
  DISK_R_MM_MIN,
  estimateKnObj,
  faceMatchesSolve,
  fmtTankPa,
  KN_OBJ_TRIGGER,
  parseBarrel,
  parsePlumeProbe,
  regimeFromKnObj,
  sliderToTankPa,
  tankPaToSlider,
  TANK_SLIDER_STEPS,
} from "../physics";
import { ADVANCED_REF_IDS } from "../refs";
import type { FieldId, SolveResponse } from "../types";
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
  advanced: boolean;
  showDisk: boolean;
  diskX: number | null;
  probeY: number;
  diskR: number;
  diskTw: number;
  onDiskX: (x: number | null) => void;
  onProbeY: (y: number) => void;
  onDiskR: (r: number) => void;
  onDiskTw: (t: number) => void;
  solvedFace: { x: number; r: number } | null;
  pTank: number;
  onPTank: (p: number) => void;
};

export function PlumeTab({
  visible,
  solve,
  running,
  waking,
  dc,
  dt,
  de,
  advanced,
  showDisk,
  diskX,
  probeY,
  diskR,
  diskTw,
  onDiskX,
  onProbeY,
  onDiskR,
  onDiskTw,
  solvedFace,
  pTank,
  onPTank,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(emptyView(dc, dt, de));
  const fittedRef = useRef<View>(emptyView(dc, dt, de));
  const mapRef = useRef<WorldMap | null>(null);
  const fieldRef = useRef<FieldId>("n_ratio");
  const diskRef = useRef<{ x: number; r: number } | null>(
    showDisk && diskX != null ? { x: diskX, r: diskR / 1000 } : null,
  );
  const touch = useRef(new PlotTouch());
  const pinchView = useRef<View | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const [field, setField] = useState<FieldId>("n_ratio");
  const [legend, setLegend] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const probeScrollRef = useRef<HTMLDivElement>(null);
  const [probeOverflow, setProbeOverflow] = useState(false);
  const solveRef = useRef(solve);
  const advancedRef = useRef(advanced);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);
  useEffect(() => {
    diskRef.current = showDisk && diskX != null ? { x: diskX, r: diskR / 1000 } : null;
  }, [showDisk, diskX, diskR]);
  useEffect(() => {
    solveRef.current = solve;
  }, [solve]);
  useEffect(() => {
    advancedRef.current = advanced;
  }, [advanced]);

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
      const disk = diskRef.current;
      const bow = advancedRef.current && s ? parseBarrel(s.plume.bow_xy) : [];
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
        probe: diskX != null ? { x: diskX, y: probeY } : null,
        disk,
        bow,
        showShocks: advancedRef.current,
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
  }, [visible, solve, dc, dt, de, field, advanced, showDisk, diskX, probeY, diskR]);

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

  const placeX = (x: number) => {
    const xmax = solve?.plume.xmax_m;
    onDiskX(clampDiskXm(x, xmax));
  };

  const placeStation = (x: number, y: number) => {
    const xmax = solve?.plume.xmax_m;
    const ymax = solve?.plume.ymax_m;
    onDiskX(clampDiskXm(x, xmax));
    onProbeY(clampProbeYm(y, ymax));
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
    const w = toWorld(e);
    if (!w) return;
    placeStation(w.x, w.y);
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
    const w = toWorld(e);
    if (!w) return;
    placeStation(w.x, w.y);
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

  const apiProbe = parsePlumeProbe(solve?.plume.probe);
  const stationLive = diskX != null;
  const plateOn = advanced && showDisk;
  const sample = solve && diskX != null ? sampleProbe(solve, diskX, probeY) : null;
  const faceReady = plateOn && faceMatchesSolve(solvedFace, diskX, diskR);
  const knObjApi = faceReady && apiProbe?.Kn_obj != null ? apiProbe.Kn_obj : null;
  const knObjEst =
    knObjApi == null && sample && plateOn
      ? estimateKnObj(sample.kn, solve?.plume.H ?? 0, diskR / 1000)
      : null;
  const knObj = knObjApi ?? knObjEst;
  const regimeApi = faceReady && apiProbe?.regime ? apiProbe.regime : null;
  const regime = regimeApi ?? (knObj != null ? regimeFromKnObj(knObj) : null);
  const pVal = faceReady ? (apiProbe?.p_Pa ?? null) : null;
  const qVal = faceReady ? (apiProbe?.q_W_m2 ?? null) : null;

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
  }, [visible, stationLive, plateOn, legend, solve]);

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
      {plateOn && (
        <div className="disk-row">
          <label className="disk-field">
            x
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={diskX == null ? "" : +(diskX * 1000).toFixed(1)}
              placeholder="mm"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onDiskX(null);
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n)) placeX(n / 1000);
              }}
            />
            <span>mm</span>
          </label>
          <label className="disk-field">
            probe R
            <input
              type="number"
              inputMode="decimal"
              min={DISK_R_MM_MIN}
              max={DISK_R_MM_MAX}
              step={1}
              value={diskR}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onDiskR(clampDiskRmm(n));
              }}
            />
            <span>mm</span>
          </label>
          <label className="disk-field">
            Tw
            <input
              type="number"
              inputMode="decimal"
              min={200}
              max={2000}
              step={10}
              value={diskTw}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onDiskTw(clampProbeTw(n));
              }}
            />
            <span>K</span>
          </label>
        </div>
      )}
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
      {advanced && (
        <div className="tank-row">
          <label htmlFor="ptank-slider">
            tank pressure / p<sub>∞</sub>
          </label>
          <input
            id="ptank-slider"
            type="range"
            min={0}
            max={TANK_SLIDER_STEPS}
            step={1}
            value={tankPaToSlider(pTank)}
            onChange={(e) => onPTank(sliderToTankPa(Number(e.target.value)))}
            aria-valuemin={0.1}
            aria-valuemax={5000}
            aria-valuenow={pTank}
            aria-label="tank pressure p infinity"
          />
          <span className="tank-val">{fmtTankPa(pTank)}</span>
        </div>
      )}
      <div className={`probe-panel${probeOverflow ? " overflow" : ""}`}>
        <div className="probe-scroll" ref={probeScrollRef}>
        <div className="probe-grid">
          <Cell l="x" v={diskX == null ? "—" : `${fmt(diskX * 1000, 1)} mm`} />
          <Cell l="y" v={diskX == null ? "—" : `${fmt(probeY * 1000, 1)} mm`} />
          <Cell l="T" v={sample ? `${fmt(sample.T, 0)} K` : "—"} />
          <Cell l="n/n0" v={sample ? fmtFixed(sample.n_ratio, 3) : "—"} />
          <Cell l="U" v={sample ? `${fmt(sample.U, 0)} m/s` : "—"} />
          <Cell l="Mach" v={sample ? fmtFixed(sample.mach, 2) : "—"} />
          <Cell l="Kn" v={sample ? sample.kn.toPrecision(3) : "—"} />
          <Cell l="E" v={sample ? `${fmt(sample.e_kin, 2)} eV` : "—"} />
          <Cell l="E_O" v={sample?.e_O == null ? "—" : `${fmt(sample.e_O, 2)} eV`} />
          <Cell l="e_th" v={sample ? `${fmt(sample.e_th, 2)} eV` : "—"} />
          <Cell l="h_tot" v={sample ? `${fmt(sample.h_tot, 2)} MJ/kg` : "—"} />
          {plateOn && (
            <>
              <Cell l="p" v={pVal == null ? "—" : fmtPa(pVal)} />
              <Cell l="q" v={qVal == null ? "—" : fmtHeatFlux(qVal)} />
              <Cell l="Kn_obj" v={knObj == null ? "—" : knObj.toPrecision(2)} />
              <Cell l="regime" v={regime ?? "—"} />
            </>
          )}
        </div>
        <div className="probe-hint">
          {!stationLive ? "Tap the jet to place a station" : plateOn && !faceReady ? "Run to fill face p, q" : "\u00a0"}
        </div>
        {legend && (
          <div className="legend-inline">
            <p>
              T0 is the frozen nozzle-exit translational temperature (CEA station 4), not the chamber. U0 is the frozen
              exit bulk velocity. Thesis is the Khasawneh–Cai 2-D planar collisionless jet, mirrored about y = 0 for
              display — not axisymmetric. Color is a bilinear
              sample of the selected field on the nx×ny grid; faint n/n0 is masked so the far field stays dark. Thin
              isolines are marching squares of that same grid, ~8 levels even in the selected field (log decades if it
              spans more than 10×). Pinch zooms the millimetre map about the pinch; two-finger drag pans. Double-tap
              or Reset returns to the fitted jet. Ticks and isoline labels re-layout on the current window — this does
              not re-run CEA. E is
              directed ½ m U² in eV; E_O is the O-atom share of that directed energy; e_th is 1.5 kT.
            </p>
            <p>
              Station: tap anywhere on the plume — Thesis or Advanced, Object None or Probe. That pick is a field
              sample at (x, y), not a probe and not a Mach disk. Incident T, n, U, M, Kn, E update at (x, |y|). Face p
              and q appear only for Advanced Object Probe after Run at the tap’s x and the centerline plate R. Thesis
              has no probe chrome. Advanced Object Probe adds x, probe R (5–50 mm), and Tw; the probe stays on the
              centerline. Kn_obj = λ / (2R); kinetic if Kn_obj ≥ {KN_OBJ_TRIGGER} (Khasawneh diffuse plate), continuum
              otherwise (Billig / Newtonian + stagnation heat). The Mach disk is a free-jet shock and is independent
              of the probe.
            </p>
            {advanced && (
              <>
                <p>
                  Advanced: Auto switches at Kn_exit = 0.05. NPR = p_e / p_tank. The log slider under the figure is
                  tank pressure / p_∞ (0.1–5000 Pa); it stays in sync with Setup’s number field and debounces a solve
                  so barrel and Mach disk can move. Collisionless Physics ignores p_tank in the kernel — the slider
                  may still refresh NPR if the API returns it, but this app never invents a Mach disk. When
                  shock_applied, barrel (pale dashed outline) and Mach disk (bright gold chord) are a stroke overlay —
                  the bilinear field is not tinted with shock colors. The canvas caption is “shock overlay”. Station
                  (green pick), probe plate, and Mach disk are three different marks. Thesis never draws this overlay.
                  A thin bow is drawn when bow_xy is present.
                </p>
                <p className="refs-head">References</p>
                <RefsList compact ids={ADVANCED_REF_IDS} />
              </>
            )}
            <p>
              <ManualLink />
              {" · "}
              <BugReportLink />
            </p>
          </div>
        )}
        <div className="caption">
          {solve ? "Hot packed gas at the exit" : "Empty nozzle field — Run a point to fill the jet"}
        </div>
        </div>
        <div className="probe-cue" aria-hidden="true">
          <span className="probe-cue-chevron">▾</span>
        </div>
      </div>
      <div className="footnote">
        hinj is local/CEA, not cavity-calorimeter bulk. IPG3 has no throat; ṁ is approximate.
      </div>
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
