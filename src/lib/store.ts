import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { SEED_SLOTS, type Slot } from "./clinic";
import type { ReceiptPayload } from "./receipt";

export interface Booking {
  id: string;
  slotId: string;
  slotLabel: string;
  patient: string;
  phone: string;
  idempotencyKey: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

export interface StoredReceipt extends ReceiptPayload {
  hmac: string;
}

// ---- Supabase (durable) with file fallback (local dev without creds) ----

let sb: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (sb) return sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  sb = createClient(url, key, { auth: { persistSession: false } });
  return sb;
}
const useDb = () => client() !== null;

// File fallback (same shape as before, plus caller memory).
interface DB {
  bookedSlotIds: string[];
  bookings: Booking[];
  receipts: StoredReceipt[];
  events: { ts: string; kind: string; detail: string }[];
  lastBookingByPatient: Record<string, { slotId: string; idempotencyKey: string }>;
  medsByPatient: Record<string, string[]>;
}
const DATA_DIR =
  process.env.SILVERLINE_DATA_DIR ||
  (process.env.VERCEL ? "/tmp/.silverline-data" : path.join(process.cwd(), ".silverline-data"));
const DB_FILE = path.join(DATA_DIR, "db.json");
function emptyDb(): DB {
  return { bookedSlotIds: [], bookings: [], receipts: [], events: [], lastBookingByPatient: {}, medsByPatient: {} };
}
async function loadFileDb(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const db = JSON.parse(raw) as Partial<DB>;
    return {
      bookedSlotIds: db.bookedSlotIds ?? [],
      bookings: db.bookings ?? [],
      receipts: db.receipts ?? [],
      events: db.events ?? [],
      lastBookingByPatient: db.lastBookingByPatient ?? {},
      medsByPatient: db.medsByPatient ?? {},
    };
  } catch {
    return emptyDb();
  }
}
async function saveFileDb(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// ---- Row mappers ----
function toBooking(r: Record<string, string>): Booking {
  return {
    id: r.id, slotId: r.slot_id, slotLabel: r.slot_label, patient: r.patient,
    phone: r.phone, idempotencyKey: r.idempotency_key, status: (r.status as Booking["status"]) ?? "confirmed",
    createdAt: r.created_at,
  };
}
function toReceipt(r: Record<string, unknown>): StoredReceipt {
  return {
    receiptId: r.receipt_id as string, workspace: r.workspace as string, patient: r.patient as string,
    summary: r.summary as string, slotId: r.slot_id as string, slotLabel: r.slot_label as string,
    idempotencyKey: r.idempotency_key as string, medsConfirmed: (r.meds_confirmed as string[]) ?? [],
    createdAt: r.created_at as string, hmac: r.hmac as string,
  };
}

export async function logEvent(kind: string, detail: string): Promise<void> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    db.events.push({ ts: new Date().toISOString(), kind, detail });
    await saveFileDb(db);
    return;
  }
  await c.from("events").insert({ kind, detail });
}

/** Slots with live availability. */
export async function listSlots(): Promise<(Slot & { available: boolean })[]> {
  const c = client();
  let booked = new Set<string>();
  if (c) {
    const { data } = await c.from("bookings").select("slot_id").eq("status", "confirmed");
    booked = new Set((data ?? []).map((r) => r.slot_id as string));
  } else {
    const db = await loadFileDb();
    booked = new Set(db.bookedSlotIds);
  }
  return SEED_SLOTS.map((s) => ({ ...s, available: !booked.has(s.id) }));
}

/**
 * Book a slot. Idempotent on idempotencyKey; the UNIQUE constraint is the
 * real no-double-book guard (a concurrent conflict returns the friendly
 * "just taken" message instead of a second row).
 */
