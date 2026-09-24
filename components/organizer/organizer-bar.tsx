import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LockIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { SignOutButton } from "./sign-out-button";

/** Quiet strip under the site header on every signed-in organizer page. */
export function OrganizerBar({ name, demo }: { name: string; demo: boolean }) {
  return (
    <div className="border-b border-line bg-surface-subtle">
      <Container className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-0.5 py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/organizers"
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xs text-sm font-semibold text-text underline-offset-4 hover:underline sm:min-h-9"
          >
            <LockIcon className="size-3.5 text-text-muted" />
            Organizer view
          </Link>
          {demo ? (
            <Badge tone="info" title="Demo slots and mentors are loaded (SHOW_DEMO_CONTENT=true)">
              Demo content
            </Badge>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="min-w-0 truncate text-text-muted">
            Signed in as <span className="font-medium text-text">{name}</span>
          </span>
          <SignOutButton className="-mr-2" />
        </div>
      </Container>
    </div>
  );
}
