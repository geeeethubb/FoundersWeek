import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/organizer/login-form";
import { SetupChecklist, SignInUnavailable, signInBlockers } from "@/components/organizer/setup-checklist";
import { AlertIcon, LockIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { isNonProductionDeploy } from "@/lib/config";
import { getPersistenceStatus } from "@/lib/db/client";
import { redactDatabaseDetail } from "@/lib/organizer/data-store";
import { getOrganizerPageSession } from "@/lib/organizer/page-auth";
import { safeReturnPath } from "@/lib/organizer/paths";
import { getSetupStatus } from "@/lib/setup-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTES = [
  "Applicant answers are private. Only open this view on devices you trust.",
  "Sessions last 12 hours. Changing the organizer password signs everyone out.",
  "Every status change and appointment is logged under your name.",
];

export default async function OrganizerLoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const next = safeReturnPath(typeof sp.next === "string" ? sp.next : null);
  if (await getOrganizerPageSession()) redirect(next);

  // Non-secret readiness (setting names, ok/not ok, fixes) — the same data as GET /api/health.
  const setup = await getSetupStatus();
  const blockers = signInBlockers(setup);

  return (
    <Container className="pt-12 pb-20 md:pt-16 md:pb-24">
      {/* Phones: intro → sign-in → notes → setup, so the form is reachable without scrolling.
          Desktop: intro, notes and setup on the left; the sign-in card on the right. */}
      <div className="grid gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <header className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-text-muted">
            <LockIcon className="size-3.5" />
            Founders Week organizers
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-text sm:text-5xl">Organizer sign-in</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-text-muted">
            Review office-hours applications, propose times and keep each student’s status up to date.
          </p>
        </header>

        <section
          aria-labelledby="signin-heading"
          className="self-start rounded-md border border-line bg-surface p-6 shadow-sm sm:p-8 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
        >
          <h2 id="signin-heading" className="text-xl font-semibold text-text">
            Sign in
          </h2>
          <div className="mt-6">
            {blockers.length ? <SignInUnavailable blockers={blockers} /> : <SignInBody next={next} />}
          </div>
        </section>

        <div className="space-y-8 self-start lg:col-span-6 lg:row-start-2">
          <ul className="max-w-xl divide-y divide-line border-y border-line text-sm leading-relaxed text-text-muted">
            {NOTES.map((note) => (
              <li key={note} className="py-3">
                {note}
              </li>
            ))}
          </ul>
          <SetupChecklist status={setup} className="max-w-xl" />
        </div>
      </div>
    </Container>
  );
}

async function SignInBody({ next }: { next: string }) {
  // Sign-in limits password attempts in the database, so it needs the database too.
  const persistence = await getPersistenceStatus();
  if (!persistence.ready) {
    return (
      <div role="status" className="rounded-md bg-danger-soft px-4 py-4 text-sm leading-relaxed">
        <p className="flex items-center gap-2 font-semibold text-text">
          <AlertIcon className="size-4 shrink-0 text-danger" />
          The application database isn’t ready
        </p>
        <p className="mt-1.5 text-text-muted">
          Sign-in needs the database (it’s used to limit password attempts), and you can’t review applications
          until it’s connected.{" "}
          <a href="#setup" className="font-medium text-text underline underline-offset-4">
            See Setup for the fix
          </a>
          .
        </p>
        {isNonProductionDeploy() ? (
          <p className="mt-2 break-words text-xs text-text-subtle">{redactDatabaseDetail(persistence.detail)}</p>
        ) : null}
      </div>
    );
  }
  return <LoginForm next={next} />;
}
