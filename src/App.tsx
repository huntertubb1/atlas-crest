import {
  Audit,
  RouteDay,
  SNAPSHOT_DATE,
  Stage,
  TodayTask,
  VIRTUAL_OUTREACH_DAY,
  VIRTUAL_SLA_DAYS,
  physicalAudits,
  todayTasks,
  upcomingRoutes,
  virtualAudits,
} from "./data";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  return Math.floor((new Date(SNAPSHOT_DATE + "T12:00:00").getTime() - new Date(iso + "T12:00:00").getTime()) / DAY_MS);
}

// Status palette (fixed roles — icon + label always accompany color)
const URGENCY = {
  critical: { color: "#d03b3b", icon: "●", label: "Do today" },
  serious: { color: "#ec835a", icon: "▲", label: "Needs reply" },
  warning: { color: "#b98200", icon: "◆", label: "This week" },
  good: { color: "#0ca30c", icon: "✓", label: "On track" },
} as const;

const STAGE_STYLE: Record<Stage, { color: string; icon: string }> = {
  "New": { color: "#d03b3b", icon: "●" },
  "Letter Sent": { color: "#b98200", icon: "◆" },
  "Scheduled": { color: "#2a78d6", icon: "◷" },
  "Confirmed": { color: "#0ca30c", icon: "✓" },
  "Awaiting Docs": { color: "#b98200", icon: "◆" },
  "Docs Received": { color: "#2a78d6", icon: "▣" },
  "Write-Up": { color: "#4a3aa7", icon: "✎" },
  "Submitted": { color: "#0ca30c", icon: "✓" },
};

function StagePill({ stage }: { stage: Stage }) {
  const s = STAGE_STYLE[stage];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ borderColor: s.color, color: s.color }}
    >
      <span aria-hidden>{s.icon}</span>
      {stage}
    </span>
  );
}

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-700 dark:text-neutral-300">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">{sub}</div>}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-gray-500 dark:text-neutral-400">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TaskList({ tasks }: { tasks: TodayTask[] }) {
  return (
    <ol className="space-y-2">
      {tasks.map((t) => {
        const u = URGENCY[t.urgency];
        return (
          <li
            key={t.id}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span aria-hidden className="mt-0.5 text-sm" style={{ color: u.color }}>
              {u.icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{t.label}</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: u.color }}>
                  {u.label}
                </span>
              </div>
              {t.detail && <p className="mt-0.5 text-sm text-gray-600 dark:text-neutral-400">{t.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AuditTable({ audits, showSla }: { audits: Audit[]; showSla?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-700 dark:text-neutral-400">
            <th className="px-3 py-2 font-medium">Control #</th>
            <th className="px-3 py-2 font-medium">Insured</th>
            <th className="px-3 py-2 font-medium">Policy</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            {showSla && <th className="px-3 py-2 font-medium">SLA</th>}
            <th className="px-3 py-2 font-medium">Appointment</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((a) => {
            const age = daysSince(a.assigned);
            const slaLeft = VIRTUAL_SLA_DAYS - age;
            const outreachLeft = VIRTUAL_OUTREACH_DAY - age;
            return (
              <tr key={a.control} className="border-b border-gray-100 last:border-0 align-top dark:border-neutral-800">
                <td className="px-3 py-2 font-mono tabular-nums">{a.control}</td>
                <td className="px-3 py-2 font-medium">
                  {a.insured}
                  <div className="text-xs font-normal text-gray-500 dark:text-neutral-400">
                    {a.carrier} · {a.policyType}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">{a.policy}</td>
                <td className="px-3 py-2"><StagePill stage={a.stage} /></td>
                {showSla && (
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    <div>Day {age} of {VIRTUAL_SLA_DAYS}</div>
                    <div className="text-gray-500 dark:text-neutral-400">
                      {outreachLeft > 0 ? `Outreach in ${outreachLeft}d` : "Outreach due"} · due in {slaLeft}d
                    </div>
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap">
                  {a.scheduled ?? "—"}
                  {a.location && <div className="text-xs text-gray-500 dark:text-neutral-400">{a.location}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {a.contact ?? "—"}
                  {a.phone && <div className="text-xs text-gray-500 dark:text-neutral-400">{a.phone}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-neutral-400">{a.note ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RouteCards({ routes }: { routes: RouteDay[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {routes.map((r) => (
        <div key={r.day} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="font-semibold">{r.day}</div>
          <div className="text-sm text-gray-600 dark:text-neutral-300">
            {r.county} County · {r.stops} stops
          </div>
          {r.flags && (
            <div className="mt-2 text-xs" style={{ color: "#b98200" }}>
              <span aria-hidden>◆ </span>
              {r.flags}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const thursdayRoute = physicalAudits.filter((a) => a.note?.startsWith("Route stop"));
  const newAssignments = physicalAudits.filter((a) => a.stage === "New");
  const openQuestions = physicalAudits.filter((a) => a.stage === "Letter Sent");
  const docsReceived = [...physicalAudits, ...virtualAudits].filter(
    (a) => a.stage === "Docs Received" || a.stage === "Write-Up"
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Atlas Crest — Audit Control</h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Snapshot: Monday, July 20, 2026 · update <code className="font-mono text-xs">src/data.ts</code> as Nexus moves
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={String(physicalAudits.length)} label="Physical audits open" sub={`${newAssignments.length} new, need letters`} />
          <StatTile value={String(virtualAudits.length)} label="Virtual (CNA) audits open" sub="All awaiting documents" />
          <StatTile value={String(docsReceived.length)} label="Ready for write-up" sub="Docs in hand" />
          <StatTile value="25" label="Field stops next 2 weeks" sub="Thu 7/23 (5) + 7/28–7/31 (20)" />
        </div>

        <Section title="Today — Monday 7/20" sub="Confirm-call window for Thursday closes tonight.">
          <TaskList tasks={todayTasks} />
        </Section>

        <Section title="Thursday 7/23 — Lee County route" sub="5 stops, letters sent 7/16. Turn each Scheduled → Confirmed as calls complete.">
          <AuditTable audits={thursdayRoute} />
        </Section>

        <Section title="New assignments (7/19) — need letters + scheduling" sub="All PhyAudit, NewToRep. Slot into the 7/28–7/31 routes where geography allows.">
          <AuditTable audits={newAssignments} />
        </Section>

        <Section title="Open questions" sub="Waiting on a reply from you.">
          <AuditTable audits={openQuestions} />
        </Section>

        <Section
          title="Virtual pipeline — CNA"
          sub={`40-day SLA from assignment; day-${VIRTUAL_OUTREACH_DAY} outreach to policyholder + agent if no records. Move to Docs Received the moment records land, then Write-Up.`}
        >
          <AuditTable audits={virtualAudits} showSla />
        </Section>

        <Section title="Next week — confirm calls Wed 7/22" sub="20 stops. Also Wed 2:00 PM: Eric Boyette, National Risk (new vendor enrollment). Friday 7/24 you're OFF.">
          <RouteCards routes={upcomingRoutes} />
        </Section>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
          Stages: New → Letter Sent → Scheduled → Confirmed (physical) / Awaiting Docs (virtual) → Docs Received → Write-Up → Submitted.
          Nexus remains the system of record — this board mirrors it.
        </footer>
      </div>
    </div>
  );
}
