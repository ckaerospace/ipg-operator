import { useEffect } from "react";
import { goLayer } from "../layer";
import { KN_EXIT_TRIGGER, KN_OBJ_TRIGGER } from "../physics";
import { ADVANCED_REF_IDS } from "../refs";
import { LayerBar } from "./LayerBar";
import { BugReportLink, RefsList } from "./RefsList";

export function ModelPage() {
  useEffect(() => {
    document.title = "PWK3 · Manual";
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
          PWK3
        </a>
        <span>Manual</span>
      </header>
      <div className="paper-layers">
        <LayerBar current="manual" />
      </div>
      <article className="paper-body">
        <h1>PWK3 plume model</h1>
        <p className="lede">
          Operator manual for the three layers. Thesis is a collisionless 2-D jet from a frozen CEA exit. Advanced
          adds a Knudsen switch, sudden-freeze, and an optional tank / barrel–disk overlay. This page is not a
          solver. Chemistry is remote NASA CEA. Nothing here is a Navier–Stokes or DSMC integration in the browser.
          PWK3 is the inductive plasma wind tunnel; this app does not model PWK1/2/4.
        </p>

        <h2>1. What the operator sets</h2>
        <p>
          Generator (IPG6-S, IPG4, IPG3, or Custom Dc / Dt / De) and gas fix the nozzle and the mixture sent to CEA.
          A point is measured chamber pressure <i>p</i>
          <sub>inj</sub> plus mass flow ṁ, or the same <i>p</i>
          <sub>inj</sub> with assigned specific enthalpy <i>h</i>
          <sub>inj</sub>. In Advanced only, Physics chooses Auto / Collisionless / Sudden-freeze, tank pressure{" "}
          <i>p</i>
          <sub>tank</sub> (default 10&nbsp;Pa, typical 0.1–5000&nbsp;Pa) is the background the jet expands into,{" "}
          <i>p</i>
          <sub>∞</sub>, and Object is None (empty jet) or Disk. The operator chrome header stays{" "}
          <span className="mono">PWK3 · {"{generator}"}</span>.
        </p>
        <p>
          <i>h</i>
          <sub>inj</sub> is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3/IPG4 show ṁ
          in g/s; the request still sends <span className="mono">mdot_mg_s</span>.
        </p>

        <h2>2. NASA CEA rocket, assigned enthalpy</h2>
        <p>
          Equilibrium composition and rocket stations come from NASA CEA (Gordon &amp; McBride, NASA RP-1311). This
          app does not reimplement CEA. Generator mode inverts ṁ + <i>p</i>
          <sub>inj</sub> for a consistent <i>h</i>
          <sub>inj</sub>; assigned-enthalpy mode uses the typed <i>h</i>
          <sub>inj</sub> directly.
        </p>
        <p>
          Station 4 is frozen: <b>T0 is the nozzle-exit translational temperature, not the chamber temperature</b>.
          U0 is the frozen exit bulk speed. Mole fractions on the strip are exit values.
        </p>

        <h2>3. Thesis layer: collisionless 2-D jet</h2>
        <p>
          Thesis is the default layer. Every solve sends <span className="mono">plume_mode: "collisionless"</span>.
          Auto and sudden-freeze are not run. Tank pressure, NPR, barrel, Mach disk, and pump stay hidden. A probe
          disk on the centerline is allowed: it is the collisionless (Khasawneh) plate.
        </p>
        <p>
          The kernel is the Khasawneh–Cai 2-D free-molecular map from that frozen CEA exit (Cai &amp; Boyd 2007;{" "}
          <a href="https://doi.org/10.2514/1.25893">doi:10.2514/1.25893</a>,{" "}
          <a href="https://doi.org/10.2514/1.32173">doi:10.2514/1.32173</a>; Khasawneh, Liu &amp; Cai 2010,{" "}
          <a href="https://doi.org/10.1063/1.3490409">doi:10.1063/1.3490409</a>). Tracers spawn on the exit lip and
          follow sampled (<i>u</i>, <i>v</i>). There is no continuum shock system in this layer.
        </p>

        <h2>4. Kn_exit trigger</h2>
        <p>
          Advanced Auto uses a gradient-length Knudsen number at the exit, Kn_exit = <i>λ</i> / <i>H</i>, with
          critical value
        </p>
        <p className="eq">
          Kn_exit = <i>λ</i>/<i>H</i>, &nbsp; KN_CRIT = {KN_EXIT_TRIGGER}
        </p>
        <ul>
          <li>
            Kn_exit ≥ {KN_EXIT_TRIGGER} → collisionless core (Bird 1970,{" "}
            <a href="https://doi.org/10.2514/3.6037">doi:10.2514/3.6037</a>; Bird 1994).
          </li>
          <li>
            Kn_exit &lt; {KN_EXIT_TRIGGER} → sudden-freeze (Boyd, Chen &amp; Candler 1995,{" "}
            <a href="https://doi.org/10.1063/1.868720">doi:10.1063/1.868720</a>).
          </li>
        </ul>
        <p>
          The operator can lock Collisionless or Sudden-freeze. Thesis never consults this switch. The Advanced strip
          prints Kn_exit → chosen mode.
        </p>

        <h2>5. Sudden-freeze</h2>
        <p>
          At higher density the continuum description holds through an isentropic core, then the translational
          temperature is frozen and density falls as a spherical (or cylindrical) expansion
        </p>
        <p className="eq">
          <i>n</i> ∼ 1/<i>R</i>
        </p>
        <p>
          past the freeze surface. The Prandtl–Meyer vacuum cone from the lip is the matching surface onto the
          collisionless exterior. Sudden-freeze is a closure, not a Navier–Stokes field and not a DSMC run (Bird 1994
          is the DSMC reference, not a solver used here).
        </p>

        <h2>6. Advanced tank: barrel and Mach disk</h2>
        <p>
          NPR = <i>p</i>
          <sub>e</sub> / <i>p</i>
          <sub>∞</sub> with <i>p</i>
          <sub>∞</sub> = <i>p</i>
          <sub>tank</sub>. NPR &gt; 1 underexpanded, NPR &lt; 1 overexpanded, NPR ≈ 1 matched.
        </p>
        <p>
          For a strongly underexpanded sonic / near-sonic exit the Mach-disk station is the Crist–Sherman–Glass /
          Addy fit
        </p>
        <p className="eq">
          <i>x</i>
          <sub>m</sub> / <i>D</i>
          <sub>e</sub> = 0.67 √(<i>p</i>
          <sub>e</sub> / <i>p</i>
          <sub>∞</sub>)
        </p>
        <p>
          (Crist, Sherman &amp; Glass 1966, <a href="https://doi.org/10.2514/3.3386">doi:10.2514/3.3386</a>; Addy
          1981, <a href="https://doi.org/10.2514/3.7751">doi:10.2514/3.7751</a>), with barrel geometry after Albini
          (1965) and Boynton (1967) and the plume-review context of Dettleff (1991). The disk itself is a
          Rankine–Hugoniot normal shock. The chemistry API may return <span className="mono">barrel_xy</span>,{" "}
          <span className="mono">x_mach_disk_m</span>, and <span className="mono">shock_applied</span>. Advanced
          strokes a thin barrel (mirrored in <i>y</i>) and a disk segment only when <span className="mono">shock_applied</span>{" "}
          is true. No filled shock hue field.
        </p>
        <p>
          <b>Freeze veto.</b> If Kn_GLL reaches {KN_EXIT_TRIGGER} before the would-be disk station, rarefaction wins
          and <span className="mono">shock_applied</span> is false — no disk is drawn.
        </p>
        <p>
          Overexpanded (<i>p</i>
          <sub>e</sub> &lt; <i>p</i>
          <sub>∞</sub>): an oblique lip shock turns the flow. The local jump is Rankine–Hugoniot; the wave angle
          follows the <i>θ</i>–<i>β</i>–<i>M</i> relation. Only API-returned geometry is stroked.
        </p>

        <h2>7. What is not modeled</h2>
        <ul>
          <li>No Navier–Stokes field and no DSMC in this PWA.</li>
          <li>
            <i>h</i>
            <sub>inj</sub> is local/CEA, not cavity-calorimeter bulk.
          </li>
          <li>IPG3 has no throat; recovered ṁ is approximate.</li>
          <li>No three-dimensional nozzle secondary flow, no unsteady screech, no probe-body interference yet.</li>
        </ul>

        <h2>8. Probe disk</h2>
        <p>
          Thesis always allows a centerline plate. Advanced Object is None (default: no body, probe fields omitted) or
          Disk. When Disk is on, tap the jet (or set <span className="mono">x</span>, <span className="mono">R</span>)
          to place a sample / calorimeter disk on the centerline. Default radius is 20&nbsp;mm (editable 5–50&nbsp;mm).
          Wall temperature is 300&nbsp;K, shown only in Advanced. The disk is a rectangle / ellipse at <i>x</i>, |<i>y</i>
          |&nbsp;&lt;&nbsp;<i>R</i>. A thin bow is stroked in Advanced when the API returns{" "}
          <span className="mono">bow_xy</span> — not a filled sheet over the canvas. Incident <i>n</i>, <i>T</i>,{" "}
          <i>U</i> come from the existing grid sample. Pressure <i>p</i> and heat flux <i>q</i> fill when the solve
          returns <span className="mono">plume.probe</span>.
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
          Kinetic: rarefied jet impingement on a diffuse plate after Khasawneh, Liu &amp; Cai (2010,{" "}
          <a href="https://doi.org/10.1063/1.3490409">doi:10.1063/1.3490409</a>
          ). Continuum: Billig shock shape (
          <a href="https://doi.org/10.2514/3.28969">doi:10.2514/3.28969</a>
          ) with Newtonian surface pressure and a stagnation-point heat flux. The chemistry API may return{" "}
          <span className="mono">probe_x_m</span>, <span className="mono">probe_r_mm</span>,{" "}
          <span className="mono">probe_Tw_K</span> on the request and <span className="mono">plume.probe</span> on the
          response. If those fields are not yet accepted, the disk is still drawn and the incident sample is shown.
        </p>
        <p>
          A Copy link control on Setup encodes the current point in the URL (
          <span className="mono">
            layer, facility, gas, mode, pinj, mdot, hinj, ptank, plume, object, probe_x, probe_r
          </span>
          ). Opening that URL applies the fields and does not auto-Run unless <span className="mono">run=1</span>.
        </p>

        <h2>9. Planned</h2>
        <p>Pump / tank volume, not implemented:</p>
        <p className="eq">
          <i>V</i> d<i>p</i>/d<i>t</i> = ṁ <i>RT</i>/<i>M</i> − <i>S</i> <i>p</i>
        </p>
        <p>
          with <i>S</i> the effective pumping speed. Advanced leaves room for pump on/off; it is not wired yet.
        </p>

        <h2>10. References</h2>
        <RefsList ids={ADVANCED_REF_IDS} />
        <p className="paper-foot">
          Thesis and Advanced return to Setup. Plume (i) links here as Manual.{" "}
          <BugReportLink />
        </p>
      </article>
    </div>
  );
}
