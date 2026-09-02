import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { operatorLayer, readLayer, writeLayer, type AppLayer } from "./layer";
import {
  clampDiskRmm,
  clampProbeTw,
  clampTankPa,
  DISK_R_MM_DEFAULT,
  jetMatch,
  P_TANK_DEFAULT,
  PROBE_TW_K,
  TANK_SOLVE_DEBOUNCE_MS,
} from "./physics";
import { mapCharacteristicsKey } from "./mapCache";
import { hydrateShareObject, parseShareSearch, shareUrl } from "./shareUrl";
import { buildSolveBody } from "./solveBody";
import type {
  CharacteristicsResponse,
  FacilityId,
  GasId,
  JetObject,
  PlumeMode,
  SolveMode,
  SolveResponse,
  TabId,
} from "./types";

type Boot = {
  facility: FacilityId;
  gas: GasId;
  customMix: CustomMix;
  custom: { dc: number; dt: number; de: number };
  mode: SolveMode;
  plumeMode: PlumeMode;
  pinj: number;
  mdotMg: number;
  hinj: number;
  pTank: number;
  layer: "thesis" | "advanced";
  object: JetObject;
  diskX: number | null;
  probeY: number;
  diskR: number;
  diskTw: number;
  autoRun: boolean;
};

type SolveOverride = {
  mode?: SolveMode;
  pinj?: number;
  hinj?: number;
  mdot?: number;
  goPlume?: boolean;
  pTank?: number;
  plumeMode?: PlumeMode;
};

