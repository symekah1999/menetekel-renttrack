import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Server-only Supabase client using the service-role key (bypasses RLS). */
export function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Verifies a Bearer token belongs to an APPROVED account. Returns user id or null. */
export async function verifyApproved(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const admin = getAdmin();
  if (!admin) return null;
  const token = authHeader.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("approved")
    .eq("id", data.user.id)
    .single();
  return profile?.approved ? data.user.id : null;
}
