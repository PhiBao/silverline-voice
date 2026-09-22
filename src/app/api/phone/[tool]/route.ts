import { NextResponse } from "next/server";
import { DEMO_PATIENT } from "@/lib/clinic";
import { runTool } from "@/lib/tool-run";

// AssemblyAI HTTP-tool endpoint (phone path). AssemblyAI POSTs the model's
// arguments as the raw JSON body to /api/phone/<tool-name>. Caller identity
// comes from an optional `caller_name` arg the agent collects, else demo.
export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  let args: Record<string, unknown> = {};
  try {
    args = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  // Tolerate wrapped shapes too.
  if (args && typeof args === "object" && "arguments" in args && typeof args.arguments === "object") {
    args = args.arguments as Record<string, unknown>;
  }
  const patient =
    typeof args.caller_name === "string" && args.caller_name ? args.caller_name : DEMO_PATIENT.name;
  const origin = new URL(req.url).origin;
  try {
    const data = await runTool(tool, args, { patient, phone: DEMO_PATIENT.phone, baseUrl: origin });
    return NextResponse.json(data);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("unknown_tool")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "tool_failed", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
