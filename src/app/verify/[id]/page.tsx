import { notFound } from "next/navigation";
import Link from "next/link";
import { getReceipt } from "@/lib/store";
import { verifyReceipt } from "@/lib/receipt";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tamper?: string }>;
}) {
  const { id } = await params;
  const { tamper } = await searchParams;
  const r = await getReceipt(id);
  if (!r) notFound();
  const { hmac, ...stored } = r;
  // ?tamper=1 simulates a single edited character to prove verification
  // is real: the signature no longer matches and the page shows failure.
  const payload = tamper ? { ...stored, summary: stored.summary + "!" } : stored;
  const valid = verifyReceipt(payload, hmac);

  return (
    <main className="min-h-screen bg-cream text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <Link href="/" className="text-sm text-stone-500 underline">← SilverLine</Link>
        <h1 className="mt-4 font-display text-4xl font-extrabold">Voice receipt</h1>
        <p className="mt-2 text-stone-600">
          This record was created by a SilverLine call and cryptographically signed.
          If any detail is changed, verification fails.
        </p>

        <div className={`mt-6 rounded-2xl border-2 p-5 ${valid ? "border-crimson bg-blush/60" : "border-red-600 bg-red-50"}`}>
          <p className={`text-xl font-bold ${valid ? "text-crimson-deep" : "text-red-800"}`}>
            {valid ? "✓ Verified — exactly as confirmed on the call" : "✕ Verification failed — details were changed"}
          </p>
        </div>

        <dl className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow-sm">
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Patient</dt><dd className="text-lg">{payload.patient}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Summary</dt><dd className="text-lg">{payload.summary}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Visit</dt><dd className="text-lg">{payload.slotLabel || "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Medications confirmed</dt><dd className="text-lg">{payload.medsConfirmed.length ? payload.medsConfirmed.join(", ") : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Clinic</dt><dd>{payload.workspace}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Recorded at</dt><dd>{new Date(payload.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-stone-500">Receipt id</dt><dd className="font-mono text-sm">{payload.receiptId}</dd></div>
        </dl>

        <p className="mt-6 text-sm text-stone-500">
          Verification recomputes an HMAC-SHA256 signature over the clinic, patient,
          summary, visit, and booking key. Any edit breaks the match.{" "}
          {valid ? (
            <a href="?tamper=1" className="underline">See what happens if a detail is edited →</a>
          ) : (
            <a href="?" className="underline">← back to the untampered record</a>
          )}
        </p>
      </div>
    </main>
  );
}
