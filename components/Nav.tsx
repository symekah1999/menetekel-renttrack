"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Property" },
  { href: "/collect", label: "Collect rent" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">MENETEKEL</div>
          <div className="brand-sub">Apartments · Nairobi</div>
        </div>
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${path === l.href ? "active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Link href="/collect" className="btn-gold" style={{ padding: "8px 16px" }}>
        Enter rent data →
      </Link>
    </nav>
  );
}
