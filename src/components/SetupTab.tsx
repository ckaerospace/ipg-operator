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
import { fmtMdot, fmtPinjPa } from "../format";
import type { AppLayer } from "../layer";
import type { CustomMix } from "../mixture";
import { PINJ_SLIDER_STEPS, pinjPaToSlider, sliderToPinjPa } from "../physics";
import { copyText } from "../shareUrl";
import type { FacilityId, GasId, JetObject, PlumeMode, SolveMode } from "../types";
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

const FACILITIES: FacilityId[] = ["IPG6-S", "IPG4", "IPG3"];

export function SetupTab(p: Props) {
  const grams = p.family !== "IPG6-S";
  const meta = FACILITY_META[p.facility];
  const mdotShow = grams ? p.mdot_mg_s / 1000 : p.mdot_mg_s;
  const mdotMin = grams ? p.mdotLim.min / 1000 : p.mdotLim.min;
  const mdotMax = grams ? p.mdotLim.max / 1000 : p.mdotLim.max;
  const mdotStep = grams ? 0.01 : 0.1;

  return (
    <div className="scroll">
      <LayerBar current={p.layer === "manual" ? "thesis" : p.layer} />

      <div className="h-label">Generator</div>
      <div className="chips">
        {FACILITIES.map((id) => (
          <button key={id} className={`chip${p.facility === id ? " on" : ""}`} onClick={() => p.onFacility(id)}>
            {id}
          </button>
        ))}
      </div>

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

      <div className="h-label">Gas</div>
      <div className="chips">
        {GASES.map((g) => (
          <button key={g.id} className={`chip${p.gas === g.id ? " on" : ""}`} onClick={() => p.onGas(g.id)}>
            {g.label}
          </button>
        ))}
      </div>

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

      <div className="h-label">Plume</div>
      <div className="locked-note">
        <div className="title">Collisionless 2-D planar jet</div>
        <p>
          Khasawneh–Cai 2-D planar free-molecular map from a frozen CEA exit. Tap Plume for an (x, y) field station.
        </p>
      </div>

      <div className="share-row">
        <CopyLink href={p.shareHref} />
      </div>
    </div>
  );
}

function CopyLink({ href }: { href: string }) {
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
      <span className="field-hint">Same generator, gas, and collisionless jet. They tap Run.</span>
    </>
  );
}
