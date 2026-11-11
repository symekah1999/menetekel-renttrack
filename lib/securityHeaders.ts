/**
 * Browser security headers for every page. Kept in one place so they can be
 * unit-tested and so next.config.ts stays short.
 *
 * The content policy limits where the app may load scripts, styles and data
 * from, and blocks other sites from framing it. It still allows inline
 * scripts, because Next.js writes small inline scripts into every page; a
 * nonce-based policy would close that last gap but needs a middleware step.
 */
export function buildCsp(supabaseUrl?: string): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try { connect.push(new URL(supabaseUrl).origin); } catch { /* ignore a malformed URL */ }
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

export function securityHeaders(opts: { production: boolean; supabaseUrl?: string }): HeaderRule[] {
  // Development needs eval and websockets for hot reload, so it is left alone.
  if (!opts.production) return [];
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: buildCsp(opts.supabaseUrl) },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    },
    {
      // Payment and account responses must never be stored by a browser or proxy.
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
    },
  ];
}
