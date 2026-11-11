import type { NextConfig } from "next";
import { securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't announce the framework to scanners
  async headers() {
    return securityHeaders({
      production: process.env.NODE_ENV === "production",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  },
};

export default nextConfig;
