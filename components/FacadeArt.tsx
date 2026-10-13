/**
 * A decorative, non-interactive copy of the building for the introduction
 * page. The pattern is invented; it only shows what the real dashboard looks like.
 * p = paid, h = part-paid, o = owing, v = vacant, W = the merged Unit 6+7.
 */
const PATTERN: string[][] = [
  ["p", "p", "p", "h", "p", "v", "p"],
  ["p", "o", "p", "p", "p", "p", "h"],
  ["p", "p", "p", "p", "o", "p", "p"],
  ["h", "p", "p", "p", "v", "p", "p"],
  ["p", "p", "p", "h", "o", "W"],
];

const STATUS = { p: "paid", h: "part", o: "owe", v: "vacant", W: "paid" } as const;
const FILL = { p: 100, h: 55, o: 0, v: 0, W: 100 } as const;
const AMT = { p: "✓", h: "3.1k", o: "4.8k", v: "", W: "✓" } as const;

export default function FacadeArt() {
  const floors = [4, 3, 2, 1, 0];
  let d = 0;
  return (
    <div className="facade lp-art" aria-hidden>
      <div className="cornice" />
      {PATTERN.map((row, i) => (
        <div className="floor" key={i}>
          <div className="floor-no">{floors[i]}</div>
          <div className="windows">
            {row.map((c, j) => {
              const k = c as keyof typeof STATUS;
              const unit = c === "W" ? "6+7" : String(j + 1);
              return (
                <div
                  key={j}
                  className={`win ${c === "W" ? "wide" : ""}`}
                  data-status={STATUS[k]}
                  style={{ ["--fill" as string]: `${FILL[k]}%`, ["--d" as string]: d++ }}
                >
                  <span className="win-no">{unit}</span>
                  <span className="win-amt">{AMT[k]}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="ground" />
    </div>
  );
}
