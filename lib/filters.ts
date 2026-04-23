import { Prisma } from "@prisma/client";
import { endOfToday, startOfToday, addDays, parseInputDate, endOfDay } from "@/lib/dates";

export type ContactFilters = {
  q?: string;
  state?: string;
  status?: string;
  due?: string;
  called?: string;
  lastFrom?: string;
  lastTo?: string;
  nextFrom?: string;
  nextTo?: string;
};

export function contactsWhere(sp: ContactFilters): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {};
  const and: Prisma.ContactWhereInput[] = [];

  if (sp.q) {
    and.push({
      OR: [
        { companyName: { contains: sp.q } },
        { city: { contains: sp.q } },
        { phone: { contains: sp.q } },
        { executives: { some: { OR: [{ firstName: { contains: sp.q } }, { lastName: { contains: sp.q } }] } } },
      ],
    });
  }
  if (sp.state) and.push({ state: sp.state });
  if (sp.status) and.push({ status: sp.status });

  const today = startOfToday();
  const endToday = endOfToday();
  if (sp.due === "today") and.push({ nextCallAt: { gte: today, lte: endToday } });
  else if (sp.due === "overdue") and.push({ nextCallAt: { lt: today } });
  else if (sp.due === "week") and.push({ nextCallAt: { gte: new Date(), lte: addDays(endToday, 7) } });
  else if (sp.due === "month") and.push({ nextCallAt: { gte: new Date(), lte: addDays(endToday, 30) } });

  if (sp.called === "never") and.push({ lastCallAt: null });
  else if (sp.called === "called") and.push({ lastCallAt: { not: null } });

  const lastFrom = parseInputDate(sp.lastFrom);
  const lastTo = parseInputDate(sp.lastTo);
  if (lastFrom || lastTo) {
    const f: Prisma.DateTimeNullableFilter = {};
    if (lastFrom) f.gte = lastFrom;
    if (lastTo) f.lte = endOfDay(lastTo);
    and.push({ lastCallAt: f });
  }
  const nextFrom = parseInputDate(sp.nextFrom);
  const nextTo = parseInputDate(sp.nextTo);
  if (nextFrom || nextTo) {
    const f: Prisma.DateTimeNullableFilter = {};
    if (nextFrom) f.gte = nextFrom;
    if (nextTo) f.lte = endOfDay(nextTo);
    and.push({ nextCallAt: f });
  }

  if (and.length) where.AND = and;
  return where;
}

export function filtersFromSearchParams(sp: URLSearchParams): ContactFilters {
  const get = (k: string) => sp.get(k) || undefined;
  return {
    q: get("q"),
    state: get("state"),
    status: get("status"),
    due: get("due"),
    called: get("called"),
    lastFrom: get("lastFrom"),
    lastTo: get("lastTo"),
    nextFrom: get("nextFrom"),
    nextTo: get("nextTo"),
  };
}
