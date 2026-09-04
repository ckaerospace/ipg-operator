export type FacilityId = "IPG6-S" | "IPG4" | "IPG3" | "Custom";
export type TabId = "setup" | "plume" | "map";
export const NAMED_GASES = ["O2", "CO2", "N2", "Air", "HeO2", "Ar", "CF4"] as const;
export type NamedGasId = (typeof NAMED_GASES)[number];
/** Named IPG presets plus the mole-fraction editor. Not a Custom nozzle. */
export type GasId = NamedGasId | "custom";
export type SolveMode = "generator" | "enthalpy";
export type PlumeMode = "auto" | "collisionless" | "sudden_freeze";
/** Advanced Setup: whether a calorimeter probe sits in the jet. Wire value stays "disk". Thesis has no probe chrome. */
export type JetObject = "none" | "disk";
export type FieldId = "t_ratio" | "n_ratio" | "h_tot" | "speed" | "mach" | "e_kin";

export type Mixture = Record<string, number>;

export type ProbeRegime = "kinetic" | "continuum";

/** Optional plate / calorimeter return from POST /api/solve. */
export type PlumeProbe = {
  x_m?: number;
  r_mm?: number;
  Tw_K?: number;
  p_Pa?: number | null;
  q_W_m2?: number | null;
  Kn_obj?: number | null;
  regime?: string | null;
};

export type Geometry = {
  name: string;
  d_c_mm: number;
  d_t_mm: number;
  d_e_mm: number;
};

export type CeaExit = {
  T0: number;
  U0: number;
  MW: number;
  gamma: number;
  R: number;
  H?: number;
  n0?: number;
  mole_fractions: Mixture;
  x_O?: number;
  x_O2?: number;
  x_CO2?: number;
  x_CO?: number;
  x_C?: number;
  x_N?: number;
  x_N2?: number;
  x_He?: number;
  x_Ar?: number;
  x_ion?: number;
  p_e_Pa?: number;
  p_Pa?: number;
  p?: number;
};

export type SolveResponse = {
  mode?: string;
  requested_mdot_mg_s?: number | null;
  cea: {
    pinj_Pa: number;
    hinj_MJ_kg: number;
    delta_h_MJ_kg?: number;
    mdot_mg_s: number;
    mdot_kg_s?: number;
    power_W?: number;
    mixture?: { h_ref_MJ_kg?: number; mole_fractions?: Mixture };
    geometry?: Geometry;
    exit: CeaExit;
    gas?: string;
    notes?: string[];
  };
  plume: {
    T0: number;
    U0: number;
    n0: number;
    H: number;
    mode: string;
    plume_mode_requested?: string;
    kn_gll_exit: number;
    xmax_m: number;
    ymax_m: number;
    nx: number;
    ny: number;
    x: number[];
    y: number[];
    n_ratio: number[];
    u: number[];
    v: number[];
    t_ratio: number[];
    speed: number[];
    mach: number[];
    e_kin_eV: number[];
    e_O_eV: number[];
    h_tot_MJ_kg: number[];
    h_tot_ratio: number[];
    p_tank_Pa?: number;
    p_e_Pa?: number;
    npr?: number;
    regime?: string;
    barrel_xy?: unknown;
    bow_xy?: unknown;
    x_mach_disk_m?: number | null;
    shock_applied?: boolean;
    probe?: PlumeProbe;
  };
  p_tank_Pa?: number;
  p_e_Pa?: number;
  npr?: number;
  regime?: string;
};

export type Kink = {
  hinj_MJ_kg: number;
  kind: string;
  label: string;
};

export type Isoline = {
  mdot_mg_s?: number;
  power_W?: number;
  pinj_Pa: number[];
  hinj_MJ_kg: number[];
};

export type CharacteristicsResponse = {
  pinj_ref_Pa: number;
  href_MJ_kg?: number;
  hinj_MJ_kg: number[];
  k_kg_s_Pa?: number[];
  chamber: {
    T: number[];
    MW: number[];
    mdot_mg_s: number[];
    x: Record<string, number[]>;
  };
  exit?: {
    T0?: number[];
    MW?: number[];
    x?: Record<string, number[]>;
  };
  kinks: Kink[];
  mdot_isolines: Isoline[];
  power_isolines: Isoline[];
  axes: { pinj_Pa: number[]; hinj_MJ_kg: number[] };
  parent_molecule?: string;
};

export type ProbeSample = {
  x_m: number;
  y_m: number;
  T: number;
  t_ratio: number;
  n_ratio: number;
  U: number;
  mach: number;
  e_kin: number;
  e_O: number | null;
  e_th: number;
  h_tot: number;
  kn: number;
  p_ram_Pa: number | null;
  q_inc_W_m2: number | null;
};
