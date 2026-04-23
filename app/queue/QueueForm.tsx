"use client";

import { useEffect, useRef } from "react";

const OUTCOMES = [
  { value: "connected",      label: "Connected",            key: "1" },
  { value: "voicemail",      label: "Left voicemail",       key: "2" },
  { value: "no_answer",      label: "No answer",            key: "3" },
  { value: "callback",       label: "Callback requested",   key: "4" },
  { value: "bad_number",     label: "Bad number",           key: "5" },
  { value: "interested",     label: "Interested",           key: "6" },
  { value: "not_interested", label: "Not interested",       key: "7" },
];

export default function QueueForm({
  action,
  skipAction,
  contactId,
  currentStatus,
  defaultNextDate,
}: {
  action: (formData: FormData) => void;
  skipAction: () => void;
  contactId: number;
  currentStatus: string;
  defaultNextDate: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      if (e.key === "s" && !typing) {
        e.preventDefault();
        skipAction();
        return;
      }
      if (e.key === "n" && !typing) {
        e.preventDefault();
        notesRef.current?.focus();
        return;
      }
      if (!typing || (target as HTMLElement).tagName === "TEXTAREA") {
        // In textarea, require Cmd/Ctrl for shortcuts
      }
      const o = OUTCOMES.find((x) => x.key === e.key);
      if (o && !typing) {
        e.preventDefault();
        const radio = formRef.current?.querySelector<HTMLInputElement>(`input[name="outcome"][value="${o.value}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) && formRef.current) {
        e.preventDefault();
        formRef.current.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skipAction]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="contactId" value={contactId} />
      <div>
        <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          Outcome — press <kbd className="badge">1</kbd>–<kbd className="badge">7</kbd> to pick
        </div>
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map((o) => (
            <label key={o.value} className="flex items-center gap-2 panel p-3 cursor-pointer hover:opacity-90">
              <input type="radio" name="outcome" value={o.value} required />
              <span className="text-sm">{o.label}</span>
              <span className="ml-auto badge">{o.key}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Next call (auto-set by outcome; override here)</label>
          <input className="input" type="date" name="nextCallAt" defaultValue={defaultNextDate} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Status override</label>
          <select className="select" name="status" defaultValue="">
            <option value="">Auto (from outcome)</option>
            <option value="new">new</option>
            <option value="attempted">attempted</option>
            <option value="contacted">contacted</option>
            <option value="interested">interested</option>
            <option value="not_interested">not interested</option>
            <option value="do_not_call">do not call</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>
          Notes — <kbd className="badge">n</kbd> to focus, <kbd className="badge">⌘/Ctrl ↵</kbd> to submit
        </label>
        <textarea ref={notesRef} className="textarea" name="notes" rows={3} placeholder={`Current status: ${currentStatus.replace(/_/g, " ")}`} />
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" type="submit">Log &amp; next →</button>
        <button className="btn btn-secondary" type="button" onClick={skipAction}>Skip <kbd className="badge ml-1">s</kbd></button>
      </div>
    </form>
  );
}
