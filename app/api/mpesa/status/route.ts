import { NextRequest, NextResponse } from "next/server";
import { getAdmin, verifyApproved } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured." }, { status: 501 });

  const uid = await verifyApproved(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data } = await admin
    .from("mpesa_requests")
    .select("status, receipt, result_desc, amount, unit, floor")
    .eq("checkout_id", id)
    .single();

  if (!data) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
  return NextResponse.json(data);
}
