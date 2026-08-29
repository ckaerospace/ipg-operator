import { goLayer, LAYER_LABEL, type AppLayer } from "../layer";

const ORDER: AppLayer[] = ["thesis", "advanced", "manual"];

type Props = {
  current: AppLayer;
  onThesisOrAdvanced?: (layer: "thesis" | "advanced") => void;
};

export function LayerBar({ current, onThesisOrAdvanced }: Props) {
  return (
    <div className="layer-bar" role="tablist" aria-label="App layer">
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={current === id}
          className={`chip${current === id ? " on" : ""}`}
          onClick={() => {
            if (id === "manual") {
              goLayer("manual");
              return;
            }
            goLayer(id);
            onThesisOrAdvanced?.(id);
          }}
        >
          {LAYER_LABEL[id]}
        </button>
      ))}
    </div>
  );
}
