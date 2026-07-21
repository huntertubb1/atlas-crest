import { useEffect, useMemo, useState } from "react";
import DetailDrawer from "./components/DetailDrawer";
import WeekView from "./components/WeekView";
import { buildSampleWeek } from "./sample";
import { addDays, formatTime, fromDateStr, mondayOf, toDateStr, todayStr } from "./lib/dates";
import { loadAppointments, newId, saveAppointments } from "./lib/store";
import { NEEDS_ACTION, STATUS_META } from "./types";
import type { Appointment } from "./types";

export default function App() {
  const [appointments, setAppointments] = useState<Appointment[]>(
    () => loadAppointments() ?? buildSampleWeek()
  );
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<Appointment | null>(null);

  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  const selected = newDraft ?? appointments.find((a) => a.id === selectedId) ?? null;

  const upsert = (a: Appointment) => {
    setAppointments((list) => {
      const i = list.findIndex((x) => x.id === a.id);
      if (i === -1) return [...list, a];
      const next = [...list];
      next[i] = a;
      return next;
    });
    if (newDraft?.id === a.id) {
      setNewDraft(null);
      setSelectedId(a.id);
    }
  };

  const remove = (id: string) => {
    setAppointments((list) => list.filter((a) => a.id !== id));
    setSelectedId(null);
    setNewDraft(null);
  };

  const startAdd = (date: string) => {
    setSelectedId(null);
    setNewDraft({
      id: newId(),
      insured: "",
      date,
      start: "09:00",
      end: "10:00",
      status: "unconfirmed",
    });
  };

  const hasSample = appointments.some((a) => a.sample);

  // Visits coming up in the next 7 days that still have no confirmation.
  const needsAction = useMemo(() => {
    const today = todayStr();
    const horizon = toDateStr(addDays(fromDateStr(today), 7));
    return appointments
      .filter((a) => NEEDS_ACTION.includes(a.status) && a.date >= today && a.date <= horizon)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, [appointments]);

  const weekLabel = `${weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Atlas Crest · Audit Schedule</h1>
            <p className="text-xs text-gray-500">
              Track appointment confirmations, click into an audit, call or reschedule.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100"
            >
              ←
            </button>
            <button
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100"
            >
              →
            </button>
            <span className="ml-2 text-sm font-medium text-gray-700">{weekLabel}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {hasSample && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span>
              Showing <strong>sample data</strong> — everything you add or edit stays in this
              browser only.
            </span>
            <button
              onClick={() => setAppointments((list) => list.filter((a) => !a.sample))}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Clear sample data
            </button>
          </div>
        )}

        {needsAction.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3">
            <h2 className="text-sm font-semibold text-amber-900">
              Needs a confirmation call — next 7 days ({needsAction.length})
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {needsAction.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[a.status].dot}`} />
                  <button
                    onClick={() => {
                      setNewDraft(null);
                      setSelectedId(a.id);
                      setWeekStart(mondayOf(fromDateStr(a.date)));
                    }}
                    className="font-medium text-amber-900 underline-offset-2 hover:underline"
                  >
                    {a.insured}
                  </button>
                  <span className="text-amber-800/80">
                    {fromDateStr(a.date).toLocaleDateString(undefined, {
                      weekday: "short",
                    })}{" "}
                    {formatTime(a.start)}
                    {a.contactName ? ` · ${a.contactName}` : ""}
                  </span>
                  {a.phone && (
                    <a
                      href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
                      className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Call {a.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <WeekView
              weekStart={weekStart}
              appointments={appointments}
              selectedId={selected?.id ?? null}
              onSelect={(id) => {
                setNewDraft(null);
                setSelectedId(id === selectedId ? null : id);
              }}
              onAdd={startAdd}
            />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              ))}
            </div>
          </div>

          {selected && (
            <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-white shadow-sm lg:w-96">
              <DetailDrawer
                appointment={selected}
                isNew={newDraft !== null}
                onSave={upsert}
                onDelete={remove}
                onClose={() => {
                  setSelectedId(null);
                  setNewDraft(null);
                }}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
