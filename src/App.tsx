import { useCallback, useMemo, useState } from "react";
import { ApiError, postCharacteristics, postSolve } from "./api";
import { MapTab } from "./components/MapTab";
import { PlumeTab } from "./components/PlumeTab";
import { SetupTab } from "./components/SetupTab";
import {
  axisFamily,
  coerceOperatingPoint,
  defaultPoint,
  FACILITY_META,
  geometryOf,
  KNOWN_POINTS,
  mixtureFor,
  mdotMgLimits,
  pinjLimits,
} from "./facility";
import { fmt, fmtFixed, fmtMdot } from "./format";
import type {
  CharacteristicsResponse,
  FacilityId,
  GasId,
  PlumeMode,
  SolveMode,
  SolveResponse,
  TabId,
} from "./types";

const NX = 49;
const NY = 49;

export default function App() {
  const [tab, setTab] = useState<TabId>("setup");
  const [facility, setFacility] = useState<FacilityId>("IPG6-S");
  const [gas, setGas] = useState<GasId>("O2");
  const [custom, setCustom] = useState({ dc: 37, dt: 20, de: 40 });
  const [mode, setMode] = useState<SolveMode>("generator");
  const [plumeMode, setPlumeMode] = useState<PlumeMode>("auto");
  const [pinj, setPinj] = useState(100);
  const [mdotMg, setMdotMg] = useState(13);
  const [hinj, setHinj] = useState(23);
  const [running, setRunning] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solve, setSolve] = useState<SolveResponse | null>(null);

  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "updating" | "error">("idle");
  const [mapWake, setMapWake] = useState(false);
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [ch, setCh] = useState<CharacteristicsResponse | null>(null);
  const [mapKey, setMapKey] = useState<string | null>(null);

  const geom = geometryOf(facility, custom);
  const family = axisFamily(facility, geom.d_t_mm);
  const pLim = pinjLimits(family);
  const mLim = mdotMgLimits(family);

  const applyFacility = (id: FacilityId) => {
    setFacility(id);
    const d = defaultPoint(id);
    setGas(id === "Custom" ? gas : d.gas);
    setPinj(d.pinj);
    setMdotMg(d.mdot_mg_s);
    setHinj(d.hinj);
    if (id !== "Custom") {
      const m = FACILITY_META[id];
      setCustom({ dc: m.dc, dt: m.dt, de: m.de });
    }
  };

  const applyKnown = (id: string) => {
    const k = KNOWN_POINTS.find((x) => x.id === id);
    if (!k) return;
    applyFacility(k.facility);
    setGas(k.gas);
    setPinj(k.pinj);
    setMode(k.mode);
    if (k.hinj != null) setHinj(k.hinj);
    if (k.mdot_mg_s != null) setMdotMg(k.mdot_mg_s);
  };

  const runSolve = useCallback(
    async (override?: { mode: SolveMode; pinj: number; hinj?: number; mdot?: number; goPlume?: boolean }) => {
      const m = override?.mode ?? mode;
      const p = override?.pinj ?? pinj;
      const h = override?.hinj ?? hinj;
      const md = override?.mdot ?? mdotMg;
      setRunning(true);
      setWaking(false);
      setError(null);
      try {
        const res = await postSolve(
          {
            mode: m,
            plume_mode: plumeMode,
            mixture: mixtureFor(gas),
            basis: "mole",
            d_c_mm: geom.d_c_mm,
            d_t_mm: geom.d_t_mm,
            d_e_mm: geom.d_e_mm,
            nozzle_name: geom.nozzle_name,
            pinj_Pa: p,
            hinj_MJ_kg: m === "enthalpy" ? h : undefined,
            mdot_mg_s: m === "generator" ? md : undefined,
            nx: NX,
            ny: NY,
          },
          () => setWaking(true),
        );
        setSolve(res);
        setPinj(res.cea.pinj_Pa);
        setHinj(res.cea.hinj_MJ_kg);
        if (res.cea.mdot_mg_s) setMdotMg(res.cea.mdot_mg_s);
        if (override?.goPlume) setTab("plume");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Solve failed");
      } finally {
        setRunning(false);
        setWaking(false);
      }
    },
    [mode, pinj, hinj, mdotMg, plumeMode, gas, geom.d_c_mm, geom.d_t_mm, geom.d_e_mm, geom.nozzle_name],
  );

  const openMap = (next: TabId) => {
    setTab(next);
    if (next !== "map") return;
    const key = `${facility}|${gas}|${geom.d_c_mm}|${geom.d_t_mm}|${geom.d_e_mm}|${Math.round(pinj)}`;
    if (mapKey === key && ch) {
      setMapStatus("ready");
      return;
    }
    setMapStatus("loading");
    setMapWake(false);
    setMapErr(null);
    postCharacteristics(
      {
        pinj_ref_Pa: pinj,
        mixture: mixtureFor(gas),
        basis: "mole",
        d_c_mm: geom.d_c_mm,
        d_t_mm: geom.d_t_mm,
        d_e_mm: geom.d_e_mm,
        nozzle_name: geom.nozzle_name,
        n_h: 13,
      },
      () => setMapWake(true),
    )
      .then((data) => {
        setCh(data);
        setMapKey(key);
        setMapStatus("ready");
      })
      .catch((e: unknown) => {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 404 || status === 405) {
          setMapStatus("updating");
          setMapErr(null);
        } else {
          setMapStatus("error");
          setMapErr(e instanceof Error ? e.message : "Map failed");
        }
      })
      .finally(() => setMapWake(false));
  };

  const strip = useMemo(() => (solve ? stripItems(solve, family) : null), [solve, family]);

  return (
    <div className="app">
      <header className="header">IPG  ·  {facility}</header>
      {strip && (
        <div className="strip">
          {strip.map((s) => (
            <span key={s.k}>
              <span className="k">{s.k}</span>
              <b>{s.v}</b>
            </span>
          ))}
        </div>
      )}
      {(waking || (mapWake && tab === "map")) && <div className="wake">waking chemistry server</div>}
      {error && tab !== "map" && <div className="err">{error}</div>}

      <div className="main">
        <section className={`pane${tab === "setup" ? " on" : ""}`} aria-hidden={tab !== "setup"}>
          <SetupTab
            facility={facility}
            gas={gas}
            custom={custom}
            mode={mode}
            plumeMode={plumeMode}
            pinj={pinj}
            mdot_mg_s={mdotMg}
            hinj={hinj}
            family={family}
            pinjLim={pLim}
            mdotLim={mLim}
            kn={solve?.plume.kn_gll_exit ?? null}
            plumeSolvedMode={solve?.plume.mode ?? null}
            onFacility={applyFacility}
            onGas={setGas}
            onCustom={(patch) => {
              const next = { ...custom, ...patch };
              setCustom(next);
              if (facility === "Custom") {
                const fam = axisFamily("Custom", next.dt);
                const coerced = coerceOperatingPoint(fam, pinj, mdotMg);
                setPinj(coerced.pinj);
                setMdotMg(coerced.mdot_mg_s);
              }
            }}
            onMode={setMode}
            onPlumeMode={setPlumeMode}
            onPinj={setPinj}
            onMdot={setMdotMg}
            onHinj={setHinj}
            onKnown={applyKnown}
          />
        </section>
        <section className={`pane${tab === "plume" ? " on" : ""}`} aria-hidden={tab !== "plume"}>
          <PlumeTab
            visible={tab === "plume"}
            solve={solve}
            running={running}
            waking={waking}
            dc={geom.d_c_mm}
            dt={geom.d_t_mm}
            de={geom.d_e_mm}
          />
        </section>
        <section className={`pane${tab === "map" ? " on" : ""}`} aria-hidden={tab !== "map"}>
          <MapTab
            key={mapKey ?? "map"}
            visible={tab === "map"}
            status={mapStatus}
            error={mapErr}
            waking={mapWake}
            ch={ch}
            family={family}
            facility={facility}
            initialPinj={pinj}
            initialHinj={hinj}
            onRunPoint={(p, h) => {
              setMode("enthalpy");
              setPinj(p);
              setHinj(h);
              setTab("plume");
              void runSolve({ mode: "enthalpy", pinj: p, hinj: h, goPlume: true });
            }}
          />
        </section>
      </div>

      <div className="run">
        <button disabled={running} onClick={() => void runSolve()}>
          {running ? "Solving…" : "Run"}
        </button>
      </div>
      <nav className="tabs">
        <button className={tab === "setup" ? "on" : ""} onClick={() => openMap("setup")}>
          Setup
        </button>
        <button className={tab === "plume" ? "on" : ""} onClick={() => openMap("plume")}>
          Plume
        </button>
        <button className={tab === "map" ? "on" : ""} onClick={() => openMap("map")}>
          Map
        </button>
      </nav>
    </div>
  );
}

