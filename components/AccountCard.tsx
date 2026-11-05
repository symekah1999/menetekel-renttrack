"use client";

import { useEffect, useState } from "react";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { hasUnsyncedChanges } from "@/lib/cloud";

/**
 * Who is signed in, and a way out. The side panel's Sign out is hidden on
 * phones, so this card is what a phone user reaches from the Settings tab.
 */
export default function AccountCard() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  if (!cloudConfigured() || !email) return null;

  async function signOut() {
    if (
      hasUnsyncedChanges() &&
      !confirm(
        "Some recent changes haven't finished saving to the cloud yet. They stay on this device and are sent the next time you sign in.\n\nSign out anyway?"
      )
    ) {
      return;
    }
    setBusy(true);
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <section className="card mb-16" aria-labelledby="acct">
      <h2 className="h2 mb-8" id="acct">Account</h2>
      <div className="row between wrap gap-12">
        <div style={{ minWidth: 0 }}>
          <div className="faint small">Signed in as</div>
          <div className="strong" style={{ overflowWrap: "anywhere" }}>{email}</div>
        </div>
        <button className="btn btn-line" onClick={signOut} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </section>
  );
}
