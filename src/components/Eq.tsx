import { renderEq } from "../eq";
import "katex/dist/katex.min.css";

type Props = {
  math: string;
  display?: boolean;
  num?: string;
};

/** Small KaTeX wrapper. Display equations get `.eq`; inline uses `.eq-inline`. */
export function Eq({ math, display = true, num }: Props) {
  const html = renderEq(math, display);
  if (!display) {
    return <span className="eq-inline" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className="eq">
      <div className="eq-math" dangerouslySetInnerHTML={{ __html: html }} />
      {num ? <span className="eq-num">{num}</span> : null}
    </div>
  );
}
