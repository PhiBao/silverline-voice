import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/store";
import { verifyReceipt } from "@/lib/receipt";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await getReceipt(id);
  if (!r) return NextResponse.json({ found: false }, { status: 404 });
  const { hmac, ...payload } = r;
  return NextResponse.json({ found: true, receipt: payload, hmac, valid: verifyReceipt(payload, hmac) });
}
