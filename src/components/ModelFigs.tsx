/** Hand-drawn SVG from the live geometry and identities. No stock art. */

import type { ReactNode } from "react";

const AXIS = "var(--muted)";
const INK = "var(--text)";
const TEAL = "var(--teal)";
const GRID = "var(--line)";
const PLOT = "var(--plot)";
const FONT = "var(--font)";

function FigFrame({
  id,
  title,
  children,
  viewBox,
  caption,
}: {
  id: string;
  title: string;
  children: ReactNode;
  viewBox: string;
  caption: string;
}) {
  return (
    <figure className="fig">
      <svg viewBox={viewBox} role="img" aria-labelledby={`${id}-title ${id}-cap`}>
        <title id={`${id}-title`}>{title}</title>
        {children}
      </svg>
      <figcaption className="fig-cap" id={`${id}-cap`}>
        {caption}
      </figcaption>
    </figure>
  );
}

/** Remote CEA rocket → frozen exit. T0 is exit T, not chamber. */
export function FigCeaExit() {
  return (
    <FigFrame
      id="fig-cea"
      title="Remote CEA rocket stations ending at a frozen exit"
      viewBox="0 0 640 220"
      caption="Fig. 1. Chemistry is remote NASA CEA (Gordon & McBride). The operator posts pinj and either ṁ or hinj; CEA returns a frozen exit. T0, U0, n0, R, MW, and mole fractions xi are exit values. hinj is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement."
    >
      <rect x="18" y="48" width="122" height="112" rx="6" fill={PLOT} stroke={INK} strokeWidth="1.6" />
      <text x="79" y="88" textAnchor="middle" fill={INK} fontFamily={FONT} fontSize="13" fontWeight="650">
        chamber
      </text>
      <text x="79" y="110" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        pinj, hinj
      </text>
      <text x="79" y="128" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        ṁ or assigned h
      </text>

      <path d="M140 104 L198 104 L198 88 L248 72 L248 136 L198 120 L198 104" fill={PLOT} stroke={INK} strokeWidth="1.6" />
      <line x1="198" y1="88" x2="198" y2="120" stroke={TEAL} strokeWidth="2.2" />
      <text x="198" y="80" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="11">
        Dt
      </text>
      <text x="168" y="168" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="11">
        Dc
      </text>

      <path d="M248 72 L360 52 L360 156 L248 136 Z" fill={PLOT} stroke={INK} strokeWidth="1.6" />
      <line x1="360" y1="52" x2="360" y2="156" stroke={TEAL} strokeWidth="2.4" />
      <text x="360" y="44" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="11">
        De
      </text>
      <text x="304" y="112" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        rocket
      </text>

      <rect x="400" y="40" width="220" height="128" rx="6" fill={PLOT} stroke={TEAL} strokeWidth="1.8" />
      <text x="510" y="68" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="13" fontWeight="650">
        frozen exit
      </text>
      <text x="510" y="92" textAnchor="middle" fill={INK} fontFamily={FONT} fontSize="13">
        T0, U0, n0
      </text>
      <text x="510" y="114" textAnchor="middle" fill={INK} fontFamily={FONT} fontSize="13">
        R, MW, xi
      </text>
      <text x="510" y="140" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        T0 is exit T, not chamber
      </text>

      <path d="M370 104 L396 104" stroke={TEAL} strokeWidth="1.6" markerEnd="url(#cea-arrow)" />
      <defs>
        <marker id="cea-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={TEAL} />
        </marker>
      </defs>
      <text x="320" y="200" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        H = De / 2 applied as a planar slit half-height
      </text>
    </FigFrame>
  );
}

