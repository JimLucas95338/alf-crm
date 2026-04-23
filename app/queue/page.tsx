import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { contactsWhere, type ContactFilters } from "@/lib/filters";
import { addDays, endOfToday, fmtDate, fmtDateTime, relativeDays, parseInputDate } from "@/lib/dates";
import { daysForOutcome, nextStatusForOutcome } from "@/lib/autoschedule";
import QueueForm from "./QueueForm";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "attempted", "contacted", "interested", "not_interested", "do_not_call"];

type SP = ContactFilters & { skipped?: string };

function parseSkipped(s: string | undefined): number[] {
  if (!s) return [];
  return s.split(",").map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function buildQueueWhere(filters: ContactFilters, skipped: number[]): Prisma.ContactWhereInput {
  const base = contactsWhere(filters);
  const and: Prisma.ContactWhereInput[] = [base];

  // Exclude do_not_call unless user explicitly filtered for it.
  if (filters.status !== "do_not_call") {
    and.push({ status: { not: "do_not_call" } });
  }
  if (skipped.length) and.push({ id: { notIn: skipped } });

  // If user picked a specific due filter, honor it.
  // Otherwise default queue = overdue + due today + never-called.
  if (!filters.due && !filters.called && !filters.nextFrom && !filters.nextTo) {
    and.push({
      OR: [
        { nextCallAt: { lte: endOfToday() } },
        { AND: [{ nextCallAt: null }, { lastCallAt: null }] },
      ],
    });
  }

  return { AND: and };
}

async function getQueue(filters: ContactFilters, skipped: number[]) {
  const where = buildQueueWhere(filters, skipped);
  const [total, next] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findFirst({
      where,
      orderBy: [{ nextCallAt: { sort: "asc", nulls: "last" } }, { companyName: "asc" }],
      include: {
        executives: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
        calls: { orderBy: { calledAt: "desc" }, take: 3 },
      },
    }),
  ]);
  return { total, next };
}

