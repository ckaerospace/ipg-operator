import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, postCharacteristics, postSolve } from "./api";
import { MapTab } from "./components/MapTab";
import { PlumeTab } from "./components/PlumeTab";
import { SetupTab } from "./components/SetupTab";
import {
  axisFamily,
  clampHinj,
  coerceOperatingPoint,
  defaultPoint,
  FACILITY_META,
  geometryOf,
  HINJ_MJ_MAX,
  HINJ_MJ_MIN,
  KNOWN_POINTS,
  mixtureFor,
  mdotMgLimits,
  pinjLimits,
} from "./facility";
import {
  emptyCustomMix,
  encodeMixParam,
  isNamedGas,
  mixLabel,
  mixtureSum,
  resolveMixture,
  seedCustomMix,
  type CustomMix,
} from "./mixture";
import { coupledPowerW, fmt, fmtFixed, fmtMdot, fmtN0, fmtPower } from "./format";
import { writeLayer } from "./layer";
import { hydrateShareObject, parseShareSearch, shareUrl } from "./shareUrl";
import { buildSolveBody } from "./solveBody";
import type { CharacteristicsResponse, FacilityId, GasId, SolveMode, SolveResponse, TabId } from "./types";

type Boot = {
  facility: FacilityId;
  gas: GasId;
  customMix: CustomMix;
  custom: { dc: number; dt: number; de: number };
  mode: SolveMode;
  pinj: number;
  mdotMg: number;
  hinj: number;
  stationX: number | null;
  stationY: number;
  autoRun: boolean;
};

type SolveOverride = {
  mode?: SolveMode;
  pinj?: number;
  hinj?: number;
  mdot?: number;
  goPlume?: boolean;
};

function readBoot(): Boot {
  const share = parseShareSearch(typeof window === "undefined" ? "" : window.location.search);
  writeLayer("thesis");
  const facility: FacilityId = share.facility ?? "IPG6-S";
  const d = defaultPoint(facility);
  const meta = FACILITY_META[facility];
  const family = axisFamily(facility, meta.dt);
  const coerced = coerceOperatingPoint(family, share.pinj ?? d.pinj, share.mdot ?? d.mdot_mg_s);
  const station = hydrateShareObject(share);
  const named = share.gas && isNamedGas(share.gas) ? share.gas : d.gas;
  const gas: GasId = share.gas === "custom" ? "custom" : named;
  return {
    facility,
    gas,
    customMix:
      share.gas === "custom" ? (share.mix ?? emptyCustomMix()) : seedCustomMix(mixtureFor(named)),
    custom: { dc: meta.dc, dt: meta.dt, de: meta.de },
    mode: share.mode ?? "generator",
    pinj: coerced.pinj,
    mdotMg: coerced.mdot_mg_s,
    hinj: clampHinj(share.hinj ?? d.hinj),
    stationX: station.stationX,
    stationY: station.stationY,
    autoRun: share.run === true,
  };
}

let shareRunStarted = false;

