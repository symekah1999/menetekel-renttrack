/** Shown while the app loads: the building draws itself, then its windows light up. */
export default function LaunchMark() {
  const cols = [34, 58, 82];
  const rows = [30, 52, 74, 96];
  const amber = new Set([2, 4, 6]);
  const one = { ["--len" as string]: 1 } as React.CSSProperties;
  return (
    <main className="shell page launch" role="status" aria-label="Opening the building">
      <div>
        <svg viewBox="0 0 132 148" aria-hidden>
          <path className="draw" pathLength={1} style={one} d="M22 140V24a6 6 0 0 1 6-6h76a6 6 0 0 1 6 6v116" />
          <path className="draw" pathLength={1} style={one} d="M10 140h112" />
          <path className="draw" pathLength={1} style={one} d="M56 140v-22h20v22" />
          {rows.map((y, r) =>
            cols.map((x, c) => {
              // ground floor first, so the building lights up from the bottom
              const i = (rows.length - 1 - r) * cols.length + c;
              return (
                <rect key={`${r}-${c}`} x={x} y={y} width="16" height="14" rx="3.5"
                  className={`pop ${amber.has(r * cols.length + c) ? "amber" : ""}`}
                  style={{ ["--i" as string]: i } as React.CSSProperties} />
              );
            })
          )}
        </svg>
        <div className="launch-name">Menetekel</div>
        <div className="launch-sub">Opening the building…</div>
      </div>
    </main>
  );
}
