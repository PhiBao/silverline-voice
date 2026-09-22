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

interface DB {
  bookedSlotIds: string[];
  bookings: Booking[];
  receipts: StoredReceipt[];
  events: { ts: string; kind: string; detail: string }[];
  // Server-side memory: last booking + confirmed meds per patient, so the
  // receipt step works even when the model omits slot_id / meds_confirmed.
  lastBookingByPatient: Record<string, { slotId: string; idempotencyKey: string }>;
  medsByPatient: Record<string, string[]>;
}

// Vercel's filesystem is read-only outside /tmp and instances don't share
// files. Honor an explicit dir, use /tmp on Vercel, local dir otherwise.
// NOTE: file persistence is a demo stand-in — concurrent instances can race
// the read-modify-write in bookSlot. Production needs a real DB (Supabase).
const DATA_DIR =
  process.env.SILVERLINE_DATA_DIR ||
  (process.env.VERCEL ? "/tmp/.silverline-data" : path.join(process.cwd(), ".silverline-data"));
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyDb(): DB {
  return { bookedSlotIds: [], bookings: [], receipts: [], events: [], lastBookingByPatient: {}, medsByPatient: {} };
}

export async function loadDb(): Promise<DB> {
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

export async function saveDb(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function logEvent(kind: string, detail: string): Promise<void> {
  const db = await loadDb();
  db.events.push({ ts: new Date().toISOString(), kind, detail });
  await saveDb(db);
}

/** Slots with live availability. */
export async function listSlots(): Promise<(Slot & { available: boolean })[]> {
  const db = await loadDb();
  const booked = new Set(db.bookedSlotIds);
  return SEED_SLOTS.map((s) => ({ ...s, available: !booked.has(s.id) }));
}

/**
 * Transactionally book a slot. The read-check-write happens against the file
 * store; a second concurrent attempt for the same slot fails visibly instead
 * of double-booking. Idempotent on idempotencyKey.
 */
export async function bookSlot(
  slotId: string,
  patient: string,
  phone: string,
  idempotencyKey: string,
): Promise<{ ok: boolean; booking?: Booking; error?: string }> {
  const db = await loadDb();

  const existing = db.bookings.find((b) => b.idempotencyKey === idempotencyKey);
  if (existing) return { ok: true, booking: existing };

  const slot = SEED_SLOTS.find((s) => s.id === slotId);
  if (!slot) return { ok: false, error: `No visit found with id ${slotId}.` };

  if (db.bookedSlotIds.includes(slotId)) {
    return {
      ok: false,
      error: `That visit (${slot.label} with ${slot.clinician}) was just taken. I can offer you another time instead.`,
    };
  }

  const booking: Booking = {
    id: `bk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    slotId,
    slotLabel: slot.label,
    patient,
    phone,
    idempotencyKey,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  db.bookedSlotIds.push(slotId);
  db.bookings.push(booking);
  db.lastBookingByPatient[patient] = { slotId, idempotencyKey };
  db.events.push({
    ts: booking.createdAt,
    kind: "booking.confirmed",
    detail: `${patient} booked ${slot.label} with ${slot.clinician}`,
  });
  await saveDb(db);
  return { ok: true, booking };
}

export async function recordMeds(patient: string, meds: string[]): Promise<void> {
  const db = await loadDb();
  db.medsByPatient[patient] = meds;
  await saveDb(db);
}

export async function saveReceipt(r: StoredReceipt): Promise<void> {
  const db = await loadDb();
  db.receipts.push(r);
  db.events.push({
    ts: new Date().toISOString(),
    kind: "receipt.issued",
    detail: `Receipt ${r.receiptId} for ${r.patient}: ${r.summary}`,
  });
  await saveDb(db);
}

export async function getReceipt(id: string): Promise<StoredReceipt | undefined> {
  const db = await loadDb();
  return db.receipts.find((r) => r.receiptId === id);
}

export async function listReceipts(): Promise<StoredReceipt[]> {
  const db = await loadDb();
  return [...db.receipts].reverse();
}

export async function listBookings(): Promise<Booking[]> {
  const db = await loadDb();
  return [...db.bookings].reverse();
}

export async function resetDemo(): Promise<void> {
  await saveDb(emptyDb());
}
