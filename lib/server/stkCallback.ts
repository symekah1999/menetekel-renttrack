/**
 * Parsing of Daraja's STK Push callback. Kept free of I/O so the exact shapes
 * Safaricom sends can be unit-tested.
 */

export interface CallbackItem { Name: string; Value?: string | number }

export interface StkCallback {
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: CallbackItem[] };
}

export interface ParsedCallback {
  checkoutId: string;
  success: boolean;
  resultDesc: string;
  amount?: number;
  receipt?: string;
  paidOn?: string; // dd/mm/yyyy
}

function metaValue(items: CallbackItem[], name: string): string | number | undefined {
  return items.find((i) => i.Name === name)?.Value;
}

/** Daraja sends TransactionDate as YYYYMMDDHHmmss; the app uses dd/mm/yyyy. */
export function formatDarajaDate(v: string | number | undefined): string | undefined {
  const s = String(v ?? "");
  if (!/^\d{14}$/.test(s)) return undefined;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function parseCallback(body: unknown): ParsedCallback | null {
  const cb = (body as { Body?: { stkCallback?: StkCallback } } | null)?.Body?.stkCallback;
  const checkoutId = cb?.CheckoutRequestID;
  if (!cb || !checkoutId) return null;

  if (cb.ResultCode !== 0) {
    return {
      checkoutId,
      success: false,
      resultDesc: cb.ResultDesc ?? "Declined or cancelled",
    };
  }
  const items = cb.CallbackMetadata?.Item ?? [];
  const amount = Number(metaValue(items, "Amount"));
  const receipt = metaValue(items, "MpesaReceiptNumber");
  return {
    checkoutId,
    success: true,
    resultDesc: cb.ResultDesc ?? "Payment received",
    amount: Number.isFinite(amount) ? Math.round(amount) : undefined,
    receipt: receipt === undefined ? undefined : String(receipt),
    paidOn: formatDarajaDate(metaValue(items, "TransactionDate")),
  };
}
