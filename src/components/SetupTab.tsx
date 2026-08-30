import { useState } from "react";
import {
  clampHinj,
  FACILITY_META,
  GASES,
  HINJ_MJ_MAX,
  HINJ_MJ_MIN,
  HINJ_MJ_STEP,
  KNOWN_POINTS,
  type AxisFamily,
} from "../facility";
import { fmtFixed, fmtMdot, fmtPinjPa } from "../format";
import type { AppLayer } from "../layer";
import { CUSTOM_SPECIES, mixtureSum, type CustomMix } from "../mixture";
import {
  clampDiskRmm,
  clampProbeTw,
  DISK_R_MM_MAX,
  DISK_R_MM_MIN,
  PINJ_SLIDER_STEPS,
  pinjPaToSlider,
  P_TANK_MAX,
  P_TANK_MIN,
  sliderToPinjPa,
} from "../physics";
import { copyText } from "../shareUrl";
import type { FacilityId, GasId, JetObject, PlumeMode, SolveMode } from "../types";
import { DraftNumber } from "./DraftNumber";
import { LayerBar } from "./LayerBar";

type Props = {
  facility: FacilityId;
  gas: GasId;
  customMix: CustomMix;
  custom: { dc: number; dt: number; de: number };
  mode: SolveMode;
  plumeMode: PlumeMode;
  pinj: number;
  mdot_mg_s: number;
  hinj: number;
  pTank: number;
  family: AxisFamily;
  pinjLim: { min: number; max: number; step: number };
  mdotLim: { min: number; max: number };
  kn: number | null;
  plumeSolvedMode: string | null;
  npr: number | null;
  regime: string | null;
  layer: AppLayer;
  onFacility: (id: FacilityId) => void;
  onGas: (id: GasId) => void;
  onCustomMix: (mix: CustomMix) => void;
  onCustom: (patch: Partial<{ dc: number; dt: number; de: number }>) => void;
  onMode: (m: SolveMode) => void;
  onPlumeMode: (m: PlumeMode) => void;
  onPinj: (v: number) => void;
  onMdot: (mg: number) => void;
  onHinj: (v: number) => void;
  onPTank: (v: number) => void;
  onKnown: (id: string) => void;
  onLayer: (layer: "thesis" | "advanced") => void;
  objectKind: JetObject;
  onObject: (kind: JetObject) => void;
  diskR: number;
  diskTw: number;
  onDiskR: (r: number) => void;
  onDiskTw: (t: number) => void;
  shareHref: string;
};

const FACILITIES: FacilityId[] = ["IPG6-S", "IPG4", "IPG3", "Custom"];

