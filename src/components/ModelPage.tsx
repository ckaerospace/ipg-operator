import { useEffect } from "react";
import { HINJ_MJ_MAX, HINJ_MJ_MIN, mdotMgLimits, pinjLimits } from "../facility";
import { goLayer } from "../layer";
import { THESIS_REF_IDS } from "../refs";
import { Eq } from "./Eq";
import { LayerBar } from "./LayerBar";
import {
  FigBilinear,
  FigCeaExit,
  FigGrid,
  FigMap,
  FigQuad,
  FigSlit,
  FigStation,
} from "./ModelFigs";
import { BugReportLink, RefsList } from "./RefsList";

const IPG6_PINJ = pinjLimits("IPG6-S");
const IPG6_MDOT = mdotMgLimits("IPG6-S");
const IPG4_PINJ = pinjLimits("IPG4");
const IPG4_MDOT = mdotMgLimits("IPG4");
const IPG3_PINJ = pinjLimits("IPG3");
const IPG3_MDOT = mdotMgLimits("IPG3");

export function ModelPage() {
  useEffect(() => {
    document.title = "Plasma wind tunnel · Model";
  }, []);
  return (
    <div className="paper paper-scroll">
      <header className="paper-bar">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            goLayer("thesis");
          }}
        >
          Plasma wind tunnel
        </a>
        <span>Model</span>
      </header>
      <div className="paper-layers">
        <LayerBar current="manual" />
      </div>
      <article className="paper-body">
        <h1>Methods</h1>
        <p className="lede">
          Short note on the calculations this Thesis-only PWA actually runs. The jet is the collisionless
          Khasawneh–Cai 2-D planar map from a frozen NASA CEA exit. Model is a page link, not a solve chip, and is not
          itself a solver. Chemistry is remote NASA CEA. This PWA does not reimplement CEA, Navier–Stokes, or DSMC.
          Operator chrome is <span className="mono">Plasma wind tunnel · {"{generator}"}</span>.
        </p>

        <h2>1. Operator inputs</h2>
        <p>
          Generator (IPG6-S, IPG4, IPG3, or Custom Dc / Dt / De) and gas fix the nozzle and the mixture sent to CEA.
          Named gases are O2, CO2, N2, Air, HeO2, and Ar. Custom gas is a mole mix of O2, N2, CO2, He, and Ar — not a
          new solver. Custom diameters are 1–499&nbsp;mm; empty numeric drafts revert on blur and do not become 0.
          Custom Dt picks the ṁ / pinj family: ≥70&nbsp;mm IPG3-like, ≥45&nbsp;mm IPG4-like, else IPG6-S. Custom IPG
          posts the same <span className="mono">d_c_mm</span> / <span className="mono">d_t_mm</span> /{" "}
          <span className="mono">d_e_mm</span> and <span className="mono">nozzle_name: &quot;custom&quot;</span> as the
          named generators’ geometry fields. Custom mix is the same CEA <span className="mono">mixture</span> object as
          a named gas.
        </p>
        <p>
          A point is chamber pressure <i>p</i>
          <sub>inj</sub> plus mass flow ṁ (generator mode), or the same <i>p</i>
          <sub>inj</sub> with assigned specific enthalpy <i>h</i>
          <sub>inj</sub>. <i>h</i>
          <sub>inj</sub> is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3/IPG4 show ṁ
          in g/s; the request still sends <span className="mono">mdot_mg_s</span>. IPG3 has no throat; recovered ṁ is
          approximate. Setup sliders clamp <i>p</i>
          <sub>inj</sub> and ṁ by family — IPG6-S {IPG6_PINJ.min}–{IPG6_PINJ.max}&nbsp;Pa and {IPG6_MDOT.min}–
          {IPG6_MDOT.max}&nbsp;mg/s; IPG4 {IPG4_PINJ.min}–{IPG4_PINJ.max}&nbsp;Pa and {IPG4_MDOT.min / 1000}–
          {IPG4_MDOT.max / 1000}&nbsp;g/s; IPG3 {IPG3_PINJ.min}–{IPG3_PINJ.max}&nbsp;Pa and {IPG3_MDOT.min / 1000}–
          {IPG3_MDOT.max / 1000}&nbsp;g/s. Assigned <i>h</i>
          <sub>inj</sub> is {HINJ_MJ_MIN}–{HINJ_MJ_MAX}&nbsp;MJ/kg (linear). The pinj slider is logarithmic so
          100&nbsp;Pa stays hittable on IPG6-S. These are PWA editor ranges, not facility hardware ratings.
        </p>

        <h2>2. Remote CEA, frozen exit</h2>
        <p>
          Equilibrium composition and rocket stations come from NASA CEA. This app does not reimplement CEA. Generator
          mode inverts ṁ + <i>p</i>
          <sub>inj</sub> for a consistent <i>h</i>
          <sub>inj</sub>; assigned-enthalpy mode uses the typed <i>h</i>
          <sub>inj</sub>. The frozen exit that seeds the jet is
        </p>
        <Eq math={"T_0,\\; U_0,\\; n_0,\\; R,\\; \\mathrm{MW},\\; x_i"} num="(1)" />
        <p>
          <b>
            T0 is the nozzle-exit translational temperature, not the chamber temperature
          </b>
          . U0 is the frozen exit bulk speed (m/s). n0 is the frozen exit number density (m<sup>−3</sup>) — the same{" "}
          <i>n</i>
          <sub>0</sub> the <i>n</i>/<i>n</i>
          <sub>0</sub> field is normalized to. R is the specific gas constant (J/(kg·K)). After a solve the header
          strip also shows n0 and coupled generator power ṁ <i>h</i>
          <sub>inj</sub>, not chamber pressure.
        </p>
        <FigCeaExit />

        <h2>3. Planar collisionless jet</h2>
        <p>
          Every solve sends <span className="mono">plume_mode: &quot;collisionless&quot;</span> and omits{" "}
          <span className="mono">p_tank_Pa</span>. The kernel is the Khasawneh–Cai <b>2-D planar</b> free-molecular map
          from that frozen exit. The round IPG exit is applied as a slit of half-height
        </p>
        <Eq math={"H = D_e/2"} num="(2)" />
        <p>
          The speed ratio and the two lip angles (atan2 so X → 0<sup>+</sup> is defined) are
        </p>
        <Eq math={"S_0 = \\dfrac{U_0}{\\sqrt{2RT_0}}"} num="(3)" />
        <Eq math={"\\theta_1 = \\operatorname{atan2}(Y-H,\\,X),\\quad \\theta_2 = \\operatorname{atan2}(Y+H,\\,X)"} num="(4)" />
        <FigSlit />

        <h2>4. Fluids 2021 integrands</h2>
        <p>
          Where thesis typesetting of the expanded moments is easy to mis-copy (√π versus π), the chemistry API stores
          the Cai &amp; Cai, Fluids 6(7) 250 (2021) A(t), B(t), C(t) form with t = S0 cos θ:
        </p>
        <Eq
          math={
            "A(t)=1+\\sqrt{\\pi}\\, t\\, e^{t^{2}}\\bigl[1+\\operatorname{erf}(t)\\bigr]"
          }
          num="(5)"
        />
        <Eq
          math={
            "B(t)=t+\\sqrt{\\pi}\\Bigl(\\tfrac12+t^{2}\\Bigr)e^{t^{2}}\\bigl[1+\\operatorname{erf}(t)\\bigr]"
          }
          num="(6)"
        />
        <Eq
          math={
            "C(t)=\\tfrac34+\\tfrac12 t^{2}+\\sqrt{\\pi}\\Bigl(t+\\tfrac12 t^{3}\\Bigr)e^{t^{2}}\\bigl[1+\\operatorname{erf}(t)\\bigr]"
          }
          num="(7)"
        />
        <p>
          Each integrand is multiplied by e<sup>−S0²</sup> up front so every term stays bounded:
        </p>
        <Eq math={"I=e^{-S_0^{2}}\\times\\{A,\\,B,\\,C\\},\\qquad t=S_0\\cos\\theta"} num="(8)" />
        <p>
          Equivalently the API evaluates the overflow-safe weight{" "}
          <Eq math={"w(\\theta)=e^{-S_0^{2}\\sin^{2}\\theta}\\bigl[1+\\operatorname{erf}(S_0\\cos\\theta)\\bigr]"} display={false} />{" "}
          and forms IA = e<sup>−S0²</sup> + √π t w, and likewise for IB and IC. Moments on [θ1, θ2] are
        </p>
        <Eq math={"\\dfrac{n}{n_0}=\\dfrac{1}{2\\pi}\\int_{\\theta_1}^{\\theta_2} I_A\\,d\\theta"} num="(9)" />
        <Eq
          math={
            "\\dfrac{U}{\\sqrt{2RT_0}}=\\dfrac{n_0}{n}\\,\\dfrac{1}{2\\pi}\\int_{\\theta_1}^{\\theta_2} I_B\\cos\\theta\\,d\\theta"
          }
          num="(10)"
        />
        <p>
          Transverse velocity uses the closed γ3 form rather than ∫ IB sin θ:
        </p>
        <Eq
          math={
            "\\gamma_3(\\theta)=e^{-S_0^{2}\\sin^{2}\\theta}\\cos\\theta\\bigl[1+\\operatorname{erf}(S_0\\cos\\theta)\\bigr]"
          }
          num="(11)"
        />
        <Eq
          math={
            "\\dfrac{V}{\\sqrt{2RT_0}}=\\dfrac{n_0}{n}\\,\\dfrac{1}{4\\sqrt{\\pi}}\\bigl[\\gamma_3(\\theta_1)-\\gamma_3(\\theta_2)\\bigr]"
          }
          num="(12)"
        />
        <Eq
          math={
            "\\dfrac{T}{T_0}=\\dfrac{2}{3}\\,\\dfrac{n_0}{n}\\,\\dfrac{1}{\\pi}\\int_{\\theta_1}^{\\theta_2} I_C\\,d\\theta-\\dfrac{U^{2}+V^{2}}{3RT_0}"
          }
          num="(13)"
        />
        <p>
          Translational T/T0 is clipped at 0. Speed on the grid is{" "}
          <Eq math={"\\sqrt{U^{2}+V^{2}}"} display={false} />. Frozen total enthalpy on that grid is the API’s{" "}
          <Eq
            math={"h_\\mathrm{static}\\approx h_\\mathrm{ref}+(h_\\mathrm{exit}-h_\\mathrm{ref})\\,(T/T_0)"}
            display={false}
          />
          , then <Eq math={"h_\\mathrm{tot}=h_\\mathrm{static}+\\tfrac12(U^{2}+V^{2})"} display={false} /> (J/kg).
        </p>

        <h2>5. Quadrature and ±y grid</h2>
        <p>
          The chemistry API integrates (IA, IB cos θ, IC) with Gauss–Legendre on [θ1, θ2]. Every Thesis solve posts a
          97×97 plume grid (<span className="mono">nx</span>, <span className="mono">ny</span>; odd, so <i>y</i> = 0
          is a node). The returned mesh spans both signs of <i>y</i>.
        </p>
        <Eq
          math={
            "\\theta(\\xi)=\\tfrac12(\\theta_2-\\theta_1)\\xi+\\tfrac12(\\theta_2+\\theta_1),\\quad \\xi\\in[-1,1]"
          }
          num="(14)"
        />
        <FigQuad />
        <FigGrid />

        <h2>6. Phone field</h2>
        <p>
          Color is a bilinear sample of the selected field (T/T0, n/n0, h_tot, U, M, E) on that same{" "}
          <span className="mono">nx</span>×<span className="mono">ny</span> grid. The map is isotropic (1&nbsp;mm{" "}
          <i>x</i> = 1&nbsp;mm <i>y</i>) and letterboxes rather than stretching the jet. Faint n/n0 is masked so the
          far field stays dark. Isolines are marching squares of the same grid, computed on <i>y</i> ≥ 0 and mirrored.
          Isoline levels are ~10–12 even 1–2–5 steps of the selected field in the current millimetre window (log
          decades if that window spans more than 10× — 1–2–5 × 10<sup>n</sup> per decade when <i>hi</i>/<i>posLo</i> ≥
          10, not equal-Δlog<sub>10</sub>). Pinch packs more curves in the visible span of the same bilinear field —
          not a new CEA solve. The colorbar stays the full-field range.
        </p>
        <FigBilinear />
        <p>
          The Plume figure is full phone width at height <span className="mono">min(48vh, 340px)</span>. Pinch (two
          fingers) zooms about the pinch and pans; one finger stays the station pick. Double-tap or Reset restores the
          fitted window without moving the station. Ticks and isoline labels reflow on the current window and skip
          collisions (nozzle and each other). They are not capped at 5. The empty-state line (“Empty nozzle field —
          Run a point to fill the jet”) shows only when there is no solve. After a solve there is no slogan and no
          hinj footnote on the Plume tab — those facts stay in this Model.
        </p>

        <h2>7. Station</h2>
        <p>
          A <b>station</b> is a green crosshair at the tap — a field sample at (<i>x</i>, <i>y</i>), not a probe. One
          finger sets (<i>x</i>, <i>y</i>) from the isotropic map; a pick within about 12 CSS pixels of the axis snaps{" "}
          <i>y</i> to 0. Two-finger pinch does not move it. Station <i>x</i> and <i>y</i> are typed millimetres in the
          grid. Empty numeric fields keep a string draft while focused and revert on blur rather than becoming 0.
        </p>
        <Eq math={"p_\\mathrm{ram}=n\\, m\\, U^{2},\\qquad q_\\mathrm{inc}=\\tfrac12 n\\, m\\, U^{3}"} num="(15)" />
        <p>
          The grid also shows <i>T</i>, n/n0, <i>U</i>, Mach, Kn, E (directed ½ <i>m</i> <i>U</i>² in eV), E_O, e_th
          (1.5 <i>kT</i>), and h_tot from the bilinear sample at (<i>x</i>, |<i>y</i>|).{" "}
          <span className="mono">p_ram</span> is in Pa; <span className="mono">q_inc</span> is in W/m². They are
          incident free-stream fluxes, not plate-face wall loads. When the grid carries E in eV the phone uses the
          identities 2nE and nUE, which are the same as (15) for E = ½ m U².
        </p>
        <FigStation />

        <h2>8. Characteristics map</h2>
        <p>
          Map is one hinj sweep at a reference pinj. At fixed hinj, composition and T are only weakly p-dependent, so
        </p>
        <Eq math={"\\dot m \\approx k(h)\\, p_\\mathrm{inj}"} num="(16)" />
        <p>
          with <Eq math={"k(h)=\\dot m(h,p_\\mathrm{ref})/p_\\mathrm{ref}"} display={false} /> from that sweep (kg/s/Pa
          on the API column). This PWA does not invent <i>k</i> or a second characteristics call. Extra ṁ and power
          isolines are 1–2–5 traces of the same identity in the current Map window (~12–16 in that span; pinch fills
          the window). Coupled power on a dashed isoline is ṁ <i>h</i>
          <sub>inj</sub>. The hinj axis is the characteristics sweep <span className="mono">hinj_min</span>–
          <span className="mono">hinj_max</span> ({HINJ_MJ_MIN}–{HINJ_MJ_MAX}&nbsp;MJ/kg, <span className="mono">n_h</span>{" "}
          = 29). Map <span className="mono">axesView</span> is <i>p</i> from 0 to{" "}
          <span className="mono">pinjLimits(family).max</span> (IPG6-S 0–{pinjLimits("IPG6-S").max}&nbsp;Pa, IPG4 0–
          {pinjLimits("IPG4").max}&nbsp;Pa, IPG3 0–{pinjLimits("IPG3").max}&nbsp;Pa). Setup sliders use{" "}
          <span className="mono">pinjLimits</span> min–max (IPG6-S {IPG6_PINJ.min}–{IPG6_PINJ.max}&nbsp;Pa, IPG4{" "}
          {IPG4_PINJ.min}–{IPG4_PINJ.max}&nbsp;Pa, IPG3 {IPG3_PINJ.min}–{IPG3_PINJ.max}&nbsp;Pa). Those are not the
          same. Zoom-out cannot exceed that fitted box. Chamber <i>p</i>
          <sub>inj</sub> is shown in Pa. If the wider hinj sweep fails, Map retries{" "}
          <span className="mono">{"{ n_h: 13 }"}</span> without <span className="mono">hinj_min</span>/
          <span className="mono">hinj_max</span> — not a stored previous request. The composition plot does not zoom.
        </p>
        <FigMap />

        <h2>9. What this PWA does not compute</h2>
        <ul>
          <li>No CEA, Navier–Stokes, or DSMC integration in the browser.</li>
          <li>The plume kernel is 2-D planar plus a display mirror — not an axisymmetric or 3-D solve.</li>
          <li>
            <i>h</i>
            <sub>inj</sub> is local/CEA, not cavity-calorimeter bulk.
          </li>
          <li>Custom mix: positive mole fractions normalize to 1 on Run; zeros are omitted.</li>
          <li>
            No tank pressure, freeze switch, or calorimeter body. Every solve still posts{" "}
            <span className="mono">plume_mode: &quot;collisionless&quot;</span> and omits{" "}
            <span className="mono">p_tank_Pa</span> and probe fields.
          </li>
        </ul>

        <h2>10. Copy link</h2>
        <p>
          Setup encodes the current point. Always: <span className="mono">layer, facility, gas, mode, pinj, plume</span>
          . <span className="mono">layer</span> is <span className="mono">thesis</span> and{" "}
          <span className="mono">plume</span> is <span className="mono">collisionless</span>.{" "}
          <span className="mono">mdot</span> only in generator mode; <span className="mono">hinj</span> only in
          enthalpy mode. <span className="mono">mix</span> only for custom gas.{" "}
          <span className="mono">facility=Custom</span> selects Custom IPG; Dc / Dt / De millimetres are not in the
          URL. Opening that Custom link uses <span className="mono">FACILITY_META.Custom</span> diameters (37 / 20 /
          40&nbsp;mm), not the session that produced the link. Named IPG diameters are not in the URL either; they
          come from the table. <span className="mono">probe_x</span> and <span className="mono">probe_y</span>{" "}
          (metres) when a station is placed. Opening that URL applies the fields and does not auto-Run unless{" "}
          <span className="mono">run=1</span>.
        </p>

        <h2>11. References</h2>
        <RefsList ids={THESIS_REF_IDS} />
        <p className="paper-foot">
          Plasma wind tunnel returns to Setup. Plume (i) links here as Model. <BugReportLink />
        </p>
      </article>
    </div>
  );
}
