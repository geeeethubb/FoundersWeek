"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Method = "POST" | "PATCH" | "DELETE";

/**
 * Calls an organizer API, surfaces its error message inline, and refreshes server data on
 * success. A 401 (expired session) sends the organizer back to sign in, then here.
 */
export function useOrganizerRequest() {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();

  const send = useCallback(
    async (url: string, method: Method, body?: unknown): Promise<boolean> => {
      setError(null);
      setSending(true);
      try {
        const res = await fetch(url, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: "same-origin",
          cache: "no-store",
        });
        if (res.status === 401) {
          router.push(`/organizers/login?next=${encodeURIComponent(pathname ?? "/organizers")}`);
          return false;
        }
        const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || !data?.ok) {
          setError(data?.message ?? "Something went wrong. Try again.");
          return false;
        }
        startTransition(() => router.refresh());
        return true;
      } catch {
        setError("Couldn’t reach the server. Check your connection and try again.");
        return false;
      } finally {
        setSending(false);
      }
    },
    [pathname, router],
  );

  return { send, error, setError, pending: sending || refreshing };
}
