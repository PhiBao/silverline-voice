# SilverLine — the voice line that waits

Elderly-first voice companion for the **AssemblyAI Voice Agent Hackathon**
(lablab.ai, Sep 1–30 2026). Slow-safe turn-taking, drug-name-accurate hearing
via dynamic keyterms, read-back-gated booking, and HMAC-signed voice receipts.

## Run

```bash
pnpm install
cp .env.example .env.local   # add ASSEMBLYAI_API_KEY for live voice (optional)
pnpm dev                      # http://localhost:3000
```

Without an API key the app runs a **guided demo**: scripted hesitant caller,
real booking backend, real receipts. With a key, the Call button opens a live
AssemblyAI Voice Agent session (single-use token mint, browser mic → agent).

## Judge tour (60 seconds)

1. Press **Call SilverLine** — watch the hesitant caller get waited for, not cut off.
2. Toggle **Patience → Default (fast)** mid-call to feel the difference.
3. Toggle **Keyterms OFF** before the drug name, ON after — mangled vs. clean.
4. Open a second tab and book the same visit — the double-book fails visibly.
5. Follow the receipt link → **Verify** → click “edited” to watch verification fail.
6. Check the **Family dashboard** for history + calendar.

## Architecture

```
browser (AudioWorklet 24kHz PCM, echo-cancelled)
  → wss://agents.assemblyai.com (Voice Agent API: STT + turn-taking + LLM + TTS)
  → tool.call → browser → POST /api/tools (availability, booking, meds, receipt)
  → tool.result → agent speaks the informed reply
```

- `src/lib/agent.ts` — persona prompt, patience presets, keyterm stages, tool schemas
- `src/lib/store.ts` — file-backed bookings/receipts with transactional no-double-book guard
- `src/lib/receipt.ts` — HMAC-SHA256 sign/verify over (clinic, patient, summary, slot, idempotency key)
- `src/components/VoiceCall.tsx` — capture, queued playback with interrupt-flush, live `session.update` narrowing

## Notes

- Demo clinic data is fictional. No EHR, no medical advice — labels are read back, never prescribed.
- `session.end` is always sent before socket close (avoids the billed 30s resume window).
