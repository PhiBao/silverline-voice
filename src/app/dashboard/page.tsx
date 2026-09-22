import Link from "next/link";
import { listReceipts, listBookings, listSlots } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [receipts, bookings, slots] = await Promise.all([
    listReceipts(),
    listBookings(),
    listSlots(),
  ]);
  const confirmed = bookings.length;
  const open = slots.filter((s) => s.available).length;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="text-sm text-stone-500 underline">← SilverLine</Link>
        <h1 className="mt-4 text-3xl font-semibold">Family dashboard</h1>
        <p className="mt-2 text-stone-600">
          Every confirmed visit and teach-back lands here — with a verifiable receipt.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-3xl font-bold">{confirmed}</p><p className="text-sm text-stone-500">visits confirmed</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-3xl font-bold">{receipts.length}</p><p className="text-sm text-stone-500">signed receipts</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-3xl font-bold">{open}</p><p className="text-sm text-stone-500">visits still open</p></div>
        </div>

        <h2 className="mt-10 text-xl font-semibold">Receipts</h2>
        {receipts.length === 0 && (
          <p className="mt-3 rounded-2xl bg-white p-5 text-stone-500 shadow-sm">
            No calls yet. Make a call on the home page — the receipt will appear here.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {receipts.map((r) => (
            <li key={r.receiptId} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-medium">{r.summary}</p>
              <p className="mt-1 text-sm text-stone-500">{r.patient} · {new Date(r.createdAt).toLocaleString()}</p>
              <Link href={`/verify/${r.receiptId}`} className="mt-2 inline-block text-sm font-medium text-emerald-700 underline">
                Verify receipt →
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-xl font-semibold">Visit calendar</h2>
        <ul className="mt-3 space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
              <span>{s.label} · {s.clinician}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
                {s.available ? "open" : "booked"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
