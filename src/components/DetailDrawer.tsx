import { useEffect, useState } from "react";
import { STATUS_META, STATUS_ORDER } from "../types";
import type { Appointment, Status } from "../types";
import { formatDateLong, formatTime } from "../lib/dates";
import { parseCalendarText } from "../lib/parse";
import StatusBadge from "./StatusBadge";

interface Props {
  appointment: Appointment;
  isNew: boolean;
  onSave: (a: Appointment) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function DetailDrawer({ appointment, isNew, onSave, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState<Appointment>(appointment);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    setDraft(appointment);
    setEditing(isNew);
    setPasteText("");
  }, [appointment, isNew]);

  const set = (patch: Partial<Appointment>) => setDraft((d) => ({ ...d, ...patch }));

  const applyPaste = () => {
    const parsed = parseCalendarText(pasteText);
    set(parsed);
  };

  const setStatus = (status: Status) => {
    const updated = { ...appointment, status };
    onSave(updated);
    setDraft(updated);
  };

  const saveNotes = (notes: string) => {
    onSave({ ...appointment, notes });
  };

  if (editing) {
    const field = (
      label: string,
      key: keyof Appointment,
      type: "text" | "date" | "time" = "text",
      placeholder = ""
    ) => (
      <label className="block text-xs font-medium text-gray-600">
        {label}
        <input
          type={type}
          value={(draft[key] as string) ?? ""}
          placeholder={placeholder}
          onChange={(e) => set({ [key]: e.target.value })}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </label>
    );

    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {isNew ? "New appointment" : "Edit appointment"}
          </h2>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <details className="rounded border border-dashed border-gray-300 bg-gray-50 p-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-600">
            Paste from calendar description
          </summary>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={"Nexus ControlId: 211567 | Policy 1060… (WC, FCBI)\nContact: Name — phone — email"}
            className="mt-2 w-full rounded border border-gray-300 p-2 text-xs focus:outline-none"
          />
          <button
            onClick={applyPaste}
            className="mt-1 rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
          >
            Fill fields from text
          </button>
        </details>

        {field("Insured / business name", "insured")}
        <div className="grid grid-cols-3 gap-2">
          {field("Date", "date", "date")}
          {field("Start", "start", "time")}
          {field("End", "end", "time")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("Control #", "controlId")}
          {field("Policy #", "policy")}
        </div>
        {field("Carrier / line", "carrier", "text", "e.g. WC, FCBI")}
        {field("Contact name", "contactName")}
        <div className="grid grid-cols-2 gap-2">
          {field("Phone", "phone")}
          {field("Email", "email")}
        </div>
        {field("Address", "address")}
        <label className="block text-xs font-medium text-gray-600">
          Notes
          <textarea
            value={draft.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
          />
        </label>

        <div className="mt-auto flex gap-2 pt-2">
          <button
            onClick={() => {
              if (!draft.insured.trim() || !draft.date) return;
              onSave({ ...draft, sample: false });
              setEditing(false);
            }}
            disabled={!draft.insured.trim() || !draft.date}
            className="flex-1 rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => (isNew ? onClose() : setEditing(false))}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const a = appointment;
  const mapsUrl =
    a.address && a.address !== "—"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.address)}`
      : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold leading-tight text-gray-900">{a.insured}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDateLong(a.date)} · {formatTime(a.start)}–{formatTime(a.end)}
          </p>
        </div>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">
          ✕
        </button>
      </div>

      <StatusBadge status={a.status} />

      <div className="flex flex-wrap gap-2">
        {a.phone && (
          <a
            href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            📞 Call {a.contactName ? a.contactName.split(" ")[0] : ""}
          </a>
        )}
        {a.email && (
          <a
            href={`mailto:${a.email}`}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
          >
            ✉ Email
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            🗺 Map
          </a>
        )}
      </div>

      <dl className="space-y-1.5 text-sm">
        {[
          ["Control #", a.controlId],
          ["Policy #", a.policy],
          ["Carrier / line", a.carrier],
          ["Contact", a.contactName],
          ["Phone", a.phone],
          ["Email", a.email],
          ["Address", a.address],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-24 shrink-0 text-gray-400">{label}</dt>
              <dd className="break-all text-gray-800">{value}</dd>
            </div>
          ))}
      </dl>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Set status
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                s === a.status
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</h3>
        <textarea
          key={a.id}
          defaultValue={a.notes ?? ""}
          onBlur={(e) => saveNotes(e.target.value)}
          rows={4}
          placeholder="Call attempts, reschedule info, documents received…"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
        />
        <p className="mt-0.5 text-[11px] text-gray-400">Saved when you click away.</p>
      </div>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          onClick={() => setEditing(true)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Edit details
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Delete "${a.insured}"?`)) onDelete(a.id);
          }}
          className="rounded border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
