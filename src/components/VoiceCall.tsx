"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRESETS,
  TOOL_DEFS,
  VOICE_ID,
  buildGreeting,
  buildSystemPrompt,
  buildTranscriptionPrompt,
  keytermsForStage,
  type PresetId,
} from "@/lib/agent";
import { DEMO_PATIENT } from "@/lib/clinic";

type Stage = "appointment" | "medications" | "receipt";

interface Line {
  id: number;
  who: "you" | "agent" | "system";
  text: string;
  partial?: boolean;
}

const ENTITY_RE =
  /(Metoprolol succinate|Atorvastatin|Lisinopril|Levothyroxine|Amlodipine|Metformin|Omeprazole|Losartan|Dr\. Rao|Dr\. Patel|Nurse Alvarez|Maple Street Family Clinic)/;

function Highlight({ text }: { text: string }) {
  const parts = text.split(ENTITY_RE);
  return (
    <>
      {parts.map((p, i) =>
        ENTITY_RE.test(p) ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

let lineId = 0;
const nextId = () => ++lineId;

function b64ToPcm16(b64: string): Int16Array {
  const raw = atob(b64);
  const out = new Int16Array(raw.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
  }
  return out;
}

function pcm16ToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export default function VoiceCall() {
  const [mode, setMode] = useState<"unknown" | "live" | "demo">("unknown");
  const [status, setStatus] = useState("idle");
  const [preset, setPreset] = useState<PresetId>("patient");
  const [keytermsOn, setKeytermsOn] = useState(true);
  const [stage, setStage] = useState<Stage>("appointment");
  const [lines, setLines] = useState<Line[]>([]);
  const [interruptions, setInterruptions] = useState(0);
  const [toolCalls, setToolCalls] = useState(0);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readyRef = useRef(false);
  const playheadRef = useRef(0);
  const currentSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const pendingToolsRef = useRef<{ call_id: string; result: string }[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const simTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef({ preset, keytermsOn, stage });
  stateRef.current = { preset, keytermsOn, stage };

  // Recording/judging override: ?demo=1 forces the guided script (no mic),
  // ?preset=default starts in fast mode. Deterministic for video capture.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("preset") === "default") {
      setPreset("default");
      stateRef.current.preset = "default";
    }
  }, []);

  const pushLine = useCallback((who: Line["who"], text: string, partial = false) => {
    const id = nextId();
    setLines((prev) => {
      if (partial) {
        const last = prev[prev.length - 1];
        if (last && last.who === who && last.partial) {
          return [...prev.slice(0, -1), { ...last, text }];
        }
      }
      return [...prev, { id, who, text, partial }];
    });
  }, []);

  const flushAudio = useCallback(() => {
    const ctx = audioCtxRef.current;
    try {
      currentSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    currentSrcRef.current = null;
    if (ctx) playheadRef.current = ctx.currentTime;
  }, []);

  const playPcm = useCallback((b64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const pcm = b64ToPcm16(b64);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    playheadRef.current = Math.max(playheadRef.current, now);
    src.start(playheadRef.current);
    playheadRef.current += buf.duration;
    currentSrcRef.current = src;
  }, []);

  const runTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          arguments: args,
          context: { patient: DEMO_PATIENT.name, phone: DEMO_PATIENT.phone },
        }),
      });
      const data = await res.json();
      setToolCalls((c) => c + 1);
      pushLine("system", `⚙ ${name} → ${JSON.stringify(data).slice(0, 160)}`);
      if (name === "issue_receipt" && data.receipt_id) {
        setReceiptUrl(`/verify/${data.receipt_id}`);
      }
      return data;
    },
    [pushLine],
  );

  const maybeNarrowKeyterms = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const lower = text.toLowerCase();
      const medHit = /metoprolol|atorvastatin|lisinopril|pill|medication|pharmacy/.test(lower);
      const next: Stage = medHit ? "medications" : stateRef.current.stage;
      if (next !== stateRef.current.stage) {
        setStage(next);
        if (stateRef.current.keytermsOn) {
          ws.send(
            JSON.stringify({
              type: "session.update",
              session: { input: { keyterms: keytermsForStage(next) } },
            }),
          );
          pushLine("system", `◉ Stage → ${next}: keyterms narrowed to ${next === "medications" ? "drug names" : "clinic names"}`);
        }
      }
    },
    [pushLine],
  );

  const cleanup = useCallback(() => {
    simTimers.current.forEach(clearTimeout);
    simTimers.current = [];
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    wsRef.current = null;
    readyRef.current = false;
  }, []);

  // ---- Live path ----
  const startLive = useCallback(
    async (token: string) => {
      setError(null);
      const Ctx = window.AudioContext;
      const ctx = new Ctx(); // device rate; worklet resamples (Firefox/Safari-safe)
      audioCtxRef.current = ctx;
      await ctx.resume();
      await ctx.audioWorklet.addModule("/pcm-processor.js");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false },
      });
      streamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, "pcm-processor", {
        processorOptions: { inputSampleRate: ctx.sampleRate, targetSampleRate: 24000 },
      });
      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        const ws = wsRef.current;
        if (readyRef.current && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input.audio", audio: pcm16ToB64(e.data) }));
        }
      };
      src.connect(worklet);
      // Keep the graph alive: Chrome suspends AudioWorkletNodes with no
      // downstream connection, which would silently stop mic capture.
      // Route through a zero-gain node so nothing plays through speakers.
      const silence = ctx.createGain();
      silence.gain.value = 0;
      worklet.connect(silence);
      silence.connect(ctx.destination);

      const url = new URL("wss://agents.assemblyai.com/v1/ws");
      url.searchParams.set("token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      playheadRef.current = ctx.currentTime;

      const p = PRESETS[stateRef.current.preset];
      const greeting = buildGreeting(DEMO_PATIENT.name);

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: buildSystemPrompt({ preset: stateRef.current.preset, patientName: DEMO_PATIENT.name }),
              greeting,
              input: {
                format: { encoding: "audio/pcm" },
                keyterms: stateRef.current.keytermsOn ? keytermsForStage("appointment") : [],
                transcription_prompt: buildTranscriptionPrompt(),
                turn_detection: p.turn_detection,
              },
              output: { voice: VOICE_ID, format: { encoding: "audio/pcm" } },
              tools: TOOL_DEFS,
            },
          }),
        );
      });

      ws.addEventListener("message", async (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        const t = msg.type as string;
        if (t === "session.ready") {
          readyRef.current = true;
          sessionIdRef.current = msg.session_id as string;
          setStatus("live — speak whenever you're ready");
        } else if (t === "transcript.user.delta") {
          pushLine("you", msg.text as string, true);
        } else if (t === "transcript.user") {
          pushLine("you", msg.text as string);
          maybeNarrowKeyterms(msg.text as string);
        } else if (t === "transcript.agent.delta") {
          pushLine("agent", (msg.delta as string) || "", true);
        } else if (t === "transcript.agent") {
          pushLine("agent", msg.text as string);
        } else if (t === "reply.audio") {
          playPcm(msg.data as string);
        } else if (t === "input.speech.started") {
          // Informational only — do NOT flush playback here (see reply.done).
        } else if (t === "reply.done") {
          if (msg.status === "interrupted") {
            // Semantic barge-in (backchannels like "mhm" do NOT trigger this).
            // Flush stale audio AND discard tool results from the killed reply.
            // NOTE: we deliberately do not flush on input.speech.started —
            // encouragement murmurs while the agent speaks must not cut it off.
            flushAudio();
            pendingToolsRef.current = [];
            setInterruptions((c) => c + 1);
          } else {
            // Drain tool results accumulated since the last reply.
            const pending = pendingToolsRef.current.splice(0);
            for (const p of pending) {
              ws.send(JSON.stringify({ type: "tool.result", call_id: p.call_id, result: p.result }));
            }
          }
        } else if (t === "tool.call") {
          const data = await runTool(msg.name as string, (msg.arguments as Record<string, unknown>) || {});
          pendingToolsRef.current.push({
            call_id: msg.call_id as string,
            result: JSON.stringify(data),
          });
        } else if (t === "session.ended") {
          setStatus("call ended");
          cleanup();
        } else if (t === "session.error") {
          setError(`Agent error (${msg.code}): ${msg.message}`);
        }
      });

      ws.addEventListener("close", () => {
        if (readyRef.current) setStatus("connection closed");
        readyRef.current = false;
      });
    },
    [cleanup, flushAudio, maybeNarrowKeyterms, playPcm, pushLine, runTool],
  );

  // ---- Simulated path (no API key): scripted hesitant caller, REAL backend ----
  // The script branches on the patience preset so judges FEEL the wedge:
  // patient mode waits, fast mode cuts the caller off mid-pause.
  const startDemo = useCallback(() => {
    setError(null);
    const fast = stateRef.current.preset === "default";
    setStatus(
      fast
        ? "demo call — FAST mode: watch it cut the caller off"
        : "demo call — scripted hesitant caller, real booking backend",
    );
    const after = (ms: number, fn: () => void) => {
      simTimers.current.push(setTimeout(fn, ms));
    };

    pushLine("agent", `Hello, ${DEMO_PATIENT.name}! This is SilverLine, calling for Maple Street Family Clinic. Take your time, dear — there is no rush at all. Can you hear me all right?`);
    after(2500, () => pushLine("you", "…yes… hello? …is… is anyone there?"));
    if (fast) {
      after(3600, () => {
        pushLine("agent", "Sorry, I didn't catch that — what day works for you?");
        setInterruptions((c) => c + 1);
      });
      after(4800, () => pushLine("system", "◉ FAST mode: cut in after ~1s of hesitant silence (interruption #1)"));
      after(6200, () => pushLine("you", "…Thursday… …ten…"));
      after(7200, () => {
        pushLine("agent", "Was that Tuesday? And morning or afternoon? Let's keep things moving, please.");
        setInterruptions((c) => c + 1);
      });
      after(8400, () => pushLine("system", "◉ FAST mode: guessed wrong + stacked two questions (interruption #2)"));
      after(9800, () => pushLine("you", "…no… Thursday… I… I think I should hang up…"));
      after(10800, () => pushLine("system", "◉ The caller gave up. 2 interruptions in 11 seconds. This is why seniors hate voice bots."));
      after(11800, () => setStatus("demo complete — 2 interruptions, caller lost. Try patient mode →"));
      return;
    }
    after(3600, () => pushLine("system", "◉ Patience envelope: 2.0s of hesitant silence — agent keeps waiting (default bots cut in here)"));
    after(5200, () => pushLine("agent", "I hear you just fine. I am here with you. I see a visit with Dr. Rao — Thursday, September 17 at 10 in the morning. Does that still suit you?"));
    after(6800, () => pushLine("you", "…Thursday… …ten… …I think… yes…"));
    after(7800, () => pushLine("system", "◉ Read-back gate: no booking until the full visit is repeated and confirmed"));
    after(8800, async () => {
      pushLine("agent", "Let me read that back slowly. Thursday, September 17, at 10 AM, with Dr. Rao, at Maple Street Family Clinic. If that is right, just say yes.");
      await runTool("check_availability", { clinician: "Dr. Rao" });
    });
    after(10600, () => pushLine("you", "…yes… that's right…"));
    after(11600, async () => {
      const booked = await runTool("book_visit", {
        slot_id: "s1",
        patient: DEMO_PATIENT.name,
        idempotency_key: "s1-demo-scripted",
      });
      pushLine(
        "agent",
        booked.booked
          ? "Wonderful — you are booked. Now, your pills. Can you tell me the first one on your list?"
          : `Oh dear — ${booked.message ?? "that time just went."} Let's find you another.`,
      );
    });
    after(13800, () => {
      if (!stateRef.current.keytermsOn) {
        pushLine("you", "…met… metopro… lol… succin… something…");
        pushLine("system", "◉ Keyterms OFF: drug name arrives mangled — teach-back stalls");
        pushLine("agent", "I did not catch that one clearly, dear. Could you spell it for me, nice and slow?");
      } else {
        pushLine("you", "…Metoprolol succinate…");
        pushLine("system", "◉ Keyterms ON (drug names boosted): entity arrives clean on the first try");
      }
    });
    after(15200, async () => {
      await runTool("list_medications", {});
      pushLine("agent", "Yes — Metoprolol succinate, 50 milligrams, every morning. Can you say that back to me?");
    });
    after(17000, () => pushLine("you", "…Metoprolol… succinate… every morning…"));
    after(17800, async () => {
      await runTool("confirm_medications", { confirmed: ["Metoprolol succinate"] });
      const rc = await runTool("issue_receipt", {
        summary: "Visit Thursday September 17 at 10 AM with Dr. Rao; Metoprolol succinate teach-back confirmed.",
        slot_id: "s1",
        meds_confirmed: ["Metoprolol succinate"],
        idempotency_key: "s1-demo-scripted",
      });
      pushLine(
        "agent",
        "You did beautifully. Your visit is set, and your daughter can see the receipt. Goodbye for now, dear — and well done.",
      );
      if (rc.receipt_id) setStatus("call complete — receipt issued ✓");
    });
  }, [pushLine, runTool]);

  const start = useCallback(async () => {
    setLines([]);
    setInterruptions(0);
    setToolCalls(0);
    setReceiptUrl(null);
    setStage("appointment");
    setStatus("connecting…");
    try {
      const forceDemo = new URLSearchParams(window.location.search).get("demo") === "1";
      if (forceDemo) {
        setMode("demo");
        startDemo();
        return;
      }
      const res = await fetch("/api/token");
      const data = await res.json();
      if (!res.ok) {
        setError(`Voice service error (${data.status ?? res.status}): ${data.detail ?? data.error ?? "unknown"}. Running guided demo instead.`);
        setMode("demo");
        startDemo();
        return;
      }
      if (data.token) {
        setMode("live");
        await startLive(data.token as string);
      } else {
        setMode("demo");
        startDemo();
      }
    } catch (e) {
      setError(`Could not reach the server: ${String(e)}`);
      setStatus("idle");
    }
  }, [startDemo, startLive]);

  const end = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "session.end" })); // avoid 30s billed grace window
      } catch {
        ws.close();
      }
      setStatus("ending…");
      setTimeout(() => {
        if (wsRef.current === ws) {
          try {
            ws.close();
          } catch {
            /* noop */
          }
          cleanup();
          setStatus("idle");
        }
      }, 1500);
    } else {
      cleanup();
      setStatus("idle");
    }
  }, [cleanup]);

  useEffect(() => {
    const onHide = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "session.end" }));
        } catch {
          /* page going away */
        }
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      simTimers.current.forEach(clearTimeout);
    };
  }, []);

  const switchPreset = (id: PresetId) => {
    setPreset(id);
    stateRef.current.preset = id;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && readyRef.current) {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: { input: { turn_detection: PRESETS[id].turn_detection } },
        }),
      );
      pushLine("system", `◉ Patience → ${PRESETS[id].label} (applied live, no reconnect)`);
    }
  };

  const toggleKeyterms = () => {
    const next = !keytermsOn;
    setKeytermsOn(next);
    stateRef.current.keytermsOn = next;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && readyRef.current) {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: { input: { keyterms: next ? keytermsForStage(stateRef.current.stage) : [] } },
        }),
      );
      pushLine("system", `◉ Keyterms ${next ? "ON — drug & clinic names boosted" : "OFF — raw transcription"}`);
    }
  };

  const calling = status !== "idle" && !status.startsWith("call complete") && !status.startsWith("call ended");

  return (
    <div className="overflow-hidden rounded-[2rem] border border-rosewood/10 bg-white shadow-2xl shadow-rosewood/10">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-rosewood/10 bg-blush/50 px-5 py-4">
        {!calling ? (
          <button
            id="btn-call"
            onClick={start}
            className="animate-pulse-ring rounded-full bg-crimson px-8 py-3.5 font-display text-lg font-bold text-white shadow-xl shadow-crimson/30 transition hover:scale-[1.03] hover:bg-crimson-deep"
          >
            📞 Call SilverLine
          </button>
        ) : (
          <button
            id="btn-call"
            onClick={end}
            className="rounded-full bg-stone-800 px-8 py-3.5 font-display text-lg font-bold text-white shadow transition hover:bg-stone-900"
          >
            End call
          </button>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-stone-500">Patience:</span>
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              id={`preset-${id}`}
              onClick={() => switchPreset(id)}
              className={`rounded-full px-3 py-1.5 font-bold ${preset === id ? "bg-crimson text-white shadow" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"}`}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <button
          id="btn-keyterms"
          onClick={toggleKeyterms}
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${keytermsOn ? "bg-amber-400 text-stone-900 shadow" : "bg-white text-stone-500 ring-1 ring-stone-200"}`}
          title="Boost recognition of drug & clinic names"
        >
          Keyterms {keytermsOn ? "ON" : "OFF"}
        </button>
        <span className="ml-auto text-xs font-bold text-stone-500">
          {mode === "live" ? "● live voice (AssemblyAI)" : mode === "demo" ? "● guided demo (add API key for live voice)" : "● ready"}
        </span>
      </div>

      {/* Status + counters */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pt-4 text-[15px]">
        <p className="text-stone-600">
          Status: <span className="font-bold text-stone-900">{status}</span>
        </p>
        <p className="text-stone-600">
          Interruptions: <span className="font-display font-extrabold text-crimson">{interruptions}</span>
          <span className="text-stone-400"> (target: 0)</span>
        </p>
        <p className="text-stone-600">
          Tool calls: <span className="font-display font-extrabold">{toolCalls}</span>
        </p>
      </div>
      {error && <p className="mx-5 mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {/* Transcript */}
      <div className="max-h-96 min-h-48 space-y-3 overflow-y-auto px-5 py-4">
        {lines.length === 0 && (
          <p className="text-lg text-stone-400">
            Press <strong className="text-crimson">Call SilverLine</strong>. {preset === "patient" ? "Speak slowly, pause as long as you like — it will wait." : "Fast mode: notice how it cuts in."} Try saying
            “Thursday at ten” with long pauses, or “Metoprolol succinate”.
          </p>
        )}
        {lines.map((l) => (
          <div
            key={l.id}
            className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[17px] leading-relaxed ${
              l.who === "agent"
                ? "bg-blush text-stone-900"
                : l.who === "you"
                  ? "ml-auto bg-stone-900 text-white"
                  : "mx-auto bg-amber-50 text-center text-sm text-stone-600"
            } ${l.partial ? "opacity-70" : ""}`}
          >
            {l.who !== "system" && (
              <span className={`mb-0.5 block text-xs font-bold uppercase tracking-wide opacity-60 ${l.who === "agent" ? "text-crimson" : ""}`}>
                {l.who === "agent" ? "SilverLine" : "You"}
              </span>
            )}
            <Highlight text={l.text} />
          </div>
        ))}
      </div>

      {/* Receipt */}
      {receiptUrl && (
        <div id="receipt-card" className="mx-5 mb-5 rounded-2xl border-2 border-crimson bg-blush/60 p-4">
          <p className="font-display font-bold text-crimson-deep">✓ Signed voice receipt issued</p>
          <a href={receiptUrl} className="font-bold text-crimson underline" id="receipt-link">
            Verify the receipt →
          </a>
          <span className="mx-2 text-stone-400">·</span>
          <a href="/dashboard" className="font-bold text-crimson underline">
            Family dashboard →
          </a>
        </div>
      )}
    </div>
  );
}
