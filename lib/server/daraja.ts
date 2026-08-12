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
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackBase = process.env.MPESA_CALLBACK_BASE;
  const callbackSecret = process.env.MPESA_CALLBACK_SECRET;
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
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Daraja auth: no token returned");
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
  const ts = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
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
