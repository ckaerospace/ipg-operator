import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import {
  drawPlumeFrame,
  emptyView,
  fitView,
  sampleProbe,
  seedParticles,
  stepParticles,
  type Particle,
  type View,
  type WorldMap,
} from "../canvas/plume";
import { fmt, fmtFixed, fmtHeatFlux, fmtPa } from "../format";
import {
  clampDiskRmm,
  clampDiskXm,
  clampProbeTw,
  DISK_R_MM_MAX,
  DISK_R_MM_MIN,
  estimateKnObj,
  KN_OBJ_TRIGGER,
  parseBarrel,
  parsePlumeProbe,
  probeMatchesDisk,
  regimeFromKnObj,
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
  diskX: number | null;
  diskR: number;
  diskTw: number;
  onDiskX: (x: number | null) => void;
  onDiskR: (r: number) => void;
  onDiskTw: (t: number) => void;
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
  diskX,
  diskR,
  diskTw,
  onDiskX,
  onDiskR,
  onDiskTw,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const parts = useRef<Particle[]>([]);
  const viewRef = useRef<View>(emptyView(dc, dt, de));
  const mapRef = useRef<WorldMap | null>(null);
  const fieldRef = useRef<FieldId>("n_ratio");
  const diskRef = useRef<{ x: number; r: number } | null>(
    diskX != null ? { x: diskX, r: diskR / 1000 } : null,
  );
  const drag = useRef(false);
  const [field, setField] = useState<FieldId>("n_ratio");
  const [legend, setLegend] = useState(false);
  const solveRef = useRef(solve);
  const advancedRef = useRef(advanced);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);
  useEffect(() => {
    diskRef.current = diskX != null ? { x: diskX, r: diskR / 1000 } : null;
  }, [diskX, diskR]);
  useEffect(() => {
    solveRef.current = solve;
  }, [solve]);
  useEffect(() => {
    advancedRef.current = advanced;
  }, [advanced]);

  useEffect(() => {
    viewRef.current = solve ? fitView(solve.plume, dc, dt, de) : emptyView(dc, dt, de);
    parts.current = solve ? seedParticles(solve.plume, viewRef.current) : [];
  }, [solve, dc, dt, de]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;
    let last = performance.now();

    const paint = (dtms: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (wrap.clientWidth < 2 || wrap.clientHeight < 2) return;
      const dpr = canvas.width / Math.max(1, wrap.clientWidth);
      const s = solveRef.current;
      if (s && visible) stepParticles(s.plume, parts.current, Math.min(0.05, dtms / 1000), viewRef.current);
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
        particles: parts.current,
        probe: null,
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
      paint(0);
    });
    ro.observe(wrap);

    const loop = (t: number) => {
      paint(t - last);
      last = t;
      raf = requestAnimationFrame(loop);
    };
    if (visible) raf = requestAnimationFrame(loop);
    else paint(0);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [visible, solve, dc, dt, de, field, advanced, diskX, diskR]);

  const toWorld = (e: PE<HTMLCanvasElement>) => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = map.fromX(e.clientX - r.left);
    return { x };
  };

  const placeX = (x: number) => {
    const xmax = solve?.plume.xmax_m;
    onDiskX(clampDiskXm(x, xmax));
  };

  const onDown = (e: PE<HTMLCanvasElement>) => {
    const w = toWorld(e);
    if (!w) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = true;
    placeX(w.x);
    setLegend(false);
  };
  const onMove = (e: PE<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const w = toWorld(e);
    if (!w) return;
    placeX(w.x);
  };
  const onUp = (e: PE<HTMLCanvasElement>) => {
    drag.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const apiProbe = parsePlumeProbe(solve?.plume.probe);
  const diskLive = diskX != null;
  const sample = solve && diskX != null ? sampleProbe(solve, diskX, 0) : null;
  const matched = diskLive && probeMatchesDisk(apiProbe, diskX, diskR);
  const knObjApi = matched && apiProbe?.Kn_obj != null ? apiProbe.Kn_obj : null;
  const knObjEst =
    knObjApi == null && sample && diskLive
      ? estimateKnObj(sample.kn, solve?.plume.H ?? 0, diskR / 1000)
      : null;
  const knObj = knObjApi ?? knObjEst;
  const regimeApi = matched && apiProbe?.regime ? apiProbe.regime : null;
  const regime = regimeApi ?? (knObj != null ? regimeFromKnObj(knObj) : null);
  const pVal = matched ? apiProbe?.p_Pa : null;
  const qVal = matched ? apiProbe?.q_W_m2 : null;

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
          R
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
        {advanced && (
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
        )}
      </div>
      {running && (
        <div className="plume-status">{waking ? "waking chemistry server" : "Solving…"}</div>
      )}
      <div className="plume-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <div className="probe-panel">
        {diskLive ? (
          <>
            {sample ? (
              <div className="probe-grid">
                <Cell l="x" v={`${fmt(diskX * 1000, 1)} mm`} />
                <Cell l="T" v={`${fmt(sample.T, 0)} K`} />
                <Cell l="n/n0" v={fmtFixed(sample.n_ratio, 3)} />
                <Cell l="U" v={`${fmt(sample.U, 0)} m/s`} />
                <Cell l="Mach" v={fmtFixed(sample.mach, 2)} />
                <Cell l="Kn" v={sample.kn.toPrecision(3)} />
              </div>
            ) : (
              <div className="probe-hint">Incident n, T, U after Run</div>
            )}
            <div className="disk-readout">
              <div className="disk-lab">Probe disk</div>
              <div className="probe-grid disk-grid">
                <Cell l="p" v={pVal == null ? "—" : fmtPa(pVal)} />
                <Cell l="q" v={qVal == null ? "—" : fmtHeatFlux(qVal)} />
                <Cell l="Kn_obj" v={knObj == null ? "—" : knObj.toPrecision(2)} />
                <Cell l="regime" v={regime ?? "—"} />
              </div>
            </div>
          </>
        ) : (
          <div className="probe-hint">Tap the jet to place a probe disk on the centerline</div>
        )}
        {legend && (
          <div className="legend-inline">
            <p>
              T0 is the frozen nozzle-exit translational temperature (CEA station 4), not the chamber. U0 is the frozen
              exit bulk velocity. Thesis is the Khasawneh–Cai collisionless jet plus a diffuse plate. Dots spawn at the
              exit lip; color is the selected field, size and brightness follow n/n0. E is directed ½ m U² in eV.
            </p>
            <p>
              Probe disk: tap or set x on the centerline. Kn_obj = λ / (2R); kinetic if Kn_obj ≥ {KN_OBJ_TRIGGER}{" "}
              (Khasawneh diffuse plate), continuum otherwise (Billig / Newtonian + stagnation heat). p and q fill when
              the solve returns plume.probe.
            </p>
            {advanced && (
              <>
                <p>
                  Advanced: Auto switches at Kn_exit = 0.05. NPR = p_e / p_tank. Barrel and Mach disk are stroked only
                  when the solve returns shock_applied — not a filled shock field. A thin bow is drawn when bow_xy is
                  present.
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
