/**
 * Where to send an organizer after sign-in. Only organizer pages are allowed, so `?next=`
 * can't be used as an open redirect. Pure — safe anywhere.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "/organizers";
  if (!/^\/organizers(?:[/?]|$)/.test(value) || value.startsWith("//") || value.includes("\\")) return "/organizers";
  if (value.startsWith("/organizers/login")) return "/organizers";
  return value;
}
