import { cookies } from "next/headers";

export const SESSION_COOKIE = "alf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set and at least 16 characters");
  }
  return s;
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(sig);
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function makeSessionToken(email: string): Promise<string> {
  const issued = Date.now().toString();
  const payload = `${email}:${issued}`;
  const sig = await hmac(payload);
  return `${b64urlEncode(payload)}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<{ email: string; issuedAt: number } | null> {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = b64urlDecode(payloadB64);
    const expected = await hmac(payload);
    if (!timingSafeEqual(fromHex(sig), fromHex(expected))) return null;
    const [email, issued] = payload.split(":");
    const issuedAt = Number(issued);
    if (!email || !issuedAt) return null;
    if (Date.now() - issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return { email, issuedAt };
  } catch {
    return null;
  }
}

export function checkTeamPassword(password: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) return false;
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(expected);
  return timingSafeEqual(a, b);
}

export async function currentUser(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { email: session.email };
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
