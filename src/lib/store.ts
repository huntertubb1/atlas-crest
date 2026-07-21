import type { Appointment } from "../types";

const KEY = "atlas-crest.appointments.v1";

export function loadAppointments(): Appointment[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Appointment[]) : null;
  } catch {
    return null;
  }
}

export function saveAppointments(list: Appointment[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `apt-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
