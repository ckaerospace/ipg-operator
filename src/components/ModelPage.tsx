import { useEffect } from "react";
import { HINJ_MJ_MAX, HINJ_MJ_MIN, mdotMgLimits, pinjLimits } from "../facility";
import { goLayer } from "../layer";
import { MACH_DISK_LABEL, SHOCK_OVERLAY_CAPTION } from "../canvas/plume";
import {
  KN_EXIT_TRIGGER,
  KN_OBJ_TRIGGER,
  P_TANK_DEFAULT,
  P_TANK_MAX,
  P_TANK_MIN,
  TANK_SOLVE_DEBOUNCE_MS,
} from "../physics";
import { ADVANCED_REF_IDS } from "../refs";
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
          Operator note for Thesis and Advanced. Thesis and Advanced are the only solve-mode chips. Model is a page
          link (not a third solve chip). This page is not a solver. Chemistry is remote NASA CEA (Gordon &amp;
          McBride, NASA RP-1311). This PWA does not reimplement CEA, Navier–Stokes, or DSMC. PWK3 is the IRS inductive
          plasma wind tunnel. Operator chrome is <span className="mono">Plasma wind tunnel · {"{generator}"}</span>.
        </p>

        <h2>1. What the operator sets</h2>
        <p>
          Generator (IPG6-S, IPG4, IPG3, or Custom Dc / Dt / De) and gas fix the nozzle and the mixture sent to CEA.
          Named gases are O2, CO2, N2, Air, HeO2, and Ar. Custom gas is a mole mix of O2, N2, CO2, He, and Ar — not a
          new solver. H2 and CH4 are not in the phone editor.
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
        <p>
          In Advanced only: Physics is Auto / Collisionless / Sudden-freeze; tank pressure <i>p</i>
          <sub>tank</sub> (default {P_TANK_DEFAULT}&nbsp;Pa, clamp {P_TANK_MIN}–{P_TANK_MAX}&nbsp;Pa) is the
          background <i>p</i>
          <sub>∞</sub>; Object is None (default) or Probe. Setup keeps a number field and does not auto-Run when it
          changes. The live control is a compact log slider on the Plume tab (tank pressure / <i>p</i>
          <sub>∞</sub>), under the figure, not a second page. Thesis has no tank row, no NPR, no Plume slider, and no
          probe editors.
        </p>

        <h2>2. NASA CEA, frozen exit</h2>
        <p>
          Equilibrium composition and rocket stations come from NASA CEA. This app does not reimplement CEA. Generator
          mode inverts ṁ + <i>p</i>
          <sub>inj</sub> for a consistent <i>h</i>
          <sub>inj</sub>; assigned-enthalpy mode uses the typed <i>h</i>
          <sub>inj</sub>. Every solve posts a 49×49 plume grid (<span className="mono">nx</span>,{" "}
          <span className="mono">ny</span>).
        </p>
        <p>
          Station 4 is frozen: <b>T0 is the nozzle-exit translational temperature, not the chamber temperature</b>. U0
          is the frozen exit bulk speed. Mole fractions on the strip are exit values.
        </p>

        <h2>3. Thesis: collisionless 2-D planar jet</h2>
        <p>
          Thesis is the default layer. Every solve sends <span className="mono">plume_mode: "collisionless"</span> and
          omits <span className="mono">p_tank_Pa</span>. Auto and sudden-freeze are not run. Tank pressure, NPR,
          barrel, and Mach disk stay hidden.
        </p>
        <p>
          The kernel is the Khasawneh–Cai <b>2-D planar</b> free-molecular map from that frozen CEA exit (Cai &amp;
          Boyd 2007, <a href="https://doi.org/10.2514/1.25893">doi:10.2514/1.25893</a>,{" "}
          <a href="https://doi.org/10.2514/1.32173">doi:10.2514/1.32173</a>; Khasawneh, Liu &amp; Cai 2010,{" "}
          <a href="https://doi.org/10.1063/1.3490409">doi:10.1063/1.3490409</a>). The chemistry API returns a grid with{" "}
          <i>y</i> ≥ 0. The full-plume display is a <b>mirror about <i>y</i> = 0</b> of that 2-D solution — not
          axisymmetric, not 3-D.
        </p>
        <p>
          Color is a bilinear sample of the selected field (T/T0, n/n0, h_tot, U, M, E) on the{" "}
          <span className="mono">nx</span>×<span className="mono">ny</span> grid. Isolines are marching squares of
          that same grid: about twelve even steps of the selected field, or equal log<sub>10</sub> spacing when{" "}
          <i>hi</i>/<i>lo</i> ≥ 10, then snapped to 1–2–5. The field is never tinted by barrel or Mach disk. Changing
          the field chip, placing a station, or pinching is not a new CEA solve.
        </p>
        <p>
          The Plume figure is full phone width at height <span className="mono">min(48vh, 340px)</span>. The
          millimetre map stays isotropic (1&nbsp;mm <i>x</i> = 1&nbsp;mm <i>y</i>); a wide wrap letterboxes and never
          stretches the jet. Pinch (two fingers) zooms about the pinch and pans; one finger stays the station pick.
          Double-tap or Reset restores the fitted window without moving the station. Ticks and isoline labels
          re-layout on the current view and skip the Mach disk / “shock overlay” boxes. The station grid has a real
          row gap. The empty-state line (“Empty nozzle field — Run a point to fill the jet”) shows only when there is
          no solve. After a solve there is no slogan and no hinj footnote on the Plume tab — those facts stay in this
          Model (§1, §7). The readout is clipped inside the Plume pane and does not cover Setup / Map
          tabs or the Thesis / Advanced chips. The Map <i>p</i>
          <sub>inj</sub>–<i>h</i>
          <sub>inj</sub> figure pinches the same way. The hinj axis is the characteristics sweep{" "}
          <span className="mono">hinj_min</span>–<span className="mono">hinj_max</span> ({HINJ_MJ_MIN}–{HINJ_MJ_MAX}
          &nbsp;MJ/kg, <span className="mono">n_h</span> = 29). The pinj box is the Setup family clamp (IPG6-S 0–
          {pinjLimits("IPG6-S").max}&nbsp;Pa, IPG4 0–{pinjLimits("IPG4").max}&nbsp;Pa, IPG3 0–
          {pinjLimits("IPG3").max}&nbsp;Pa) — not the API catalog clip 250/5000/3000. Extra ṁ and power isolines are
          denser 1–2–5 traces of the same computed <i>k</i>(<i>h</i>)×<i>p</i>
          <sub>inj</sub> identity on that box; this PWA does not invent <i>k</i> or a second characteristics call.
          Zoom-out cannot exceed that fitted box. Pa | kPa is display only (internal <span className="mono">pinj_Pa</span>{" "}
          stays pascals). If the wider hinj sweep fails, Map falls back to the previous characteristics request and
          still uses the returned hinj axes. Labels reflow.
          The composition plot does not zoom.
        </p>

        <h2>4. Station and probe</h2>
        <p>
          Three different marks on Plume: a <b>station</b> is a green crosshair at the tap (field sample); a{" "}
          <b>probe</b> is a filled centerline calorimeter plate (Advanced Object Probe only); a <b>Mach disk</b> is a
          gold free-jet shock chord (Advanced, when <span className="mono">shock_applied</span>). They are not the
          same object.
        </p>
        <p>
          A station is always available — Thesis and Advanced, Object None or Probe. One-finger pointer down/move sets
          (<i>x</i>, <i>y</i>) from the isotropic map; two-finger pinch does not move it. The marker sits at that
          signed point. The grid shows <i>x</i>, <i>y</i>, <i>T</i>, n/n0, <i>U</i>, Mach, Kn, E (directed ½ <i>m</i>{" "}
          <i>U</i>² in eV), E_O, e_th (1.5 <i>kT</i>), and h_tot from the bilinear sample at (<i>x</i>, |<i>y</i>|).
          The tap is not a probe and not a Mach disk. Thesis has no probe chrome and no R / Tw / x editors.
        </p>
        <p>
          Advanced Object Probe adds a <b>centerline</b> calorimeter plate — not a shock. Setup next to None|Probe
          edits probe R (5–50&nbsp;mm, default 20) and Tw (200–2000&nbsp;K, default 300). There is no <i>x</i> editor
          on Plume or Setup: tap sets station (<i>x</i>, <i>y</i>), and the plate uses that same <i>x</i> on the
          centerline. <span className="mono">p_probe</span> (plate face pressure) and{" "}
          <span className="mono">q_probe</span> (plate heat flux) fill only after Run at that <i>x</i>, <i>R</i> —
          not on every drag. They are not tank <i>p</i>
          <sub>∞</sub> and not field-sample cells. Object None has no plate and no p_probe / q_probe row; the
          (<i>x</i>, <i>y</i>) station still works. Request fields{" "}
          <span className="mono">probe_x_m</span>, <span className="mono">probe_r_mm</span>,{" "}
          <span className="mono">probe_Tw_K</span> are posted only for Advanced Probe when a station <i>x</i> is set.
          If the chemistry API rejects those keys (HTTP 422), the solve is retried without them; the plate is still
          drawn and the incident sample is shown.
        </p>
        <p>
          Regime uses object Knudsen number Kn_obj = <i>λ</i> / (2<i>R</i>) with trigger
        </p>
        <p className="eq">
          Kn_obj ≥ {KN_OBJ_TRIGGER} → kinetic (Khasawneh diffuse plate)
          <br />
          Kn_obj &lt; {KN_OBJ_TRIGGER} → continuum (Billig / Newtonian + stagnation heat)
        </p>
        <p>
          When the API has not returned Kn_obj, the console estimates it from the grid Kn and exit length <i>H</i>.
          Kinetic: rarefied jet impingement on a diffuse plate after Khasawneh, Liu &amp; Cai (2010,{" "}
          <a href="https://doi.org/10.1063/1.3490409">doi:10.1063/1.3490409</a>
          ). Continuum: Billig shock shape (
          <a href="https://doi.org/10.2514/3.28969">doi:10.2514/3.28969</a>) with Newtonian surface pressure and a
          stagnation-point heat flux, as returned on <span className="mono">plume.probe</span>.
        </p>

        <h2>5. Advanced Auto and sudden-freeze</h2>
        <p>
          Advanced Auto uses a gradient-length Knudsen number at the exit, Kn_exit = <i>λ</i> / <i>H</i> (
          <span className="mono">kn_gll_exit</span>), with
        </p>
        <p className="eq">
          Kn_exit = <i>λ</i>/<i>H</i>, &nbsp; KN_CRIT = {KN_EXIT_TRIGGER}
        </p>
        <ul>
          <li>
            Kn_exit ≥ {KN_EXIT_TRIGGER} → collisionless (Bird 1970,{" "}
            <a href="https://doi.org/10.2514/3.6037">doi:10.2514/3.6037</a>; Bird 1994).
          </li>
          <li>
            Kn_exit &lt; {KN_EXIT_TRIGGER} → sudden-freeze (Boyd, Chen &amp; Candler 1995,{" "}
            <a href="https://doi.org/10.1063/1.868720">doi:10.1063/1.868720</a>).
          </li>
        </ul>
        <p>
          The operator can lock Collisionless or Sudden-freeze. Thesis never consults this switch. The Advanced strip
          prints Kn_exit → the mode the chemistry API chose. This PWA does not integrate the switch locally; it posts{" "}
          <span className="mono">plume_mode</span> and displays <span className="mono">plume.mode</span>.
        </p>
        <p>
          Sudden-freeze is the chemistry server’s kernel when Advanced posts{" "}
          <span className="mono">plume_mode: "sudden_freeze"</span> (or Auto selects it). This PWA does not integrate a
          freeze surface. It is not a Navier–Stokes field and not a DSMC run here (Bird 1994 is the DSMC reference,
          not a solver used in this app).
        </p>

        <h2>6. Advanced tank: barrel and Mach disk</h2>
        <p>
          After a solve, the Advanced Setup strip prints Kn_exit → <span className="mono">plume.mode</span> and, when
          NPR is available, underexpanded / overexpanded / matched (thresholds 1.05 and 0.95). NPR is the API{" "}
          <span className="mono">npr</span> when present, otherwise <i>p</i>
          <sub>e</sub> / <i>p</i>
          <sub>tank</sub>.
        </p>
        <p>
          For a strongly underexpanded sonic / near-sonic exit the Mach disk axial location on the chemistry server is
          the Crist–Sherman–Glass / Addy fit
        </p>
        <p className="eq">
          <i>x</i>
          <sub>m</sub> / <i>D</i>
          <sub>e</sub> ≈ 0.67 √(<i>p</i>
          <sub>e</sub> / <i>p</i>
          <sub>∞</sub>)
        </p>
        <p>
          (Crist, Sherman &amp; Glass 1966, <a href="https://doi.org/10.2514/3.3386">doi:10.2514/3.3386</a>; Addy 1981,{" "}
          <a href="https://doi.org/10.2514/3.7751">doi:10.2514/3.7751</a>). This PWA does not evaluate that formula.
          When <span className="mono">shock_applied</span> is true and <span className="mono">x_mach_disk_m</span> is
          finite it strokes a Mach disk chord at that station and, if <span className="mono">barrel_xy</span> has at
          least two points, that polyline mirrored in <i>y</i>.
          The canvas label is “{MACH_DISK_LABEL}” on or beside the gold chord, with a small “{SHOCK_OVERLAY_CAPTION}”
          caption on the next line — not stacked on an isoline number. Isoline labels skip those boxes. Barrel is a
          pale dashed outline; the Mach disk is a brighter, thicker gold stroke with a dark halo — not a filled shock
          hue, and the bilinear field is never tinted by shocks.
          Station (green pick), probe plate, and Mach disk are three different glyphs. Thesis never draws this overlay.
          Object None still shows the Mach disk in
          Advanced when shocks apply — the probe is not required. A thin bow is the probe-plate bow (Advanced Object
          Probe), stroked from <span className="mono">bow_xy</span> with the plate glyph — not the Mach disk, and not
          drawn on Thesis or Object None.
        </p>
        <p>
          On Plume in Advanced a log slider ({P_TANK_MIN}–{P_TANK_MAX}&nbsp;Pa) under the figure updates <i>p</i>
          <sub>tank</sub> immediately and debounces a solve ({TANK_SOLVE_DEBOUNCE_MS}&nbsp;ms after the last drag) so
          barrel and Mach disk can move. CEA is not posted on every pointer move. Setup’s number field stays in sync
          and does not auto-Run. Advanced still posts <span className="mono">p_tank_Pa</span> in Collisionless; the
          API ignores it for that kernel. The slider may still refresh NPR if the response includes it, but this PWA
          never invents a Mach disk. Auto / sudden-freeze overlays still follow{" "}
          <span className="mono">shock_applied</span> — this PWA does not evaluate Crist–Addy locally.
        </p>
        <p>
          <b>Freeze veto.</b> This PWA does not compute a local freeze veto. Barrel and Mach disk draw only when{" "}
          <span className="mono">shock_applied</span> is true and <span className="mono">x_mach_disk_m</span> is
          finite. If the chemistry server leaves <span className="mono">shock_applied</span> false, no overlay is
          drawn.
        </p>

        <h2>7. What is not in this PWA</h2>
        <ul>
          <li>No CEA, Navier–Stokes, or DSMC integration in the browser.</li>
          <li>
            The plume kernel is 2-D planar plus a display mirror — not an axisymmetric or 3-D solve.
          </li>
          <li>
            <i>h</i>
            <sub>inj</sub> is local/CEA, not cavity-calorimeter bulk.
          </li>
          <li>Custom gas has no H2 or CH4.</li>
        </ul>

        <h2>8. Copy link</h2>
        <p>
          Setup encodes the current point. Always: <span className="mono">layer, facility, gas, mode, pinj, plume</span>
          . <span className="mono">mix</span> only for custom gas. <span className="mono">mdot</span> only in
          generator mode; <span className="mono">hinj</span> only in enthalpy mode.{" "}
          <span className="mono">ptank</span> and <span className="mono">object</span> only on Advanced.{" "}
          <span className="mono">probe_x</span> and <span className="mono">probe_y</span> (metres) when a station is
          placed — Thesis or Advanced. <span className="mono">probe_r</span> (mm) only for Advanced Object Probe (URL
          key <span className="mono">object=disk</span>). Opening that URL applies the fields and does not auto-Run
          unless <span className="mono">run=1</span>.
        </p>

        <h2>9. References</h2>
        <RefsList ids={ADVANCED_REF_IDS} />
        <p className="paper-foot">
          Thesis and Advanced return to Setup. Plume (i) links here as Model. <BugReportLink />
        </p>
      </article>
    </div>
  );
}
