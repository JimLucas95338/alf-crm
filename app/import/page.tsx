import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function clean(s: unknown): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t ? t : null;
}
function formatPhone(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw);
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return s.trim() || null;
}

async function importAction(formData: FormData): Promise<void> {
  "use server";
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") redirect("/import?error=No+file");
  const text = await (file as File).text();
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }) as Record<string, string>[];

  let created = 0;
  let skipped = 0;
  let execs = 0;

  for (const r of rows) {
    const company = clean(r["Company Name"]);
    if (!company) { skipped++; continue; }

    const existing = await prisma.contact.findFirst({
      where: {
        companyName: company,
        city: clean(r["City"]) ?? undefined,
        state: clean(r["State"]) ?? undefined,
      },
    });
    if (existing) { skipped++; continue; }

    const contact = await prisma.contact.create({
      data: {
        companyName: company,
        parentCompanyName: clean(r["Parent Company Name"]),
        legalName: clean(r["Legal Name"]),
        address: clean(r["Address"]),
        city: clean(r["City"]),
        state: clean(r["State"]),
        zip: clean(r["ZIP Code"]),
        phone: formatPhone(r["Phone Number"]),
        website: clean(r["Website"]),
        description: clean(r["Company Description"]),
        metroArea: clean(r["Metro Area"]),
        naicsCode: clean(r["Primary NAICS"]),
        naicsDescription: clean(r["Primary NAICS Description"]),
        employeeCount: clean(r["Location Employee Size Actual"]),
        recordType: clean(r["Record Type"]),
        insuranceExpenses: clean(r["Insurance Expenses"]),
        linkedIn: clean(r["Linked-In"]),
        facebook: clean(r["Facebook"]),
        propertyOwner: clean(r["Property Owner"]),
        status: "new",
      },
    });
    created++;

    const pf = clean(r["Executive First Name"]);
    const pl = clean(r["Executive Last Name"]);
    const pt = clean(r["Executive Title"]) || clean(r["Professional Title"]);
    if (pf || pl) {
      await prisma.executive.create({ data: { contactId: contact.id, firstName: pf, lastName: pl, title: pt, isPrimary: true } });
      execs++;
    }
    for (let i = 1; i <= 5; i++) {
      const f = clean(r[`Executive First Name ${i}`]);
      const l = clean(r[`Executive Last Name ${i}`]);
      const t = clean(r[`Executive Title ${i}`]);
      if (!f && !l) continue;
      if (f === pf && l === pl && t === pt) continue;
      await prisma.executive.create({ data: { contactId: contact.id, firstName: f, lastName: l, title: t } });
      execs++;
    }
  }
  redirect(`/import?created=${created}&skipped=${skipped}&execs=${execs}`);
}

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ created?: string; skipped?: string; execs?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Import contacts</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Upload a CSV with the standard headers (Company Name, City, State, Phone Number, Executive First/Last Name, etc.).
        Duplicates are skipped based on company + city + state.
      </p>
      {sp.created && (
        <div className="panel p-4 text-sm">
          Imported <strong>{sp.created}</strong> contacts · <strong>{sp.execs}</strong> executives · skipped <strong>{sp.skipped}</strong> duplicates.
        </div>
      )}
      {sp.error && <div className="panel p-4 text-sm" style={{ color: "var(--danger)" }}>{sp.error}</div>}
      <form action={importAction} className="panel p-4 space-y-3" encType="multipart/form-data">
        <input className="input" type="file" name="file" accept=".csv,text/csv" required />
        <div className="flex justify-end">
          <button className="btn" type="submit">Upload</button>
        </div>
      </form>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Tip: for initial bulk loading from the filesystem, run <code>npm run import</code> from the project directory.
      </p>
    </div>
  );
}
