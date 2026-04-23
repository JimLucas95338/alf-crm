import { NextRequest, NextResponse } from "next/server";
import { checkTeamPassword, makeSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.redirect(new URL(`/login?error=Invalid+email&next=${encodeURIComponent(next)}`, req.url));
  }
  if (!checkTeamPassword(password)) {
    return NextResponse.redirect(new URL(`/login?error=Wrong+password&next=${encodeURIComponent(next)}`, req.url));
  }

  const token = await makeSessionToken(email);
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