/** Khasawneh–Cai slit: θ1=atan2(Y−H,X), θ2=atan2(Y+H,X). */
export function FigSlit() {
  const ox = 92;
  const oy = 158;
  const H = 62;
  const X = 286;
  const Y = 88;
  const px = ox + X;
  const py = oy - Y;
  const upX = ox;
  const upY = oy - H;
  const loX = ox;
  const loY = oy + H;
  const axisEnd = ox + 430;
  const th1 = Math.atan2(Y - H, X);
  const th2 = Math.atan2(Y + H, X);
  const rArc = 78;
  const a1x = ox + rArc * Math.cos(th1);
  const a1y = oy - rArc * Math.sin(th1);
  const a2x = ox + rArc * Math.cos(th2);
  const a2y = oy - rArc * Math.sin(th2);
  const arc1 = `M ${ox + rArc} ${oy} A ${rArc} ${rArc} 0 0 ${th1 > 0 ? 0 : 1} ${a1x} ${a1y}`;
  const arc2 = `M ${ox + rArc} ${oy} A ${rArc} ${rArc} 0 0 0 ${a2x} ${a2y}`;

  return (
    <FigFrame
      id="fig-slit"
      title="Planar slit of half-height H with viewing angles theta1 and theta2"
      viewBox="0 0 640 310"
      caption="Fig. 2. 2-D planar slit. Half-height H = De/2 (round IPG exit applied as a slit). From a field point (X, Y) the lips are at angles θ1 = atan2(Y − H, X) and θ2 = atan2(Y + H, X). The jet is planar, not axisymmetric. Downstream only: X > 0."
    >
      <line x1={ox - 24} y1={oy} x2={axisEnd} y2={oy} stroke={AXIS} strokeWidth="1.1" />
      <line x1={ox} y1={oy - 128} x2={ox} y2={oy + 128} stroke={AXIS} strokeWidth="1.1" />
      <text x={axisEnd - 8} y={oy + 16} fill={AXIS} fontFamily={FONT} fontSize="13">
        X
      </text>
      <text x={ox - 18} y={oy - 132} fill={AXIS} fontFamily={FONT} fontSize="13">
        Y
      </text>

      <rect x={ox - 10} y={upY} width="10" height={2 * H} fill={TEAL} />
      <line x1={ox} y1={upY} x2={ox} y2={loY} stroke={TEAL} strokeWidth="3.2" />
      <circle cx={ox} cy={upY} r="3.2" fill={TEAL} />
      <circle cx={ox} cy={loY} r="3.2" fill={TEAL} />
      <text x={ox - 16} y={upY - 8} textAnchor="end" fill={TEAL} fontFamily={FONT} fontSize="13">
        +H
      </text>
      <text x={ox - 16} y={loY + 16} textAnchor="end" fill={TEAL} fontFamily={FONT} fontSize="13">
        −H
      </text>
      <text x={ox + 14} y={(upY + loY) / 2 + 5} fill={TEAL} fontFamily={FONT} fontSize="12">
        slit
      </text>

      <line x1={upX} y1={upY} x2={px} y2={py} stroke={INK} strokeWidth="1.35" />
      <line x1={loX} y1={loY} x2={px} y2={py} stroke={INK} strokeWidth="1.35" />
      <line x1={ox} y1={oy} x2={px} y2={py} stroke={GRID} strokeWidth="1" strokeDasharray="4 3" />

      <path d={arc1} fill="none" stroke={TEAL} strokeWidth="1.4" />
      <path d={arc2} fill="none" stroke={TEAL} strokeWidth="1.4" />
      <text x={ox + 96} y={oy - 10} fill={TEAL} fontFamily={FONT} fontSize="14">
        θ1
      </text>
      <text x={ox + 72} y={oy - 52} fill={TEAL} fontFamily={FONT} fontSize="14">
        θ2
      </text>

      <circle cx={px} cy={py} r="5" fill={INK} />
      <text x={px + 10} y={py - 8} fill={INK} fontFamily={FONT} fontSize="14" fontWeight="650">
        (X, Y)
      </text>
      <text x={ox + 200} y={oy + 36} fill={AXIS} fontFamily={FONT} fontSize="12">
        H = De/2
      </text>
    </FigFrame>
  );
}

