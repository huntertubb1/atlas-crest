// Atlas Crest audit tracker data.
// Snapshot compiled 7/20/2026 from Nexus assignment emails + calendar.
// Update stages here as work moves in Nexus — this file is the single source of truth.

export type Stage =
  | "New"            // assigned, no letter sent yet
  | "Letter Sent"    // audit letter out, waiting on response/docs
  | "Scheduled"      // appointment set (physical) — confirm call still required
  | "Confirmed"      // confirm call completed, appointment locked
  | "Awaiting Docs"  // virtual: waiting on records from insured
  | "Docs Received"  // records in hand — ready to move to write-up
  | "Write-Up"       // working the audit in Nexus
  | "Submitted";     // sent to carrier / MCS

export type Service = "Physical" | "Virtual";

export interface Audit {
  control: string;
  insured: string;
  carrier: string;
  policy: string;
  policyType: string;
  service: Service;
  stage: Stage;
  /** ISO date the stage clock started (assignment date for SLA math) */
  assigned: string;
  scheduled?: string; // e.g. "Thu 7/23 9:00 AM"
  location?: string;
  contact?: string;
  phone?: string;
  note?: string;
}

export interface TodayTask {
  id: string;
  label: string;
  detail?: string;
  urgency: "critical" | "serious" | "warning" | "good";
}

export const SNAPSHOT_DATE = "2026-07-20";

/** CNA virtual audits: 40-day SLA, day-20 outreach if no records. */
export const VIRTUAL_SLA_DAYS = 40;
export const VIRTUAL_OUTREACH_DAY = 20;

export const todayTasks: TodayTask[] = [
  {
    id: "confirm-calls",
    label: "Make the 5 confirm calls for Thursday's Lee County route",
    detail: "Window closes TODAY (7/18–7/20). Log every attempt in Nexus progress notes.",
    urgency: "critical",
  },
  {
    id: "cna-meeting",
    label: "Accept the mandatory CNA meeting invite from Morgan",
    detail: "\"CNA Codes and Questions\" — invite attached to her email, not on your calendar yet.",
    urgency: "serious",
  },
  {
    id: "bath-kitchen",
    label: "Reply to Bath & Kitchen Gallery (212778) — confirm Aug 6, 1–2 PM",
    detail: "Alison Fernandez confirmed 7/16; still unanswered. Log in Nexus + calendar.",
    urgency: "serious",
  },
  {
    id: "fgc-period",
    label: "Freedom Ground Coverings (211537) — verify audit period, reply",
    detail: "Insured says the period in the letter doesn't match the FCBI notice. Legitimacy question already settled by agent.",
    urgency: "warning",
  },
  {
    id: "new-letters",
    label: "Open the 7 new assignments in Nexus and send audit letters",
    detail: "Assigned 7/19, all NewToRep. Several policies already expired or expiring this week.",
    urgency: "warning",
  },
];

