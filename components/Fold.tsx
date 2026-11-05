"use client";

import { useEffect, useState } from "react";
import { IconChevron } from "./Icons";

/**
 * A card whose body folds away. On phones it starts closed (or open, if
 * `defaultOpen`) so a long page becomes a short list; on wide screens it
 * starts open, because there is room.
 */
export default function Fold({
  id, title, hint, defaultOpen = false, children,
}: {
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (window.matchMedia("(min-width: 900px)").matches) setOpen(true);
  }, []);

  return (
    <details
      className="card fold mb-16"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary aria-describedby={hint ? `${id}-hint` : undefined}>
        <span>
          <span className="h2" id={id}>{title}</span>
          {hint && <span className="fold-hint" id={`${id}-hint`}>{hint}</span>}
        </span>
        <IconChevron className="fold-chev" aria-hidden />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
