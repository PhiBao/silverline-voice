import { NextResponse } from "next/server";

// Mints a single-use AssemblyAI Voice Agent token. The API key never
// reaches the browser. Without a key we report demo mode so the UI can
// run its scripted simulation instead of the live voice loop.
export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    return NextResponse.json({ demo: true });
  }
  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "300");
  url.searchParams.set("max_session_duration_seconds", "1800");

  // Voice Agent API requires the Bearer prefix (unlike STT/LLM Gateway,
  // which take the raw key). Raw is kept as a fallback only.
  let res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401 || res.status === 403) {
    res = await fetch(url, { headers: { Authorization: key } });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "token_failed", status: res.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { token: string };
  return NextResponse.json({ token: data.token });
}