function readBoot(): Boot {
  const share = parseShareSearch(typeof window === "undefined" ? "" : window.location.search);
  const stored = operatorLayer(readLayer());
  const layer = share.layer ?? stored;
  if (share.layer) writeLayer(share.layer);
  const facility: FacilityId = share.facility ?? "IPG6-S";
  const d = defaultPoint(facility);
  const meta = FACILITY_META[facility];
  const family = axisFamily(facility, meta.dt);
  const coerced = coerceOperatingPoint(family, share.pinj ?? d.pinj, share.mdot ?? d.mdot_mg_s);
  const obj = hydrateShareObject(layer, share);
  return {
    facility,
    gas: share.gas ?? d.gas,
    customMix:
      share.gas === "custom"
        ? (share.mix ?? emptyCustomMix())
        : seedCustomMix(mixtureFor(share.gas && isNamedGas(share.gas) ? share.gas : d.gas)),
    custom: { dc: meta.dc, dt: meta.dt, de: meta.de },
    mode: share.mode ?? "generator",
    plumeMode: share.plume ?? "auto",
    pinj: coerced.pinj,
    mdotMg: coerced.mdot_mg_s,
    hinj: clampHinj(share.hinj ?? d.hinj),
    pTank: clampTankPa(share.ptank ?? P_TANK_DEFAULT),
    layer,
    object: obj.object,
    diskX: obj.diskX,
    probeY: obj.probeY,
    diskR: share.probe_r ?? DISK_R_MM_DEFAULT,
    diskTw: PROBE_TW_K,
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
  const [plumeMode, setPlumeMode] = useState<PlumeMode>(boot.plumeMode);
  const [pinj, setPinj] = useState(boot.pinj);
  const [mdotMg, setMdotMg] = useState(boot.mdotMg);
  const [hinj, setHinj] = useState(boot.hinj);
  const [pTank, setPTank] = useState(boot.pTank);
  const pTankRef = useRef(pTank);
  const tankDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSolveRef = useRef<(override?: SolveOverride) => Promise<void>>(async () => {});
  const [layer, setLayer] = useState<AppLayer>(boot.layer);
  const [diskX, setDiskX] = useState<number | null>(boot.diskX);
  const [probeY, setProbeY] = useState(boot.probeY);
  const [diskR, setDiskR] = useState(boot.diskR);
  const [diskTw, setDiskTw] = useState(boot.diskTw);
  const [solvedFace, setSolvedFace] = useState<{ x: number; r: number } | null>(null);
  const [objectKind, setObjectKind] = useState<JetObject>(boot.object);
  const advanced = layer === "advanced";
  const showDisk = advanced && objectKind === "disk";
  const effectiveDiskR = showDisk ? diskR : DISK_R_MM_DEFAULT;
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

  const clearTankDebounce = useCallback(() => {
    if (tankDebounce.current != null) {
      clearTimeout(tankDebounce.current);
      tankDebounce.current = null;
    }
  }, []);

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
      const sentTank = clampTankPa(override?.pTank ?? pTankRef.current);
      const sentPlume = override?.plumeMode ?? plumeMode;
      const sentX = showDisk ? diskX : null;
      const sentR = effectiveDiskR;
      setRunning(true);
      setWaking(false);
      setError(null);
      try {
        const res = await postSolve(
          buildSolveBody({
            layer,
            plumeMode: sentPlume,
            mode: m,
            mixture: mix,
            d_c_mm: geom.d_c_mm,
            d_t_mm: geom.d_t_mm,
            d_e_mm: geom.d_e_mm,
            nozzle_name: geom.nozzle_name,
            pinj_Pa: p,
            hinj_MJ_kg: h,
            mdot_mg_s: md,
            p_tank_Pa: sentTank,
            probe_x_m: sentX,
            probe_r_mm: sentR,
            probe_Tw_K: diskTw,
          }),
          () => setWaking(true),
        );
        setSolve(res);
        setSolvedFace(sentX != null && Number.isFinite(sentX) ? { x: sentX, r: sentR } : null);
        setPinj(res.cea.pinj_Pa);
        setHinj(res.cea.hinj_MJ_kg);
        if (res.cea.mdot_mg_s) setMdotMg(res.cea.mdot_mg_s);
        if (advanced) {
          const tankEcho = res.plume.p_tank_Pa ?? res.p_tank_Pa;
          const stale = tankDebounce.current != null || pTankRef.current !== sentTank;
          if (!stale && typeof tankEcho === "number" && Number.isFinite(tankEcho)) {
            const echoed = clampTankPa(tankEcho);
            pTankRef.current = echoed;
            setPTank(echoed);
          }
        }
        if (override?.goPlume) setTab("plume");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Solve failed");
      } finally {
        setRunning(false);
        setWaking(false);
      }
    },
    [advanced, layer, mode, pinj, hinj, mdotMg, plumeMode, gas, customMix, geom.d_c_mm, geom.d_t_mm, geom.d_e_mm, geom.nozzle_name, showDisk, diskX, effectiveDiskR, diskTw],
  );

  useEffect(() => {
    pTankRef.current = pTank;
  }, [pTank]);

  useEffect(() => {
    runSolveRef.current = runSolve;
  }, [runSolve]);

  useEffect(() => {
    if (!advanced) clearTankDebounce();
  }, [advanced, clearTankDebounce]);

  useEffect(() => () => clearTankDebounce(), [clearTankDebounce]);

  const onPlumeTank = (p: number) => {
    const next = clampTankPa(p);
    pTankRef.current = next;
    setPTank(next);
    if (!advanced) return;
    clearTankDebounce();
    tankDebounce.current = setTimeout(() => {
      tankDebounce.current = null;
      void runSolveRef.current({ pTank: pTankRef.current });
    }, TANK_SOLVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!boot.autoRun || shareRunStarted) return;
    if (!resolveMixture(boot.gas, boot.customMix)) return;
    shareRunStarted = true;
    void runSolve();
  }, [boot.autoRun, boot.gas, boot.customMix, runSolve]);

  const mapLoadGen = useRef(0);
  const loadMap = useCallback(
    (mdotForKey: number) => {
      const mix = resolveMixture(gas, customMix);
      const mixKey = gas === "custom" ? encodeMixParam(customMix) : gas;
      const key = mapCharacteristicsKey({
        facility,
        mixKey,
        d_c_mm: geom.d_c_mm,
        d_t_mm: geom.d_t_mm,
        d_e_mm: geom.d_e_mm,
        mdot_mg_s: mdotForKey,
      });
      if (!mix) {
        setMapStatus("error");
        setMapErr("Enter at least one mole fraction.");
        return;
      }
      if (mapKey === key && ch) {
        setMapStatus("ready");
        return;
      }
      const gen = ++mapLoadGen.current;
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
          if (gen !== mapLoadGen.current) return;
          setCh(data);
          setMapKey(key);
          setMapStatus("ready");
        })
        .catch((e: unknown) => {
          if (gen !== mapLoadGen.current) return;
          const status = e instanceof ApiError ? e.status : 0;
          if (status === 404 || status === 405) {
            setMapStatus("updating");
            setMapErr(null);
          } else {
            setMapStatus("error");
            setMapErr(e instanceof Error ? e.message : "Map failed");
          }
        })
        .finally(() => {
          if (gen === mapLoadGen.current) setMapWake(false);
        });
    },
    [facility, gas, customMix, geom.d_c_mm, geom.d_t_mm, geom.d_e_mm, geom.nozzle_name, pinj, mapKey, ch],
  );

  const openMap = (next: TabId) => {
    setTab(next);
    if (next !== "map") return;
    loadMap(mdotMg);
  };

  const heading = `Plasma wind tunnel · ${facility}`;
  useEffect(() => {
    document.title = heading;
  }, [heading]);

  const strip = useMemo(
    () => (solve ? stripItems(solve, family, pTank, advanced, gas === "custom" ? activeMixture : null) : null),
    [solve, family, pTank, advanced, gas, activeMixture],
  );

  const shareHref = useMemo(
    () =>
      shareUrl(window.location.origin, {
        layer: advanced ? "advanced" : "thesis",
        facility,
        gas,
        customMix: gas === "custom" ? customMix : undefined,
        mode,
        pinj,
        mdot_mg_s: mdotMg,
        hinj,
        pTank,
        plumeMode,
        object: showDisk ? "disk" : "none",
        diskX_m: diskX,
        diskY_m: diskX != null ? probeY : null,
        diskR_mm: effectiveDiskR,
      }),
    [advanced, facility, gas, customMix, mode, pinj, mdotMg, hinj, pTank, plumeMode, showDisk, diskX, probeY, effectiveDiskR],
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
            plumeMode={plumeMode}
            pinj={pinj}
            mdot_mg_s={mdotMg}
            hinj={hinj}
            pTank={pTank}
            family={family}
            pinjLim={pLim}
            mdotLim={mLim}
            kn={solve?.plume.kn_gll_exit ?? null}
            plumeSolvedMode={solve?.plume.mode ?? null}
            npr={advanced && solve ? jetMatch(solve, pTank).npr : null}
            regime={advanced && solve ? jetMatch(solve, pTank).regime : null}
            layer={layer}
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
            onPlumeMode={setPlumeMode}
            onPinj={setPinj}
            onMdot={setMdotMg}
            onHinj={setHinj}
            onPTank={(p) => {
              pTankRef.current = clampTankPa(p);
              setPTank(clampTankPa(p));
            }}
            onKnown={applyKnown}
            onLayer={(next) => {
              writeLayer(next);
              setLayer(next);
            }}
            objectKind={objectKind}
            onObject={setObjectKind}
            diskR={diskR}
            diskTw={diskTw}
            onDiskR={(r) => setDiskR(clampDiskRmm(r))}
            onDiskTw={(t) => setDiskTw(clampProbeTw(t))}
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
            advanced={advanced}
            plumeMode={plumeMode}
            onPlotKernel={(m) => {
              setPlumeMode(m);
              void runSolve({ plumeMode: m });
            }}
            showDisk={showDisk}
            diskX={diskX}
            probeY={probeY}
            diskR={effectiveDiskR}
            onDiskX={setDiskX}
            onProbeY={setProbeY}
            solvedFace={solvedFace}
            pTank={pTank}
            onPTank={onPlumeTank}
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
            pinj={pinj}
            hinj={hinj}
            mdot_mg_s={mdotMg}
            pinjLim={pLim}
            mdotLim={mLim}
            onPinj={setPinj}
            onMdot={(m) => {
              setMdotMg(m);
              loadMap(m);
            }}
            onRunPoint={(p, h) => {
              clearTankDebounce();
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
        <button
          disabled={running || !mixOk}
          onClick={() => {
            clearTankDebounce();
            void runSolve();
          }}
        >
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
  pTank: number,
  advanced: boolean,
  customSent: ReturnType<typeof resolveMixture>,
) {
  const ex = solve.cea.exit;
  const mf = ex.mole_fractions ?? {};
  const xO = ex.x_O ?? mf.O ?? 0;
  const xe = mf["e-"] ?? ex.x_ion ?? 0;
  const eO = solve.plume.e_O_eV[Math.floor(solve.plume.ny / 2) * solve.plume.nx] ?? null;
  const kn = solve.plume.kn_gll_exit;
  const mode = solve.plume.mode;
  const jet = jetMatch(solve, pTank);
  const nprLab = jet.npr == null ? "—" : fmtFixed(jet.npr, 2);
  const jetLab = jet.regime ? `${nprLab} · ${jet.regime}` : nprLab;
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
  if (advanced) {
    rows.push({ k: "NPR", v: jetLab }, { k: "Kn_exit", v: `${kn.toPrecision(2)} → ${mode}` });
  }
  rows.push({ k: "ṁ", v: fmtMdot(solve.cea.mdot_mg_s, family) });
  if (customSent) {
    rows.push({ k: "mix", v: mixLabel(customSent) });
  }
  return rows;
}
