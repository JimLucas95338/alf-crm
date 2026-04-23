import Link from "next/link";
import { prisma } from "@/lib/db";
import { endOfToday, startOfToday, addDays, fmtDate, relativeDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

async function getStats() {
  const now = new Date();
  const today = startOfToday();
  const endToday = endOfToday();
  const endWeek = addDays(endToday, 7);

  const [dueToday, overdue, neverCalled, thisWeek, total, byStatus] = await Promise.all([
    prisma.contact.findMany({
      where: { nextCallAt: { gte: today, lte: endToday } },
      orderBy: { nextCallAt: "asc" },
      take: 50,
    }),
    prisma.contact.findMany({
      where: { nextCallAt: { lt: today } },
      orderBy: { nextCallAt: "asc" },
      take: 50,
    }),
    prisma.contact.count({ where: { lastCallAt: null, status: { notIn: ["do_not_call"] } } }),
    prisma.contact.count({ where: { nextCallAt: { gte: now, lte: endWeek } } }),
    prisma.contact.count(),
    prisma.contact.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return { dueToday, overdue, neverCalled, thisWeek, total, byStatus };
}

export default async function Dashboard() {
  const { dueToday, overdue, neverCalled, thisWeek, total, byStatus } = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {total} contacts total. {byStatus.map((s) => `${s.status}: ${s._count._all}`).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Due today" value={dueToday.length} href="/contacts?due=today" />
        <StatCard label="Overdue" value={overdue.length} href="/contacts?due=overdue" danger />
        <StatCard label="Never called" value={neverCalled} href="/contacts?called=never" />
        <StatCard label="Scheduled (7d)" value={thisWeek} href="/contacts?due=week" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ListPanel title="Due today" items={dueToday} emptyText="Nothing scheduled for today" />
        <ListPanel title="Overdue" items={overdue} emptyText="No overdue calls" danger />
      </div>
    </div>
  );
}

function StatCard({ label, value, href, danger }: { label: string; value: number; href: string; danger?: boolean }) {
  return (
    <Link href={href} className="panel p-4 block hover:opacity-90">
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-3xl font-semibold mt-1" style={{ color: danger && value > 0 ? "var(--danger)" : undefined }}>{value}</div>
    </Link>
  );
}

function ListPanel({
  title,
  items,
  emptyText,
  danger,
}: {
  title: string;
  items: { id: number; companyName: string; city: string | null; state: string | null; phone: string | null; nextCallAt: Date | null }[];
  emptyText: string;
  danger?: boolean;
}) {
  return (
    <div className="panel">
      <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="font-medium">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>{emptyText}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/contacts/${c.id}`}>{c.companyName}</Link></td>
                <td>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                <td>{c.phone || "—"}</td>
                <td style={{ color: danger ? "var(--danger)" : undefined }}>
                  {fmtDate(c.nextCallAt)} <span style={{ color: "var(--muted)" }}>({relativeDays(c.nextCallAt)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
