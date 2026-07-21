export type Status =
  | "unconfirmed"
  | "left_message"
  | "confirmed"
  | "rescheduled"
  | "records"
  | "cancelled"
  | "completed";

export interface Appointment {
  id: string;
  insured: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm (24h)
  end: string; // HH:mm (24h)
  controlId?: string;
  policy?: string;
  carrier?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: Status;
  sample?: boolean;
}

interface StatusMeta {
  label: string;
  /** Small pill badge */
  badge: string;
  /** Calendar card */
  card: string;
  /** Colored dot */
  dot: string;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  unconfirmed: {
    label: "No response",
    badge: "bg-amber-100 text-amber-800",
    card: "bg-amber-50 border-amber-400 hover:bg-amber-100",
    dot: "bg-amber-400",
  },
  left_message: {
    label: "Left message",
    badge: "bg-sky-100 text-sky-800",
    card: "bg-sky-50 border-sky-400 hover:bg-sky-100",
    dot: "bg-sky-400",
  },
  confirmed: {
    label: "Confirmed",
    badge: "bg-emerald-100 text-emerald-800",
    card: "bg-emerald-50 border-emerald-500 hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
  rescheduled: {
    label: "Rescheduled",
    badge: "bg-violet-100 text-violet-800",
    card: "bg-violet-50 border-violet-400 hover:bg-violet-100",
    dot: "bg-violet-400",
  },
  records: {
    label: "Records / no visit",
    badge: "bg-teal-100 text-teal-800",
    card: "bg-teal-50 border-teal-400 hover:bg-teal-100",
    dot: "bg-teal-500",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-gray-200 text-gray-600",
    card: "bg-gray-50 border-gray-300 hover:bg-gray-100 opacity-70",
    dot: "bg-gray-400",
  },
  completed: {
    label: "Completed",
    badge: "bg-slate-200 text-slate-700",
    card: "bg-slate-50 border-slate-400 hover:bg-slate-100",
    dot: "bg-slate-500",
  },
};

export const STATUS_ORDER: Status[] = [
  "unconfirmed",
  "left_message",
  "confirmed",
  "rescheduled",
  "records",
  "cancelled",
  "completed",
];

/** Statuses that still need a confirmation call/email before the visit. */
export const NEEDS_ACTION: Status[] = ["unconfirmed", "left_message"];
