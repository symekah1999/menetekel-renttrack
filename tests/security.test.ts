import { describe, it, expect } from "vitest";
import { buildCsp, securityHeaders } from "@/lib/securityHeaders";
import { clientIp, ipAllowed, overLimit, parseAllowlist, windowStart, MAX_PROMPTS_PER_HOUR } from "@/lib/server/limits";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe("content security policy", () => {
  const csp = buildCsp("https://abcd1234.supabase.co/");
  it("only lets the app talk to itself and its own database", () => {
    expect(csp).toContain("connect-src 'self' https://abcd1234.supabase.co");
    expect(csp).not.toMatch(/connect-src[^;]*\*/);
  });
  it("blocks plugins, framing by other sites, and base-tag tricks", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
  it("never allows eval, and survives a missing or malformed database address", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(buildCsp(undefined)).toContain("connect-src 'self'");
    expect(buildCsp("not a url")).toContain("connect-src 'self'");
  });
});

describe("securityHeaders", () => {
  it("adds nothing in development, where hot reload needs eval", () => {
    expect(securityHeaders({ production: false })).toEqual([]);
  });
  it("sets the standard protections on every page and no-store on the API", () => {
    const rules = securityHeaders({ production: true, supabaseUrl: "https://x.supabase.co" });
    const all = Object.fromEntries(rules.find((r) => r.source === "/:path*")!.headers.map((h) => [h.key, h.value]));
    expect(all["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}/);
    expect(all["X-Content-Type-Options"]).toBe("nosniff");
    expect(all["X-Frame-Options"]).toBe("DENY");
    expect(all["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(all["Permissions-Policy"]).toContain("camera=()");
    expect(all["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(rules.find((r) => r.source === "/api/:path*")!.headers[0].value).toContain("no-store");
  });
});

describe("M-Pesa prompt limit", () => {
  it("allows normal use and blocks at the limit", () => {
    expect(overLimit(0)).toBe(false);
    expect(overLimit(MAX_PROMPTS_PER_HOUR - 1)).toBe(false);
    expect(overLimit(MAX_PROMPTS_PER_HOUR)).toBe(true);
    expect(overLimit(null)).toBe(false);
  });
  it("counts from one hour ago", () => {
    expect(windowStart(new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-10T11:00:00.000Z");
  });
});

describe("callback address allow-list", () => {
  it("is off until configured", () => {
    expect(ipAllowed("1.2.3.4", parseAllowlist(undefined))).toBe(true);
    expect(ipAllowed(null, parseAllowlist(""))).toBe(true);
  });
  it("accepts listed addresses only once configured", () => {
    const allow = parseAllowlist(" 196.201.214.200 , 196.201.214.206 ,");
    expect(allow).toEqual(["196.201.214.200", "196.201.214.206"]);
    expect(ipAllowed("196.201.214.206", allow)).toBe(true);
    expect(ipAllowed("203.0.113.9", allow)).toBe(false);
    expect(ipAllowed(null, allow)).toBe(false);
  });
  it("reads the caller from the first forwarded address", () => {
    expect(clientIp(headers({ "x-forwarded-for": "196.201.214.200, 10.0.0.1" }))).toBe("196.201.214.200");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(headers({}))).toBeNull();
  });
});