/** Gauss–Legendre nodes on [θ1, θ2], mapped from ξ ∈ [−1, 1]. */
export function FigQuad() {
  const x1 = 70;
  const x2 = 570;
  const y = 78;
  const nodes = [-0.960, -0.796, -0.525, -0.183, 0.183, 0.525, 0.796, 0.960];
  return (
    <FigFrame
      id="fig-quad"
      title="Gauss-Legendre nodes mapped from xi in [-1,1] onto theta in [theta1, theta2]"
      viewBox="0 0 640 168"
      caption="Fig. 3. The chemistry API integrates each integrand on [θ1, θ2] with Gauss–Legendre (default 64 nodes; eight shown). ξ ∈ [−1, 1] maps to θ = ½(θ2 − θ1)ξ + ½(θ2 + θ1). Weights scale by ½(θ2 − θ1)."
    >
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={INK} strokeWidth="1.6" />
      <line x1={x1} y1={y - 10} x2={x1} y2={y + 10} stroke={TEAL} strokeWidth="2" />
      <line x1={x2} y1={y - 10} x2={x2} y2={y + 10} stroke={TEAL} strokeWidth="2" />
      <text x={x1} y={y + 28} textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="14">
        θ1
      </text>
      <text x={x2} y={y + 28} textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="14">
        θ2
      </text>
      {nodes.map((xi) => {
        const x = x1 + ((xi + 1) / 2) * (x2 - x1);
        return <circle key={xi} cx={x} cy={y} r="4.2" fill={TEAL} />;
      })}
      <text x="320" y="36" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="13">
        ξ ∈ [−1, 1] → θ(ξ) on [θ1, θ2]
      </text>
      <text x="320" y="148" textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="12">
        {"I(\u03b8) = exp(-S0\u00b2) \u00d7 {A, B, C}(S0 cos \u03b8)"}
      </text>
    </FigFrame>
  );
}

/** API tensor-product mesh: x ≥ 0, y from −ymax to +ymax, odd ny so y = 0 is a node. */
export function FigGrid() {
  const l = 70;
  const t = 28;
  const w = 420;
  const h = 260;
  const nx = 8;
  const ny = 7;
  const xs = Array.from({ length: nx }, (_, i) => l + (i * w) / (nx - 1));
  const ys = Array.from({ length: ny }, (_, j) => t + (j * h) / (ny - 1));
  const yMid = t + h / 2;
  return (
    <FigFrame
      id="fig-grid"
      title="Odd-by-odd plume mesh spanning both signs of y"
      viewBox="0 0 640 340"
      caption="Fig. 4. Every Thesis solve requests a 97 × 97 tensor-product mesh (odd, so y = 0 is a node). The chemistry API fills x ∈ [0, xmax] and y ∈ [−ymax, +ymax]. Schematic shows 8 × 7 cells. The phone color-samples that grid at (x, |y|) and marches isolines on y ≥ 0, then mirrors them."
    >
      <rect x={l} y={t} width={w} height={h} fill={PLOT} stroke={INK} strokeWidth="1.4" />
      {xs.map((x) => (
        <line key={`x${x}`} x1={x} y1={t} x2={x} y2={t + h} stroke={GRID} strokeWidth="1" />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} x1={l} y1={y} x2={l + w} y2={y} stroke={GRID} strokeWidth="1" />
      ))}
      <line x1={l} y1={yMid} x2={l + w} y2={yMid} stroke={TEAL} strokeWidth="1.8" />
      <text x={l + w + 10} y={yMid + 4} fill={TEAL} fontFamily={FONT} fontSize="13">
        y = 0
      </text>
      <text x={l - 10} y={t + 6} textAnchor="end" fill={AXIS} fontFamily={FONT} fontSize="12">
        +ymax
      </text>
      <text x={l - 10} y={t + h + 4} textAnchor="end" fill={AXIS} fontFamily={FONT} fontSize="12">
        −ymax
      </text>
      <text x={l} y={t + h + 22} fill={AXIS} fontFamily={FONT} fontSize="12">
        x = 0
      </text>
      <text x={l + w} y={t + h + 22} textAnchor="end" fill={AXIS} fontFamily={FONT} fontSize="12">
        xmax
      </text>
      <rect x={oxNozzle(l)} y={yMid - 18} width="10" height="36" fill={TEAL} />
      <text x={l + w / 2} y={t + h + 40} textAnchor="middle" fill={INK} fontFamily={FONT} fontSize="13">
        97 × 97 · row-major [iy, ix]
      </text>
    </FigFrame>
  );
}

