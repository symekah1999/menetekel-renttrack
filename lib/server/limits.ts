/** How many M-Pesa prompts one account may send per hour. A normal month for 34 units is far below this. */
export const MAX_PROMPTS_PER_HOUR = 40;
export const WINDOW_MS = 60 * 60 * 1000;

export function windowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - WINDOW_MS).toISOString();
}

export function overLimit(sentInWindow: number | null | undefined, max: number = MAX_PROMPTS_PER_HOUR): boolean {
  return (sentInWindow ?? 0) >= max;
}

/**
 * Optional allow-list of the addresses Safaricom calls back from. Set
 * MPESA_CALLBACK_ALLOWED_IPS to a comma-separated list to switch it on; with
 * nothing set the callback behaves as before.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** The caller's address as the hosting platform reports it (first entry of x-forwarded-for). */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return h.get("x-real-ip")?.trim() || null;
}

export function ipAllowed(ip: string | null, allow: string[]): boolean {
  if (allow.length === 0) return true; // not configured
  return ip !== null && allow.includes(ip);
}
