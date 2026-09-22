import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.SILVERLINE_RECEIPT_SECRET || "dev-only-secret-change-me";

export interface ReceiptPayload {
  receiptId: string;
  workspace: string;
  patient: string;
  summary: string;
  slotId: string;
  slotLabel: string;
  idempotencyKey: string;
  medsConfirmed: string[];
  createdAt: string;
}

export function signReceipt(p: Omit<ReceiptPayload, "receiptId" | "createdAt"> & { createdAt?: string }): ReceiptPayload {
  const createdAt = p.createdAt ?? new Date().toISOString();
  const receiptId = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const body: ReceiptPayload = { ...p, receiptId, createdAt };
  return body;
}

function canonical(p: ReceiptPayload): string {
  return [
    p.workspace,
    p.patient,
    p.summary,
    p.slotId,
    p.slotLabel,
    p.idempotencyKey,
    p.medsConfirmed.join("|"),
    p.createdAt,
    p.receiptId,
  ].join("\n");
}

export function hmacFor(p: ReceiptPayload): string {
  return createHmac("sha256", SECRET).update(canonical(p), "utf8").digest("hex");
}

export function verifyReceipt(
  p: ReceiptPayload,
  hmac: string,
): boolean {
  try {
    const a = Buffer.from(hmacFor(p), "hex");
    const b = Buffer.from(hmac, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
