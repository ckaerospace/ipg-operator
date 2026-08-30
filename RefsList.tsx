import { BUG_REPORT_URL } from "../routes";
import { REFS, type RefItem } from "../refs";

export function RefsList({
  compact = false,
  ids,
}: {
  compact?: boolean;
  ids?: string[];
}) {
  const items: RefItem[] = ids ? REFS.filter((r) => ids.includes(r.id)) : REFS;
  return (
    <ol className={compact ? "refs compact" : "refs"}>
      {items.map((r) => (
        <li key={r.id}>
          {r.cite}
          {r.href ? (
            <>
              {" "}
              <a href={r.href} target="_blank" rel="noreferrer">
                {r.label ?? r.href}
              </a>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ManualLink() {
  return (
    <a className="model-notes" href="/model">
      Model
    </a>
  );
}

export function BugReportLink() {
  return (
    <a className="model-notes" href={BUG_REPORT_URL} target="_blank" rel="noreferrer">
      Report a bug
    </a>
  );
}
