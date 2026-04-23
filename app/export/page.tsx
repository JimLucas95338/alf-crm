import { prisma } from "@/lib/db";
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

type SP = ContactFilters & { primaryOnly?: string };

async function getStates(): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    where: { state: { not: null } },
    distinct: ["state"],
    select: { state: true },
    orderBy: { state: "asc" },
  });
  return rows.map((r) => r.state!).filter(Boolean);
}

function buildQuery(sp: SP, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, String(v));
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function ExportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where = contactsWhere(sp);
  const [states, companyCount, execCount] = await Promise.all([
    getStates(),
    prisma.contact.count({ where }),
    prisma.executive.count({
      where: {
        contact: where,
        ...(sp.primaryOnly === "1" ? { isPrimary: true } : {}),
        OR: [{ firstName: { not: null } }, { lastName: { not: null } }],
      },
    }),
  ]);

  const companiesHref = `/api/export/companies${buildQuery(sp)}`;
  const contactsHref = `/api/export/contacts${buildQuery(sp)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Export to HubSpot</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Filter the set you want, then download the Companies CSV and Contacts CSV. Import Companies into HubSpot first so Contacts can link by company name.
        </p>
      </div>

      <form className="panel p-4 grid grid-cols-4 gap-3" method="get">
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
        <div className="col-span-3 flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="primaryOnly" value="1" defaultChecked={sp.primaryOnly === "1"} />
            Contacts CSV: primary executive only (skip additional execs)
          </label>
        </div>
        <div className="flex items-end justify-end">
          <button className="btn" type="submit">Apply filters</button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel p-4 space-y-2">
          <div className="text-xs" style={{ color: "var(--muted)" }}>Companies</div>
          <div className="text-3xl font-semibold">{companyCount.toLocaleString()}</div>
          <a className="btn inline-block mt-2" href={companiesHref}>Download companies CSV</a>
        </div>
        <div className="panel p-4 space-y-2">
          <div className="text-xs" style={{ color: "var(--muted)" }}>Contacts (executives)</div>
          <div className="text-3xl font-semibold">{execCount.toLocaleString()}</div>
          <a className="btn inline-block mt-2" href={contactsHref}>Download contacts CSV</a>
        </div>
      </div>

      <div className="panel p-4 text-sm space-y-2">
        <div className="font-medium">HubSpot setup (one-time)</div>
        <p style={{ color: "var(--muted)" }}>Before your first import, create these custom company properties in HubSpot → Settings → Properties → Company:</p>
        <ul className="list-disc pl-5" style={{ color: "var(--muted)" }}>
          <li><code>alf_last_call_date</code> — Date picker</li>
          <li><code>alf_next_call_date</code> — Date picker</li>
          <li><code>alf_call_count</code> — Number</li>
          <li><code>alf_owner_email</code> — Single-line text</li>
          <li><code>alf_notes</code> — Multi-line text</li>
        </ul>
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          Import order: <strong>Companies first</strong>, then Contacts. In the HubSpot import wizard, use "One file with multiple objects" = No, pick "Companies" for the first file and "Contacts" for the second. HubSpot will auto-associate contacts to companies by the <code>company</code> column.
        </p>
      </div>
    </div>
  );
}
