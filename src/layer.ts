export type AppLayer = "thesis" | "advanced" | "manual";

export const LAYER_KEY = "ipg-layer";
export const DEFAULT_LAYER: AppLayer = "thesis";

export function parseLayer(raw: string | null | undefined): AppLayer {
  if (raw === "manual") return "manual";
  return DEFAULT_LAYER;
}

/** Live PWA is Thesis-only. Advanced is not an operator layer. */
export function operatorLayer(_layer?: AppLayer): "thesis" {
  return "thesis";
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
    localStorage.setItem(LAYER_KEY, layer === "manual" ? "manual" : "thesis");
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
  manual: "Model",
};
