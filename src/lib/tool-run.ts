import { SEED_MEDS, CLINIC, DEMO_PATIENT } from "./clinic";
import { bookSlot, listSlots, saveReceipt, logEvent, callerMemory, recordMeds } from "./store";
import { signReceipt, hmacFor } from "./receipt";
import { sendReceiptSms } from "./sms";

export interface ToolContext {
  patient: string;
  phone: string;
  baseUrl?: string;
}

/**
 * Shared tool implementation behind BOTH:
 * - POST /api/tools (browser client: { name, arguments, context })
 * - POST /api/phone/[tool] (AssemblyAI HTTP tools: raw args as JSON body)
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const patient = ctx.patient || DEMO_PATIENT.name;
  const phone = ctx.phone || DEMO_PATIENT.phone;

  switch (name) {
    case "check_availability": {
      const clinician = typeof args.clinician === "string" ? args.clinician : "";
      const slots = await listSlots();
      const filtered = clinician
        ? slots.filter((s) => s.clinician.toLowerCase().includes(clinician.toLowerCase()))
        : slots;
      const open = filtered.filter((s) => s.available).slice(0, 4);
      await logEvent("tool.check_availability", clinician || "any clinician");
      return {
        clinic: CLINIC.name,
        visits: open.map((s) => ({ slot_id: s.id, label: s.label, clinician: s.clinician })),
        note:
          open.length === 0
            ? "No open visits matched. Offer to try another clinician or day."
            : "Read ONE option at a time, slowly. Wait for the answer before offering the next.",
      };
    }
    case "book_visit": {
      const slotId = String(args.slot_id ?? "");
      const idem = String(args.idempotency_key ?? `${slotId}-${new Date().toISOString().slice(0, 10)}`);
      const result = await bookSlot(slotId, patient, phone, idem);
      if (!result.ok) {
        return { booked: false, message: result.error };
      }
      return {
        booked: true,
        booking_id: result.booking!.id,
        slot_id: result.booking!.slotId,
        label: result.booking!.slotLabel,
        message: `Booked ${result.booking!.slotLabel}. Read it back once more and celebrate gently.`,
      };
    }
    case "list_medications": {
      await logEvent("tool.list_medications", patient);
      return {
        medications: SEED_MEDS,
        note: "Teach back ONE medication at a time. Say the name slowly, spell tricky ones, ask them to repeat it.",
      };
    }
    case "confirm_medications": {
      const confirmed = Array.isArray(args.confirmed) ? args.confirmed.map(String) : [];
      await recordMeds(patient, confirmed);
      await logEvent("tool.confirm_medications", confirmed.join(", "));
      return { recorded: confirmed };
    }
    case "issue_receipt": {
      const summary = String(args.summary ?? "Visit and medications confirmed.");
      const mem = await callerMemory(patient);
      const slotId = String(args.slot_id ?? mem.slotId ?? "");
      let medsConfirmed = Array.isArray(args.meds_confirmed) ? args.meds_confirmed.map(String) : [];
      if (medsConfirmed.length === 0) medsConfirmed = mem.meds;
      const idem = String(args.idempotency_key ?? mem.idempotencyKey ?? `rcpt-${Date.now()}`);
      const slot = (await listSlots()).find((s) => s.id === slotId);
      const payload = signReceipt({
        workspace: CLINIC.name,
        patient,
        summary,
        slotId,
        slotLabel: slot?.label ?? "",
        idempotencyKey: idem,
        medsConfirmed,
      });
      const hmac = hmacFor(payload);
      await saveReceipt({ ...payload, hmac });
      const base = (ctx.baseUrl || process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
      const verifyUrl = `${base}/verify/${payload.receiptId}`;

      // Optional SMS receipt to a family mobile, read digit-by-digit safe.
      const receiptPhone = String(args.receipt_phone ?? "");
      let sms: Record<string, unknown> = { sent: false };
      if (receiptPhone) {
        sms = await sendReceiptSms({
          to: receiptPhone,
          from: process.env.TWILIO_PHONE_NUMBER || process.env.SILVERLINE_PHONE_NUMBER || "",
          text: `SilverLine for ${patient}: ${summary} Check the signed receipt: ${verifyUrl}`,
        });
      }
      return {
        receipt_id: payload.receiptId,
        verify_url: verifyUrl,
        sms,
        message: `Receipt issued. Tell the caller their family can check it, and read the summary once more, slowly.`,
      };
    }
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}