async function getStates(): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    where: { state: { not: null } },
    distinct: ["state"],
    select: { state: true },
    orderBy: { state: "asc" },
  });
  return rows.map((r) => r.state!).filter(Boolean);
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const skipped = parseSkipped(sp.skipped);
  const [{ total, next }, states] = await Promise.all([getQueue(sp, skipped), getStates()]);

  async function logCall(formData: FormData) {
    "use server";
    const user = await currentUser();
    if (!user) redirect("/login");

    const contactId = Number(formData.get("contactId"));
    const outcome = String(formData.get("outcome") || "").trim();
    if (!contactId || !outcome) return;

    const notes = String(formData.get("notes") || "").trim() || null;
    const overrideStatus = String(formData.get("status") || "").trim();
    const nextDateStr = String(formData.get("nextCallAt") || "").trim();

    const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { status: true } });
    if (!contact) return;

    // Next call: if user gave an explicit date, use it. Else use outcome default.
    let nextCallAt: Date | null = parseInputDate(nextDateStr);
    if (!nextCallAt) {
      const days = daysForOutcome(outcome);
      nextCallAt = days === null ? null : addDays(new Date(), days);
    }

    // Status: explicit override wins; otherwise auto-bump based on outcome.
    let newStatus: string | undefined;
    if (STATUSES.includes(overrideStatus)) {
      newStatus = overrideStatus;
    } else {
      const auto = nextStatusForOutcome(contact.status, outcome);
      if (auto) newStatus = auto;
    }
    if (outcome === "bad_number" && !newStatus) newStatus = "do_not_call";

    const calledAt = new Date();
    await prisma.$transaction([
      prisma.call.create({
        data: { contactId, outcome, notes, calledAt, nextCallAt, calledBy: user.email },
      }),
      prisma.contact.update({
        where: { id: contactId },
        data: { lastCallAt: calledAt, nextCallAt, status: newStatus },
      }),
    ]);

    // Stay on /queue — the contact we just handled drops out because its nextCallAt is future.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "skipped") params.set(k, String(v));
    redirect(`/queue${params.toString() ? `?${params.toString()}` : ""}`);
  }

  async function skipContact() {
    "use server";
    if (!next) return;
    const nextSkipped = [...skipped, next.id].join(",");
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "skipped") params.set(k, String(v));
    params.set("skipped", nextSkipped);
    redirect(`/queue?${params.toString()}`);
  }

  const defaultNextDate = (() => {
    const d = addDays(new Date(), 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Call Queue</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {total} in queue{skipped.length ? ` · ${skipped.length} skipped this session` : ""}
          </p>
        </div>
        {skipped.length > 0 && (
          <Link href={`/queue${Object.entries(sp).filter(([k]) => k !== "skipped").map(([k, v]) => `${k}=${v}`).join("&") ? `?${Object.entries(sp).filter(([k]) => k !== "skipped").map(([k, v]) => `${k}=${v}`).join("&")}` : ""}`} className="btn btn-secondary">Reset skip list</Link>
        )}
      </div>

      <form className="panel p-3 flex flex-wrap gap-3 items-end" method="get">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>State</label>
          <select className="select" name="state" defaultValue={sp.state || ""}>
            <option value="">Any</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Status</label>
          <select className="select" name="status" defaultValue={sp.status || ""}>
            <option value="">Any (except DNC)</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Search</label>
          <input className="input" name="q" defaultValue={sp.q || ""} placeholder="company, city…" />
        </div>
        <button className="btn btn-secondary" type="submit">Apply</button>
        <Link className="btn btn-secondary" href="/queue">Clear</Link>
      </form>

      {!next ? (
        <div className="panel p-8 text-center">
          <div className="text-xl">🎉 Queue is empty</div>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            No contacts match your filters and are due. Adjust filters above or go back to the dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            <div className="panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    <Link href={`/contacts/${next.id}`}>Open full record ↗</Link>
                  </div>
                  <h2 className="text-2xl font-semibold mt-1">{next.companyName}</h2>
                  <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                    {[next.city, next.state, next.zip].filter(Boolean).join(" ")}{next.metroArea ? ` · ${next.metroArea}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ color: next.nextCallAt && next.nextCallAt < new Date() ? "var(--danger)" : undefined }}>
                    {next.nextCallAt ? `${fmtDate(next.nextCallAt)} · ${relativeDays(next.nextCallAt)}` : "never called"}
                  </div>
                  <span className="badge mt-1 inline-block">{next.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                {next.phone ? (
                  <a className="text-2xl font-mono" href={`tel:${next.phone}`}>{next.phone}</a>
                ) : (
                  <span style={{ color: "var(--muted)" }}>no phone</span>
                )}
                {next.website && (
                  <a target="_blank" href={next.website.startsWith("http") ? next.website : `https://${next.website}`} className="text-sm">
                    {next.website} ↗
                  </a>
                )}
              </div>
              {next.executives.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {next.executives.slice(0, 4).map((e) => (
                    <div key={e.id} className="text-sm">
                      <span>{`${e.firstName || ""} ${e.lastName || ""}`.trim() || "—"}</span>
                      {e.title && <span style={{ color: "var(--muted)" }}> · {e.title}</span>}
                      {e.isPrimary && <span className="badge badge-ok ml-2">primary</span>}
                    </div>
                  ))}
                </div>
              )}
              {next.notes && (
                <div className="mt-4 p-3 text-sm" style={{ background: "#0f1216", borderRadius: 6, color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                  {next.notes}
                </div>
              )}
            </div>

            <div className="panel p-5">
              <div className="font-medium mb-3">Log call</div>
              <QueueForm
                action={logCall}
                skipAction={async () => { "use server"; await skipContact(); }}
                contactId={next.id}
                currentStatus={next.status}
                defaultNextDate={defaultNextDate}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel">
              <div className="p-3 border-b font-medium text-sm" style={{ borderColor: "var(--border)" }}>Recent calls on this contact</div>
              {next.calls.length === 0 ? (
                <div className="p-4 text-sm" style={{ color: "var(--muted)" }}>No prior calls.</div>
              ) : (
                <div>
                  {next.calls.map((c) => (
                    <div key={c.id} className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                        <span>{fmtDateTime(c.calledAt)}</span>
                        <span className="badge">{c.outcome.replace(/_/g, " ")}</span>
                      </div>
                      {c.notes && <div className="mt-1 text-sm" style={{ whiteSpace: "pre-wrap" }}>{c.notes}</div>}
                      <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>by {c.calledBy || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel p-3 text-xs space-y-1" style={{ color: "var(--muted)" }}>
              <div className="font-medium" style={{ color: "var(--text)" }}>Auto-schedule defaults</div>
              <div>Connected → +30 days · Voicemail → +3 · No answer → +1</div>
              <div>Callback → +2 · Interested → +2 · Not interested / bad number → no next call</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
