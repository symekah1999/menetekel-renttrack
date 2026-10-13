/**
 * Decorative night-time illustration of Menetekel Apartments for the sign-in panel.
 * Every window is a unit: lit green = paid, half-lit amber = part-paid,
 * dark with a coral frame = owing, dark and plain = vacant. The pattern is invented.
 * p = paid, h = part-paid, o = owing, v = vacant, W = the merged Unit 6+7.
 */
const PATTERN: string[][] = [
  ["p", "p", "p", "h", "p", "v", "p"],
  ["p", "o", "p", "p", "p", "p", "h"],
  ["p", "p", "p", "p", "o", "p", "p"],
  ["h", "p", "p", "p", "v", "p", "p"],
  ["p", "p", "p", "h", "o", "W"],
];

const X0 = 72;      // left edge of the first window (centred on the facade)
const WW = 28;      // window width
const GAP = 10;     // gap between windows
const WH = 36;      // window height
const FLOOR_H = 60; // storey height
const TOP = 96;     // y of the first storey's top edge

const STARS: [number, number, number][] = [
  [34, 40, 1.4], [88, 22, 1], [140, 52, 1.2], [214, 18, 1], [262, 44, 1.3],
  [318, 26, 1], [372, 62, 1.4], [20, 110, 1], [380, 130, 1],
];

