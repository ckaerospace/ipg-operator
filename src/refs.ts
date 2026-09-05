export type RefItem = {
  id: string;
  cite: string;
  href?: string;
  label?: string;
};

/** Real DOIs (or NTRS for NASA RP-1311). No invented identifiers. */
export const REFS: RefItem[] = [
  {
    id: "cea",
    cite: "Gordon, S. & McBride, B. J. (1994). Computer program for calculation of complex chemical equilibrium compositions and applications. I. Analysis. NASA RP-1311.",
    href: "https://ntrs.nasa.gov/citations/19950013764",
    label: "NTRS 19950013764",
  },
  {
    id: "cea2",
    cite: "McBride, B. J. & Gordon, S. (1996). Computer program for calculation of complex chemical equilibrium compositions and applications. II. Users manual and program description. NASA RP-1311.",
    href: "https://ntrs.nasa.gov/citations/19960044559",
    label: "NTRS 19960044559",
  },
  {
    id: "bird1970",
    cite: "Bird, G. A. (1970). Breakdown of translational and rotational equilibrium in gaseous expansions. AIAA Journal, 8(11), 1998–2003.",
    href: "https://doi.org/10.2514/3.6037",
    label: "doi:10.2514/3.6037",
  },
  {
    id: "bird1994",
    cite: "Bird, G. A. (1994). Molecular Gas Dynamics and the Direct Simulation of Gas Flows. Clarendon Press, Oxford.",
  },
  {
    id: "boyd1995",
    cite: "Boyd, I. D., Chen, G. & Candler, G. V. (1995). Predicting failure of the continuum fluid equations in transitional hypersonic flows. Physics of Fluids, 7(1), 210–219.",
    href: "https://doi.org/10.1063/1.868720",
    label: "doi:10.1063/1.868720",
  },
  {
    id: "cai2007a",
    cite: "Cai, C. & Boyd, I. D. (2007). Theoretical and numerical study of free-molecular flow problems. Journal of Spacecraft and Rockets, 44(3), 619–624.",
    href: "https://doi.org/10.2514/1.25893",
    label: "doi:10.2514/1.25893",
  },
  {
    id: "cai2007b",
    cite: "Cai, C. & Boyd, I. D. (2007). Collisionless gas expanding into vacuum. Journal of Spacecraft and Rockets, 44(6), 1326–1330.",
    href: "https://doi.org/10.2514/1.32173",
    label: "doi:10.2514/1.32173",
  },
  {
    id: "billig1967",
    cite: "Billig, F. S. (1967). Shock-wave shapes around spherical- and cylindrical-nosed bodies. Journal of Spacecraft and Rockets, 4(6), 822–823.",
    href: "https://doi.org/10.2514/3.28969",
    label: "doi:10.2514/3.28969",
  },
  {
    id: "khasawneh2010",
    cite: "Khasawneh, K. R., Liu, H. & Cai, C. (2010). Highly rarefied two-dimensional jet impingement on a flat plate. Physics of Fluids, 22(11), 117101.",
    href: "https://doi.org/10.1063/1.3490409",
    label: "doi:10.1063/1.3490409",
  },
  {
    id: "cai2021fluids",
    cite: "Cai, S. & Cai, C. (2021). A simple gas-kinetic model for dilute and weakly charged plasma micro-jet flows. Fluids, 6(7), 250.",
    href: "https://doi.org/10.3390/fluids6070250",
    label: "doi:10.3390/fluids6070250",
  },
  {
    id: "crist1966",
    cite: "Crist, S., Sherman, P. M. & Glass, D. R. (1966). Study of the highly underexpanded sonic jet. AIAA Journal, 4(1), 68–71.",
    href: "https://doi.org/10.2514/3.3386",
    label: "doi:10.2514/3.3386",
  },
  {
    id: "addy1981",
    cite: "Addy, A. L. (1981). Effects of axisymmetric sonic nozzle geometry on Mach disk characteristics. AIAA Journal, 19(1), 121–122.",
    href: "https://doi.org/10.2514/3.7751",
    label: "doi:10.2514/3.7751",
  },
  {
    id: "albini1965",
    cite: "Albini, F. A. (1965). Approximate calculation of underexpanded jet structure. AIAA Journal, 3(8), 1535–1537.",
    href: "https://doi.org/10.2514/3.3194",
    label: "doi:10.2514/3.3194",
  },
  {
    id: "boynton1967",
    cite: "Boynton, F. P. (1967). Highly underexpanded jet structure: Exact and approximate calculations. AIAA Journal, 5(9), 1703–1704.",
    href: "https://doi.org/10.2514/3.4283",
    label: "doi:10.2514/3.4283",
  },
  {
    id: "dettleff1991",
    cite: "Dettleff, G. (1991). Plume flow and plume impingement in space technology. Progress in Aerospace Sciences, 28(1), 1–71.",
    href: "https://doi.org/10.1016/0376-0421(91)90008-R",
    label: "doi:10.1016/0376-0421(91)90008-R",
  },
];

export const THESIS_REF_IDS = ["cea", "cea2", "cai2007a", "cai2007b", "khasawneh2010", "cai2021fluids"];
export const ADVANCED_REF_IDS = [
  ...THESIS_REF_IDS,
  "billig1967",
  "bird1970",
  "bird1994",
  "boyd1995",
  "crist1966",
  "addy1981",
  "albini1965",
  "boynton1967",
  "dettleff1991",
];
