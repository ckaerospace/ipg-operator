import { goLayer, LAYER_LABEL, type AppLayer } from "../layer";

const MODES = ["thesis", "advanced"] as const;

type Props = {
  current: AppLayer;
  onThesisOrAdvanced?: (layer: "thesis" | "advanced") => void;
};

export function LayerBar({ current, onThesisOrAdvanced }: Props) {
  const solving = current === "thesis" || current === "advanced";
  return (
    <div className="layer-bar">
      <div className="layer-modes-block">
        <div className="h-label">Operation mode</div>
        <div className="layer-modes" role="tablist" aria-label="Operation mode">
          {MODES.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={solving && current === id}
              className={`chip${solving && current === id ? " on" : ""}`}
              onClick={() => {
                goLayer(id);
                onThesisOrAdvanced?.(id);
              }}
            >
              {LAYER_LABEL[id]}
            </button>
          ))}
        </div>
      </div>
      <a
        className={`model-page-link${current === "manual" ? " on" : ""}`}
        href="/model"
        onClick={(e) => {
          e.preventDefault();
          goLayer("manual");
        }}
      >
        Model
      </a>
    </div>
  );
}
