import { afterEach, describe, expect, it, vi } from "vitest";
import { safeReturnPath } from "@/lib/organizer/paths";
import {
  checkOrganizerPassword,
  clearSessionCookieHeader,
  createSessionToken,
  passwordVersion,
  readCookie,
  SESSION_TTL_SECONDS,
  sessionCookieHeader,
  verifySessionToken,
} from "@/lib/organizer/session";
import { sign } from "@/lib/security/crypto";

const PASSWORD = "correct-horse-battery-staple";
const NOW = new Date("2026-09-30T15:00:00Z");

afterEach(() => {
  vi.unstubAllEnvs();
});

function forge(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign("organizer-session:v1", encoded)}`;
}

describe("organizer session tokens", () => {
  it("round-trips a valid session", () => {
    const token = createSessionToken({ name: "Alex Organizer", password: PASSWORD, now: NOW });
    const session = verifySessionToken(token, { password: PASSWORD, now: NOW });
    expect(session).toMatchObject({ v: 1, name: "Alex Organizer", pwv: passwordVersion(PASSWORD) });
    expect(session!.exp - session!.iat).toBe(SESSION_TTL_SECONDS);
  });

  it("expires after 12 hours", () => {
    const token = createSessionToken({ name: "A", password: PASSWORD, now: NOW });
    const almost = new Date(NOW.getTime() + (SESSION_TTL_SECONDS - 1) * 1000);
    const after = new Date(NOW.getTime() + SESSION_TTL_SECONDS * 1000);
    expect(verifySessionToken(token, { password: PASSWORD, now: almost })).not.toBeNull();
    expect(verifySessionToken(token, { password: PASSWORD, now: after })).toBeNull();
  });

  it("rejects tampered payloads and signatures", () => {
    const token = createSessionToken({ name: "A", password: PASSWORD, now: NOW });
    const [payload, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, name: "Mallory", exp: decoded.exp + 999999 }))
      .toString("base64url");
    expect(verifySessionToken(`${tamperedPayload}.${sig}`, { password: PASSWORD, now: NOW })).toBeNull();
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifySessionToken(`${payload}.${flipped}`, { password: PASSWORD, now: NOW })).toBeNull();
    expect(verifySessionToken(payload, { password: PASSWORD, now: NOW })).toBeNull();
    expect(verifySessionToken("", { password: PASSWORD, now: NOW })).toBeNull();
    expect(verifySessionToken("garbage.token", { password: PASSWORD, now: NOW })).toBeNull();
  });

  it("is invalidated by rotating the organizer password", () => {
    const token = createSessionToken({ name: "A", password: PASSWORD, now: NOW });
    expect(verifySessionToken(token, { password: "a-brand-new-password-2026", now: NOW })).toBeNull();
    expect(verifySessionToken(token, { password: null, now: NOW })).toBeNull();
  });

  it("rejects wrong versions, overlong lifetimes and future-issued tokens even when signed", () => {
    const iat = Math.floor(NOW.getTime() / 1000);
    const base = { v: 1, name: "A", iat, exp: iat + 3600, pwv: passwordVersion(PASSWORD) };
    expect(verifySessionToken(forge(base), { password: PASSWORD, now: NOW })).not.toBeNull();
    expect(verifySessionToken(forge({ ...base, v: 2 }), { password: PASSWORD, now: NOW })).toBeNull();
    expect(
      verifySessionToken(forge({ ...base, exp: iat + SESSION_TTL_SECONDS * 10 }), { password: PASSWORD, now: NOW }),
    ).toBeNull();
    expect(
      verifySessionToken(forge({ ...base, iat: iat + 3600, exp: iat + 7200 }), { password: PASSWORD, now: NOW }),
    ).toBeNull();
    expect(verifySessionToken(forge({ ...base, name: "" }), { password: PASSWORD, now: NOW })).toBeNull();
  });

  it("compares passwords correctly", () => {
    expect(checkOrganizerPassword(PASSWORD, PASSWORD)).toBe(true);
    expect(checkOrganizerPassword(`${PASSWORD} `, PASSWORD)).toBe(false);
    expect(checkOrganizerPassword("", PASSWORD)).toBe(false);
  });
});

describe("organizer session cookie", () => {
  it("is httpOnly, SameSite=Strict, path / and 12h", () => {
    const header = sessionCookieHeader("abc.def");
    expect(header).toMatch(/^fw_organizer=abc\.def;/);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/");
    expect(header).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(header).not.toContain("Secure");
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });

  it("is Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieHeader("abc.def")).toContain("Secure");
    expect(clearSessionCookieHeader()).toContain("Secure");
  });

  it("reads cookies from a Cookie header", () => {
    expect(readCookie("a=1; fw_organizer=tok.en; b=2", "fw_organizer")).toBe("tok.en");
    expect(readCookie("xfw_organizer=nope", "fw_organizer")).toBeNull();
    expect(readCookie(null, "fw_organizer")).toBeNull();
  });
});

describe("post-login redirect", () => {
  it("only returns to organizer pages", () => {
    expect(safeReturnPath("/organizers/applications/abc")).toBe("/organizers/applications/abc");
    expect(safeReturnPath("/organizers?status=selected")).toBe("/organizers?status=selected");
    expect(safeReturnPath("https://evil.example")).toBe("/organizers");
    expect(safeReturnPath("//evil.example/organizers")).toBe("/organizers");
    expect(safeReturnPath("/organizersevil")).toBe("/organizers");
    expect(safeReturnPath("/organizers/login")).toBe("/organizers");
    expect(safeReturnPath("/organizers\\..\\x")).toBe("/organizers");
    expect(safeReturnPath(null)).toBe("/organizers");
  });
});