export async function bookSlot(
  slotId: string,
  patient: string,
  phone: string,
  idempotencyKey: string,
): Promise<{ ok: boolean; booking?: Booking; error?: string }> {
  const slot = SEED_SLOTS.find((s) => s.id === slotId);
  if (!slot) return { ok: false, error: `No visit found with id ${slotId}.` };

  const c = client();
  if (!c) {
    const db = await loadFileDb();
    const existing = db.bookings.find((b) => b.idempotencyKey === idempotencyKey);
    if (existing) return { ok: true, booking: existing };
    if (db.bookedSlotIds.includes(slotId)) {
      return { ok: false, error: takenMsg(slot.label, slot.clinician) };
    }
    const booking: Booking = {
      id: `bk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      slotId, slotLabel: slot.label, patient, phone, idempotencyKey,
      status: "confirmed", createdAt: new Date().toISOString(),
    };
    db.bookedSlotIds.push(slotId);
    db.bookings.push(booking);
    db.lastBookingByPatient[patient] = { slotId, idempotencyKey };
    db.events.push({ ts: booking.createdAt, kind: "booking.confirmed", detail: `${patient} booked ${slot.label} with ${slot.clinician}` });
    await saveFileDb(db);
    return { ok: true, booking };
  }

  const { data: dup } = await c.from("bookings").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (dup) return { ok: true, booking: toBooking(dup as Record<string, string>) };

  const { data: clash } = await c.from("bookings").select("id").eq("slot_id", slotId).eq("status", "confirmed").limit(1);
  if (clash && clash.length > 0) {
    return { ok: false, error: takenMsg(slot.label, slot.clinician) };
  }

  const booking: Booking = {
    id: `bk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    slotId, slotLabel: slot.label, patient, phone, idempotencyKey,
    status: "confirmed", createdAt: new Date().toISOString(),
  };
  const { error } = await c.from("bookings").insert({
    id: booking.id, slot_id: slotId, slot_label: slot.label, patient, phone,
    idempotency_key: idempotencyKey, status: "confirmed",
  });
  if (error) {
    // Genuine race: someone else won the slot between check and insert.
    return { ok: false, error: takenMsg(slot.label, slot.clinician) };
  }
  await c.from("caller_state").upsert(
    { patient, last_slot_id: slotId, last_idempotency_key: idempotencyKey, updated_at: new Date().toISOString() },
    { onConflict: "patient" },
  );
  await c.from("events").insert({ kind: "booking.confirmed", detail: `${patient} booked ${slot.label} with ${slot.clinician}` });
  return { ok: true, booking };
}

function takenMsg(label: string, clinician: string): string {
  return `That visit (${label} with ${clinician}) was just taken. I can offer you another time instead.`;
}

/** Server-side caller memory: last booking + confirmed meds. */
export async function callerMemory(patient: string): Promise<{ slotId: string; idempotencyKey: string; meds: string[] }> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    const last = db.lastBookingByPatient[patient];
    return { slotId: last?.slotId ?? "", idempotencyKey: last?.idempotencyKey ?? "", meds: db.medsByPatient[patient] ?? [] };
  }
  const { data } = await c.from("caller_state").select("*").eq("patient", patient).maybeSingle();
  const row = data as Record<string, string | string[]> | null;
  return {
    slotId: (row?.last_slot_id as string) ?? "",
    idempotencyKey: (row?.last_idempotency_key as string) ?? "",
    meds: ((row?.meds as string[]) ?? []),
  };
}

export async function recordMeds(patient: string, meds: string[]): Promise<void> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    db.medsByPatient[patient] = meds;
    await saveFileDb(db);
    return;
  }
  await c.from("caller_state").upsert(
    { patient, meds, updated_at: new Date().toISOString() },
    { onConflict: "patient" },
  );
}

export async function loadDb(): Promise<DB> {
  // Compat shim for callers that only need caller memory: file shape only.
  return loadFileDb();
}

export async function saveReceipt(r: StoredReceipt): Promise<void> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    db.receipts.push(r);
    db.events.push({ ts: new Date().toISOString(), kind: "receipt.issued", detail: `Receipt ${r.receiptId} for ${r.patient}: ${r.summary}` });
    await saveFileDb(db);
    return;
  }
  await c.from("receipts").insert({
    receipt_id: r.receiptId, workspace: r.workspace, patient: r.patient, summary: r.summary,
    slot_id: r.slotId, slot_label: r.slotLabel, idempotency_key: r.idempotencyKey,
    meds_confirmed: r.medsConfirmed, hmac: r.hmac, created_at: r.createdAt,
  });
  await c.from("events").insert({ kind: "receipt.issued", detail: `Receipt ${r.receiptId} for ${r.patient}: ${r.summary}` });
}

export async function getReceipt(id: string): Promise<StoredReceipt | undefined> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    return db.receipts.find((r) => r.receiptId === id);
  }
  const { data } = await c.from("receipts").select("*").eq("receipt_id", id).maybeSingle();
  return data ? toReceipt(data as Record<string, unknown>) : undefined;
}

export async function listReceipts(): Promise<StoredReceipt[]> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    return [...db.receipts].reverse();
  }
  const { data } = await c.from("receipts").select("*").order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => toReceipt(r as Record<string, unknown>));
}

export async function listBookings(): Promise<Booking[]> {
  const c = client();
  if (!c) {
    const db = await loadFileDb();
    return [...db.bookings].reverse();
  }
  const { data } = await c.from("bookings").select("*").order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => toBooking(r as Record<string, string>));
}

export async function resetDemo(): Promise<void> {
  const c = client();
  if (c) {
    await c.from("bookings").delete().neq("id", "__none__");
    await c.from("receipts").delete().neq("receipt_id", "__none__");
    await c.from("caller_state").delete().neq("patient", "__none__");
    await c.from("events").delete().neq("id", -1);
  }
  await saveFileDb(emptyDb());
}