export default function App() {
  const [boot] = useState(readBoot);
  const [tab, setTab] = useState<TabId>("setup");
  const [facility, setFacility] = useState<FacilityId>(boot.facility);
  const [gas, setGas] = useState<GasId>(boot.gas);
  const [customMix, setCustomMix] = useState<CustomMix>(boot.customMix);
  const [custom, setCustom] = useState(boot.custom);
  const [mode, setMode] = useState<SolveMode>(boot.mode);
  const [pinj, setPinj] = useState(boot.pinj);
  const [mdotMg, setMdotMg] = useState(boot.mdotMg);
  const [hinj, setHinj] = useState(boot.hinj);
  const [stationX, setStationX] = useState<number | null>(boot.stationX);
  const [stationY, setStationY] = useState(boot.stationY);
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
    if (gas !== "custom" && id !== "Custom") setGas(d.gas);
    setPinj(d.pinj);
    setMdotMg(d.mdot_mg_s);
    setHinj(clampHinj(d.hinj));
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
    if (k.hinj != null) setHinj(clampHinj(k.hinj));
    if (k.mdot_mg_s != null) setMdotMg(k.mdot_mg_s);
  };

  const mixOk = gas !== "custom" || mixtureSum(customMix) > 0;
  const activeMixture = resolveMixture(gas, customMix);

  const selectGas = (id: GasId) => {
    if (id === "custom" && isNamedGas(gas)) setCustomMix(seedCustomMix(mixtureFor(gas)));
    setGas(id);
  };

  const runSolve = useCallback(
    async (override?: SolveOverride) => {
      const mix = resolveMixture(gas, customMix);
      if (!mix) {
        setError("Enter at least one mole fraction.");
        return;
      }
      const m = override?.mode ?? mode;
      const p = override?.pinj ?? pinj;
      const h = override?.hinj ?? hinj;
      const md = override?.mdot ?? mdotMg;
      setRunning(true);
      setWaking(false);
      setError(null);
      try {
        const res = await postSolve(
          buildSolveBody({
            layer: "thesis",
            plumeMode: "collisionless",
            mode: m,
            mixture: mix,
            d_c_mm: geom.d_c_mm,
            d_t_mm: geom.d_t_mm,
            d_e_mm: geom.d_e_mm,
            nozzle_name: geom.nozzle_name,
            pinj_Pa: p,
            hinj_MJ_kg: h,
            mdot_mg_s: md,
          }),
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
    [mode, pinj, hinj, mdotMg, gas, customMix, geom.d_c_mm, geom.d_t_mm, geom.d_e_mm, geom.nozzle_name],
  );

  useEffect(() => {
    if (!boot.autoRun || shareRunStarted) return;
    if (!resolveMixture(boot.gas, boot.customMix)) return;
    shareRunStarted = true;
    void runSolve();
  }, [boot.autoRun, boot.gas, boot.customMix, runSolve]);

  const openMap = (next: TabId) => {
    setTab(next);
    if (next !== "map") return;
    const mix = resolveMixture(gas, customMix);
    const mixKey = gas === "custom" ? encodeMixParam(customMix) : gas;
    const key = `${facility}|${mixKey}|${geom.d_c_mm}|${geom.d_t_mm}|${geom.d_e_mm}|${Math.round(pinj)}|h${HINJ_MJ_MIN}-${HINJ_MJ_MAX}|n29`;
    if (!mix) {
      setMapStatus("error");
      setMapErr("Enter at least one mole fraction.");
      return;
    }
    if (mapKey === key && ch) {
      setMapStatus("ready");
      return;
    }
    setMapStatus("loading");
    setMapWake(false);
    setMapErr(null);
    const charBase = {
      pinj_ref_Pa: pinj,
      mixture: mix,
      basis: "mole" as const,
      d_c_mm: geom.d_c_mm,
      d_t_mm: geom.d_t_mm,
      d_e_mm: geom.d_e_mm,
      nozzle_name: geom.nozzle_name,
    };
    const wake = () => setMapWake(true);
    postCharacteristics({ ...charBase, n_h: 29, hinj_min: HINJ_MJ_MIN, hinj_max: HINJ_MJ_MAX }, wake)
      .catch((e: unknown) => {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 404 || status === 405) throw e;
        return postCharacteristics({ ...charBase, n_h: 13 }, wake);
      })
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

  const heading = `Plasma wind tunnel · ${facility}`;
  useEffect(() => {
    document.title = heading;
  }, [heading]);

  const strip = useMemo(
    () => (solve ? stripItems(solve, family, gas === "custom" ? activeMixture : null) : null),
    [solve, family, gas, activeMixture],
  );

  const shareHref = useMemo(
    () =>
      shareUrl(window.location.origin, {
        facility,
        gas,
        customMix: gas === "custom" ? customMix : undefined,
        mode,
        pinj,
        mdot_mg_s: mdotMg,
        hinj,
        stationX_m: stationX,
        stationY_m: stationX != null ? stationY : null,
      }),
    [facility, gas, customMix, mode, pinj, mdotMg, hinj, stationX, stationY],
  );

  return (
    <div className="app">
      <header className="header">{heading}</header>
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
            customMix={customMix}
            custom={custom}
            mode={mode}
            pinj={pinj}
            mdot_mg_s={mdotMg}
            hinj={hinj}
            family={family}
            pinjLim={pLim}
            mdotLim={mLim}
            onFacility={applyFacility}
            onGas={selectGas}
            onCustomMix={setCustomMix}
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
            onPinj={setPinj}
            onMdot={setMdotMg}
            onHinj={setHinj}
            onKnown={applyKnown}
            shareHref={shareHref}
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
            stationX={stationX}
            stationY={stationY}
            onStationX={setStationX}
            onStationY={setStationY}
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
              setHinj(clampHinj(h));
              setTab("plume");
              void runSolve({ mode: "enthalpy", pinj: p, hinj: clampHinj(h), goPlume: true });
            }}
          />
        </section>
      </div>

      <div className="run">
        <button disabled={running || !mixOk} onClick={() => void runSolve()}>
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

export function stripItems(
  solve: SolveResponse,
  family: ReturnType<typeof axisFamily>,
  customSent: ReturnType<typeof resolveMixture>,
) {
  const ex = solve.cea.exit;
  const mf = ex.mole_fractions ?? {};
  const xO = ex.x_O ?? mf.O ?? 0;
  const xe = mf["e-"] ?? ex.x_ion ?? 0;
  const eO = solve.plume.e_O_eV[Math.floor(solve.plume.ny / 2) * solve.plume.nx] ?? null;
  const pwr = coupledPowerW(solve.cea);
  const rows = [
    { k: "hinj", v: `${fmtFixed(solve.cea.hinj_MJ_kg, 2)} MJ/kg` },
    { k: "n0", v: fmtN0(solve.plume.n0) },
    { k: "power", v: Number.isFinite(pwr) ? fmtPower(pwr) : "—" },
    { k: "T_exit", v: `${fmt(ex.T0, 0)} K` },
    { k: "U", v: `${fmtFixed(ex.U0 / 1000, 2)} km/s` },
    { k: "x_O", v: fmtFixed(xO, 3) },
    { k: "x_e", v: fmtFixed(xe, 3) },
    { k: "E_O", v: eO == null ? "—" : `${fmtFixed(eO, 2)} eV` },
  ];
  rows.push({ k: "ṁ", v: fmtMdot(solve.cea.mdot_mg_s, family) });
  if (customSent) {
    rows.push({ k: "mix", v: mixLabel(customSent) });
  }
  return rows;
}
