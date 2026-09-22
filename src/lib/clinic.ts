// Seeded demo data: one clinic, two clinicians, slots, meds.
// In production these come from the clinic's scheduling system / pharmacy.

export interface Slot {
  id: string;
  clinic: string;
  clinician: string;
  specialty: string;
  start: string; // ISO
  end: string; // ISO
  label: string; // human label, e.g. "Thursday, Sept 18 at 10:00 AM"
}

export interface Med {
  name: string;
  dose: string;
  schedule: string;
}

export const CLINIC = {
  name: "Maple Street Family Clinic",
  phone: "+1-555-0100",
  address: "42 Maple Street",
};

export const CLINICIANS = ["Dr. Rao", "Dr. Patel", "Nurse Alvarez"];

// Drug names double as STT keyterms — the exact terms generic models mangle.
export const DRUG_KEYTERMS = [
  "Metoprolol succinate",
  "Atorvastatin",
  "Lisinopril",
  "Levothyroxine",
  "Amlodipine",
  "Metformin",
  "Omeprazole",
  "Losartan",
  "Dr. Rao",
  "Dr. Patel",
  "Maple Street Family Clinic",
];

export const CLINIC_KEYTERMS = [
  "Maple Street Family Clinic",
  "Dr. Rao",
  "Dr. Patel",
  "Nurse Alvarez",
];

function slot(
  id: string,
  clinician: string,
  specialty: string,
  start: string,
  end: string,
  label: string,
): Slot {
  return { id, clinic: CLINIC.name, clinician, specialty, start, end, label };
}

// Fixed demo week so the demo is deterministic.
export const SEED_SLOTS: Slot[] = [
  slot("s1", "Dr. Rao", "Family medicine", "2026-09-17T10:00:00", "2026-09-17T10:20:00", "Thursday, September 17 at 10:00 AM"),
  slot("s2", "Dr. Rao", "Family medicine", "2026-09-17T10:30:00", "2026-09-17T10:50:00", "Thursday, September 17 at 10:30 AM"),
  slot("s3", "Dr. Patel", "Family medicine", "2026-09-18T09:00:00", "2026-09-18T09:20:00", "Friday, September 18 at 9:00 AM"),
  slot("s4", "Dr. Patel", "Family medicine", "2026-09-18T11:00:00", "2026-09-18T11:20:00", "Friday, September 18 at 11:00 AM"),
  slot("s5", "Nurse Alvarez", "Blood pressure check", "2026-09-18T14:00:00", "2026-09-18T14:15:00", "Friday, September 18 at 2:00 PM"),
  slot("s6", "Dr. Rao", "Family medicine", "2026-09-21T10:00:00", "2026-09-21T10:20:00", "Monday, September 21 at 10:00 AM"),
];

export const SEED_MEDS: Med[] = [
  { name: "Metoprolol succinate", dose: "50 mg", schedule: "every morning" },
  { name: "Atorvastatin", dose: "20 mg", schedule: "every evening" },
  { name: "Lisinopril", dose: "10 mg", schedule: "every morning" },
];

export const DEMO_PATIENT = {
  name: "Margaret Ellis",
  phone: "+1-555-0142",
};
