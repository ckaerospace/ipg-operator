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
import { fmt, fmtFixed } from "../format";
import type { FieldId, ProbeSample, SolveResponse } from "../types";

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
};

export function PlumeTab({ visible, solve, running, waking, dc, dt, de }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const parts = useRef<Particle[]>([]);
  const viewRef = useRef<View>(emptyView(dc, dt, de));
  const mapRef = useRef<WorldMap | null>(null);
  const fieldRef = useRef<FieldId>("n_ratio");
  const probeRef = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef(false);
  const [field, setField] = useState<FieldId>("n_ratio");
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);
  const [sample, setSample] = useState<ProbeSample | null>(null);
  const [legend, setLegend] = useState(false);
  const solveRef = useRef(solve);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);
  useEffect(() => {
    probeRef.current = probe;
  }, [probe]);
  useEffect(() => {
    solveRef.current = solve;
  }, [solve]);

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
        probe: probeRef.current,
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
  }, [visible, solve, dc, dt, de, field]);

  const toWorld = (e: PE<HTMLCanvasElement>) => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = map.fromX(e.clientX - r.left);
    const y = map.fromY(e.clientY - r.top);
    return { x, y: Math.max(0, y) };
  };

  const onDown = (e: PE<HTMLCanvasElement>) => {
    const w = toWorld(e);
    if (!w || !solve) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = true;
    setProbe(w);
    setSample(sampleProbe(solve, w.x, w.y));
    setLegend(false);
  };
  const onMove = (e: PE<HTMLCanvasElement>) => {
    if (!drag.current || !solve) return;
    const w = toWorld(e);
    if (!w) return;
    setProbe(w);
    setSample(sampleProbe(solve, w.x, w.y));
  };
  const onUp = (e: PE<HTMLCanvasElement>) => {
    drag.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

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
        {sample && probe ? (
          <div className="probe-grid">
            <Cell l="x" v={`${fmt(probe.x * 1000, 1)} mm`} />
            <Cell l="y" v={`${fmt(probe.y * 1000, 1)} mm`} />
            <Cell l="T" v={`${fmt(sample.T, 0)} K`} />
            <Cell l="T/T0" v={fmtFixed(sample.t_ratio, 3)} />
            <Cell l="n/n0" v={fmtFixed(sample.n_ratio, 3)} />
            <Cell l="U" v={`${fmt(sample.U, 0)} m/s`} />
            <Cell l="Mach" v={fmtFixed(sample.mach, 2)} />
            <Cell l="E" v={`${fmtFixed(sample.e_kin, 2)} eV`} />
            <Cell l="E_O" v={sample.e_O == null ? "—" : `${fmtFixed(sample.e_O, 2)} eV`} />
            <Cell l="E_th" v={`${fmtFixed(sample.e_th, 2)} eV`} />
            <Cell l="h_tot" v={`${fmtFixed(sample.h_tot, 2)} MJ/kg`} />
            <Cell l="Kn" v={sample.kn.toPrecision(3)} />
          </div>
        ) : (
          <div className="probe-hint">Tap the jet to place a probe</div>
        )}
        {legend && (
          <div className="legend-inline">
            Frozen exit, not chamber. T0 is the frozen nozzle-exit translational temperature (CEA station 4). U0 is the
            frozen exit bulk velocity. Dots spawn at the exit lip and follow the calculated velocity. Color is the
            selected field; size and brightness follow n/n0 (packed at the exit, fading as density drops). E is directed
            ½ m U² in eV; E_O is shown when oxygen atoms exist. E_th = 3/2 kT is on the probe only.
          </div>
        )}
      </div>
      <div className="caption">
        {solve ? "Hot packed gas at the exit" : "Empty nozzle field — Run a point to fill the jet"}
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
