import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nairobiDate } from "../ledger";

export interface PendingRequest {
  checkout_id: string;
  year: number;
  month: number;
  floor: number;
  unit: string;
  amount: number | null;
  requested_by: string | null;
}

/**
 * Write a successful STK payment into the ledger.
 *
 * It is idempotent on `checkout_id`: Safaricom may deliver a callback twice,
 * and the status poll may confirm a payment before the callback arrives. The
 * unique index on checkout_id means only one ledger row can ever exist per
 * prompt. A late callback fills in the receipt on the row that's already there.
 */
export async function recordStkPayment(
  admin: SupabaseClient,
  req: PendingRequest,
  info: { amount?: number; receipt?: string; paidOn?: string }
): Promise<{ ok: boolean; error?: string }> {
  const amount = info.amount ?? req.amount ?? 0;
  const { error } = await admin.from("payments").upsert(
    {
      id: randomUUID(),
      year: req.year,
      month: req.month,
      floor: req.floor,
      unit: req.unit,
      amount,
      receipt: info.receipt ?? "",
      source: "stk",
      paid_on: info.paidOn ?? nairobiDate(),
      checkout_id: req.checkout_id,
      created_by: req.requested_by,
      created_at: new Date().toISOString(),
    },
    { onConflict: "checkout_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: error.message };

  // If the row already existed without a receipt, add it now.
  if (info.receipt) {
    await admin
      .from("payments")
      .update({ receipt: info.receipt })
      .eq("checkout_id", req.checkout_id)
      .eq("receipt", "");
  }
  return { ok: true };
}
