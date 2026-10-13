import { timingSafeEqual } from "crypto";

const SANDBOX = "https://sandbox.safaricom.co.ke";
const PRODUCTION = "https://api.safaricom.co.ke";

export interface MpesaConfig {
  base: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  partyB: string;
  passkey: string;
  txnType: string;
  callbackBase: string;
  callbackSecret: string;
}

export function getMpesaConfig(): MpesaConfig | null {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  const callbackBase = process.env.MPESA_CALLBACK_BASE?.trim();
  const callbackSecret = process.env.MPESA_CALLBACK_SECRET?.trim();
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackBase || !callbackSecret) {
    return null;
  }
  return {
    base: process.env.MPESA_ENV === "production" ? PRODUCTION : SANDBOX,
    consumerKey,
    consumerSecret,
    shortcode,
    partyB: process.env.MPESA_PARTYB || shortcode,
    passkey,
    txnType: process.env.MPESA_TXN_TYPE || "CustomerPayBillOnline",
    callbackBase: callbackBase.replace(/\/$/, ""),
    callbackSecret,
  };
}

export async function getToken(cfg: MpesaConfig): Promise<string> {
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const res = await fetch(`${cfg.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Daraja auth failed (${res.status}): ${raw.slice(0, 300)}`);
  }
  let json: { access_token?: string };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Daraja auth: unexpected response: ${raw.slice(0, 300)}`);
  }
  if (!json.access_token) throw new Error(`Daraja auth: no token returned: ${raw.slice(0, 300)}`);
  return json.access_token;
}

/** Kenyan phone → 2547XXXXXXXX / 2541XXXXXXXX */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (/^254(7|1)\d{8}$/.test(d)) return d;
  if (/^0(7|1)\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^(7|1)\d{8}$/.test(d)) return "254" + d;
  return null;
}

export interface StkResult {
  ok: boolean;
  checkoutId?: string;
  error?: string;
}

export async function stkPush(
  cfg: MpesaConfig,
  args: { phone: string; amount: number; reference: string; description: string }
): Promise<StkResult> {
  const token = await getToken(cfg);
  const ts = darajaTimestamp();
  const password = Buffer.from(cfg.shortcode + cfg.passkey + ts).toString("base64");

  const res = await fetch(`${cfg.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: cfg.txnType,
      Amount: Math.max(1, Math.round(args.amount)),
      PartyA: args.phone,
      PartyB: cfg.partyB,
      PhoneNumber: args.phone,
      CallBackURL: `${cfg.callbackBase}/api/mpesa/callback?secret=${encodeURIComponent(cfg.callbackSecret)}`,
      AccountReference: args.reference.slice(0, 12),
      TransactionDesc: args.description.slice(0, 13),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (res.ok && json.ResponseCode === "0" && json.CheckoutRequestID) {
    return { ok: true, checkoutId: json.CheckoutRequestID };
  }
  return {
    ok: false,
    error: json.errorMessage || json.ResponseDescription || `STK request failed (${res.status})`,
  };
}

/** YYYYMMDDHHmmss in Nairobi time (EAT, UTC+3), the format Daraja expects. */
export function darajaTimestamp(d: Date = new Date()): string {
  const eat = new Date(d.getTime() + 3 * 3600_000);
  return eat.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

/** Constant-time string comparison, so the callback secret can't be guessed by timing. */
export function safeEqual(a: string | null | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export type StkQueryOutcome = "paid" | "failed" | "pending" | "error";

export interface StkQueryResult {
  outcome: StkQueryOutcome;
  description?: string;
}

/**
 * Ask Daraja what happened to a prompt we sent. Used when the callback never
 * arrives, so a request can't stay "pending" forever.
 */
export async function stkQuery(cfg: MpesaConfig, checkoutId: string): Promise<StkQueryResult> {
  try {
    const token = await getToken(cfg);
    const ts = darajaTimestamp();
    const password = Buffer.from(cfg.shortcode + cfg.passkey + ts).toString("base64");
    const res = await fetch(`${cfg.base}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: ts,
        CheckoutRequestID: checkoutId,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, string>;
    return interpretStkQuery(json);
  } catch {
    return { outcome: "error" };
  }
}

/** Turn Daraja's query response into one of four outcomes. Pure, so it is testable. */
export function interpretStkQuery(json: Record<string, string | number | undefined>): StkQueryResult {
  const code = json.ResultCode;
  const desc = typeof json.ResultDesc === "string" ? json.ResultDesc : undefined;
  if (code === undefined || code === "") {
    // Daraja answers 500.001.1001 while the customer is still deciding.
    return { outcome: "pending", description: desc ?? (typeof json.errorMessage === "string" ? json.errorMessage : undefined) };
  }
  return String(code) === "0"
    ? { outcome: "paid", description: desc }
    : { outcome: "failed", description: desc };
}
