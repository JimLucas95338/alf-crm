import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ALF CRM",
  description: "Cold-call CRM for assisted living facility outreach",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const loggedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);

  return (
    <html lang="en">
      <body>
        {loggedIn && (
          <nav className="border-b" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <div className="max-w-[1600px] mx-auto flex items-center gap-6 px-6 py-3">
              <Link href="/" className="font-semibold">ALF CRM</Link>
              <Link href="/" className="text-sm">Dashboard</Link>
              <Link href="/queue" className="text-sm">Queue</Link>
              <Link href="/contacts" className="text-sm">Contacts</Link>
              <Link href="/import" className="text-sm">Import</Link>
              <Link href="/export" className="text-sm">Export</Link>
              <form action="/api/logout" method="post" className="ml-auto">
                <button className="text-sm" style={{ color: "var(--muted)" }}>Logout</button>
              </form>
            </div>
          </nav>
        )}
        <main className="max-w-[1600px] mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
