import { NextRequest, NextResponse } from "next/server";
import { getAdmin, verifyApproved } from "@/lib/server/supabaseAdmin";
import { getMpesaConfig, normalizePhone, stkPush } from "@/lib/server/daraja";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cfg = getMpesaConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "M-Pesa is not configured yet (missing MPESA_* environment variables)." },
      { status: 501 }
    );
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }

  const uid = await verifyApproved(req.headers.get("authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Sign in with an approved account first." }, { status: 401 });
  }

  let body: { year?: number; month?: number; floor?: number; unit?: string; phone?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { year, month, floor, unit } = body;
  if (
    typeof year !== "number" || typeof month !== "number" ||
    typeof floor !== "number" || typeof unit !== "string" || !unit
  ) {
    return NextResponse.json({ error: "Missing unit details." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid Safaricom number (07XX… or 2547XX…)." }, { status: 400 });
  }
  const amount = Math.round(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Amount must be at least KShs 1." }, { status: 400 });
  }

  try {
    const result = await stkPush(cfg, {
      phone,
      amount,
      reference: `F${floor}-${unit.replace(/\W+/g, "")}`,
      description: "Menetekel rent",
    });
    if (!result.ok || !result.checkoutId) {
      return NextResponse.json({ error: result.error ?? "STK push failed." }, { status: 502 });
    }

    await admin.from("mpesa_requests").insert({
      checkout_id: result.checkoutId,
      year, month, floor, unit,
      phone, amount,
      status: "pending",
      requested_by: uid,
    });

    return NextResponse.json({ checkoutId: result.checkoutId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "STK push failed." },
      { status: 502 }
    );
  }
}
