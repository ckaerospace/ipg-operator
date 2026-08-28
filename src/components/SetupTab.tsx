import { FACILITY_META, GASES, KNOWN_POINTS, type AxisFamily } from "../facility";
import { fmtMdot, fmtPinj } from "../format";
import type { FacilityId, GasId, PlumeMode, SolveMode } from "../types";

type Props = {
  facility: FacilityId;
  gas: GasId;
  custom: { dc: number; dt: number; de: number };
  mode: SolveMode;
  plumeMode: PlumeMode;
  pinj: number;
  mdot_mg_s: number;
  hinj: number;
  family: AxisFamily;
  pinjLim: { min: number; max: number; step: number };
  mdotLim: { min: number; max: number };
  kn: number | null;
  plumeSolvedMode: string | null;
  onFacility: (id: FacilityId) => void;
  onGas: (id: GasId) => void;
  onCustom: (patch: Partial<{ dc: number; dt: number; de: number }>) => void;
  onMode: (m: SolveMode) => void;
  onPlumeMode: (m: PlumeMode) => void;
  onPinj: (v: number) => void;
  onMdot: (mg: number) => void;
  onHinj: (v: number) => void;
  onKnown: (id: string) => void;
};

const FACILITIES: FacilityId[] = ["IPG6-S", "IPG4", "IPG3", "Custom"];

export function SetupTab(p: Props) {
  const grams = p.family !== "IPG6-S";
  const meta = FACILITY_META[p.facility];
  const mdotShow = grams ? p.mdot_mg_s / 1000 : p.mdot_mg_s;
  const mdotMin = grams ? p.mdotLim.min / 1000 : p.mdotLim.min;
  const mdotMax = grams ? p.mdotLim.max / 1000 : p.mdotLim.max;
  const mdotStep = grams ? 0.01 : 0.1;

  return (
    <div className="scroll">
      <div className="h-label">Facility</div>
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
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={499}
                step={0.5}
                value={val}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) p.onCustom({ [key]: n });
                }}
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
          <div className="val">{fmtPinj(p.pinj)}</div>
        </div>
        <input
          type="range"
          min={p.pinjLim.min}
          max={p.pinjLim.max}
          step={p.pinjLim.step}
          value={Math.min(p.pinjLim.max, Math.max(p.pinjLim.min, p.pinj))}
          onChange={(e) => p.onPinj(Number(e.target.value))}
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
            min={1}
            max={40}
            step={0.1}
            value={p.hinj}
            onChange={(e) => p.onHinj(Number(e.target.value))}
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
      {p.kn != null && (
        <div className="kn">
          Kn_exit = {p.kn.toPrecision(3)}
          {p.plumeSolvedMode ? `  →  ${p.plumeSolvedMode}` : ""}
        </div>
      )}
    </div>
  );
}
