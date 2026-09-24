import { redirect } from "next/navigation";
import { APPLY_ANCHOR, APPLY_PATH } from "@/lib/schedule/entries";

/**
 * The application now lives on the Office Hours page (/office-hours#apply). Old /apply links —
 * including prefilled ones like /apply?mentor=ron-lewis — land there with their preferences kept.
 * (Applicant status pages stay at /apply/status/[token].)
 */
export default async function ApplyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ["mentor", "window", "slot"]) {
    const value = params[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v) q.set(key, v);
  }
  const qs = q.toString();
  redirect(`${APPLY_PATH}${qs ? `?${qs}` : ""}#${APPLY_ANCHOR}`);
}
