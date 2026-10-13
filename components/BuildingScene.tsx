/**
 * Sign-in hero: Menetekel Apartments at dusk, Nairobi.
 *
 * Purely decorative (the panel is aria-hidden). Drawn as layered SVG so it stays
 * sharp at any size and costs nothing to load: sky and distant city, the block
 * itself (stone stair core, plaster facade, glass balconies, lit rooms, a side
 * wall in perspective), the lobby, then a jacaranda, the compound wall and a
 * street lamp in the foreground. Everything random is seeded, so server and
 * client render the same picture.
 */

const W = 800;
const H = 1000;

const FH = 100; // storey height
const TOP = 250; // top of the highest storey
const FLOORS = 5;
const LOBBY = TOP + FH * FLOORS; // 750
const GROUND = 870;
const FL = 290; // plaster facade, left edge
const FR = 560; // plaster facade, right edge (corner)
const CL = 230; // stone stair core, left edge
const DEPTH = 92; // visible depth of the side wall
const EYE = 800; // horizon / eye level
const VP = 1040; // distance to the right vanishing point

/** y of a point `d` units back along the side wall, starting from the corner at height y. */
const py = (d: number, y: number) => y + (EYE - y) * (d / VP);
const pt = (d: number, y: number) => `${FR + d},${py(d, y).toFixed(1)}`;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Room = "warm" | "lamp" | "plant" | "curtain" | "tv" | "dark";

/** Two balcony bays per floor, top floor first. */
const ROOMS: [Room, Room][] = [
  ["plant", "dark"],
  ["curtain", "lamp"],
  ["tv", "warm"],
  ["lamp", "curtain"],
  ["dark", "plant"],
];
const SIDE: Room[] = ["warm", "dark", "curtain", "warm", "dark"];
const BAYS = [302, 434];
const BAY_W = 116;

const BASE: Record<Room, string> = {
  warm: "url(#ms-warm)",
  lamp: "url(#ms-warm)",
  plant: "url(#ms-warm)",
  curtain: "url(#ms-curtain)",
  tv: "url(#ms-tv)",
  dark: "url(#ms-darkglass)",
};

