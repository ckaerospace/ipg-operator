export type AppLayer = "thesis" | "advanced" | "manual";

export const LAYER_KEY = "ipg-layer";
export const DEFAULT_LAYER: AppLayer = "thesis";

export function parseLayer(raw: string | null | undefined): AppLayer {
  if (raw === "thesis" || raw === "advanced" || raw === "manual") return raw;
  return DEFAULT_LAYER;
}

/** Solver chrome: Manual is not a solve layer. */
export function operatorLayer(layer: AppLayer): "thesis" | "advanced" {
  return layer === "advanced" ? "advanced" : "thesis";
}

export function readLayer(): AppLayer {
  try {
    return parseLayer(localStorage.getItem(LAYER_KEY));
  } catch {
    return DEFAULT_LAYER;
  }
}

export function writeLayer(layer: AppLayer): void {
  try {
    localStorage.setItem(LAYER_KEY, layer);
  } catch {
    /* private mode */
  }
}

export function goLayer(layer: AppLayer): void {
  writeLayer(layer);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (layer === "manual") {
    if (path !== "/model") window.location.assign("/model");
    return;
  }
  if (path === "/model") window.location.assign("/");
}

export const LAYER_LABEL: Record<AppLayer, string> = {
  thesis: "Thesis",
  advanced: "Advanced",
  manual: "Manual",
};
