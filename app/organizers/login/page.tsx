import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/organizer/login-form";
import { LockIcon } from "@/components/ui/icons";
import { Container, Eyebrow, Notice } from "@/components/ui/primitives";
import { getOrganizerPassword, isNonProductionDeploy } from "@/lib/config";
import { getPersistenceStatus, type PersistenceStatus } from "@/lib/db/client";
import { redactSecrets } from "@/lib/organizer/data-store-view";
import { getOrganizerPageSession } from "@/lib/organizer/page-auth";
import { safeReturnPath } from "@/lib/organizer/paths";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizerLoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const next = safeReturnPath(typeof sp.next === "string" ? sp.next : null);
  if (await getOrganizerPageSession()) redirect(next);

  const passwordConfigured = Boolean(getOrganizerPassword());
  const persistence = passwordConfigured ? await getPersistenceStatus() : null;
  const showSetupHints = isNonProductionDeploy();

  return (
    <Container className="pt-10 pb-16 md:pt-16 md:pb-24">
      {/* Phones: heading → form → notes, so the form is reachable without scrolling past the notes.
          Desktop: heading and notes on the left, the form spanning both rows on the right. */}
      <div className="grid gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8">
        <header className="lg:col-span-6">
          <Eyebrow>
            <span className="inline-flex items-center gap-2">
              <LockIcon className="size-3.5" />
              Organizers · Private
            </span>
          </Eyebrow>
          <h1 className="mt-5 font-wide text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-5xl md:text-6xl">
            Organizer sign-in
          </h1>
          <p className="mt-5 max-w-xl text-lg text-paper-muted">
            Review office-hours applications, assign appointment slots and keep every student’s status current.
          </p>
        </header>

        <section aria-labelledby="signin-heading" className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="rounded-sm border border-line-strong bg-ink-850 p-6 sm:p-8">
            <h2 id="signin-heading" className="mono-label text-paper-subtle">
              Sign in
            </h2>
            <div className="mt-6">
              <SignInBody
                next={next}
                passwordConfigured={passwordConfigured}
                persistence={persistence}
                showSetupHints={showSetupHints}
              />
            </div>
          </div>
        </section>

        <ul className="max-w-xl divide-y divide-line self-start border-y border-line text-sm text-paper-muted lg:col-span-6 lg:row-start-2">
          <li className="flex gap-4 py-3">
            <span className="mono-label w-6 shrink-0 pt-0.5 text-accent tabular">01</span>
            <span>Applicant answers are private. Only open this view on devices you trust.</span>
          </li>
          <li className="flex gap-4 py-3">
            <span className="mono-label w-6 shrink-0 pt-0.5 text-accent tabular">02</span>
            <span>Sessions last 12 hours. Changing the organizer password signs everyone out.</span>
          </li>
          <li className="flex gap-4 py-3">
            <span className="mono-label w-6 shrink-0 pt-0.5 text-accent tabular">03</span>
            <span>Every status change and appointment is recorded with your name.</span>
          </li>
        </ul>
      </div>
    </Container>
  );
}

function SignInBody({
  next,
  passwordConfigured,
  persistence,
  showSetupHints,
}: {
  next: string;
  passwordConfigured: boolean;
  persistence: PersistenceStatus | null;
  showSetupHints: boolean;
}) {
  if (!passwordConfigured) {
    return (
      <Notice tone="warning" title="Organizer sign-in is disabled">
        <p>No organizer password is configured for this deployment, so the organizer view is locked for everyone.</p>
        {showSetupHints ? (
          <p className="mt-2">
            Set <code className="font-mono text-paper">ORGANIZER_PASSWORD</code> (12+ characters) in the environment
            and restart the server. See README → Configuration.
          </p>
        ) : null}
      </Notice>
    );
  }
  if (persistence && !persistence.ready) {
    return (
      <Notice tone="danger" title="The application database isn’t ready">
        <p>
          Sign-in needs the database (it limits password attempts), and applications can’t be reviewed until it’s
          available.
        </p>
        {showSetupHints ? (
          <p className="mt-2 font-mono text-xs text-paper-muted">{redactSecrets(persistence.detail)} See README → Database.</p>
        ) : null}
      </Notice>
    );
  }
  return <LoginForm next={next} />;
}
