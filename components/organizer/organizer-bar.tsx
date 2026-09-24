import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LockIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { SignOutButton } from "./sign-out-button";

/** Thin strip under the site header on every signed-in organizer page. */
export function OrganizerBar({ name, demo }: { name: string; demo: boolean }) {
  return (
    <div className="border-b border-line bg-ink-950">
      <Container className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5">
        <div className="flex items-center gap-3">
          <Link
            href="/organizers"
            className="mono-label inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xs text-paper hover:text-accent sm:min-h-8"
          >
            <LockIcon className="size-3.5 text-accent" />
            Organizer view
          </Link>
          <span aria-hidden className="h-3 w-px bg-line-strong max-sm:hidden" />
          <span className="mono-label text-paper-subtle max-sm:hidden">Private</span>
          {demo ? (
            <Badge tone="info" line="dashed" title="Demo slots and mentors are loaded (SHOW_DEMO_CONTENT=true)">
              Demo<span className="max-sm:hidden"> content on</span>
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-paper-subtle">
            Signed in as <span className="text-paper">{name}</span>
          </span>
          <SignOutButton className="-mr-2" />
        </div>
      </Container>
    </div>
  );
}
