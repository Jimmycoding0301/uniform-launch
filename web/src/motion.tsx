import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const WIDE = "，。？、；：（）";

export function Zh({ text }: { text: string }) {
  const parts = text.split(/([，。？、；：（）])/);
  return (
    <>
      {parts.map((part, i) =>
        part.length === 1 && WIDE.includes(part) ? (
          <span key={i} className="fw-punct">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function Roller({ text }: { text: string }) {
  return (
    <span className="roller" role="img" aria-label={text}>
      {[...text].map((ch, i) =>
        ch >= "0" && ch <= "9" ? (
          <span className="roll-digit" key={`${i}-${text.length}`} aria-hidden="true">
            <span className="roll-col" style={{ transform: `translate3d(0, ${-Number(ch)}em, 0)` }}>
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="roll-ch" key={`${i}-${ch}`} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
