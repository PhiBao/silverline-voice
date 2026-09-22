import { NextResponse } from "next/server";
import { listSlots, listReceipts, listBookings, resetDemo } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const what = searchParams.get("what") || "slots";
  if (what === "receipts") return NextResponse.json({ receipts: await listReceipts() });
  if (what === "bookings") return NextResponse.json({ bookings: await listBookings() });
  return NextResponse.json({ slots: await listSlots() });
}

export async function DELETE(req: Request) {
  // Open reset would let anyone wipe the demo mid-judging. Allow only with
  // the admin key, or in local development.
  const adminKey = process.env.SILVERLINE_ADMIN_KEY;
  const provided = req.headers.get("x-admin-key");
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && (!adminKey || provided !== adminKey)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await resetDemo();
  return NextResponse.json({ ok: true });
}
