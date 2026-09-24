/**
 * Server-side session checks for organizer pages (server components). Every page under
 * /organizers (except the login page) calls `requireOrganizerPage()` before reading data.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSecret } from "@/lib/config";
import { safeReturnPath } from "./paths";
import { getSessionFromCookieValue, SESSION_COOKIE, type OrganizerSession } from "./session";

export async function getOrganizerPageSession(): Promise<OrganizerSession | null> {
  // Without a signing secret no session can be verified (production refuses the dev fallback):
  // treat everyone as signed out so the sign-in page can explain the missing setting.
  if (!getAppSecret()) return null;
  const store = await cookies();
  return getSessionFromCookieValue(store.get(SESSION_COOKIE)?.value);
}

/** Redirects to the login page (remembering where to come back to) when not signed in. */
export async function requireOrganizerPage(returnTo: string = "/organizers"): Promise<OrganizerSession> {
  const session = await getOrganizerPageSession();
  if (!session) {
    const next = safeReturnPath(returnTo);
    redirect(next === "/organizers" ? "/organizers/login" : `/organizers/login?next=${encodeURIComponent(next)}`);
  }
  return session;
}
