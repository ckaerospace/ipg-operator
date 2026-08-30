import { useState, type KeyboardEvent } from "react";
import { parseDraftNumber } from "../numberDraft";

type Props = {
  value: number | null;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void;
  format?: (n: number) => string;
  className?: string;
  "aria-label"?: string;
  placeholder?: string;
};

/** Focused string draft. Empty stays empty; blur/Enter commits or reverts. Never writes 0 from "". */
export function DraftNumber({
  value,
  min,
  max,
  step,
  onCommit,
  format,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft !== null ? draft : value == null ? "" : format ? format(value) : String(value);

  const finish = () => {
    const parsed = parseDraftNumber(draft ?? "", min, max);
    setDraft(null);
    if (parsed == null) return;
    onCommit(parsed);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      className={className}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={shown}
      onFocus={() => setDraft(value == null ? "" : format ? format(value) : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={onKey}
    />
  );
}