export function SetupTab(p: Props) {
  const grams = p.family !== "IPG6-S";
  const meta = FACILITY_META[p.facility];
  const mdotShow = grams ? p.mdot_mg_s / 1000 : p.mdot_mg_s;
  const mdotMin = grams ? p.mdotLim.min / 1000 : p.mdotLim.min;
  const mdotMax = grams ? p.mdotLim.max / 1000 : p.mdotLim.max;
  const mdotStep = grams ? 0.01 : 0.1;

  const advanced = p.layer === "advanced";

  return (
    <div className="scroll">
      <LayerBar current={p.layer === "manual" ? "thesis" : p.layer} onThesisOrAdvanced={p.onLayer} />

      <div className="h-label">Generator</div>
      <div className="chips">
        {FACILITIES.map((id) => (
          <button key={id} className={`chip${p.facility === id ? " on" : ""}`} onClick={() => p.onFacility(id)}>
            {id}
          </button>
        ))}
      </div>

      {p.facility !== "Custom" ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="title">{meta.label}</div>
          <div className="geo">
            <div>
              <span>Dc</span> {meta.dc} mm
            </div>
            <div>
              <span>Dt</span> {meta.dt} mm
            </div>
            <div>
              <span>De</span> {meta.de} mm
            </div>
            <div>
              <span>nozzle</span> {meta.nozzle}
            </div>
            <div>
              <span>ṁ</span> {meta.label === "IPG6-S" ? "mg/s" : "g/s"}
            </div>
            <div>
              <span>default gas</span> {meta.defaultGas}
            </div>
          </div>
        </div>
      ) : (
        <div className="fields three" style={{ marginTop: 12 }}>
          {(
            [
              ["Dc mm", "dc", p.custom.dc],
              ["Dt mm", "dt", p.custom.dt],
              ["De mm", "de", p.custom.de],
            ] as const
          ).map(([lab, key, val]) => (
            <label className="field" key={key}>
              {lab}
              <DraftNumber
                value={val}
                min={1}
                max={499}
                step={0.5}
                aria-label={lab}
                onCommit={(n) => p.onCustom({ [key]: n })}
              />
            </label>
          ))}
        </div>
      )}

      <div className="h-label">Gas</div>
      <div className="chips">
        {GASES.map((g) => (
          <button key={g.id} className={`chip${p.gas === g.id ? " on" : ""}`} onClick={() => p.onGas(g.id)}>
            {g.label}
          </button>
        ))}
        <button className={`chip${p.gas === "custom" ? " on" : ""}`} onClick={() => p.onGas("custom")}>
          Custom
        </button>
      </div>
      {p.gas === "custom" && <MixEditor mix={p.customMix} onChange={p.onCustomMix} />}

      <div className="h-label">Generator setup</div>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={`chip${p.mode === "generator" ? " on" : ""}`} onClick={() => p.onMode("generator")}>
          MFC + pinj
        </button>
        <button className={`chip${p.mode === "enthalpy" ? " on" : ""}`} onClick={() => p.onMode("enthalpy")}>
          Assigned hinj
        </button>
      </div>

      <div className="slider">
        <div className="row">
          <div className="name">measured pinj</div>
          <div className="val">{fmtPinjPa(p.pinj)}</div>
        </div>
        <input
          type="range"
          min={0}
          max={PINJ_SLIDER_STEPS}
          step={1}
          value={pinjPaToSlider(p.pinj, p.pinjLim.min, p.pinjLim.max)}
          onChange={(e) =>
            p.onPinj(sliderToPinjPa(Number(e.target.value), p.pinjLim.min, p.pinjLim.max, p.pinjLim.step))
          }
          aria-label="Chamber pressure, logarithmic"
          aria-valuemin={p.pinjLim.min}
          aria-valuemax={p.pinjLim.max}
          aria-valuenow={p.pinj}
        />
      </div>

      {p.mode === "generator" ? (
        <div className="slider">
          <div className="row">
            <div className="name">MFC mass flow</div>
            <div className="val">{fmtMdot(p.mdot_mg_s, p.family)}</div>
          </div>
          <input
            type="range"
            min={mdotMin}
            max={mdotMax}
            step={mdotStep}
            value={Math.min(mdotMax, Math.max(mdotMin, mdotShow))}
            onChange={(e) => p.onMdot(grams ? Number(e.target.value) * 1000 : Number(e.target.value))}
          />
        </div>
      ) : (
        <div className="slider">
          <div className="row">
            <div className="name">assigned hinj</div>
            <div className="val">{p.hinj.toFixed(1)} MJ/kg</div>
          </div>
          <input
            type="range"
            min={HINJ_MJ_MIN}
            max={HINJ_MJ_MAX}
            step={HINJ_MJ_STEP}
            value={clampHinj(p.hinj)}
            onChange={(e) => p.onHinj(clampHinj(Number(e.target.value)))}
          />
        </div>
      )}

      <div className="h-label">Known points</div>
      <div className="chips">
        {KNOWN_POINTS.map((k) => (
          <button key={k.id} className="chip" onClick={() => p.onKnown(k.id)}>
            {k.facility === "IPG6-S" ? k.label : `${k.facility} ${k.label}`}
          </button>
        ))}
      </div>

      {advanced ? (
        <>
          <div className="h-label">Physics</div>
          <div className="chips">
            {(
              [
                ["auto", "Auto"],
                ["collisionless", "Collisionless"],
                ["sudden_freeze", "Sudden-freeze"],
              ] as const
            ).map(([id, lab]) => (
              <button key={id} className={`chip${p.plumeMode === id ? " on" : ""}`} onClick={() => p.onPlumeMode(id)}>
                {lab}
              </button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span>tank pressure</span>
            <DraftNumber
              value={p.pTank}
              min={P_TANK_MIN}
              max={P_TANK_MAX}
              step={0.1}
              aria-label="tank pressure"
              onCommit={(n) => p.onPTank(n)}
            />
            <span className="field-hint">Pa · background the jet expands into (0.1–5000)</span>
          </label>
          {p.kn != null && (
            <div className="kn">
              Kn_exit = {p.kn.toPrecision(3)}
              {p.plumeSolvedMode ? `  →  ${p.plumeSolvedMode}` : ""}
              {p.npr != null ? (
                <>
                  <br />
                  NPR = p_e / p_tank = {fmtFixed(p.npr, 2)}
                  {p.regime ? `  ·  ${p.regime}` : ""}
                </>
              ) : null}
            </div>
          )}
          <div className="h-label">Object</div>
          <div className="object-probe-row">
            <div className="chips" role="group" aria-label="Object">
              <button
                className={`chip${p.objectKind === "none" ? " on" : ""}`}
                onClick={() => p.onObject("none")}
              >
                None
              </button>
              <button
                className={`chip${p.objectKind === "disk" ? " on" : ""}`}
                onClick={() => p.onObject("disk")}
              >
                Probe
              </button>
            </div>
            {p.objectKind === "disk" && (
              <div className="disk-row disk-row-setup">
                <label className="disk-field">
                  probe R
                  <DraftNumber
                    value={p.diskR}
                    min={DISK_R_MM_MIN}
                    max={DISK_R_MM_MAX}
                    step={1}
                    aria-label="Probe radius in millimetres"
                    onCommit={(n) => p.onDiskR(clampDiskRmm(n))}
                  />
                  <span>mm</span>
                </label>
                <label className="disk-field">
                  Tw
                  <DraftNumber
                    value={p.diskTw}
                    min={200}
                    max={2000}
                    step={10}
                    aria-label="Probe wall temperature in kelvin"
                    onCommit={(n) => p.onDiskTw(clampProbeTw(n))}
                  />
                  <span>K</span>
                </label>
              </div>
            )}
          </div>
          {p.objectKind === "disk" ? (
            <div className="field-hint" style={{ marginTop: 8 }}>
              Centerline calorimeter, not the Mach disk. Tap the jet for station (x, y); the plate uses that same x.
              After Run the station grid shows p_probe, q_probe, and Kn_obj.
            </div>
          ) : (
            <div className="field-hint" style={{ marginTop: 8 }}>
              Empty jet — no probe. Mach disk still draws in Advanced when shocks apply.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="h-label">Plume</div>
          <div className="locked-note">
            <div className="title">Thesis: collisionless jet</div>
            <p>
              Khasawneh–Cai 2-D planar free-molecular map from a frozen CEA exit. Auto and sudden-freeze stay off. Tap
              Plume for an (x, y) field station — no probe.
            </p>
          </div>
        </>
      )}

      <div className="share-row">
        <CopyLink href={p.shareHref} mentionDisk={advanced && p.objectKind === "disk"} />
      </div>
    </div>
  );
}

function MixEditor({ mix, onChange }: { mix: CustomMix; onChange: (mix: CustomMix) => void }) {
  const sum = mixtureSum(mix);
  return (
    <div className="mix-editor">
      <div className="mix-grid">
        {CUSTOM_SPECIES.map((s) => (
          <label className="field" key={s}>
            {s}
            <DraftNumber
              value={mix[s]}
              min={0}
              max={1}
              step={0.01}
              aria-label={`${s} mole fraction`}
              onCommit={(n) => onChange({ ...mix, [s]: n })}
            />
          </label>
        ))}
      </div>
      <div className={`mix-sum${sum <= 0 ? " bad" : ""}`}>
        {sum <= 0 ? "Enter at least one mole fraction." : `Σ ${fmtFixed(sum, 3)} · mole fraction (0–1)`}
      </div>
      <p className="field-hint">Positive fractions normalize to 1 on Run. Zeros are omitted.</p>
    </div>
  );
}

function CopyLink({ href, mentionDisk }: { href: string; mentionDisk: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        type="button"
        className="copy-link"
        onClick={() => {
          void copyText(href).then((ok) => {
            setState(ok ? "copied" : "failed");
            window.setTimeout(() => setState("idle"), 1800);
          });
        }}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy link"}
      </button>
      <span className="field-hint">
        {mentionDisk ? "Same generator, gas, and probe. They tap Run." : "Same generator, gas, and physics. They tap Run."}
      </span>
    </>
  );
}
