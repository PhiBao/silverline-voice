import Image from "next/image";
import Link from "next/link";
import VoiceCall from "@/components/VoiceCall";

const MARQUEE = [
  "waits through pauses",
  "hears drug names right",
  "reads back every visit",
  "never guesses",
  "signed receipts",
  "works on any phone",
];

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-display text-2xl font-800 font-extrabold tracking-tight">
          <span className="text-crimson">●</span> SilverLine
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] font-medium text-stone-600 md:flex">
          <a href="#demo" className="hover:text-crimson">Live demo</a>
          <a href="#how" className="hover:text-crimson">How it works</a>
          <a href="#proof" className="hover:text-crimson">Proof</a>
          <a href="#faq" className="hover:text-crimson">FAQ</a>
        </nav>
        <a
          href="tel:+18043151987"
          className="rounded-full bg-crimson px-5 py-2.5 font-display text-[15px] font-bold text-white shadow-lg shadow-crimson/30 transition hover:bg-crimson-deep"
        >
          Call +1 (804) 315-1987
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-crimson text-white">
      <div className="dot-grid absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold tracking-wide">
              ASSEMBLYAI VOICE AGENT HACKATHON · LIVE ON A REAL PHONE LINE
            </p>
            <h1 className="font-display mt-5 text-5xl font-extrabold leading-[1.02] md:text-7xl">
              The voice line that <u className="decoration-white/60 underline-offset-8">waits.</u>
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-relaxed text-white/90">
              Every voice bot hangs up on Grandma first — it mistakes thinking for
              finished. SilverLine confirms visits and medications over a plain
              phone call, then gives the family a signed receipt that it happened right.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#demo"
                className="rounded-full bg-white px-8 py-4 font-display text-lg font-bold text-crimson shadow-xl transition hover:scale-[1.03]"
              >
                ▶ Try the live demo
              </a>
              <a
                href="tel:+18043151987"
                className="rounded-full border-2 border-white/70 px-8 py-4 font-display text-lg font-bold text-white transition hover:bg-white/10"
              >
                Call +1 (804) 315-1987
              </a>
            </div>
          </div>

          {/* Margaret on the call */}
          <figure className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-[2.5rem] border-4 border-white/70 shadow-2xl">
              <Image
                src="/hero-elderly.jpg"
                alt="Smiling elderly woman talking on the phone at home"
                width={800}
                height={600}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
            <span
              style={{ "--tilt": "-3deg" } as React.CSSProperties}
              className="animate-floaty absolute -left-4 top-8 rounded-2xl bg-white px-4 py-2.5 font-display text-sm font-bold text-stone-800 shadow-2xl md:-left-8"
            >
              “…Thursday… ten…” ✓ heard, not cut off
            </span>
            <span
              style={{ "--tilt": "2.5deg", animationDelay: "1.2s" } as React.CSSProperties}
              className="animate-floaty absolute -right-3 bottom-10 rounded-2xl bg-stone-900 px-4 py-2.5 font-display text-sm font-bold text-white shadow-2xl md:-right-6"
            >
              🧾 Receipt verified ✓
            </span>
            <figcaption className="mt-3 text-center text-sm text-white/70">
              Margaret, 78 — confirmed her visit in one slow call. Photo: Unsplash.
            </figcaption>
          </figure>
        </div>

        {/* Floating proof bubbles */}
        <div className="mt-12 flex flex-wrap gap-4">
          {[
            { t: "Visit booked · Thu 10 AM ✓", tilt: "-2deg", d: "0s" },
            { t: "Metoprolol succinate ✓ heard right", tilt: "1.5deg", d: "0.8s" },
            { t: "0 interruptions in 8 min ✓", tilt: "-1deg", d: "1.6s" },
          ].map((b) => (
            <span
              key={b.t}
              style={{ "--tilt": b.tilt, animationDelay: b.d } as React.CSSProperties}
              className="animate-floaty rounded-2xl bg-white/95 px-5 py-3 font-display text-[15px] font-bold text-stone-800 shadow-2xl"
            >
              {b.t}
            </span>
          ))}
        </div>
      </div>
      {/* Marquee */}
      <div className="relative border-t border-white/20 bg-crimson-deep py-3">
        <div className="flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pr-8 font-display text-lg font-bold text-white/90">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i}>● {m}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-crimson">01 · Live demo</p>
      <h2 className="font-display mt-2 max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
        Press call. Talk slowly. It keeps up.
      </h2>
      <p className="mt-3 max-w-2xl text-lg text-stone-600">
        No login, no app. Judges: toggle patience and keyterms mid-call and
        watch the counters — or skip the browser entirely and dial the number.
      </p>
      <div className="mt-8">
        <VoiceCall />
      </div>
    </section>
  );
}

