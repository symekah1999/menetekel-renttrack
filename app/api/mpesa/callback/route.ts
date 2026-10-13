import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/supabaseAdmin";
import { getMpesaConfig, safeEqual } from "@/lib/server/daraja";
import { parseCallback } from "@/lib/server/stkCallback";
import { recordStkPayment, PendingRequest } from "@/lib/server/recordPayment";

export const runtime = "nodejs";

// Safaricom only needs a 200 with this body. We always answer it, so a bad
// request never makes Daraja retry forever, and never reveal why we ignored it.
const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

export async function POST(req: NextRequest) {
  const cfg = getMpesaConfig();
  const admin = getAdmin();
  if (!cfg || !admin) return NextResponse.json(ACK);

  // Daraja doesn't sign callbacks, so only requests that know the secret in
  // our callback URL are accepted (compared in constant time).
  if (!safeEqual(req.nextUrl.searchParams.get("secret"), cfg.callbackSecret)) {
    return NextResponse.json(ACK);
  }

  let parsed;
  try {
    parsed = parseCallback(await req.json());
  } catch {
    return NextResponse.json(ACK);
  }
  if (!parsed) return NextResponse.json(ACK);

  const { data: row } = await admin
    .from("mpesa_requests")
    .select("*")
    .eq("checkout_id", parsed.checkoutId)
    .maybeSingle();
  if (!row) return NextResponse.json(ACK);
  const request = row as PendingRequest & { status: string };

  if (!parsed.success) {
    // Only a still-pending request can fail; never downgrade a paid one.
    await admin
      .from("mpesa_requests")
      .update({ status: "failed", result_desc: parsed.resultDesc })
      .eq("checkout_id", parsed.checkoutId)
      .eq("status", "pending");
    return NextResponse.json(ACK);
  }

  // The ledger insert is idempotent on checkout_id, so a repeated callback
  // (or one that races the status poll) cannot record the payment twice.
  const rec = await recordStkPayment(admin, request, {
    amount: parsed.amount,
    receipt: parsed.receipt,
    paidOn: parsed.paidOn,
  });

  await admin
    .from("mpesa_requests")
    .update({
      status: rec.ok ? "success" : "success_unrecorded",
      receipt: parsed.receipt ?? null,
      result_desc: rec.ok
        ? "Payment received and recorded"
        : "Payment received but could not be saved. Add it from the unit panel.",
    })
    .eq("checkout_id", parsed.checkoutId)
    .in("status", ["pending", "success_unrecorded", "success"]);

  return NextResponse.json(ACK);
}
