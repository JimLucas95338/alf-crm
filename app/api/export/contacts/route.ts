import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactsWhere, filtersFromSearchParams } from "@/lib/filters";
import { csvHeader, csvRow } from "@/lib/csv";
import { CONTACT_HEADERS, mapStatus } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const filters = filtersFromSearchParams(url.searchParams);
  const onlyPrimary = url.searchParams.get("primaryOnly") === "1";
  const where = contactsWhere(filters);

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { companyName: "asc" },
    include: {
      executives: {
        where: onlyPrimary ? { isPrimary: true } : undefined,
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
  });

  let body = csvHeader(CONTACT_HEADERS);
  for (const c of contacts) {
    const { lifecyclestage, hs_lead_status } = mapStatus(c.status);
    for (const e of c.executives) {
      if (!e.firstName && !e.lastName) continue;
      body += csvRow([
        e.firstName,
        e.lastName,
        e.title,
        c.phone,
        c.companyName,
        lifecyclestage,
        hs_lead_status,
      ]);
    }
  }

  const filename = `hubspot_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