export const physicalAudits: Audit[] = [
  // ── Thursday 7/23 route — Lee County (letters sent 7/16) ──
  {
    control: "211567", insured: "MP Construction Corp", carrier: "FCBI", policy: "10608679001",
    policyType: "WC", service: "Physical", stage: "Scheduled", assigned: "2026-07-16",
    scheduled: "Thu 7/23 9:00 AM", location: "2540 SW 4th Ave, Cape Coral",
    contact: "Martin Paredes", phone: "239-333-6724", note: "Route stop 1 of 5",
  },
  {
    control: "211533", insured: "Fernando Construction Services", carrier: "FCBI", policy: "10606845602",
    policyType: "WC", service: "Physical", stage: "Scheduled", assigned: "2026-07-16",
    scheduled: "Thu 7/23 11:00 AM", location: "5041 Billys Creek Dr, Fort Myers",
    contact: "Zacarias Fernando Juan", phone: "239-478-1395", note: "Route stop 2 of 5",
  },
  {
    control: "211638", insured: "Wilkar Capital", carrier: "FCBI", policy: "10606178007",
    policyType: "WC", service: "Physical", stage: "Scheduled", assigned: "2026-07-16",
    scheduled: "Thu 7/23 12:30 PM", location: "2201 Rockfill Rd, Fort Myers",
    contact: "Sue Carriker", phone: "239-337-4360", note: "Route stop 3 of 5",
  },
  {
    control: "211536", insured: "Foote Bros Contracting", carrier: "FCBI", policy: "10606324106",
    policyType: "WC", service: "Physical", stage: "Scheduled", assigned: "2026-07-16",
    scheduled: "Thu 7/23 2:00 PM", location: "6091 Greenbriar Farms Rd, Fort Myers",
    contact: "Dawn Foote", phone: "239-633-1230", note: "Route stop 4 of 5",
  },
  {
    control: "211637", insured: "Victory Christian Center", carrier: "FCBI", policy: "10608678901",
    policyType: "WC", service: "Physical", stage: "Scheduled", assigned: "2026-07-16",
    scheduled: "Thu 7/23 4:00 PM", location: "1251 Taylor Ln Ext, Lehigh Acres",
    contact: "Lawrence Gregory", phone: "239-839-9423", note: "Route stop 5 of 5",
  },
  // ── In-flight items with open questions ──
  {
    control: "212778", insured: "Bath & Kitchen Gallery Inc", carrier: "MCS", policy: "20794830",
    policyType: "GL", service: "Physical", stage: "Letter Sent", assigned: "2026-07-14",
    scheduled: "Thu 8/6 1:00 PM (proposed)", contact: "Alison Fernandez",
    note: "Insured confirmed Aug 6 window — reply + lock it in",
  },
  {
    control: "211537", insured: "Freedom Ground Coverings LLC", carrier: "FCBI", policy: "10608663901",
    policyType: "WC", service: "Physical", stage: "Letter Sent", assigned: "2026-07-14",
    contact: "Kyle Graham", phone: "941-253-6055",
    note: "Audit-period discrepancy raised by insured — verify in Nexus and reply",
  },
  // ── New assignments 7/19 — all NewToRep, letters needed ──
  {
    control: "210334", insured: "Little Road Express Wash Inc", carrier: "MCS", policy: "20454522",
    policyType: "GL – Sales", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expires 7/22",
  },
  {
    control: "210550", insured: "Pair A Jacks Cleaning Specialists", carrier: "MCS", policy: "A106-603-057",
    policyType: "WC", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expires 7/31",
  },
  {
    control: "211485", insured: "Vaughan Yost Construction Inc", carrier: "MCS", policy: "20604238",
    policyType: "GL – Payroll", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expires 7/31",
  },
  {
    control: "212771", insured: "Edward J Hauck Inc", carrier: "MCS", policy: "20299739",
    policyType: "GL – Payroll", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expired 7/18",
  },
  {
    control: "212775", insured: "Classic Construction & Cleaning Inc", carrier: "MCS", policy: "78922916",
    policyType: "GL – Payroll", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expires 7/22",
  },
  {
    control: "212786", insured: "Milmur Land Management LLC", carrier: "MCS", policy: "20828709",
    policyType: "GL – Payroll", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expires 7/27",
  },
  {
    control: "214691", insured: "Planet Stone Marble & Granite Inc", carrier: "MCS", policy: "20920454",
    policyType: "GL – Payroll & Sales", service: "Physical", stage: "New", assigned: "2026-07-19",
    note: "Policy expired 7/16 — oldest of the batch",
  },
];

export const virtualAudits: Audit[] = [
  {
    control: "212707", insured: "Just Right Services", carrier: "CNA", policy: "CNP738909606",
    policyType: "GL – Payroll", service: "Virtual", stage: "Awaiting Docs", assigned: "2026-07-17",
    contact: "Nick", note: "Letter emailed 7/17 — no response yet",
  },
  {
    control: "212710", insured: "Ken's Welding Inc.", carrier: "CNA", policy: "PMT833097545",
    policyType: "GL – Payroll, Sales & Units", service: "Virtual", stage: "Awaiting Docs", assigned: "2026-07-17",
    contact: "Megan Nuanes", note: "Replied 7/20: records coming \"over the next few weeks\" — diary a follow-up",
  },
  {
    control: "212713", insured: "Lambda, Inc.", carrier: "CNA", policy: "GL819135397",
    policyType: "GL – Sales & Units", service: "Virtual", stage: "Awaiting Docs", assigned: "2026-07-17",
    note: "Letter emailed 7/17 — no response yet",
  },
  {
    control: "212832", insured: "Fineline Electric Inc", carrier: "CNA", policy: "PMT792475232",
    policyType: "GL – Payroll & Units", service: "Virtual", stage: "Awaiting Docs", assigned: "2026-07-17",
    contact: "Jennifer", note: "Letter emailed 7/17 (paired with Fineline GC)",
  },
  {
    control: "212833", insured: "Fineline General Contractor Inc", carrier: "CNA", policy: "WC792475246",
    policyType: "WC", service: "Virtual", stage: "Awaiting Docs", assigned: "2026-07-17",
    contact: "Jennifer", note: "Letter emailed 7/17 (paired with Fineline Electric)",
  },
];

export interface RouteDay {
  day: string;
  county: string;
  stops: number;
  flags?: string;
}

/** Next week's physical routes — 20 stops, confirm calls due Wed 7/22. */
export const upcomingRoutes: RouteDay[] = [
  { day: "Tue 7/28", county: "Charlotte", stops: 5 },
  { day: "Wed 7/29", county: "Pinellas", stops: 5 },
  { day: "Thu 7/30", county: "Polk", stops: 5, flags: "A&S Grove: Bartow vs Frostproof addr · K-Ron: PO Box, need street addr" },
  { day: "Fri 7/31", county: "Pinellas", stops: 5, flags: "Bay City: Brooksville addr — verify" },
];
