import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { startOfToday, fmtDate, relativeDays } from "@/lib/dates";
import { contactsWhere, type ContactFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "attempted", "contacted", "interested", "not_interested", "do_not_call"];
const DUE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due next 7 days" },
  { value: "month", label: "Due next 30 days" },
];
const CALLED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "never", label: "Never called" },
  { value: "called", label: "Has calls" },
];

type SP = ContactFilters & { page?: string; sort?: string };

async function getStates(): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    where: { state: { not: null } },
    distinct: ["state"],
    select: { state: true },
    orderBy: { state: "asc" },
  });
  return rows.map((r) => r.state!).filter(Boolean);
}

function orderBy(sort: string | undefined): Prisma.ContactOrderByWithRelationInput[] {
  switch (sort) {
    case "next": return [{ nextCallAt: { sort: "asc", nulls: "last" } }];
    case "last": return [{ lastCallAt: { sort: "desc", nulls: "last" } }];
    case "state": return [{ state: "asc" }, { companyName: "asc" }];
    case "status": return [{ status: "asc" }, { companyName: "asc" }];
    default: return [{ companyName: "asc" }];
  }
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where = contactsWhere(sp);
  const page = Math.max(1, Number(sp.page || "1"));
  const pageSize = 50;
  const [total, states, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    getStates(),
    prisma.contact.findMany({
      where,
      orderBy: orderBy(sp.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { executives: { where: { isPrimary: true }, take: 1 } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="text-sm" style={{ color: "var(--muted)" }}>{total.toLocaleString()} match{total === 1 ? "" : "es"}</div>
      </div>

      <form className="panel p-4 grid grid-cols-6 gap-3" method="get">
        <div className="col-span-2">
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Search</label>
          <input className="input" name="q" defaultValue={sp.q || ""} placeholder="company, city, phone, exec name" />
        </div>
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
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Due</label>
          <select className="select" name="due" defaultValue={sp.due || ""}>
            {DUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Called</label>
          <select className="select" name="called" defaultValue={sp.called || ""}>
            {CALLED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Last call from</label>
          <input className="input" type="date" name="lastFrom" defaultValue={sp.lastFrom || ""} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Last call to</label>
          <input className="input" type="date" name="lastTo" defaultValue={sp.lastTo || ""} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Next call from</label>
          <input className="input" type="date" name="nextFrom" defaultValue={sp.nextFrom || ""} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Next call to</label>
          <input className="input" type="date" name="nextTo" defaultValue={sp.nextTo || ""} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Sort</label>
          <select className="select" name="sort" defaultValue={sp.sort || ""}>
            <option value="">Company (A-Z)</option>
            <option value="next">Next call (soonest)</option>
            <option value="last">Last call (recent)</option>
            <option value="state">State</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn" type="submit">Filter</button>
          <Link href="/contacts" className="btn btn-secondary">Reset</Link>
        </div>
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Primary Contact</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Last call</th>
                <th>Next call</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr><td colSpan={7} className="text-center" style={{ color: "var(--muted)" }}>No contacts match these filters.</td></tr>
              )}
              {contacts.map((c) => {
                const exec = c.executives[0];
                const overdue = c.nextCallAt && c.nextCallAt < startOfToday();
                return (
                  <tr key={c.id}>
                    <td><Link href={`/contacts/${c.id}`}>{c.companyName}</Link></td>
                    <td>{exec ? `${exec.firstName || ""} ${exec.lastName || ""}${exec.title ? ` · ${exec.title}` : ""}`.trim() : "—"}</td>
                    <td>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td><span className="badge">{c.status.replace(/_/g, " ")}</span></td>
                    <td>{c.lastCallAt ? `${fmtDate(c.lastCallAt)} · ${relativeDays(c.lastCallAt)}` : "—"}</td>
                    <td style={{ color: overdue ? "var(--danger)" : undefined }}>
                      {c.nextCallAt ? `${fmtDate(c.nextCallAt)} · ${relativeDays(c.nextCallAt)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pages={pages} sp={sp} />
    </div>
  );
}

function Pagination({ page, pages, sp }: { page: number; pages: number; sp: SP }) {
  if (pages <= 1) return null;
  const qs = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") params.set(k, String(v));
    params.set("page", String(p));
    return `?${params.toString()}`;
  };
  return (
    <div className="flex justify-center gap-2">
      {page > 1 && <Link className="btn btn-secondary" href={qs(page - 1)}>Previous</Link>}
      <span className="text-sm self-center" style={{ color: "var(--muted)" }}>Page {page} of {pages}</span>
      {page < pages && <Link className="btn btn-secondary" href={qs(page + 1)}>Next</Link>}
    </div>
  );
}
