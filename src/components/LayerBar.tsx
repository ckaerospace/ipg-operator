import { goLayer, type AppLayer } from "../layer";

type Props = {
  current: AppLayer;
};

/** Thesis is the only solve mode. Model is a page link, not a second chip. */
export function LayerBar({ current }: Props) {
  return (
    <div className="layer-bar">
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