function RoomView({ id, x, y, w, h, type, toggle }: { id: string; x: number; y: number; w: number; h: number; type: Room; toggle?: boolean }) {
  const lit = type !== "dark";
  return (
    <g>
      <clipPath id={id}><rect x={x} y={y} width={w} height={h} /></clipPath>
      <g clipPath={`url(#${id})`}>
      <rect x={x} y={y} width={w} height={h} fill={BASE[type]} />
      {/* back wall + ceiling light */}
      {(type === "warm" || type === "lamp" || type === "plant") && (
        <>
          <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#b8743f" opacity="0.28" />
          <rect x={x} y={y} width={w} height={h * 0.7} fill="url(#ms-ceil)" />
          {/* sheer curtains at the sides */}
          <rect x={x} y={y} width={w * 0.2} height={h} fill="#fff7ea" opacity="0.38" />
          <rect x={x + w * 0.82} y={y} width={w * 0.18} height={h} fill="#fff7ea" opacity="0.32" />
        </>
      )}
      {type === "warm" && (
        <>
          <line x1={x + w * 0.42} y1={y} x2={x + w * 0.42} y2={y + 18} stroke="#3a261a" strokeWidth="1" />
          <ellipse cx={x + w * 0.42} cy={y + 21} rx="7" ry="4" fill="#2e1f17" />
          <circle cx={x + w * 0.42} cy={y + 24} r="9" fill="#fff4d6" opacity="0.55" />
          {/* a framed picture on the back wall */}
          <rect x={x + w * 0.58} y={y + 22} width="16" height="12" fill="#6b4a33" opacity="0.55" />
        </>
      )}
      {type === "lamp" && (
        <>
          <line x1={x + w * 0.7} y1={y + h} x2={x + w * 0.7} y2={y + h - 38} stroke="#2a1d16" strokeWidth="1.6" />
          <path d={`M${x + w * 0.7 - 8} ${y + h - 38} h16 l-4 -10 h-8 z`} fill="#fff1c9" />
          <circle cx={x + w * 0.7} cy={y + h - 42} r="16" fill="#fff1c9" opacity="0.4" />
          <rect x={x + w * 0.18} y={y + h - 26} width={w * 0.36} height="14" rx="4" fill="#3b2a22" opacity="0.75" />
        </>
      )}
      {type === "plant" && (
        <g opacity="0.85">
          <rect x={x + 16} y={y + h - 16} width="12" height="16" fill="#2c2018" />
          <ellipse cx={x + 22} cy={y + h - 26} rx="10" ry="14" fill="#2f4a2a" />
          <ellipse cx={x + 15} cy={y + h - 32} rx="6" ry="10" fill="#3b5d33" transform={`rotate(-25 ${x + 15} ${y + h - 32})`} />
          <ellipse cx={x + 29} cy={y + h - 34} rx="6" ry="11" fill="#355530" transform={`rotate(20 ${x + 29} ${y + h - 34})`} />
        </g>
      )}
      {type === "curtain" && (
        <>
          {Array.from({ length: Math.floor(w / 6) }, (_, i) => (
            <line key={i} x1={x + 3 + i * 6} y1={y} x2={x + 3 + i * 6} y2={y + h} stroke="#9a6534" strokeWidth="1.2" opacity="0.22" />
          ))}
          <rect x={x + w * 0.47} y={y} width={w * 0.06} height={h} fill="#fff3d4" opacity="0.8" />
        </>
      )}
      {type === "tv" && (
        <>
          <rect className="ms-flicker" x={x} y={y} width={w} height={h} fill="#c9dcff" opacity="0.18" />
          <rect x={x + w * 0.2} y={y + h - 24} width={w * 0.45} height="14" rx="4" fill="#1d1f3a" opacity="0.8" />
        </>
      )}
      {type === "dark" && (
        <>
          <path d={`M${x + w * 0.15} ${y} L${x + w * 0.42} ${y} L${x + w * 0.12} ${y + h} L${x} ${y + h} Z`} fill="#8f7fc4" opacity="0.16" />
          <path d={`M${x + w * 0.55} ${y} L${x + w * 0.62} ${y} L${x + w * 0.36} ${y + h} L${x + w * 0.29} ${y + h} Z`} fill="#8f7fc4" opacity="0.12" />
        </>
      )}
      {toggle && <rect className="ms-toggle" x={x} y={y} width={w} height={h} fill="#1b1631" />}
      </g>
      {/* glass sheen + frame */}
      <rect x={x} y={y} width={w} height={h} fill="url(#ms-sheen)" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#2a2530" strokeWidth="3" />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#2a2530" strokeWidth="2.4" />
      {lit && <rect x={x} y={y} width={w} height="10" fill="url(#ms-soffit)" />}
    </g>
  );
}

function Balcony({ x, top, plant }: { x: number; top: number; plant?: boolean }) {
  const y = top + 58;
  return (
    <g>
      {plant && (
        <g>
          <path d={`M${x + BAY_W - 22} ${top + 88} l3 -12 h12 l3 12 z`} fill="#3a2a22" />
          <ellipse cx={x + BAY_W - 13} cy={top + 70} rx="11" ry="9" fill="#2f5a3a" />
          <ellipse cx={x + BAY_W - 18} cy={top + 66} rx="6" ry="8" fill="#3c7048" />
        </g>
      )}
      {/* glass balustrade */}
      <rect x={x - 6} y={y} width={BAY_W + 12} height="30" fill="url(#ms-glass)" stroke="#e9eef5" strokeOpacity="0.35" strokeWidth="0.8" />
      <path d={`M${x + 10} ${y + 30} L${x + 30} ${y}`} stroke="#fff" strokeOpacity="0.16" strokeWidth="5" />
      <path d={`M${x + 62} ${y + 30} L${x + 76} ${y}`} stroke="#fff" strokeOpacity="0.1" strokeWidth="3" />
      <rect x={x - 7} y={y - 2.5} width={BAY_W + 14} height="3" rx="1.2" fill="#dfe4ea" />
      {[x - 6, x + BAY_W / 2 - 1, x + BAY_W + 4].map((px, i) => (
        <rect key={i} x={px} y={y} width="2" height="30" fill="#c7ced6" opacity="0.8" />
      ))}
      {/* slab: front edge, then its underside in shadow */}
      <rect x={x - 9} y={top + 88} width={BAY_W + 18} height="7" fill="#c3b3aa" />
      <rect x={x - 9} y={top + 88} width={BAY_W + 18} height="1.5" fill="#ddd0c6" />
      <rect x={x - 9} y={top + 95} width={BAY_W + 18} height="5" fill="#140f22" opacity="0.28" />
      <polygon points={`${x + BAY_W + 9},${top + 88} ${x + BAY_W + 13},${top + 89.5} ${x + BAY_W + 13},${top + 96} ${x + BAY_W + 9},${top + 95}`} fill="#b9aa9c" />
    </g>
  );
}

