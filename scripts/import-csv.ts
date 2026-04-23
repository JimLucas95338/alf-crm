import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

function formatPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw.trim() || null;
}

function clean(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t ? t : null;
}

async function importFile(path: string) {
  console.log(`\nReading ${path}`);
  const text = readFileSync(path, "utf8");
  const rows: Row[] = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  console.log(`  ${rows.length} rows`);

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

    // Primary exec
    const primaryFirst = clean(r["Executive First Name"]);
    const primaryLast = clean(r["Executive Last Name"]);
    const primaryTitle = clean(r["Executive Title"]) || clean(r["Professional Title"]);
    if (primaryFirst || primaryLast) {
      await prisma.executive.create({
        data: {
          contactId: contact.id,
          firstName: primaryFirst,
          lastName: primaryLast,
          title: primaryTitle,
          isPrimary: true,
        },
      });
      execs++;
    }

    // Numbered execs 1..5
    for (let i = 1; i <= 5; i++) {
      const f = clean(r[`Executive First Name ${i}`]);
      const l = clean(r[`Executive Last Name ${i}`]);
      const t = clean(r[`Executive Title ${i}`]);
      if (!f && !l) continue;
      // Skip duplicates of primary
      if (f === primaryFirst && l === primaryLast && t === primaryTitle) continue;
      await prisma.executive.create({
        data: { contactId: contact.id, firstName: f, lastName: l, title: t },
      });
      execs++;
    }
  }

  console.log(`  created ${created} contacts · ${execs} executives · skipped ${skipped}`);
  return { created, skipped, execs };
}

async function main() {
  const dir = process.argv[2] || "/Users/jimlucas/Downloads/alfcontacts";
  const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === ".csv");
  if (files.length === 0) {
    console.error(`No CSV files in ${dir}`);
    process.exit(1);
  }
  let totals = { created: 0, skipped: 0, execs: 0 };
  for (const f of files) {
    const r = await importFile(join(dir, f));
    totals.created += r.created;
    totals.skipped += r.skipped;
    totals.execs += r.execs;
  }
  console.log(`\nDone. Contacts created: ${totals.created} · Executives: ${totals.execs} · Skipped: ${totals.skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
