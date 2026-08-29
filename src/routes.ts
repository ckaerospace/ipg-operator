export type AppRoute = "app" | "model";

export const BUG_REPORT_URL = "https://github.com/ckaerospace/ipg-operator/issues/new?template=bug.yml";

export function routeForPath(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/model" ? "model" : "app";
}