export default function BuildingScene() {
  const r = rng(7);

  // ---- distant city ----
  const far: { x: number; w: number; h: number }[] = [];
  for (let x = -20; x < W + 20; ) {
    const w = 26 + r() * 54;
    far.push({ x, w, h: 50 + r() * r() * 230 });
    x += w + (r() < 0.3 ? 6 : 0);
  }
  const farLights: { x: number; y: number; o: number }[] = [];
  far.forEach((b) => {
    for (let yy = 836 - b.h + 8; yy < 820; yy += 9)
      for (let xx = b.x + 5; xx < b.x + b.w - 5; xx += 8)
        if (r() < 0.12) farLights.push({ x: xx, y: yy, o: 0.35 + r() * 0.5 });
  });

  // ---- stars ----
  const stars = Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * 400, s: 0.5 + r() * 1.2, o: 0.25 + r() * 0.7, tw: r() < 0.3 }));

  // ---- stone tiles on the stair core ----
  const tiles: { x: number; y: number; w: number; c: string }[] = [];
  const stone = ["#3b3650", "#423c59", "#36314a", "#47405e", "#3e3854"];
  for (let y = 196; y < GROUND; y += 14) {
    let x = CL + (Math.floor((y - 196) / 14) % 2 ? -12 : 0);
    while (x < 290) {
      const w = 18 + r() * 22;
      tiles.push({ x, y, w, c: stone[Math.floor(r() * stone.length)] });
      x += w;
    }
  }

  // ---- jacaranda canopy: many small clusters, lit from the top right ----
  const jac = ["#2e2150", "#3b2a63", "#4a3478", "#5a408c", "#6b4ea0", "#7a5caf", "#8a6dbd", "#9c80cb"];
  const blooms: { x: number; y: number; rad: number; c: string; s: number }[] = [];
  const JX = 140, JY = 640, JRX = 152, JRY = 110;
  // a few lobes so the outline is irregular, not an ellipse
  const lobes = [
    { x: JX - 70, y: JY + 10, rx: 80, ry: 70 },
    { x: JX + 10, y: JY - 40, rx: 95, ry: 75 },
    { x: JX + 85, y: JY + 5, rx: 75, ry: 65 },
    { x: JX - 20, y: JY + 55, rx: 90, ry: 50 },
    { x: JX + 120, y: JY - 30, rx: 45, ry: 40 },
  ];
  for (let i = 0; i < 900; i++) {
    const L = lobes[Math.floor(r() * lobes.length)];
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6);
    const x = L.x + Math.cos(a) * d * L.rx;
    const y = L.y + Math.sin(a) * d * L.ry;
    const score = ((x - JX) / JRX) * 0.35 + ((JY - y) / JRY) * 0.5 + (1 - d) * 0.15 + r() * 0.55;
    const idx = Math.max(0, Math.min(jac.length - 1, Math.floor(((score + 0.75) / 1.85) * jac.length)));
    const c = r() < 0.07 ? (r() < 0.5 ? "#1f3a30" : "#2b4a3b") : jac[idx];
    blooms.push({ x, y, rad: 3.5 + r() * 7.5, c, s: score });
  }
  blooms.sort((a, b) => a.s - b.s);
  const petals = Array.from({ length: 55 }, () => ({ x: 20 + r() * 300, y: 910 + r() * 40, rx: 0.8 + r() * 1.6, o: 0.25 + r() * 0.4 }));

  // ---- right-hand tree ----
  const greens = ["#0d1f1c", "#122a25", "#17352d", "#1d4236", "#265040", "#33604a"];
  const leaves = Array.from({ length: 520 }, () => {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6);
    const x = 772 + Math.cos(a) * d * 88, y = 716 + Math.sin(a) * d * 125;
    // lit from the street lamp on its left
    const score = ((772 - x) / 88) * 0.55 + (y > 640 && y < 760 ? 0.2 : 0) + r() * 0.6;
    return { x, y, rad: 3.5 + r() * 7, c: greens[Math.max(0, Math.min(5, Math.floor(((score + 0.5) / 1.8) * 6)))], s: score };
  }).sort((a, b) => a.s - b.s);

  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f0b27" />
          <stop offset="0.32" stopColor="#241a52" />
          <stop offset="0.55" stopColor="#4a3482" />
          <stop offset="0.68" stopColor="#8a4f8f" />
          <stop offset="0.76" stopColor="#d27a7f" />
          <stop offset="0.83" stopColor="#f2a777" />
          <stop offset="0.9" stopColor="#f6c38c" />
        </linearGradient>
        <linearGradient id="ms-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3a27c" stopOpacity="0" />
          <stop offset="1" stopColor="#f3a27c" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="ms-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3577" />
          <stop offset="1" stopColor="#6b4680" />
        </linearGradient>
        <radialGradient id="ms-moonglow">
          <stop offset="0" stopColor="#fff3d8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff3d8" stopOpacity="0" />
        </radialGradient>
        <mask id="ms-moonmask">
          <circle cx="640" cy="150" r="17" fill="#fff" />
          <circle cx="632" cy="144" r="15" fill="#000" />
        </mask>
        <filter id="ms-soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="ms-blur2"><feGaussianBlur stdDeviation="1.1" /></filter>
        <filter id="ms-blur12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id="ms-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <linearGradient id="ms-plaster" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8918f" />
          <stop offset="0.5" stopColor="#8f7a7e" />
          <stop offset="1" stopColor="#76646f" />
        </linearGradient>
        <linearGradient id="ms-plaster-x" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a1f45" stopOpacity="0.28" />
          <stop offset="0.25" stopColor="#2a1f45" stopOpacity="0" />
          <stop offset="0.85" stopColor="#ffd9b0" stopOpacity="0" />
          <stop offset="1" stopColor="#ffd9b0" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="ms-sidewall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a5872" />
          <stop offset="1" stopColor="#3f3452" />
        </linearGradient>
        <linearGradient id="ms-stone-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="ms-uplight" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#ffbf7a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffbf7a" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="ms-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6b8" />
          <stop offset="0.6" stopColor="#f6bb72" />
          <stop offset="1" stopColor="#d9894c" />
        </linearGradient>
        <linearGradient id="ms-curtain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8deb2" />
          <stop offset="1" stopColor="#e2a96c" />
        </linearGradient>
        <linearGradient id="ms-tv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f9ce8" />
          <stop offset="0.6" stopColor="#4a5cb0" />
          <stop offset="1" stopColor="#2a2f66" />
        </linearGradient>
        <linearGradient id="ms-darkglass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d3f80" />
          <stop offset="0.55" stopColor="#2a2252" />
          <stop offset="1" stopColor="#17132d" />
        </linearGradient>
        <radialGradient id="ms-ceil" cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#fffbe9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fffbe9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ms-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ms-soffit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1426" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1b1426" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ms-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe9f5" stopOpacity="0.1" />
          <stop offset="1" stopColor="#dfe9f5" stopOpacity="0.26" />
        </linearGradient>

        <linearGradient id="ms-lobby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2d2" />
          <stop offset="0.55" stopColor="#f7c985" />
          <stop offset="1" stopColor="#df9757" />
        </linearGradient>
        <linearGradient id="ms-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ms-bulb">
          <stop offset="0" stopColor="#fff8e4" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#ffd28a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffb867" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ms-pool">
          <stop offset="0" stopColor="#ffc982" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffc982" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="ms-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2347" />
          <stop offset="1" stopColor="#110d22" />
        </linearGradient>
        <linearGradient id="ms-path" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a6d6a" />
          <stop offset="1" stopColor="#3c3150" />
        </linearGradient>
        <linearGradient id="ms-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3e58" />
          <stop offset="1" stopColor="#261f36" />
        </linearGradient>
        <radialGradient id="ms-vignette" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#0b0818" stopOpacity="0" />
          <stop offset="1" stopColor="#0b0818" stopOpacity="0.6" />
        </radialGradient>

        <clipPath id="ms-building">
          <path d={`M${CL} 196 H${FL} V${TOP - 20} H${FR} L${pt(DEPTH, TOP - 20).replace(",", " ")} L${pt(DEPTH, GROUND).replace(",", " ")} L${FR} ${GROUND} H${CL} Z`} />
        </clipPath>
      </defs>

      {/* ============ sky ============ */}
      <rect width={W} height={H} fill="url(#ms-sky)" />
      {stars.map((s, i) => (
        <circle key={i} className={s.tw ? "ms-star" : undefined} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o}
          style={s.tw ? { animationDelay: `${(i % 7) * 0.6}s` } : undefined} />
      ))}
      <circle cx="636" cy="148" r="80" fill="url(#ms-moonglow)" />
      <rect x="600" y="110" width="80" height="80" fill="#fff4dc" mask="url(#ms-moonmask)" />
      <g filter="url(#ms-soft)">
        <ellipse cx="150" cy="560" rx="200" ry="10" fill="#f0a3a0" opacity="0.28" />
        <ellipse cx="610" cy="600" rx="240" ry="12" fill="#f5b29a" opacity="0.3" />
        <ellipse cx="420" cy="520" rx="160" ry="7" fill="#c98fb4" opacity="0.25" />
        <ellipse cx="700" cy="330" rx="150" ry="9" fill="#5c4691" opacity="0.5" />
      </g>

      {/* ============ distant city ============ */}
      <g filter="url(#ms-blur2)">
        {far.map((b, i) => (
          <rect key={i} x={b.x} y={836 - b.h} width={b.w} height={b.h} fill="url(#ms-far)" />
        ))}
        {farLights.map((l, i) => (
          <rect key={i} x={l.x} y={l.y} width="2.4" height="2.4" fill="#ffd79a" opacity={l.o} />
        ))}
      </g>
      {far.filter((b) => b.h > 190).map((b, i) => (
        <circle key={i} className="ms-beacon" cx={b.x + b.w / 2} cy={836 - b.h - 3} r="2" fill="#ff5a5a" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <rect x="0" y="600" width={W} height="240" fill="url(#ms-haze)" />
      <path d="M0 818 q40 -26 80 -8 t90 -6 t110 4 t120 -10 t130 8 t120 -12 t150 6 V860 H0 Z" fill="#1f1640" />

      {/* ============ the building ============ */}
      {/* soft contact shadow */}
      <ellipse cx="460" cy="874" rx="300" ry="16" fill="#07040f" opacity="0.55" filter="url(#ms-blur12)" />

      {/* roof furniture, behind the parapet */}
      <g>
        {[316, 364].map((tx, i) => (
          <g key={i}>
            <line x1={tx + 4} y1="212" x2={tx + 4} y2="232" stroke="#1d1a24" strokeWidth="2" />
            <line x1={tx + 32} y1="212" x2={tx + 32} y2="232" stroke="#1d1a24" strokeWidth="2" />
            <rect x={tx} y="178" width="36" height="34" rx="4" fill="#1e1b26" />
            <rect x={tx} y="178" width="36" height="34" rx="4" fill="url(#ms-stone-shade)" />
            <rect x={tx + 6} y="178" width="5" height="34" fill="#fff" opacity="0.07" />
            <line x1={tx} y1="190" x2={tx + 36} y2="190" stroke="#000" strokeOpacity="0.35" />
            <line x1={tx} y1="201" x2={tx + 36} y2="201" stroke="#000" strokeOpacity="0.35" />
            <ellipse cx={tx + 18} cy="178" rx="18" ry="4" fill="#2c2836" />
            <rect x={tx + 14} y="171" width="8" height="5" rx="1" fill="#2c2836" />
          </g>
        ))}
        <rect x="466" y="192" width="74" height="42" fill="#8f7b7d" />
        <rect x="466" y="192" width="74" height="42" fill="url(#ms-plaster-x)" />
        <rect x="462" y="188" width="82" height="6" fill="#bcaea6" />
        <rect x="508" y="206" width="20" height="28" fill="#3a3346" />
        <line x1="482" y1="188" x2="482" y2="150" stroke="#2b2631" strokeWidth="1.6" />
        <line x1="476" y1="160" x2="488" y2="160" stroke="#2b2631" strokeWidth="1.4" />
        <line x1="474" y1="168" x2="490" y2="168" stroke="#2b2631" strokeWidth="1.4" />
        <circle className="ms-beacon" cx="482" cy="149" r="1.8" fill="#ff6b6b" />
      </g>

      {/* side wall in perspective */}
      <polygon points={`${pt(0, TOP - 20)} ${pt(DEPTH, TOP - 20)} ${pt(DEPTH, GROUND)} ${pt(0, GROUND)}`} fill="url(#ms-sidewall)" />
      <polygon points={`${pt(0, TOP - 24)} ${pt(DEPTH + 3, TOP - 24)} ${pt(DEPTH + 3, TOP - 18)} ${pt(0, TOP - 18)}`} fill="#b7a5a6" />
      {SIDE.map((type, i) => {
        const t = TOP + i * FH;
        const y1 = t + 22, y2 = t + 80;
        return (
          <g key={i}>
            <polygon points={`${pt(24, y1)} ${pt(64, y1)} ${pt(64, y2)} ${pt(24, y2)}`} fill={BASE[type]} opacity={type === "dark" ? 1 : 0.92} />
            <polygon points={`${pt(24, y1)} ${pt(64, y1)} ${pt(64, y2)} ${pt(24, y2)}`} fill="none" stroke="#2a2530" strokeWidth="2.4" />
            <line x1={FR + 44} y1={py(44, y1)} x2={FR + 44} y2={py(44, y2)} stroke="#2a2530" strokeWidth="1.8" />
            <polygon points={`${pt(20, y2 + 1)} ${pt(68, y2 + 1)} ${pt(68, y2 + 5)} ${pt(20, y2 + 5)}`} fill="#cbb9ad" />
            <line x1={FR} y1={t + FH - 1} x2={FR + DEPTH} y2={py(DEPTH, t + FH - 1)} stroke="#000" strokeOpacity="0.18" />
          </g>
        );
      })}
      {/* lobby side: a lit service door */}
      <polygon points={`${pt(30, 790)} ${pt(52, 790)} ${pt(52, GROUND)} ${pt(30, GROUND)}`} fill="#f2c27e" opacity="0.85" />
      <polygon points={`${pt(30, 790)} ${pt(52, 790)} ${pt(52, GROUND)} ${pt(30, GROUND)}`} fill="none" stroke="#2a2530" strokeWidth="2" />

      {/* front plaster facade */}
      <rect x={FL} y={TOP - 20} width={FR - FL} height={GROUND - TOP + 20} fill="url(#ms-plaster)" />
      <rect x={FL} y={TOP - 20} width={FR - FL} height={GROUND - TOP + 20} fill="url(#ms-plaster-x)" />
      {/* parapet coping */}
      <rect x={FL - 2} y={TOP - 24} width={FR - FL + 4} height="6" fill="#c7b9b0" />
      <rect x={FL - 2} y={TOP - 18} width={FR - FL + 4} height="3" fill="#000" opacity="0.15" />

      {/* storeys */}
      {ROOMS.map((pair, i) => {
        const t = TOP + i * FH;
        return (
          <g key={i}>
            <line x1={FL} y1={t + FH - 0.5} x2={FR} y2={t + FH - 0.5} stroke="#000" strokeOpacity="0.12" />
            {pair.map((type, j) => {
              const x = BAYS[j];
              return (
                <g key={j}>
                  <RoomView id={`ms-r${i}${j}`} x={x + 6} y={t + 12} w={BAY_W - 12} h={76} type={type} toggle={i === 1 && j === 1} />
                  <Balcony x={x} top={t} plant={type === "plant" || (i === 3 && j === 1)} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* stone stair core with slot windows */}
      <g>
        <rect x={CL} y="196" width={FL - CL} height={GROUND - 196} fill="#3b3650" />
        <clipPath id="ms-core"><rect x={CL} y="196" width={FL - CL} height={GROUND - 196} /></clipPath>
        <g clipPath="url(#ms-core)">
          {tiles.map((t, i) => (
            <rect key={i} x={t.x} y={t.y} width={t.w - 1.2} height="12.8" fill={t.c} />
          ))}
        </g>
        <rect x={CL} y="196" width={FL - CL} height={GROUND - 196} fill="url(#ms-stone-shade)" />
        <rect x={CL - 3} y="190" width={FL - CL + 6} height="7" fill="#5d5674" />
        {ROOMS.map((_, i) => {
          const t = TOP + i * FH;
          return (
            <g key={i}>
              <rect x="252" y={t + 26} width="16" height="56" fill="#cfd6f2" opacity="0.75" />
              <rect x="252" y={t + 26} width="16" height="56" fill="url(#ms-sheen)" />
              <rect x="252" y={t + 26} width="16" height="56" fill="none" stroke="#1f1b29" strokeWidth="2" />
            </g>
          );
        })}
        {/* wall washer by the entrance */}
        <rect x="254" y="790" width="12" height="5" rx="1.5" fill="#2a2533" />
        <ellipse cx="260" cy="805" rx="22" ry="30" fill="url(#ms-bulb)" opacity="0.6" />
      </g>

      {/* lobby */}
      <g>
        <rect x={FL} y={LOBBY} width={FR - FL} height="12" fill="#8a7679" />
        <rect x={FL} y={LOBBY + 12} width={FR - FL} height={GROUND - LOBBY - 12} fill="url(#ms-lobby)" />
        {Array.from({ length: 30 }, (_, i) => (
          <line key={i} x1={FL + 6 + i * 9} y1={LOBBY + 16} x2={FL + 6 + i * 9} y2={GROUND - 30} stroke="#9b5f2f" strokeOpacity="0.16" strokeWidth="2" />
        ))}
        {[340, 372, 404].map((x) => (
          <g key={x}>
            <line x1={x} y1={LOBBY + 12} x2={x} y2={LOBBY + 44} stroke="#5a3b25" strokeWidth="1" />
            <circle cx={x} cy={LOBBY + 47} r="22" fill="url(#ms-bulb)" />
            <path d={`M${x - 6} ${LOBBY + 47} a6 6 0 0 1 12 0 z`} fill="#3a2a20" />
          </g>
        ))}
        <rect x="322" y="834" width="96" height="36" fill="#3c2a20" />
        <rect x="322" y="834" width="96" height="3" fill="#d39a5e" />
        <g>
          <rect x="526" y="846" width="20" height="24" fill="#2c2420" />
          <ellipse cx="536" cy="830" rx="16" ry="22" fill="#2f5034" />
          <ellipse cx="528" cy="822" rx="8" ry="14" fill="#3e6a43" transform="rotate(-20 528 822)" />
          <ellipse cx="545" cy="824" rx="7" ry="13" fill="#386140" transform="rotate(22 545 824)" />
        </g>
        {/* mullions */}
        {[FL, 335, 380, 425, 452, 482, 512, FR - 3].map((x, i) => (
          <rect key={i} x={x} y={LOBBY + 12} width="3" height={GROUND - LOBBY - 12} fill="#221e29" />
        ))}
        <rect x={FL} y={LOBBY + 12} width={FR - FL} height="3" fill="#221e29" />
        <rect x={FL} y={LOBBY + 12} width={FR - FL} height={GROUND - LOBBY - 12} fill="url(#ms-sheen)" />
        {/* entrance doors */}
        <rect x="455" y="796" width="54" height="74" fill="none" stroke="#221e29" strokeWidth="3" />
        <rect x="477" y="820" width="2" height="26" fill="#e9d6b0" />
        <rect x="485" y="820" width="2" height="26" fill="#e9d6b0" />
        {/* canopy with sign */}
        <rect x="414" y="772" width="134" height="18" fill="#221e29" />
        <rect x="414" y="772" width="134" height="1.5" fill="#6b6380" />
        <rect x="414" y="790" width="134" height="3" fill="#fff0cc" opacity="0.9" />
        <text x="481" y="784.5" textAnchor="middle" fontSize="9.5" fontWeight="700" letterSpacing="3.4" fill="#f6e2b8"
          style={{ fontFamily: "var(--font-display), 'Segoe UI', sans-serif" }}>MENETEKEL</text>
        {[438, 481, 524].map((x) => (
          <polygon key={x} points={`${x - 4},793 ${x + 4},793 ${x + 24},${GROUND} ${x - 24},${GROUND}`} fill="url(#ms-cone)" />
        ))}
        <rect x="436" y={GROUND - 3} width="92" height="5" fill="#d8c6b6" />
      </g>

      {/* plaster texture + warm uplight from the lobby */}
      <g clipPath="url(#ms-building)">
        <rect x={CL} y="150" width={DEPTH + FR - CL} height={GROUND - 150} filter="url(#ms-grain)" opacity="0.1" style={{ mixBlendMode: "multiply" }} />
        <ellipse cx="440" cy={GROUND} rx="260" ry="220" fill="url(#ms-uplight)" />
      </g>

      {/* ============ ground ============ */}
      <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="url(#ms-ground)" />
      <ellipse cx="460" cy={GROUND + 18} rx="190" ry="34" fill="url(#ms-pool)" />
      <polygon points={`420,${GROUND} 544,${GROUND} 600,${H} 360,${H}`} fill="url(#ms-path)" opacity="0.75" />
      {Array.from({ length: 7 }, (_, i) => {
        const y = GROUND + 8 + i * i * 2.6;
        const k = (y - GROUND) / (H - GROUND);
        return <line key={i} x1={420 - 60 * k} y1={y} x2={544 + 56 * k} y2={y} stroke="#1a1430" strokeOpacity="0.35" />;
      })}

      {/* ============ jacaranda ============ */}
      <g>
        <path d="M150 905 C148 840 140 790 128 735" stroke="#241a2b" strokeWidth="13" fill="none" strokeLinecap="round" />
        <path d="M142 800 C160 760 190 735 222 712" stroke="#241a2b" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M134 770 C110 740 84 722 60 700" stroke="#241a2b" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M130 745 C135 700 150 680 160 650" stroke="#241a2b" strokeWidth="5" fill="none" strokeLinecap="round" />
        {lobes.map((L, i) => (
          <ellipse key={i} cx={L.x} cy={L.y + 6} rx={L.rx * 0.9} ry={L.ry * 0.85} fill="#21173b" />
        ))}
        {blooms.map((b, i) => (
          <circle key={i} cx={b.x.toFixed(1)} cy={b.y.toFixed(1)} r={b.rad.toFixed(1)} fill={b.c} />
        ))}
        <ellipse cx={JX + 60} cy={JY - 40} rx="90" ry="60" fill="#ffd9c2" opacity="0.08" filter="url(#ms-blur12)" />
      </g>

      {/* ============ right-hand tree ============ */}
      <g>
        <path d="M776 900 C778 850 772 810 768 760" stroke="#14101d" strokeWidth="10" fill="none" />
        <ellipse cx="775" cy="720" rx="80" ry="115" fill="#0b1a17" />
        {leaves.map((l, i) => (
          <circle key={i} cx={l.x.toFixed(1)} cy={l.y.toFixed(1)} r={l.rad.toFixed(1)} fill={l.c} />
        ))}
      </g>

      {/* ============ compound wall, pillars and gate lights ============ */}
      {[
        { x1: -10, x2: 244 },
        { x1: 622, x2: 810 },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x1} y="842" width={s.x2 - s.x1} height="62" fill="url(#ms-wall)" />
          {Array.from({ length: 4 }, (_, k) => (
            <line key={k} x1={s.x1} y1={856 + k * 13} x2={s.x2} y2={856 + k * 13} stroke="#000" strokeOpacity="0.12" />
          ))}
          <rect x={s.x1} y="836" width={s.x2 - s.x1} height="7" fill="#3a3249" />
          {Array.from({ length: Math.ceil((s.x2 - s.x1) / 10) }, (_, k) => (
            <rect key={k} x={s.x1 + k * 10} y="806" width="1.6" height="30" fill="#17121f" />
          ))}
          <rect x={s.x1} y="806" width={s.x2 - s.x1} height="2" fill="#17121f" />
        </g>
      ))}
      {[244, 596].map((x) => (
        <g key={x}>
          <rect x={x} y="824" width="26" height="82" fill="#4b3f58" />
          <ellipse cx={x + 13} cy="850" rx="70" ry="36" fill="url(#ms-pool)" />
          <rect x={x} y="824" width="26" height="82" fill="url(#ms-stone-shade)" />
          <rect x={x - 3} y="818" width="32" height="7" fill="#3a3249" />
          <rect x={x + 9} y="806" width="8" height="12" rx="2" fill="#fff1cf" />
          <circle className="ms-glow" cx={x + 13} cy="811" r="30" fill="url(#ms-bulb)" />
        </g>
      ))}

      {/* ============ street lamp ============ */}
      <g>
        <ellipse cx="690" cy="968" rx="150" ry="20" fill="url(#ms-pool)" />
        <polygon points="684,616 700,616 760,968 620,968" fill="url(#ms-cone)" opacity="0.25" />
        <rect x="727" y="610" width="5" height="360" fill="#14101d" />
        <path d="M729 612 C729 596 714 592 696 600" stroke="#14101d" strokeWidth="4" fill="none" />
        <path d="M682 600 h26 l-4 9 h-18 z" fill="#14101d" />
        <rect x="688" y="608" width="14" height="3" fill="#fff6dc" />
        <circle className="ms-glow" cx="695" cy="612" r="80" fill="url(#ms-bulb)" />
      </g>

      {/* pavement, kerb and fallen jacaranda petals */}
      <rect x="0" y="904" width={W} height="2" fill="#5d4f74" opacity="0.6" />
      <rect x="0" y="952" width={W} height="2" fill="#7a6a92" opacity="0.45" />
      <rect x="0" y="954" width={W} height={H - 954} fill="#0d0a1a" opacity="0.55" />
      {petals.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.rx * 0.6} fill="#a98ae0" opacity={p.o} />
      ))}

      <rect width={W} height={H} fill="url(#ms-vignette)" />
    </svg>
  );
}