function oxNozzle(l: number): number {
  return l - 10;
}

/** One bilinear cell and a marching-squares isoline. */
export function FigBilinear() {
  const x0 = 80;
  const y0 = 200;
  const x1 = 300;
  const y1 = 50;
  const tx = 0.38;
  const ty = 0.42;
  const px = x0 + tx * (x1 - x0);
  const py = y0 + ty * (y1 - y0);
  const tEdge = 0.62;
  const a = { x: x0 + tEdge * (x1 - x0), y: y0 };
  const b = { x: x1, y: y0 + 0.48 * (y1 - y0) };
  return (
    <FigFrame
      id="fig-bilin"
      title="Bilinear sample inside a grid cell and a marching-squares isoline"
      viewBox="0 0 640 280"
      caption="Fig. 5. Color and the station read the same bilinear interpolant on the 97 × 97 field (no spline). Isolines are marching squares of that grid: an isoline crosses a cell where the level sits between two corners. Levels are ~10–12 even 1–2–5 steps of the visible window (1–2–5 × 10^n per decade when hi/posLo ≥ 10)."
    >
      <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill={PLOT} stroke={INK} strokeWidth="1.6" />
      <circle cx={x0} cy={y0} r="4" fill={TEAL} />
      <circle cx={x1} cy={y0} r="4" fill={TEAL} />
      <circle cx={x0} cy={y1} r="4" fill={TEAL} />
      <circle cx={x1} cy={y1} r="4" fill={TEAL} />
      <text x={x0 - 8} y={y0 + 18} textAnchor="end" fill={INK} fontFamily={FONT} fontSize="13">
        (i, j)
      </text>
      <text x={x1 + 8} y={y0 + 18} fill={INK} fontFamily={FONT} fontSize="13">
        (i+1, j)
      </text>
      <text x={x0 - 8} y={y1 - 8} textAnchor="end" fill={INK} fontFamily={FONT} fontSize="13">
        (i, j+1)
      </text>
      <text x={x1 + 8} y={y1 - 8} fill={INK} fontFamily={FONT} fontSize="13">
        (i+1, j+1)
      </text>
      <line x1={x0} y1={py} x2={px} y2={py} stroke={AXIS} strokeWidth="1" strokeDasharray="3 3" />
      <line x1={px} y1={y0} x2={px} y2={py} stroke={AXIS} strokeWidth="1" strokeDasharray="3 3" />
      <circle cx={px} cy={py} r="5.5" fill={INK} />
      <text x={px + 10} y={py - 8} fill={INK} fontFamily={FONT} fontSize="13">
        (tx, ty)
      </text>
      <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke={TEAL} strokeWidth="2.2" />
      <text x={(a.x + b.x) / 2 + 14} y={(a.y + b.y) / 2} fill={TEAL} fontFamily={FONT} fontSize="13">
        isoline
      </text>
      <text x="460" y="90" fill={AXIS} fontFamily={FONT} fontSize="12">
        f = (1−tx)(1−ty) f00
      </text>
      <text x="478" y="110" fill={AXIS} fontFamily={FONT} fontSize="12">
        + tx(1−ty) f10
      </text>
      <text x="478" y="130" fill={AXIS} fontFamily={FONT} fontSize="12">
        + (1−tx) ty f01
      </text>
      <text x="478" y="150" fill={AXIS} fontFamily={FONT} fontSize="12">
        + tx ty f11
      </text>
    </FigFrame>
  );
}

