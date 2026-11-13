"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";
import Intro from "@/components/Intro";
import { useReportData, makePeriod, Period } from "@/components/reports/data";
import Overview from "@/components/reports/Overview";

// The less-used tabs load only when opened.
const Statement = dynamic(() => import("@/components/reports/Statement"), { ssr: false });
const Arrears = dynamic(() => import("@/components/reports/Arrears"), { ssr: false });
const Tenants = dynamic(() => import("@/components/reports/Tenants"), { ssr: false });
const Expenses = dynamic(() => import("@/components/reports/Expenses"), { ssr: false });
const Tax = dynamic(() => import("@/components/reports/Tax"), { ssr: false });
const YearEnd = dynamic(() => import("@/components/reports/YearEnd"), { ssr: false });
const Checks = dynamic(() => import("@/components/reports/Checks"), { ssr: false });

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "statement", label: "Statement" },
  { id: "arrears", label: "Arrears" },
  { id: "tenants", label: "Tenants" },
  { id: "expenses", label: "Expenses" },
  { id: "tax", label: "Tax" },
  { id: "year", label: "Year end" },
  { id: "checks", label: "Checks" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function ReportsInner() {
  const d = useReportData();
  const [tab, setTab] = useState<Tab>("overview");
  const [month, setMonth] = useState(0);
  const [period, setPeriod] = useState<Period>(makePeriod("month", 0));
  const [ready, setReady] = useState(false);

  // Start on the current month; a link like /reports#statement opens that tab.
  useEffect(() => {
    if (!d || ready) return;
    setMonth(d.current);
    setPeriod(makePeriod("month", d.current));
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === h)) setTab(h);
    setReady(true);
  }, [d, ready]);

  function choose(t: Tab) {
    setTab(t);
    history.replaceState(null, "", t === "overview" ? window.location.pathname : `#${t}`);
  }

  return (
    <main className="shell page">
      <h1 className="h1 mb-8">Reports</h1>
      <div className="mb-16">
        <Intro>Collections, arrears, tenants, expenses and tax for the building, with documents to download for the owner, tenants, your accountant and KRA.</Intro>
      </div>

      <nav className="rtabs" aria-label="Report sections">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => choose(t.id)}>{t.label}</button>
        ))}
      </nav>

      {!d || !ready ? null : (
        <div className="rtab-body" key={tab}>
          {tab === "overview" && <Overview d={d} period={period} setPeriod={setPeriod} />}
          {tab === "statement" && <Statement d={d} month={month} setMonth={setMonth} />}
          {tab === "arrears" && <Arrears d={d} month={month} setMonth={setMonth} />}
          {tab === "tenants" && <Tenants d={d} />}
          {tab === "expenses" && <Expenses d={d} month={month} setMonth={setMonth} />}
          {tab === "tax" && <Tax d={d} />}
          {tab === "year" && <YearEnd d={d} month={month} />}
          {tab === "checks" && <Checks d={d} />}
        </div>
      )}
    </main>
  );
}

export default function ReportsPage() {
  return <AuthGuard><ReportsInner /></AuthGuard>;
}
