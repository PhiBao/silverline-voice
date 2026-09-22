import { NextResponse } from "next/server";
import { DEMO_PATIENT } from "@/lib/clinic";
import { runTool } from "@/lib/tool-run";

// Browser client shape: { name, arguments, context }.
export async function POST(req: Request) {
  let body: { name?: string; arguments?: Record<string, unknown>; context?: { patient?: string; phone?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { name, arguments: args = {}, context = {} } = body;
  if (!name) return NextResponse.json({ error: "missing_tool_name" }, { status: 400 });
  try {
    const data = await runTool(name, args, {
      patient: context.patient || DEMO_PATIENT.name,
      phone: context.phone || DEMO_PATIENT.phone,
    });
    return NextResponse.json(data);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("unknown_tool")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "tool_failed", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
