/** Parse a typed number. Empty or NaN is not 0 — caller reverts to last valid. */
export function parseDraftNumber(raw: string, min: number, max: number): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Commit on blur/Enter. Empty or NaN returns `last`, never 0-from-empty. */
export function commitDraftNumber(raw: string, last: number, min: number, max: number): number {
  return parseDraftNumber(raw, min, max) ?? last;
}
