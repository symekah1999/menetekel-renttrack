"use client";

import { useEffect, useState } from "react";
import { calmStored, setCalm } from "@/lib/motion";

/** Turns the animation and scenery off on this device. */
export default function CalmSwitch() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(calmStored()); }, []);
  return (
    <label className="row gap-12" style={{ cursor: "pointer", alignItems: "flex-start" }}>
      <input type="checkbox" checked={on} style={{ width: 22, height: 22, accentColor: "var(--brand)", marginTop: 2 }}
        onChange={(e) => { setOn(e.target.checked); setCalm(e.target.checked); }} />
      <span>
        <span className="strong" style={{ display: "block" }}>Calm mode</span>
        <span className="muted small">No animation and no sky or scenery behind the building. It also switches on by itself if your phone is set to reduce motion.</span>
      </span>
    </label>
  );
}
