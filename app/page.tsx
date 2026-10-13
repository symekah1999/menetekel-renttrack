import Link from "next/link";
import { GRAND_TOTAL, TOTAL_UNITS, fmt } from "@/lib/config";
import FacadeArt from "@/components/FacadeArt";
import { IconArrowRight, IconBuilding, IconCoins, IconPhone, IconReceipt } from "@/components/Icons";

const FEATURES = [
  {
    Icon: IconBuilding,
    title: "See the whole building at a glance",
    body: "Every unit is a window that fills with colour as its rent arrives. You can tell who has paid without opening a spreadsheet.",
  },
  {
    Icon: IconPhone,
    title: "Ask for rent on M-Pesa",
    body: "Send a payment prompt to a tenant's phone. When they enter their PIN, the payment lands in the ledger with its receipt number.",
  },
  {
    Icon: IconReceipt,
    title: "Every shilling stays on record",
    body: "Payments are never overwritten. A mistake is reversed with a new entry, and the same M-Pesa receipt can't be recorded twice.",
  },
];

const STEPS = [
  { title: "Open the month", body: "Tenants and phone numbers carry over. The month itself starts clean, with nothing added from before." },
  { title: "Collect", body: "Send M-Pesa prompts, record cash, or import your M-Pesa statement and match it to units." },
  { title: "Check the report", body: "Per floor and per unit, as PDF or Excel, with signature lines ready to print." },
  { title: "Read the running total", body: "The Cumulative page adds the months together, so a shortfall is never forgotten." },
];

export default function IntroPage() {
  return (
    <div className="lp">
      <header className="lp-wrap lp-head">
        <Link href="/" className="brand" aria-label="Menetekel Apartments">
          <span className="brand-mark"><IconBuilding width={20} height={20} /></span>
          <span>
            <span className="brand-name" style={{ display: "block" }}>Menetekel</span>
            <span className="brand-sub" style={{ display: "block" }}>Apartments, Nairobi</span>
          </span>
        </Link>
        <Link href="/dashboard" className="btn btn-primary">Open the app</Link>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div>
            <h1>Know who has paid, floor by floor.</h1>
            <p className="lp-lede">
              RentTrack is the rent book for Menetekel Apartments in Nairobi: five floors, {TOTAL_UNITS} homes,
              and every payment on the record.
            </p>
            <div className="lp-actions">
              <Link href="/dashboard" className="btn btn-primary">Open the app <IconArrowRight /></Link>
              <a href="#how" className="btn btn-line">How a month works</a>
            </div>
            <p className="lp-facts">{fmt(GRAND_TOTAL)} a month when every unit is let.</p>
          </div>
          <FacadeArt />
        </section>

        <div className="lp-band">
          <section className="lp-wrap lp-section" aria-labelledby="what">
            <h2 id="what">Built for one building, kept simple.</h2>
            <div className="lp-features">
              {FEATURES.map(({ Icon, title, body }) => (
                <div className="lp-feature" key={title}>
                  <Icon />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="lp-wrap lp-section" id="how" aria-labelledby="how-h">
          <h2 id="how-h">How a month works.</h2>
          <ol className="lp-steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="lp-cta">
          <div className="lp-wrap">
            <h2>Ready for this month&apos;s rent?</h2>
            <Link href="/dashboard" className="btn"><IconCoins /> Open the app</Link>
          </div>
        </div>
      </main>

      <footer className="lp-wrap lp-foot">
        <span>Menetekel Apartments · Nairobi, Kenya</span>
        <span>Accounts are by approval. Signed-in members share the same records.</span>
      </footer>
    </div>
  );
}