function How() {
  const steps = [
    {
      n: "1",
      title: "Call",
      body: "One tap in the browser, or dial from any phone — even a landline. No account, no app, nothing to install. The agent greets you slowly and waits.",
    },
    {
      n: "2",
      title: "Confirm",
      body: "It finds your visit, reads the full day-date-time-clinician back slowly, and books only on an explicit “yes”. Then it teaches your medications back, one at a time.",
    },
    {
      n: "3",
      title: "Prove",
      body: "Every call ends in an HMAC-signed receipt: spoken aloud, shown on the family dashboard, verifiable on a public page. Any edit breaks verification.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 bg-blush/60 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-crimson">02 · How it works</p>
        <h2 className="font-display mt-2 text-4xl font-extrabold md:text-5xl">Three steps. Zero rushing.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl bg-white p-7 shadow-xl shadow-rosewood/5">
              <p className="font-display text-5xl font-extrabold text-crimson">{s.n}</p>
              <h3 className="font-display mt-3 text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { big: "8m 08s", small: "live PSTN call, completed with zero errors" },
    { big: "3 / 3", small: "medications teach-back confirmed" },
    { big: "✓ valid", small: "HMAC-signed receipt, verified live" },
    { big: "≈ $0.60", small: "AssemblyAI cost of the whole call" },
  ];
  return (
    <section id="proof" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-crimson">03 · Proven, not promised</p>
      <h2 className="font-display mt-2 text-4xl font-extrabold md:text-5xl">
        A real phone call, on Sep 22.
      </h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.big} className="rounded-3xl bg-stone-900 p-6 text-white">
            <p className="font-display text-4xl font-extrabold text-amber-300">{s.big}</p>
            <p className="mt-2 text-[15px] leading-snug text-stone-300">{s.small}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-stone-500">
        Full evidence log in <a className="font-bold text-crimson underline" href="https://github.com/PhiBao/silverline-voice/tree/main/proof">/proof</a> — including
        the SIP 503 detour that taught us EU-pinned accounts need <code>sip.eu.assemblyai.com</code>.
      </p>
    </section>
  );
}

function Tech() {
  const items = [
    { t: "Voice Agent API", d: "One WebSocket: STT + turn detection + LLM + TTS. PCI-certified, session-observable." },
    { t: "Patient turn-taking", d: "1200/3500 ms envelope + semantic interruption. Switchable live via session.update." },
    { t: "Dynamic keyterms", d: "Vocabulary narrows per stage — clinic names, then drug names. No reconnect." },
    { t: "5 tools", d: "Availability, transactional booking (Supabase), meds, teach-back, signed receipts." },
    { t: "Twilio", d: "Real number, SIP trunk, SMS receipts for US handsets." },
    { t: "Hygiene", d: "Single-use tokens, echo-cancelled capture, interrupt-flush, session.end before close." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <div className="rounded-[2rem] bg-stone-900 p-8 text-stone-200 md:p-12">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-amber-300">Under the hood · all AssemblyAI</p>
        <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {items.map((i) => (
            <div key={i.t}>
              <h3 className="font-display text-lg font-bold text-white">● {i.t}</h3>
              <p className="mt-1 text-[15px] text-stone-400">{i.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-stone-500">
          No EHR. No medical advice — labels are read back, never prescribed. Demo data fictional.
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    {
      q: "Who is this for?",
      a: "Patients over 70 on plain phones first — plus the adult children who worry from afar and the clinic staff drowning in reminder phone tag.",
    },
    {
      q: "What makes it different from every other voice bot?",
      a: "Everyone optimized for speed; we engineered tolerance. A slow-safe silence envelope, backchannel-aware barge-in, drug-name-boosted hearing, and a signed receipt at the end. Try fast mode in the demo to feel the difference.",
    },
    {
      q: "Is my call data safe?",
      a: "Single-use voice tokens, keys server-side only, no PHI in URLs, receipts carry hashes not data. AssemblyAI offers a HIPAA BAA path; the demo uses fictional patients.",
    },
    {
      q: "Who pays?",
      a: "Clinics pay per confirmed visit (cheaper than staff phone tag). Families get a $9/mo plan for receipt history and med-adherence view.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-6 pb-16">
      <h2 className="font-display text-4xl font-extrabold">Questions, answered.</h2>
      <div className="mt-6 space-y-4">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl bg-white p-6 shadow-sm">
            <summary className="font-display cursor-pointer text-lg font-bold">{f.q}</summary>
            <p className="mt-2 text-stone-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-crimson text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-display mx-auto max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
          Bots got faster. Patients got older. We built the line that waits.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a href="#demo" className="rounded-full bg-white px-8 py-4 font-display text-lg font-bold text-crimson shadow-xl">
            ▶ Try it now
          </a>
          <a href="tel:+18043151987" className="rounded-full border-2 border-white/70 px-8 py-4 font-display text-lg font-bold">
            📞 +1 (804) 315-1987
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-[15px] text-white/80">
          <Link href="/dashboard" className="underline">Family dashboard</Link>
          <a href="https://github.com/PhiBao/silverline-voice" className="underline">GitHub · MIT</a>
        </div>
        <p className="mt-6 text-sm text-white/60">SilverLine · Maple Street Family Clinic (demo) · AssemblyAI Voice Agent Hackathon</p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <Demo />
      <How />
      <Stats />
      <Tech />
      <Faq />
      <Footer />
    </main>
  );
}
