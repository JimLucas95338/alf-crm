import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, parseInputDate, relativeDays, addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "attempted", "contacted", "interested", "not_interested", "do_not_call"];
const OUTCOMES = [
  { value: "connected", label: "Connected" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "callback", label: "Callback requested" },
  { value: "bad_number", label: "Bad number" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
];

async function getContact(id: number) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      executives: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
      calls: { orderBy: { calledAt: "desc" } },
    },
  });
}

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const contact = await getContact(id);
  if (!contact) notFound();

  async function logCall(formData: FormData) {
    "use server";
    const user = await currentUser();
    if (!user) redirect("/login");

    const outcome = String(formData.get("outcome") || "").trim();
    const notes = String(formData.get("notes") || "").trim() || null;
    const calledAtStr = String(formData.get("calledAt") || "");
    const nextCallStr = String(formData.get("nextCallAt") || "");
    const newStatus = String(formData.get("status") || "").trim();

    if (!outcome) return;

    const calledAt = parseInputDate(calledAtStr) || new Date();
    const nextCallAt = parseInputDate(nextCallStr);

    await prisma.$transaction([
      prisma.call.create({
        data: {
          contactId: id,
          outcome,
          notes,
          calledAt,
          nextCallAt,
          calledBy: user.email,
        },
      }),
      prisma.contact.update({
        where: { id },
        data: {
          lastCallAt: calledAt,
          nextCallAt,
          status: STATUSES.includes(newStatus) ? newStatus : undefined,
        },
      }),
    ]);
    redirect(`/contacts/${id}`);
  }

  async function updateContact(formData: FormData) {
    "use server";
    const status = String(formData.get("status") || "");
    const notes = String(formData.get("notes") || "").trim() || null;
    const nextCallStr = String(formData.get("nextCallAt") || "");
    const ownerEmail = String(formData.get("ownerEmail") || "").trim() || null;
    const phone = String(formData.get("phone") || "").trim() || null;
    await prisma.contact.update({
      where: { id },
      data: {
        status: STATUSES.includes(status) ? status : undefined,
        notes,
        ownerEmail,
        phone,
        nextCallAt: parseInputDate(nextCallStr),
      },
    });
    redirect(`/contacts/${id}`);
  }

  function phoneDigits(p: string | null | undefined): number {
    return p ? p.replace(/\D/g, "").length : 0;
  }

  const defaultNext = addDays(new Date(), 7);
  const defaultNextStr = `${defaultNext.getFullYear()}-${String(defaultNext.getMonth() + 1).padStart(2, "0")}-${String(defaultNext.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/contacts" className="text-sm" style={{ color: "var(--muted)" }}>← All contacts</Link>
          <h1 className="text-2xl font-semibold mt-1">{contact.companyName}</h1>
          <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {contact.address && <div>{contact.address}</div>}
            <div>
              {[contact.city, contact.state, contact.zip].filter(Boolean).join(" ")}
              {contact.metroArea ? ` · ${contact.metroArea}` : ""}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="badge">{contact.status.replace(/_/g, " ")}</span>
          <div className="mt-2 text-sm">
            {contact.phone ? (
              <>
                <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                {phoneDigits(contact.phone) < 10 && (
                  <div className="text-xs mt-1" style={{ color: "var(--danger)" }}>area code missing — edit below</div>
                )}
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>no phone</span>
            )}
          </div>
          {contact.website && <div className="mt-1 text-sm"><a href={(contact.website.startsWith("http") ? contact.website : `https://${contact.website}`)} target="_blank">{contact.website}</a></div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="panel p-4">
          <div className="text-xs" style={{ color: "var(--muted)" }}>Last call</div>
          <div className="text-lg mt-1">{fmtDate(contact.lastCallAt)}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{contact.lastCallAt ? relativeDays(contact.lastCallAt) : ""}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs" style={{ color: "var(--muted)" }}>Next call</div>
          <div className="text-lg mt-1" style={{ color: contact.nextCallAt && contact.nextCallAt < new Date() ? "var(--danger)" : undefined }}>
            {fmtDate(contact.nextCallAt)}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{contact.nextCallAt ? relativeDays(contact.nextCallAt) : ""}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs" style={{ color: "var(--muted)" }}>Owner</div>
          <div className="text-lg mt-1">{contact.ownerEmail || "—"}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{contact.calls.length} call{contact.calls.length === 1 ? "" : "s"} logged</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <div className="p-4 border-b font-medium" style={{ borderColor: "var(--border)" }}>Company info</div>
          <div className="p-4 text-sm space-y-2">
            <InfoRow label="Legal name" value={contact.legalName} />
            <InfoRow label="Parent company" value={contact.parentCompanyName} />
            <InfoRow label="Property owner" value={contact.propertyOwner} />
            <InfoRow label="Record type" value={contact.recordType} />
            <InfoRow label="Industry" value={contact.naicsDescription} />
            <InfoRow label="NAICS" value={contact.naicsCode} />
            <InfoRow label="Employees" value={contact.employeeCount ? String(parseInt(contact.employeeCount, 10) || contact.employeeCount) : null} />
            <InfoRow label="Insurance spend" value={contact.insuranceExpenses} />
            {contact.linkedIn && (
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>LinkedIn</span>
                <a href={contact.linkedIn.startsWith("http") ? contact.linkedIn : `https://${contact.linkedIn}`} target="_blank" className="truncate">{contact.linkedIn}</a>
              </div>
            )}
            {contact.facebook && (
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>Facebook</span>
                <a href={contact.facebook.startsWith("http") ? contact.facebook : `https://${contact.facebook}`} target="_blank" className="truncate">{contact.facebook}</a>
              </div>
            )}
            <InfoRow label="Added" value={fmtDate(contact.createdAt)} />
          </div>
        </div>

        <div className="panel">
          <div className="p-4 border-b font-medium" style={{ borderColor: "var(--border)" }}>Executives</div>
          <div>
            {contact.executives.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: "var(--muted)" }}>None on file.</div>
            ) : contact.executives.map((e) => (
              <div key={e.id} className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="text-sm">{`${e.firstName || ""} ${e.lastName || ""}`.trim() || "—"}{e.isPrimary && <span className="badge badge-ok ml-2">primary</span>}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{e.title || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 panel p-4">
          <div className="font-medium mb-3">Log a call</div>
          <form action={logCall} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Outcome</label>
                <select className="select" name="outcome" required>
                  <option value="">Pick one…</option>
                  {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Update status</label>
                <select className="select" name="status" defaultValue="">
                  <option value="">(keep {contact.status.replace(/_/g, " ")})</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Called at</label>
                <input className="input" type="datetime-local" name="calledAt" />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Next call date</label>
                <input className="input" type="date" name="nextCallAt" defaultValue={defaultNextStr} />
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Notes</label>
              <textarea className="textarea" name="notes" rows={3} placeholder="What happened on the call?" />
            </div>
            <div className="flex justify-end">
              <button className="btn" type="submit">Log call</button>
            </div>
          </form>
        </div>

        <div className="panel p-4">
          <div className="font-medium mb-3">Edit details</div>
          <form action={updateContact} className="space-y-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Phone</label>
              <input className="input" type="tel" name="phone" defaultValue={contact.phone || ""} placeholder="(555) 123-4567" />
              {phoneDigits(contact.phone) > 0 && phoneDigits(contact.phone) < 10 && (
                <div className="text-xs mt-1" style={{ color: "var(--danger)" }}>Missing area code — add the 3-digit prefix.</div>
              )}
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Status</label>
              <select className="select" name="status" defaultValue={contact.status}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Next call</label>
              <input className="input" type="date" name="nextCallAt" defaultValue={contact.nextCallAt ? contact.nextCallAt.toISOString().slice(0, 10) : ""} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Owner (email)</label>
              <input className="input" type="email" name="ownerEmail" defaultValue={contact.ownerEmail || ""} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>General notes</label>
              <textarea className="textarea" name="notes" rows={4} defaultValue={contact.notes || ""} />
            </div>
            <div className="flex justify-end">
              <button className="btn btn-secondary" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="p-4 border-b font-medium" style={{ borderColor: "var(--border)" }}>Call history</div>
        {contact.calls.length === 0 ? (
          <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>No calls logged yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Outcome</th>
                <th>By</th>
                <th>Next</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {contact.calls.map((c) => (
                <tr key={c.id}>
                  <td>{fmtDateTime(c.calledAt)}</td>
                  <td><span className="badge">{c.outcome.replace(/_/g, " ")}</span></td>
                  <td>{c.calledBy || "—"}</td>
                  <td>{fmtDate(c.nextCallAt)}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{c.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contact.description && (
        <div className="panel p-6">
          <div className="font-medium mb-3">About</div>
          <p className="leading-relaxed whitespace-pre-line" style={{ fontSize: 15, maxWidth: "75ch" }}>
            {contact.description}
          </p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-right" style={{ maxWidth: "60%", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