/** Station at (x, y); incident ram pressure and energy flux. */
export function FigStation() {
  const ox = 70;
  const oy = 130;
  const H = 28;
  return (
    <FigFrame
      id="fig-station"
      title="Station sample with incident ram pressure and energy flux"
      viewBox="0 0 640 250"
      caption="Fig. 6. A station is a field sample at the tap (x, y), not a probe body. The marker uses signed y; the bilinear read uses (x, |y|). Incident free-stream fluxes: pram = n m U² (Pa) and qinc = ½ n m U³ (W/m²). These are not plate-face p_w / q_w."
    >
      <rect x={ox - 8} y={oy - H} width="8" height={2 * H} fill={TEAL} />
      <path
        d={`M ${ox} ${oy - H} L 420 36 L 420 224 L ${ox} ${oy + H} Z`}
        fill={TEAL}
        fillOpacity="0.12"
        stroke={TEAL}
        strokeWidth="1.2"
      />
      <line x1={ox} y1={oy} x2="560" y2={oy} stroke={AXIS} strokeWidth="1" strokeDasharray="4 3" />
      <g transform="translate(310, 96)">
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#3ee8c8" strokeWidth="2.2" />
        <line x1="0" y1="-14" x2="0" y2="14" stroke="#3ee8c8" strokeWidth="2.2" />
        <circle cx="0" cy="0" r="3.2" fill="#3ee8c8" />
      </g>
      <text x="328" y="82" fill={INK} fontFamily={FONT} fontSize="13" fontWeight="650">
        station (x, y)
      </text>
      <path d="M 330 108 L 470 108" stroke={INK} strokeWidth="1.5" markerEnd="url(#st-arrow)" />
      <text x="400" y="100" textAnchor="middle" fill={INK} fontFamily={FONT} fontSize="12">
        U
      </text>
      <text x="400" y="168" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="13">
        pram = n m U²
      </text>
      <text x="400" y="188" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="13">
        qinc = ½ n m U³
      </text>
      <defs>
        <marker id="st-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
        </marker>
      </defs>
    </FigFrame>
  );
}

/** Map identity ṁ = k(h)·pinj. Axes: pinj 0→family max, hinj from the CEA sweep. */
export function FigMap() {
  const l = 72;
  const t = 24;
  const w = 430;
  const h = 230;
  const k = (hv: number) => 1 / (0.72 + 0.55 * hv);
  const traces = [0.22, 0.4, 0.62];
  const hs = Array.from({ length: 24 }, (_, i) => i / 23);
  return (
    <FigFrame
      id="fig-map"
      title="Characteristics map identity mdot equals k of h times pinj"
      viewBox="0 0 640 320"
      caption="Fig. 7. Map identity ṁ ≈ k(h)·pinj from one hinj sweep at a reference pinj (k = ṁ(h, pinj_ref)/pinj_ref). Extra ṁ and power isolines are 1–2–5 traces of that same identity in the current window — not a second CEA call. Drawn curves use a monotone k(h) only to show the identity; the live Map uses the sweep. pinj axis is 0 to the family max; Setup sliders are min–max."
    >
      <rect x={l} y={t} width={w} height={h} fill={PLOT} stroke={INK} strokeWidth="1.4" />
      <line x1={l} y1={t + h} x2={l + w} y2={t + h} stroke={INK} strokeWidth="1.4" />
      <line x1={l} y1={t} x2={l} y2={t + h} stroke={INK} strokeWidth="1.4" />
      <text x={l + w / 2} y={t + h + 28} textAnchor="middle" fill={AXIS} fontFamily={FONT} fontSize="13">
        pinj (0 → family max)
      </text>
      <text
        x={l - 36}
        y={t + h / 2}
        fill={AXIS}
        fontFamily={FONT}
        fontSize="13"
        transform={`rotate(-90 ${l - 36} ${t + h / 2})`}
      >
        hinj
      </text>
      {traces.map((mdot, idx) => {
        const pts = hs
          .map((hv) => {
            const p = mdot / k(hv);
            const x = l + Math.min(0.96, p) * w;
            const y = t + h - hv * h;
            return `${x},${y}`;
          })
          .join(" ");
        return <polyline key={mdot} points={pts} fill="none" stroke={TEAL} strokeWidth={idx === 1 ? 2.1 : 1.4} strokeOpacity={0.45 + idx * 0.2} />;
      })}
      <text x={l + w - 12} y={t + 22} textAnchor="end" fill={TEAL} fontFamily={FONT} fontSize="12">
        ṁ = k(h) · pinj
      </text>
    </FigFrame>
  );
}
