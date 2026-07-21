import { STATUS_META } from "../types";
import type { Appointment } from "../types";
import { addDays, formatTime, toDateStr, todayStr } from "../lib/dates";

interface Props {
  weekStart: Date; // Monday
  appointments: Appointment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (date: string) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeekView({ weekStart, appointments, selectedId, onSelect, onAdd }: Props) {
  const today = todayStr();
  const days = DAY_LABELS.map((label, i) => {
    const date = toDateStr(addDays(weekStart, i));
    const items = appointments
      .filter((a) => a.date === date)
      .sort((a, b) => a.start.localeCompare(b.start));
    return { label, date, items };
  });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {days.map(({ label, date, items }) => {
        const isToday = date === today;
        return (
          <div
            key={date}
            className={`flex min-h-[10rem] flex-col rounded-lg border ${
              isToday ? "border-emerald-500 bg-emerald-50/40" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}{" "}
                <span className={isToday ? "text-emerald-600" : "text-gray-700"}>
                  {Number(date.slice(8, 10))}
                </span>
                {isToday && <span className="ml-1 text-emerald-600">• today</span>}
              </div>
              <button
                onClick={() => onAdd(date)}
                title="Add appointment"
                className="rounded px-1.5 text-sm font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                +
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-1.5">
              {items.length === 0 && (
                <div className="mt-2 text-center text-xs text-gray-300">—</div>
              )}
              {items.map((a) => {
                const meta = STATUS_META[a.status];
                const selected = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a.id)}
                    className={`rounded-md border-l-4 p-2 text-left text-xs shadow-sm transition ${meta.card} ${
                      selected ? "ring-2 ring-gray-900/60" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-500">
                      {formatTime(a.start)}–{formatTime(a.end)}
                    </div>
                    <div
                      className={`mt-0.5 font-semibold text-gray-900 ${
                        a.status === "cancelled" ? "line-through" : ""
                      }`}
                    >
                      {a.insured}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-600">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
