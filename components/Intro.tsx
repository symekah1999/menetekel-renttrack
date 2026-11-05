"use client";

import { useState } from "react";
import { IconInfo } from "./Icons";

/** The explanatory sentence under a page title: always visible on wide screens, tucked behind a button on phones. */
export default function Intro({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="intro">
      <button type="button" className="intro-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconInfo width={16} height={16} /> {open ? "Hide" : "About this page"}
      </button>
      <p className={`lede intro-text ${open ? "open" : ""}`}>{children}</p>
    </div>
  );
}
