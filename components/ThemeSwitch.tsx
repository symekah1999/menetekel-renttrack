"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "menetekel:theme";

function apply(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}

/** System follows the phone; Light and Dark override it on this device. */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") setTheme(t);
    } catch { /* ignore */ }
  }, []);
  function choose(t: Theme) {
    setTheme(t);
    apply(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch { /* ignore */ }
  }
  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {(["system", "light", "dark"] as Theme[]).map((t) => (
        <button key={t} aria-pressed={theme === t} onClick={() => choose(t)}>
          {t === "system" ? "Match my phone" : t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
