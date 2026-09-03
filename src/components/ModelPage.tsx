import { useEffect } from "react";
import { HINJ_MJ_MAX, HINJ_MJ_MIN, mdotMgLimits, pinjLimits } from "../facility";
import { goLayer } from "../layer";
import { THESIS_REF_IDS } from "../refs";
import { LayerBar } from "./LayerBar";
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
    <div className="paper">
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
        <h1>Plume model</h1>
        <p className="lede">
          Operator note for this console. The jet is the collisionless Khasawneh–Cai 2-D planar map from a frozen NASA
          CEA exit. Model is a page link (not a solve chip). This page is not a solver. Chemistry is remote NASA CEA
          (Gordon &amp; McBride, NASA RP-1311). This PWA does not reimplement CEA, Navier–Stokes, or DSMC. Operator
          chrome is <span className="mono">Plasma wind tunnel · {"{generator}"}</span>.
        </p>

        <h2>1. What the operator sets</h2>
        <p>
          Generator (IPG6-S, IPG4, IPG3, or Custom Dc / Dt / De) and gas fix the nozzle and the mixture sent to CEA.
          Named gases are O2, CO2, N2, Air, HeO2, and Ar. Custom gas is a mole mix of O2, N2, CO2, He, and Ar — not a
          new solver. H2 and CH4 are not in the phone editor. Custom diameters are 1–499&nbsp;mm; empty numeric drafts
          revert on blur and do not become 0. Custom Dt picks the ṁ / pinj family: ≥70&nbsp;mm IPG3-like, ≥45&nbsp;mm
          IPG4-like, else IPG6-S. Custom IPG posts the same <span className="mono">d_c_mm</span> /{" "}
          <span className="mono">d_t_mm</span> / <span className="mono">d_e_mm</span> and{" "}
          <span className="mono">nozzle_name: &quot;custom&quot;</span> as the named generators’ geometry fields. Custom
          mix is the same CEA <span className="mono">mixture</span> object as a named gas.
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

        <h2>2. NASA CEA, frozen exit</h2>
        <p>
          Equilibrium composition and rocket stations come from NASA CEA. This app does not reimplement CEA. Generator
          mode inverts ṁ + <i>p</i>
          <sub>inj</sub> for a consistent <i>h</i>
          <sub>inj</sub>; assigned-enthalpy mode uses the typed <i>h</i>
          <sub>inj</sub>. Every solve posts a 97×97 plume grid (<span className="mono">nx</span>,{" "}
          <span className="mono">ny</span>; odd, so <i>y</i> = 0 is a node). Color map and isolines sample that same
          grid (bilinear / marching squares, no spline).
        </p>
        <p>
          Station 4 is frozen: <b>T0 is the nozzle-exit translational temperature, not the chamber temperature</b>. U0
          is the frozen exit bulk speed. Mole fractions on the strip are exit values. After a solve the header strip
          also shows <span className="mono">n0</span> (frozen CEA exit number density — the same <i>n</i>
          <sub>0</sub> the <i>n</i>/<i>n</i>
          <sub>0</sub> field is normalized to) and coupled generator power ṁ <i>h</i>
          <sub>inj</sub>, not chamber pressure.
        </p>

        <h2>3. Collisionless 2-D planar jet</h2>
        <p>
          Every solve sends <span className="mono">plume_mode: "collisionless"</span> and omits{" "}
          <span className="mono">p_tank_Pa</span>.
        </p>
        <p>
          The kernel is the Khasawneh–Cai <b>2-D planar</b> free-molecular map from that frozen CEA exit (Cai &amp;
          Boyd 2007, <a href="https://doi.org/10.2514/1.25893">doi:10.2514/1.25893</a>,{" "}
          <a href="https://doi.org/10.2514/1.32173">doi:10.2514/1.32173</a>; Khasawneh, Liu &amp; Cai 2010,{" "}
          <a href="https://doi.org/10.1063/1.3490409">doi:10.1063/1.3490409</a>).           The chemistry API returns a grid that
          spans both signs of <i>y</i> (±<i>y</i>). The jet is 2-D planar — not
          axisymmetric, not 3-D.
        </p>
        <p>
          Color is a bilinear sample of the selected field (T/T0, n/n0, h_tot, U, M, E) on the{" "}
          <span className="mono">nx</span>×<span className="mono">ny</span> grid. Isolines are marching squares of
          that same grid. Isoline levels are ~10–12 even 1–2–5 steps of the selected field in the current millimetre
          window (log decades if that window spans more than 10× — 1–2–5 × 10<sup>n</sup> per decade when <i>hi</i>/
          <i>posLo</i> ≥ 10, not equal-Δlog<sub>10</sub>). Pinch packs more curves in the
          visible span of the same bilinear field — not a new CEA solve and not a scribble at the fitted view. The
          colorbar stays the full-field range. Changing the field chip, placing a station, or pinching is not a new CEA
          solve.
        </p>
        <p>
          The Plume figure is full phone width at height <span className="mono">min(48vh, 340px)</span>. The
          millimetre map stays isotropic (1&nbsp;mm <i>x</i> = 1&nbsp;mm <i>y</i>); a wide wrap letterboxes and never
          stretches the jet. Pinch (two fingers) zooms about the pinch and pans; one finger stays the station pick.
          Double-tap or Reset restores the fitted window without moving the station. Ticks and isoline labels reflow
          on the current window and skip collisions (nozzle and each other). They are not capped at 5 — a fitted jet
          with ~12 curves can show more than five numbers, and pinch keeps labels on the new 1–2–5 set. The station
          grid has a real row gap. The empty-state line (“Empty nozzle field — Run a point to fill the jet”) shows only
          when there is no solve. After a solve there is no slogan and no hinj footnote on the Plume tab — those facts
          stay in this Model (§1, §6). The readout is clipped inside the Plume pane and does not cover Setup / Map
          tabs. The Map <i>p</i>
          <sub>inj</sub>–<i>h</i>
          <sub>inj</sub> figure pinches the same way. The hinj axis is the characteristics sweep{" "}
          <span className="mono">hinj_min</span>–<span className="mono">hinj_max</span> ({HINJ_MJ_MIN}–{HINJ_MJ_MAX}
          &nbsp;MJ/kg, <span className="mono">n_h</span> = 29). Map <span className="mono">axesView</span> is{" "}
          <i>p</i>0: 0 to <span className="mono">pinjLimits(family).max</span> (IPG6-S 0–
          {pinjLimits("IPG6-S").max}&nbsp;Pa, IPG4 0–{pinjLimits("IPG4").max}&nbsp;Pa, IPG3 0–
          {pinjLimits("IPG3").max}&nbsp;Pa). Setup sliders use <span className="mono">pinjLimits</span> min–max
          (IPG6-S {IPG6_PINJ.min}–{IPG6_PINJ.max}&nbsp;Pa, IPG4 {IPG4_PINJ.min}–{IPG4_PINJ.max}&nbsp;Pa, IPG3{" "}
          {IPG3_PINJ.min}–{IPG3_PINJ.max}&nbsp;Pa). Those are not the same.
          Extra ṁ and power isolines are
          1–2–5 traces of the same computed <i>k</i>(<i>h</i>)×<i>p</i>
          <sub>inj</sub> identity in the current Map window (~12–16 in that span; pinch fills the window, fitted
          density stays similar). This PWA does not invent <i>k</i> or a second characteristics call. Zoom-out cannot
          exceed that fitted box. Chamber <i>p</i>
          <sub>inj</sub> is shown in Pa. If the wider hinj sweep fails, Map retries{" "}
          <span className="mono">{"{ n_h: 13 }"}</span> without <span className="mono">hinj_min</span>/
          <span className="mono">hinj_max</span> — not a stored previous characteristics request. Labels reflow. The
          composition plot does not zoom.
        </p>

        <h2>4. Station</h2>
        <p>
          A <b>station</b> is a green crosshair at the tap — a field sample at (<i>x</i>, <i>y</i>), not a probe.
        </p>
        <p>
          One-finger pointer down/move sets (<i>x</i>, <i>y</i>) from the isotropic map; a pick within about 12 CSS
          pixels of the axis snaps <i>y</i> to 0 (soft — drag off the band and it leaves). Two-finger pinch does not
          move it. The marker sits at that signed point. Station <i>x</i> and <i>y</i> are typed millimetres in the
          grid (same commit as a tap); there is no bulky editor above the jet. Empty numeric fields keep a string draft
          while focused and revert on blur rather than becoming 0. The grid also shows <i>T</i>, n/n0, <i>U</i>, Mach,
          Kn, E (directed ½ <i>m</i> <i>U</i>² in eV), E_O, e_th (1.5 <i>kT</i>), h_tot,{" "}
          <span className="mono">p_ram</span>, and <span className="mono">q_inc</span> from the bilinear sample at (
          <i>x</i>, |<i>y</i>|). <span className="mono">p_ram</span> = <i>n</i> <i>m</i> <i>U</i>² and{" "}
          <span className="mono">q_inc</span> = ½ <i>n</i> <i>m</i> <i>U</i>³ are incident free-stream fluxes at the
          station.
        </p>

        <h2>5. What is not in this PWA</h2>
        <ul>
          <li>No CEA, Navier–Stokes, or DSMC integration in the browser.</li>
          <li>The plume kernel is 2-D planar plus a display mirror — not an axisymmetric or 3-D solve.</li>
          <li>
            <i>h</i>
            <sub>inj</sub> is local/CEA, not cavity-calorimeter bulk.
          </li>
          <li>Custom gas has no H2 or CH4. Positive mole fractions normalize to 1 on Run; zeros are omitted.</li>
          <li>
            No Advanced chip, Object Probe, tank pressure, Freeze, Disk, or Collisionless / Auto / Sudden freeze
            switch. Every solve still posts <span className="mono">plume_mode: &quot;collisionless&quot;</span> and
            omits <span className="mono">p_tank_Pa</span> and probe fields.
          </li>
        </ul>

        <h2>6. Copy link</h2>
        <p>
          Setup encodes the current point. Always: <span className="mono">layer, facility, gas, mode, pinj, plume</span>
          . <span className="mono">layer</span> is <span className="mono">thesis</span> and{" "}
          <span className="mono">plume</span> is <span className="mono">collisionless</span>.{" "}
          <span className="mono">mdot</span> only in generator mode; <span className="mono">hinj</span> only in
          enthalpy mode. <span className="mono">mix</span> only for custom gas.{" "}
          <span className="mono">facility=Custom</span> selects Custom IPG; Dc / Dt / De millimetres are not in the
          URL. Opening that Custom link uses <span className="mono">FACILITY_META.Custom</span> diameters (37 / 20 /
          40&nbsp;mm), not the session that produced the link. Named IPG diameters are not in the URL either; they
          come from the table. <span className="mono">probe_x</span> and{" "}
          <span className="mono">probe_y</span> (metres) when a station is placed. Opening that URL applies the fields
          and does not auto-Run unless <span className="mono">run=1</span>.
        </p>

        <h2>7. References</h2>
        <RefsList ids={THESIS_REF_IDS} />
        <p className="paper-foot">
          Plasma wind tunnel returns to Setup. Plume (i) links here as Model. <BugReportLink />
        </p>
      </article>
    </div>
  );
}
