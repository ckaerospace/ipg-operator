import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import {
  drawPlumeFrame,
  emptyView,
  fitView,
  panPlumeView,
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
import {
  clampDiskXm,
  clampProbeYm,
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
import { diskChipLive, kernelChipOn, plotPhysicsVisible, shockOverlayDrawn } from "../plotChips";
import type { FieldId, PlumeMode, SolveResponse } from "../types";
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
  advanced: boolean;
  plumeMode: PlumeMode;
  onPlotKernel: (m: "collisionless" | "sudden_freeze") => void;
  showDisk: boolean;
  diskX: number | null;
  probeY: number;
  diskR: number;
  onDiskX: (x: number | null) => void;
  onProbeY: (y: number) => void;
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
  plumeMode,
  onPlotKernel,
  showDisk,
  diskX,
  probeY,
  diskR,
  onDiskX,
  onProbeY,
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
  const panFrom = useRef<{ x: number; y: number } | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const [field, setField] = useState<FieldId>("n_ratio");
  const [legend, setLegend] = useState(false);
  const [shockOverlayOn, setShockOverlayOn] = useState(true);
  const [chipBox, setChipBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const probeScrollRef = useRef<HTMLDivElement>(null);
  const [probeOverflow, setProbeOverflow] = useState(false);
  const solveRef = useRef(solve);
  const advancedRef = useRef(advanced);
  const overlayOnRef = useRef(true);
  const diskLiveRef = useRef(false);

  const diskLive = diskChipLive({
    advanced,
    plumeMode,
    solveMode: solve?.plume.mode,
    shockApplied: solve?.plume.shock_applied,
  });
  const showPlotChips = plotPhysicsVisible(advanced);

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
    overlayOnRef.current = shockOverlayOn;
  }, [shockOverlayOn]);
  useEffect(() => {
    diskLiveRef.current = diskLive;
  }, [diskLive]);

  useEffect(() => {
    const fitted = solve ? fitView(solve.plume, dc, dt, de) : emptyView(dc, dt, de);
    fittedRef.current = fitted;
    viewRef.current = fitted;
    pinchView.current = null;
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
        showShocks: shockOverlayDrawn(diskLiveRef.current, overlayOnRef.current),
      });
      mapRef.current = frame.map;
      const p = frame.map.plot;
      setChipBox((prev) =>
        prev && prev.l === p.l && prev.t === p.t && prev.w === p.w && prev.h === p.h ? prev : { ...p },
      );
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
      paint();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const onTouchMove = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    paint();
    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [visible, solve, dc, dt, de, field, advanced, showDisk, diskX, probeY, diskR, shockOverlayOn, diskLive]);

  const placeStation = (x: number, y: number) => {
    const xmax = solve?.plume.xmax_m;
    const ymax = solve?.plume.ymax_m;
    onDiskX(clampDiskXm(x, xmax));
    onProbeY(clampProbeYm(y, ymax));
  };

  const placeFromCss = (css: { x: number; y: number }) => {
    const map = mapRef.current;
    if (!map) return;
    const view = viewRef.current;
    const x = Math.min(view.x1, Math.max(view.x0, map.fromX(css.x)));
    const y = Math.min(view.y1, Math.max(view.y0, map.fromY(css.y)));
    placeStation(x, snapStationYCss(css.y, map.toY(0), y));
  };

  const isZoomed = () => !viewsClose(viewRef.current, fittedRef.current);

  const panBy = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const wrap = wrapRef.current;
    if (!wrap || !isZoomed()) return;
    viewRef.current = panPlumeView(
      viewRef.current,
      wrap.clientWidth,
      wrap.clientHeight,
      from,
      to,
      fittedRef.current,
    );
    paintRef.current();
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
    paintRef.current();
  };

  const onDown = (e: PE<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = cssPoint(e, e.currentTarget);
    const kind = touch.current.down(e.pointerId, pt);
    panFrom.current = pt;
    if (kind === "pinch") {
      pinchView.current = { ...viewRef.current };
      applyPinch();
      return;
    }
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
    if (kind === "drag") {
      const from = panFrom.current ?? pt;
      panBy(from, pt);
      panFrom.current = pt;
    }
  };
  const onUp = (e: PE<HTMLCanvasElement>) => {
    const pt = cssPoint(e, e.currentTarget);
    const result = touch.current.up(e.pointerId, pt);
    if (touch.current.count < 2) pinchView.current = null;
    panFrom.current = null;
    if (result === "tap") placeFromCss(pt);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };
  const onCancel = (e: PE<HTMLCanvasElement>) => {
    touch.current.up(e.pointerId, cssPoint(e, e.currentTarget));
    if (touch.current.count < 2) pinchView.current = null;
    panFrom.current = null;
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
            onPointerCancel={onCancel}
          />
          {showPlotChips && chipBox && (
            <div
              className="plot-phys"
              style={{ left: chipBox.l + 5, top: chipBox.t + chipBox.h - 5 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`plot-phys-chip${kernelChipOn(plumeMode, "collisionless") ? " on" : ""}`}
                disabled={running}
                aria-pressed={kernelChipOn(plumeMode, "collisionless")}
                onClick={() => onPlotKernel("collisionless")}
              >
                Collisionless
              </button>
              <button
                type="button"
                className={`plot-phys-chip${kernelChipOn(plumeMode, "sudden_freeze") ? " on" : ""}`}
                disabled={running}
                aria-pressed={kernelChipOn(plumeMode, "sudden_freeze")}
                onClick={() => onPlotKernel("sudden_freeze")}
              >
                Freeze
              </button>
              {diskLive ? (
                <button
                  type="button"
                  className={`plot-phys-chip disk${shockOverlayOn ? " on" : ""}`}
                  aria-pressed={shockOverlayOn}
                  onClick={() => setShockOverlayOn((on) => !on)}
                >
                  Disk
                </button>
              ) : null}
            </div>
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
          <StationMm
            l="x"
            mm={diskX == null ? null : diskX * 1000}
            min={0}
            max={(solve?.plume.xmax_m ?? 2) * 1000}
            ariaLabel="station x millimetres"
            onCommitMm={(mm) => placeStation(mm / 1000, diskX == null ? 0 : probeY)}
          />
          <StationMm
            l="y"
            mm={diskX == null ? null : probeY * 1000}
            min={-(solve?.plume.ymax_m ?? 2) * 1000}
            max={(solve?.plume.ymax_m ?? 2) * 1000}
            ariaLabel="station y millimetres"
            onCommitMm={(mm) => placeStation(diskX ?? 0, mm / 1000)}
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
          {plateOn && (
            <>
              <Cell l="p_probe" v={pVal == null ? "—" : fmtPa(pVal)} />
              <Cell l="q_probe" v={qVal == null ? "—" : fmtHeatFlux(qVal)} />
              <Cell l="Kn_obj" v={knObj == null ? "—" : knObj.toPrecision(2)} />
              <Cell l="regime" v={regime ?? "—"} />
            </>
          )}
        </div>
        {stationLive && !(plateOn && !faceReady) ? null : (
          <div className="probe-hint">
            {!stationLive ? "Tap the jet to place a station" : "Run to fill p_probe, q_probe"}
          </div>
        )}
        {legend && (
          <div className="legend-inline">
            <p>
              T0 is the frozen nozzle-exit translational temperature (CEA station 4), not the chamber. U0 is the frozen
              exit bulk velocity. Thesis is the Khasawneh–Cai 2-D planar collisionless jet, mirrored about y = 0 for
              display — not axisymmetric. Color is a bilinear
              sample of the selected field on the nx×ny grid; faint n/n0 is masked so the far field stays dark. Thin
              isolines are marching squares of that same grid. Levels are ~10–12 1–2–5 steps of the selected field in
              the current millimetre window (log decades if that window spans more than 10×). Pinch packs more curves
              in the visible span — the colorbar stays the full-field range. Pinch zooms the millimetre map about the
              pinch centroid. One-finger or mouse-drag pans only when already zoomed (~8 px slop); at the fitted view,
              drag does nothing. A tap still places the station. Zoom and pan do not change station millimetres.
              Pinch or wheel out returns to the fitted jet. Isoline labels reflow on the current window for every
              plotted field (not only n/n0) and skip collisions;
              they are not capped at 5. This does
              not re-run CEA. E is
              directed ½ m U² in eV; E_O is the O-atom share of that directed energy; e_th is 1.5 kT.
            </p>
            <p>
              Station: tap anywhere on the plume — Thesis or Advanced, Object None or Probe. That pick is a field
              sample at (x, y), not a probe and not a Mach disk. Incident T, n, U, M, Kn, E, p_ram, and q_inc update
              at (x, |y|). p_ram = n m U² and q_inc = ½ n m U³ are free-stream fluxes, not plate-face numbers.
              p_probe (plate face pressure) and q_probe (plate heat flux) appear only for Advanced Object Probe after
              Run at the tap’s x on the centerline plate — not tank p_∞ and not a field sample. Thesis
              has no probe chrome. Tap sets station (x, y) and does not pan; a pick near the axis snaps y to 0. Station x and y are
              typed millimetres in this grid — not a second editor above the jet. Advanced Object Probe uses that
              same x for the centerline plate; probe R and Tw stay on Setup. Kn_obj = λ / (2R); kinetic if
              Kn_obj ≥ {KN_OBJ_TRIGGER} (Khasawneh diffuse plate), continuum
              otherwise (Billig / Newtonian + stagnation heat). The Mach disk is a free-jet shock and is independent
              of the probe.
            </p>
            {advanced && (
              <>
                <p>
                  Advanced: Auto switches at Kn_exit = 0.05. NPR = p_e / p_tank. The log slider under the figure is
                  tank pressure / p_∞ (0.1–5000 Pa); it stays in sync with Setup’s number field and debounces a solve
                  so barrel and Mach disk can move. Collisionless Physics ignores p_tank in the kernel — the slider
                  may still refresh NPR if the API returns it, but this app never invents a Mach disk. Collisionless
                  and Freeze chips sit in the figure (bottom-left, above the x-axis) and re-solve the same exclusive
                  pair as Setup Physics; Auto stays on Setup. A gold Disk chip is live only after Freeze ran with
                  shock_applied — off hides barrel and Mach disk strokes and does not change the colormap. When
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
