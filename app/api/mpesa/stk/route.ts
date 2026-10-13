import { NextRequest, NextResponse } from "next/server";
import { getAdmin, verifyApproved } from "@/lib/server/supabaseAdmin";
import { getMpesaConfig, normalizePhone, stkPush } from "@/lib/server/daraja";
import { unitsForFloor, FLOORS } from "@/lib/config";

/** Safaricom's per-transaction ceiling for STK Push. */
const MAX_AMOUNT = 250_000;
/** Block a second prompt to the same unit within this window (stops double taps). */
const COOLDOWN_MS = 60_000;

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

  if (
    !Number.isInteger(month) || month < 0 || month > 11 ||
    !Number.isInteger(year) || year < 2024 || year > 2100 ||
    !FLOORS.includes(floor) ||
    !unitsForFloor(floor).some((u) => u.label === unit)
  ) {
    return NextResponse.json({ error: "That unit doesn't exist." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid Safaricom number (07XX… or 2547XX…)." }, { status: 400 });
  }
  const amount = Math.round(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between KShs 1 and KShs ${MAX_AMOUNT.toLocaleString()}.` },
      { status: 400 }
    );
  }

  // One prompt at a time per unit: a double tap must not ring the tenant twice.
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("mpesa_requests")
    .select("checkout_id")
    .eq("year", year).eq("month", month).eq("floor", floor).eq("unit", unit)
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "A prompt for this unit is already waiting. Give it a minute, then try again." },
      { status: 429 }
    );
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
