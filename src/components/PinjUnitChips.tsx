import type { PinjUnit } from "../facility";

export function PinjUnitChips({
  unit,
  onChange,
}: {
  unit: PinjUnit;
  onChange: (u: PinjUnit) => void;
}) {
  return (
    <div className="chips pinj-unit" role="group" aria-label="Chamber pressure unit">
      {(["Pa", "kPa"] as const).map((u) => (
        <button
          key={u}
          type="button"
          className={`chip${unit === u ? " on" : ""}`}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
