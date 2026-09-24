"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Site priority: 1. Office Hours (primary experience) · 2. Calendar. The calendar lives at
 * /schedule (/calendar redirects there).
 */
const NAV_ITEMS = [
  { href: "/", label: "Home", mobileOnly: true, primary: false },
  { href: "/office-hours", label: "Office Hours", mobileOnly: false, primary: true },
  { href: "/schedule", label: "Calendar", mobileOnly: false, primary: false },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation links with an orange underline for the active page. */
export function SiteNav({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname() ?? "/";
  const items = NAV_ITEMS.filter((i) => variant === "mobile" || !i.mobileOnly);
  return (
    <ul className={cn("flex items-stretch", variant === "desktop" ? "h-full gap-7" : "h-11 gap-6")}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href} className="flex">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 text-[0.9375rem] transition-colors duration-150",
                item.primary && "font-semibold",
                active ? "text-paper" : item.primary ? "text-paper hover:text-accent" : "text-paper-muted hover:text-paper",
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:transition-transform after:duration-200",
                active ? "after:scale-x-100" : "after:scale-x-0",
              )}
            >
              {item.primary ? <span aria-hidden className="size-1.5 rotate-45 bg-accent" /> : null}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** "Apply for Office Hours" — the primary sitewide call to action. */
export function ApplyNavButton({ className }: { className?: string }) {
  return (
    <Link
      href="/office-hours#apply"
      className={cn(
        "inline-flex h-9 items-center rounded-sm bg-accent px-3.5 text-sm font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent-hover",
        className,
      )}
    >
      {/* Short visible label on phones; the accessible name is always the full CTA. */}
      <span className="md:hidden">
        Apply<span className="sr-only"> for Office Hours</span>
      </span>
      <span className="hidden md:inline">Apply for Office Hours</span>
    </Link>
  );
}
