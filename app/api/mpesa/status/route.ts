import { NextRequest, NextResponse } from "next/server";
import { getAdmin, verifyApproved } from "@/lib/server/supabaseAdmin";
import { getMpesaConfig, stkQuery } from "@/lib/server/daraja";
import { recordStkPayment, PendingRequest } from "@/lib/server/recordPayment";

export const runtime = "nodejs";

/** How long we wait for the callback before asking Daraja directly. */
const QUERY_AFTER_MS = 25_000;

export async function GET(req: NextRequest) {
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured." }, { status: 501 });

  const uid = await verifyApproved(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data } = await admin
    .from("mpesa_requests")
    .select("*")
    .eq("checkout_id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Unknown request." }, { status: 404 });

  // The callback is the normal path. If it hasn't arrived after a while
  // (dropped request, server asleep), ask Safaricom so the request can't hang.
  const cfg = getMpesaConfig();
  const age = Date.now() - new Date(data.created_at as string).getTime();
  if (data.status === "pending" && cfg && age > QUERY_AFTER_MS) {
    const q = await stkQuery(cfg, id);
    if (q.outcome === "failed") {
      await admin
        .from("mpesa_requests")
        .update({ status: "failed", result_desc: q.description ?? "Declined or cancelled" })
        .eq("checkout_id", id)
        .eq("status", "pending");
      data.status = "failed";
      data.result_desc = q.description ?? "Declined or cancelled";
    } else if (q.outcome === "paid") {
      // Paid, but the callback (which carries the receipt) hasn't landed yet.
      // Record the money now; the callback adds the receipt when it arrives.
      const rec = await recordStkPayment(admin, data as PendingRequest, {});
      if (rec.ok) {
        await admin
          .from("mpesa_requests")
          .update({ status: "success", result_desc: "Payment confirmed with Safaricom" })
          .eq("checkout_id", id)
          .eq("status", "pending");
        data.status = "success";
      }
    }
  }

  return NextResponse.json({
    status: data.status,
    receipt: data.receipt,
    result_desc: data.result_desc,
    amount: data.amount,
    unit: data.unit,
    floor: data.floor,
  });
}
