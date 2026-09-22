import Link from "next/link";
import VoiceCall from "@/components/VoiceCall";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      {/* Hero */}
      <header className="mx-auto max-w-4xl px-6 pb-8 pt-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          AssemblyAI Voice Agent Hackathon
        </p>
        <h1 className="mt-3 text-5xl font-bold leading-tight">
          The voice line that <span className="text-emerald-700">waits.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-stone-600">
          Every voice bot hangs up on Grandma first — it mistakes thinking for
          finished. SilverLine is a slow-safe companion for elderly patients:
          it confirms visits and medications over a plain phone call, then
          gives the family a signed receipt that it happened right.
        </p>
      </header>

      {/* Live demo */}
      <section className="mx-auto max-w-4xl px-6">
        <VoiceCall />
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/dashboard" className="font-medium text-emerald-800 underline">
            Family dashboard →
          </Link>
          <span className="text-stone-400">Built for judges: toggle patience & keyterms mid-call, watch the counters.</span>
        </div>
      </section>

      {/* Proof points */}
      <section className="mx-auto grid max-w-4xl gap-4 px-6 py-12 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-2xl">🐢</p>
          <h2 className="mt-2 font-semibold">Patience, engineered</h2>
          <p className="mt-1 text-sm text-stone-600">
            Slow-safe turn detection (1200/3500&nbsp;ms), backchannel-aware
            barge-in, one question at a time. Switch to fast mode mid-call and
            feel the difference. Target: <strong>0 interruptions</strong>.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-2xl">👂</p>
          <h2 className="mt-2 font-semibold">Hears drug names right</h2>
          <p className="mt-1 text-sm text-stone-600">
            Per-stage keyterm narrowing boosts clinic names, then drug names
            like <em>Metoprolol succinate</em>. Toggle keyterms OFF to hear the
            mangling generic bots produce.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-2xl">🧾</p>
          <h2 className="mt-2 font-semibold">Proof, not promises</h2>
          <p className="mt-1 text-sm text-stone-600">
            Nothing books without a slow read-back and an explicit “yes”.
            Every call ends in an HMAC-signed receipt the family can verify —
            any edit breaks verification.
          </p>
        </div>
      </section>

      {/* Tech depth */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-3xl bg-stone-900 p-8 text-stone-100">
          <h2 className="text-2xl font-semibold">Under the hood (all AssemblyAI)</h2>
          <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-stone-300">
            <li>● <strong className="text-white">Voice Agent API</strong> — single WebSocket: STT + turn detection + LLM + TTS, PCI-certified.</li>
            <li>● <strong className="text-white">Patient turn-taking</strong> — tuned silence envelope + semantic interruption handling, switchable live via <code>session.update</code>.</li>
            <li>● <strong className="text-white">Dynamic keyterms</strong> — vocabulary narrows per conversation stage (clinic → drugs), mid-session, no reconnect.</li>
            <li>● <strong className="text-white">Function tools</strong> — availability, transactional booking (no double-books), meds teach-back, signed receipts.</li>
            <li>● <strong className="text-white">Hygiene that matters</strong> — single-use token mint, echo-cancelled capture, interrupt-flush playback, <code>session.end</code> before close.</li>
          </ul>
          <p className="mt-4 text-sm text-stone-400">
            No EHR integration. No medical advice — SilverLine reads labels back; it never prescribes.
            Demo data is fictional. Add <code>ASSEMBLYAI_API_KEY</code> for live voice; otherwise a guided demo runs on the real booking backend.
          </p>
        </div>
        <footer className="mt-8 text-center text-sm text-stone-500">
          SilverLine · Maple Street Family Clinic (demo) · MIT open source
        </footer>
      </section>
    </main>
  );
}
