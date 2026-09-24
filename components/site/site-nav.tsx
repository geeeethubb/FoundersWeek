"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Office Hours (primary) and Calendar. The calendar lives at /schedule (/calendar redirects). */
const NAV_ITEMS = [
  { href: "/office-hours", label: "Office Hours" },
  { href: "/schedule", label: "Calendar" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-sm px-3 text-[0.9375rem] font-medium transition-colors duration-150",
                active ? "bg-surface-muted text-text" : "text-text-muted hover:bg-surface-subtle hover:text-text",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The one prominent "Apply" button. Accessible name is the full CTA at every width. */
export function ApplyNavButton({ className }: { className?: string }) {
  return (
    <Link
      href="/office-hours#apply"
      className={cn(
        "inline-flex h-11 items-center rounded-sm bg-accent px-4 text-[0.9375rem] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent-hover",
        className,
      )}
    >
      Apply<span className="sr-only"> for Office Hours</span>
    </Link>
  );
}
