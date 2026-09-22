import { CLINIC, CLINIC_KEYTERMS, DRUG_KEYTERMS } from "./clinic";

// Turn-detection presets. The patient preset is the product wedge:
// slow, hesitant speakers are never cut off.
export const PRESETS = {
  default: {
    id: "default",
    label: "Default (fast)",
    description: "Typical voice-bot tuning. Interrupts hesitant speakers.",
    turn_detection: { min_silence: 500, max_silence: 1500, interrupt_response: true },
  },
  patient: {
    id: "patient",
    label: "SilverLine patient (slow-safe)",
    description: "Waits through pauses. Never mistakes thinking for finished.",
    turn_detection: { min_silence: 1200, max_silence: 3500, interrupt_response: true },
  },
} as const;

export type PresetId = keyof typeof PRESETS;

export function buildSystemPrompt(opts: {
  preset: PresetId;
  patientName: string;
}): string {
  return `You are SilverLine, a warm, slow, patient voice companion for elderly patients of ${CLINIC.name}. You speak on a plain phone call.

RULES — follow them exactly:
1. Speak SLOWLY in short sentences. One question at a time. Never stack two questions.
2. WAIT. The caller may pause for several seconds to think or breathe. A pause is NOT an ending. Never rush them, never say "are you still there?" before 5 full seconds of silence.
3. If you did not clearly hear a date, time, name, or medication, say exactly what you heard and ask them to repeat that one thing. NEVER guess a date, time, or medication.
4. Before booking anything, READ BACK the full visit (day, date, time, clinician, clinic) and ask for an explicit "yes". No "yes" means no booking.
5. For medications, use teach-back: say each medication name slowly, spell tricky ones, and ask the caller to repeat it back.
6. Offer "say GO BACK at any time to repeat the last step". Honor it immediately.
7. You never give medical advice, diagnoses, or dosage changes. You only read back what is on their list and confirm.
8. Keep every reply under 2 sentences unless reading back a summary.
9. The caller's name is ${opts.patientName}. Address them kindly, never patronizingly. You are talking WITH them, not AT them.

BACKCHANNELS (mm-hmm, uh-huh, oh, okay while you speak) are encouragement, not interruptions. Keep going.

FLOW: 1) greet + confirm who you are speaking with, 2) confirm or find the visit, 3) read-back + explicit yes + book, 4) medication teach-back, 5) spoken receipt summary.`;
}

export function buildGreeting(patientName: string): string {
  return `Hello, ${patientName}! This is SilverLine, calling for ${CLINIC.name}. Take your time, dear — there is no rush at all. Can you hear me all right?`;
}

// "mary" is a US-English voice from the official voices table (verified Sep
// 2026); pinned explicitly so the demo never depends on a changing default.
export const VOICE_ID = "mary";

export function buildTranscriptionPrompt(): string {
  return "Slow elderly speaker on a phone call, with long thinking pauses. Clinic names: Maple Street Family Clinic, Dr. Rao, Dr. Patel, Nurse Alvarez. Medications: Metoprolol succinate, Atorvastatin, Lisinopril.";
}
// Client-side function tools. The browser executes them against our own
// /api/tools endpoint and returns tool.result over the WebSocket, so
// AssemblyAI never needs a public webhook URL.
export const TOOL_DEFS = [
  {
    type: "function",
    name: "check_availability",
    description:
      "List upcoming available visits at the clinic. Use when the caller wants a visit, asks what times exist, or needs an alternative after a conflict.",
    parameters: {
      type: "object",
      properties: {
        clinician: {
          type: "string",
          description: "Clinician name if the caller asked for someone, e.g. 'Dr. Rao'. Empty means any.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "book_visit",
    description:
      "Book a visit slot. Use ONLY after reading back the full visit (day, date, time, clinician, clinic) AND hearing an explicit yes. Never call without the read-back.",
    parameters: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "Slot id from check_availability, e.g. 's1'." },
        patient: { type: "string", description: "Caller full name, e.g. 'Margaret Ellis'." },
        idempotency_key: {
          type: "string",
          description: "Unique key for this booking attempt, e.g. the slot id plus today's date.",
        },
      },
      required: ["slot_id", "patient", "idempotency_key"],
    },
  },
  {
    type: "function",
    name: "list_medications",
    description:
      "Read the caller's current medication list. Use when starting the medication teach-back step.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "confirm_medications",
    description:
      "Record which medications the caller repeated back correctly. Use after the teach-back for each medication.",
    parameters: {
      type: "object",
      properties: {
        confirmed: {
          type: "array",
          items: { type: "string" },
          description: "Medication names the caller repeated back, e.g. ['Metoprolol succinate'].",
        },
      },
      required: ["confirmed"],
    },
  },
  {
    type: "function",
    name: "issue_receipt",
    description:
      "Issue the signed voice receipt after booking and medications are done. Use once at the end of the call to create the verifiable record the family can check. Pass the slot_id you booked and the medications the caller repeated back; omit them only if unknown and the server will use the call's last booking.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One-sentence spoken summary of what was confirmed, e.g. 'Visit Thursday September 17 at 10 AM with Dr. Rao; 3 medications confirmed.'",
        },
        slot_id: {
          type: "string",
          description: "Slot id that was booked, e.g. 's1'. Omit if unknown.",
        },
        meds_confirmed: {
          type: "array",
          items: { type: "string" },
          description: "Medication names the caller repeated back, e.g. ['Metoprolol succinate']. Omit if none.",
        },
        idempotency_key: {
          type: "string",
          description: "Booking key used for book_visit, e.g. the slot id plus today's date. Omit if unknown.",
        },
        receipt_phone: {
          type: "string",
          description: "Family mobile number for the SMS receipt, with country code, e.g. '+15550142'. Ask the caller for it before issuing the receipt. Omit to skip SMS.",
          examples: ["+15550142"],
          pattern: "\\+[1-9]\\d{1,14}",
        },
      },
      required: ["summary"],
    },
  },
];

export function keytermsForStage(stage: "appointment" | "medications" | "receipt" | "all"): string[] {
  if (stage === "medications") return DRUG_KEYTERMS;
  if (stage === "appointment") return CLINIC_KEYTERMS;
  return [...new Set([...CLINIC_KEYTERMS, ...DRUG_KEYTERMS])].slice(0, 100);
}