function stripItems(solve: SolveResponse, family: ReturnType<typeof axisFamily>) {
  const ex = solve.cea.exit;
  const mf = ex.mole_fractions ?? {};
  const xO = ex.x_O ?? mf.O ?? 0;
  const xe = mf["e-"] ?? ex.x_ion ?? 0;
  const eO = solve.plume.e_O_eV[Math.floor(solve.plume.ny / 2) * solve.plume.nx] ?? null;
  const kn = solve.plume.kn_gll_exit;
  const mode = solve.plume.mode;
  return [
    { k: "hinj", v: `${fmtFixed(solve.cea.hinj_MJ_kg, 2)} MJ/kg` },
    { k: "T_exit", v: `${fmt(ex.T0, 0)} K` },
    { k: "U", v: `${fmtFixed(ex.U0 / 1000, 2)} km/s` },
    { k: "x_O", v: fmtFixed(xO, 3) },
    { k: "x_e", v: fmtFixed(xe, 3) },
    { k: "E_O", v: eO == null ? "—" : `${fmtFixed(eO, 2)} eV` },
    { k: "Kn_exit", v: `${kn.toPrecision(2)} → ${mode}` },
    { k: "ṁ", v: fmtMdot(solve.cea.mdot_mg_s, family) },
  ];
}
