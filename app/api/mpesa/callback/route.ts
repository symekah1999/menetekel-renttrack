import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/supabaseAdmin";
import { getMpesaConfig } from "@/lib/server/daraja";

export const runtime = "nodejs";

interface CallbackItem { Name: string; Value?: string | number }
interface StkCallback {
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: CallbackItem[] };
}

interface EntryLike {
  floor: number; unit: string; paid?: number; receipt?: string; date?: string;
  [k: string]: unknown;
}

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

function metaValue(items: CallbackItem[], name: string): string | number | undefined {
  return items.find((i) => i.Name === name)?.Value;
}

function formatDarajaDate(v: string | number | undefined): string | null {
  const s = String(v ?? "");
  if (!/^\d{14}$/.test(s)) return null;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export async function POST(req: NextRequest) {
  const cfg = getMpesaConfig();
  const admin = getAdmin();
  if (!cfg || !admin) return NextResponse.json(ACK);

  // Shared-secret check: Daraja doesn't sign callbacks, so we only accept
  // requests that know the secret embedded in our callback URL.
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== cfg.callbackSecret) return NextResponse.json(ACK);

  let cb: StkCallback | undefined;
  try {
    const body = (await req.json()) as { Body?: { stkCallback?: StkCallback } };
    cb = body.Body?.stkCallback;
  } catch {
    return NextResponse.json(ACK);
  }
  const checkoutId = cb?.CheckoutRequestID;
  if (!checkoutId) return NextResponse.json(ACK);

  const { data: reqRow } = await admin
    .from("mpesa_requests")
    .select("*")
    .eq("checkout_id", checkoutId)
    .single();
  if (!reqRow || reqRow.status !== "pending") return NextResponse.json(ACK);

  if (cb?.ResultCode !== 0) {
    await admin
      .from("mpesa_requests")
      .update({ status: "failed", result_desc: cb?.ResultDesc ?? "Declined or cancelled" })
      .eq("checkout_id", checkoutId);
    return NextResponse.json(ACK);
  }

  const items = cb.CallbackMetadata?.Item ?? [];
  const amount = Math.round(Number(metaValue(items, "Amount") ?? reqRow.amount));
  const receipt = String(metaValue(items, "MpesaReceiptNumber") ?? "");
  const payDate = formatDarajaDate(metaValue(items, "TransactionDate"));

  // Record into the shared month blob
  let recorded = false;
  const { data: monthRow } = await admin
    .from("months")
    .select("data")
    .eq("year", reqRow.year)
    .eq("month", reqRow.month)
    .single();

  if (monthRow?.data && Array.isArray(monthRow.data)) {
    const data = monthRow.data as EntryLike[];
    const idx = data.findIndex((e) => e.floor === reqRow.floor && e.unit === reqRow.unit);
    if (idx >= 0) {
      const e = data[idx];
      data[idx] = {
        ...e,
        paid: (Number(e.paid) || 0) + amount,
        receipt: e.receipt ? `${e.receipt} ${receipt}`.trim() : receipt,
        date: payDate ?? e.date,
      };
      const { error } = await admin
        .from("months")
        .update({ data, updated_at: new Date().toISOString() })
        .eq("year", reqRow.year)
        .eq("month", reqRow.month);
      recorded = !error;
    }
  }

  await admin
    .from("mpesa_requests")
    .update({
      status: recorded ? "success" : "success_unrecorded",
      receipt,
      result_desc: recorded
        ? "Payment received and recorded"
        : "Payment received — open the month in the app and enter it (month record not found)",
    })
    .eq("checkout_id", checkoutId);

  return NextResponse.json(ACK);
}
