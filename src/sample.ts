import type { Appointment } from "./types";
import { addDays, mondayOf, toDateStr } from "./lib/dates";

/**
 * Fictional starter data so the calendar isn't empty on first load. All
 * names, numbers, and policies here are made up — replace them with real
 * audits, which stay in this browser's localStorage and are never committed
 * to the repository.
 */
export function buildSampleWeek(): Appointment[] {
  const mon = mondayOf(new Date());
  const day = (offset: number) => toDateStr(addDays(mon, offset));

  return [
    {
      id: "sample-1",
      insured: "Gulf Breeze Framing LLC",
      date: day(1),
      start: "10:00",
      end: "11:00",
      controlId: "200001",
      policy: "10600000001",
      carrier: "WC, FCBI",
      contactName: "Alex Rivera",
      phone: "555-555-0101",
      email: "alex@example.com",
      address: "1200 Industrial Ave, Fort Myers, FL",
      notes: "Letter sent last week.",
      status: "confirmed",
      sample: true,
    },
    {
      id: "sample-2",
      insured: "Sunshine Stucco Inc",
      date: day(3),
      start: "09:00",
      end: "10:00",
      controlId: "200002",
      policy: "10600000002",
      carrier: "WC, FCBI",
      contactName: "Pat Morgan",
      phone: "555-555-0102",
      email: "pat@example.com",
      address: "48 Palmetto Rd, Cape Coral, FL",
      notes: "Route stop 1 of 3.",
      status: "unconfirmed",
      sample: true,
    },
    {
      id: "sample-3",
      insured: "Coastal Roofing Group",
      date: day(3),
      start: "11:00",
      end: "12:00",
      controlId: "200003",
      policy: "10600000003",
      carrier: "WC, FCBI",
      contactName: "Sam Lee",
      phone: "555-555-0103",
      email: "sam@example.com",
      address: "990 Harbor Blvd, Fort Myers, FL",
      notes: "Route stop 2 of 3. Called Monday, waiting on callback.",
      status: "left_message",
      sample: true,
    },
    {
      id: "sample-4",
      insured: "Victory Lane Detailing",
      date: day(3),
      start: "14:00",
      end: "15:00",
      controlId: "200004",
      policy: "10600000004",
      carrier: "WC, FCBI",
      contactName: "Jordan Casey (agent)",
      phone: "555-555-0104",
      email: "agent@example.com",
      address: "—",
      notes: "Agent of record will handle by records; no onsite visit.",
      status: "records",
      sample: true,
    },
    {
      id: "sample-5",
      insured: "Pine Island Electric",
      date: day(4),
      start: "13:00",
      end: "14:00",
      controlId: "200005",
      policy: "10600000005",
      carrier: "GL, CNA",
      contactName: "Chris Diaz",
      phone: "555-555-0105",
      email: "chris@example.com",
      address: "77 Pine Island Rd, Bokeelia, FL",
      notes: "",
      status: "completed",
      sample: true,
    },
  ];
}
