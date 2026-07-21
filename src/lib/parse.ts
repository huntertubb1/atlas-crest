import type { Appointment } from "../types";

/**
 * Parse the structured description text used on audit calendar events, e.g.
 *
 *   Nexus ControlId: 211567 | Policy 10608679001 (WC, FCBI)
 *   Contact: Jane Doe — 555-555-1234 — jane@example.com
 *   Route stop 1 of 5
 *
 * Tolerates HTML line breaks and em/en dashes. Anything it can't find is
 * simply left out of the result.
 */
export function parseCalendarText(raw: string): Partial<Appointment> {
  const text = raw
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&amp;/g, "&");

  const out: Partial<Appointment> = {};

  const control = text.match(/Control\s*(?:Id|#|No\.?|Number)?\s*[:#]\s*(\d{4,})/i);
  if (control) out.controlId = control[1];

  const policy = text.match(/Policy\s*#?\s*:?\s*([A-Za-z0-9][A-Za-z0-9-]{4,})/i);
  if (policy) out.policy = policy[1];

  const carrier = text.match(/Policy[^()\n]*\(([^)]{2,40})\)/i);
  if (carrier) out.carrier = carrier[1].trim();

  const contactLine = text.match(/Contact\s*:\s*(.+)/i);
  if (contactLine) {
    const line = contactLine[1].trim();
    const email = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (email) out.email = email[0];
    const phone = line.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phone) out.phone = phone[0].trim();
    // The name is whatever comes before the first separator/phone/email.
    const name = line.split(/\s+[—–|]\s+|\s+-\s+/)[0];
    if (name && !name.match(/@|\d{3}/)) out.contactName = name.trim();
  }

  const addr = text.match(/(?:Address|Location)\s*:\s*(.+)/i);
  if (addr) out.address = addr[1].trim();

  return out;
}