export default function BuildingScene() {
  let n = 0;
  return (
    <svg className="scene" viewBox="0 0 400 470" role="img" aria-label="Illustration of the Menetekel Apartments building at night" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="bs-wall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b2a7a" />
          <stop offset="0.55" stopColor="#32226b" />
          <stop offset="1" stopColor="#261a56" />
        </linearGradient>
        <linearGradient id="bs-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1c5e" />
          <stop offset="1" stopColor="#1b1240" />
        </linearGradient>
        <radialGradient id="bs-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <filter id="bs-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {PATTERN.flatMap((row, i) =>
          row.map((c, j) => {
            if (c !== "h") return null;
            const x = X0 + j * (WW + GAP);
            const y = TOP + i * FLOOR_H + 8;
            return (
              <clipPath id={`bs-c${i}-${j}`} key={`${i}-${j}`}>
                <rect x={x} y={y} width={WW} height={WH} rx="5" />
              </clipPath>
            );
          })
        )}
      </defs>

      {/* sky: moon and stars */}
      <circle cx="326" cy="62" r="46" fill="url(#bs-moon)" />
      <circle cx="326" cy="62" r="15" fill="#fff3d1" />
      <circle cx="320" cy="57" r="15" fill="#3e2a7e" opacity="0.0" />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} className="star" cx={x} cy={y} r={r} fill="#fff" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}

      {/* trees */}
      <g>
        <rect x="27" y="404" width="4" height="30" fill="#1b1240" />
        <ellipse cx="29" cy="396" rx="22" ry="30" fill="#1f5a52" />
        <ellipse cx="22" cy="404" rx="14" ry="20" fill="#27705f" />
        <rect x="369" y="410" width="4" height="26" fill="#1b1240" />
        <ellipse cx="371" cy="402" rx="19" ry="27" fill="#1f5a52" />
        <ellipse cx="378" cy="410" rx="12" ry="17" fill="#27705f" />
      </g>

      {/* roof: tank and parapet */}
      <g>
        <rect x="102" y="62" width="30" height="22" rx="3" fill="#4a3796" />
        <rect x="108" y="84" width="3" height="10" fill="#4a3796" />
        <rect x="123" y="84" width="3" height="10" fill="#4a3796" />
        <rect x="262" y="70" width="14" height="24" fill="#4a3796" />
        <rect x="258" y="66" width="22" height="6" rx="2" fill="#5b45a8" />
      </g>
      <rect x="48" y="84" width="304" height="12" rx="3" fill="#5b3fa8" />
      <rect x="48" y="94" width="304" height="3" fill="#7a5fd0" opacity="0.7" />

      {/* the building */}
      <rect x="52" y="96" width="296" height={FLOOR_H * 5 + 38} fill="url(#bs-wall)" />
      <rect x="52" y="96" width="4" height={FLOOR_H * 5 + 38} fill="#6a52bb" opacity="0.45" />

      {/* storey slabs + balcony rails */}
      {PATTERN.map((_, i) => {
        const y = TOP + i * FLOOR_H;
        return (
          <g key={i}>
            <rect x="48" y={y + FLOOR_H - 3} width="304" height="4" fill="#5b45a8" opacity="0.8" />
            <rect x="48" y={y + FLOOR_H + 1} width="304" height="2" fill="#000" opacity="0.18" />
          </g>
        );
      })}

      {/* windows */}
      {PATTERN.map((row, i) =>
        row.map((c, j) => {
          const merged = c === "W";
          const x = X0 + j * (WW + GAP);
          const y = TOP + i * FLOOR_H + 8;
          const w = merged ? WW * 2 + GAP : WW;
          const delay = `${(n++ * 0.045).toFixed(2)}s`;
          const lit = c === "p" || merged;
          return (
            <g key={`${i}-${j}`} className="win-g" style={{ animationDelay: delay }}>
              {(lit || c === "h") && (
                <rect x={x} y={y} width={w} height={WH} rx="5"
                  fill={lit ? "#4cc79a" : "#e9a62a"} opacity={lit ? 0.55 : 0.4} filter="url(#bs-glow)" />
              )}
              <rect x={x} y={y} width={w} height={WH} rx="5"
                fill={lit ? "#58d6a6" : "#1a1140"}
                stroke={c === "o" ? "#f08585" : c === "h" ? "#e9a62a" : lit ? "#7fe6bd" : "#4a3796"} strokeWidth="1.6" />
              {c === "h" && (
                <rect x={x} y={y + WH * 0.45} width={w} height={WH * 0.55} fill="#e9a62a" clipPath={`url(#bs-c${i}-${j})`} />
              )}
              {c === "o" && <rect x={x + 1} y={y + 1} width={w - 2} height={WH - 2} rx="4" fill="#f08585" opacity="0.14" />}
              {/* frame bars */}
              <path d={`M${x + w / 2} ${y} V${y + WH} M${x} ${y + WH * 0.55} H${x + w}`} stroke="#1a1140" strokeWidth="1.4" opacity={lit || c === "h" ? 0.32 : 0.7} />
              {merged && <path d={`M${x + w / 4} ${y} V${y + WH} M${x + (w * 3) / 4} ${y} V${y + WH}`} stroke="#1a1140" strokeWidth="1.4" opacity="0.32" />}
              {/* flower box on the balcony rail */}
              {c !== "v" && <rect x={x + 2} y={y + WH + 2} width={w - 4} height="3" rx="1.5" fill="#3f9b7c" opacity="0.7" />}
            </g>
          );
        })
      )}

      {/* lobby */}
      <rect x="52" y={TOP + FLOOR_H * 5} width="296" height="38" fill="#241853" />
      <rect x="168" y={TOP + FLOOR_H * 5 + 6} width="64" height="32" rx="3" fill="#ffd98a" />
      <path d={`M200 ${TOP + FLOOR_H * 5 + 6} V${TOP + FLOOR_H * 5 + 38}`} stroke="#9b6f1c" strokeWidth="2" />
      <path d={`M158 ${TOP + FLOOR_H * 5 + 6} H242 L236 ${TOP + FLOOR_H * 5 - 4} H164 Z`} fill="#e45f7a" />
      <circle cx="115" cy={TOP + FLOOR_H * 5 + 18} r="11" fill="#58d6a6" opacity="0.35" />
      <circle cx="285" cy={TOP + FLOOR_H * 5 + 18} r="11" fill="#58d6a6" opacity="0.35" />
      <text x="200" y="76" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontWeight="700" fontSize="10" letterSpacing="3.2" fill="#fff" opacity="0.92">MENETEKEL</text>

      {/* ground */}
      <rect x="0" y={TOP + FLOOR_H * 5 + 38} width="400" height="36" fill="url(#bs-ground)" />
      <rect x="52" y={TOP + FLOOR_H * 5 + 38} width="296" height="3" fill="#7a5fd0" opacity="0.35" />
      <path d={`M176 ${TOP + FLOOR_H * 5 + 38} H224 L238 470 H162 Z`} fill="#3a2a7a" opacity="0.9" />
    </svg>
  );
}
