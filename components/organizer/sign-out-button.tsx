"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/organizer/session", { method: "DELETE", credentials: "same-origin" });
        } finally {
          router.replace("/organizers/login");
          router.refresh();
        }
      }}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xs px-2 text-sm text-paper-muted underline-offset-4 transition-colors duration-150 hover:text-paper hover:underline disabled:opacity-60 sm:min-h-8",
        className,
      )}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
