import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactsWhere, filtersFromSearchParams } from "@/lib/filters";
import { csvHeader, csvRow } from "@/lib/csv";
import { COMPANY_HEADERS, mapStatus, toDomain } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const filters = filtersFromSearchParams(req.nextUrl.searchParams);
  const where = contactsWhere(filters);

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { companyName: "asc" },
    include: { _count: { select: { calls: true } } },
  });

  let body = csvHeader(COMPANY_HEADERS);
  for (const c of contacts) {
    const { lifecyclestage, hs_lead_status } = mapStatus(c.status);
    body += csvRow([
      c.companyName,
      toDomain(c.website),
      c.phone,
      c.address,
      c.city,
      c.state,
      c.zip,
      "United States",
      c.website,
      c.description,
      c.naicsDescription,
      c.employeeCount ? Number(c.employeeCount) || c.employeeCount : "",
      lifecyclestage,
      hs_lead_status,
      c.lastCallAt,
      c.nextCallAt,
      c._count.calls,
      c.ownerEmail,
      c.notes,
    ]);
  }

  const filename = `hubspot_companies_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
