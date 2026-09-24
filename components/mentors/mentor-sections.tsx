/**
 * MentorSections — every mentor in full on /office-hours (under the lineup), as a "dossier":
 * always expanded, nothing collapsed or hidden behind a click.
 *
 * Props
 * - `mentors`: public Mentor records (from `getMentors()`), in display order.
 * - `appearances`: Founders Week sessions per mentor id (`appearancesByMentor()`).
 * - `applicationsOpen`: site.applications.open.
 * - `className`: extra classes for the list.
 *
 * Each section (`#mentor-<id>`):
 *   header — portrait, "01 / 04", name, verified role · organization, "Full profile", and the CTA
 *            (top right on desktop; closes the section on smaller screens);
 *   facts  — a spec-sheet grid: background (approved bio) · expertise with its basis ·
 *            approved "Ask me about"/"Useful for" (only when approved) · office hours (window vs.
 *            scheduling in progress, with notes) · Founders Week appearances (→ the calendar) ·
 *            session details ("To be confirmed" when unknown).
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { DemoBadge, DraftBadge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import {
  mentorCta,
  mentorProfileHref,
  mentorSectionId,
  visibleExpertise,
  visibleField,
  type AppearanceView,
} from "@/lib/mentors-view";
import { MentorCtaButton, PreselectNote } from "./mentor-cta";
import { AppearanceList, AvailabilityBlocks, ExpertiseList, SessionDetailsList } from "./mentor-profile";
import { TopicList } from "./topic-list";

/** One labeled block of the fact sheet: hairline on top, mono label, content. */
function Fact({
  label,
  badge,
  className,
  children,
}: {
  label: string;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 border-t border-line pt-4", className)}>
      <dt className="flex min-h-6 flex-wrap items-center gap-2">
        <span className="mono-label text-paper-subtle">{label}</span>
        {badge}
      </dt>
      <dd className="mt-4">{children}</dd>
    </div>
  );
}

/** Column spans for the bottom row (office hours · appearances · session) on desktop. */
const BOTTOM_SPAN: Record<number, string> = { 2: "lg:col-span-6", 3: "lg:col-span-4" };

function MentorDossier({
  mentor,
  index,
  total,
  appearances,
  applicationsOpen,
}: {
  mentor: Mentor;
  index: number;
  total: number;
  appearances: AppearanceView[];
  applicationsOpen: boolean;
}) {
  const id = mentorSectionId(mentor.id);
  const cta = mentorCta(mentor, { applicationsOpen });
  const bio = visibleField(mentor.bio);
  const expertise = visibleExpertise(mentor);
  const topics = visibleField(mentor.askMeAbout);
  const goodFit = visibleField(mentor.goodFitFor);
  const profileHref = mentorProfileHref(mentor.id);
  const pad = (n: number) => String(n).padStart(2, "0");
  const bottomCount = 2 + (appearances.length ? 1 : 0);

  const indexMark = (
    <p aria-hidden className="font-mono text-sm leading-none tabular">
      <span className="text-accent">{pad(index + 1)}</span>
      <span className="text-paper-subtle"> / {pad(total)}</span>
    </p>
  );

  const actions = (
    <div className="space-y-2.5">
      <MentorCtaButton cta={cta} size="lg" className="w-full" />
      <PreselectNote cta={cta} firstName={mentor.firstName} />
    </div>
  );

  return (
    <li id={id} className="scroll-mt-24 border-t border-line-strong py-10 md:py-16">
      <article aria-labelledby={`${id}-name`}>
        {/* ── Identity + CTA ─────────────────────────────────────────── */}
        <header className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:gap-7 lg:col-span-8">
            <div className="flex items-end gap-5">
              <Link href={profileHref} tabIndex={-1} aria-hidden className="block shrink-0 rounded-sm">
                <MentorPortrait
                  id={mentor.id}
                  name={mentor.name}
                  headshot={mentor.headshot}
                  size="md"
                  className="size-24 sm:size-32"
                />
              </Link>
              <div className="pb-1 sm:hidden">{indexMark}</div>
            </div>
            <div className="min-w-0">
              <div className="hidden sm:block">{indexMark}</div>
              <h3
                id={`${id}-name`}
                className="font-wide text-[1.75rem] font-bold leading-[1.02] tracking-[-0.03em] text-paper sm:mt-3.5 sm:text-4xl lg:text-[2.625rem]"
              >
                {mentor.name}
              </h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
                {mentor.role || mentor.company ? (
                  <p className="text-base leading-snug">
                    {mentor.role ? <span className="text-paper-muted">{mentor.role}</span> : null}
                    {mentor.role && mentor.company ? (
                      <>
                        <span aria-hidden className="px-2 text-paper-subtle">
                          ·
                        </span>
                        <span className="sr-only">, </span>
                      </>
                    ) : null}
                    {mentor.company ? <span className="text-paper">{mentor.company}</span> : null}
                  </p>
                ) : null}
                <Link
                  href={profileHref}
                  className="mono-label inline-flex h-11 items-center gap-1.5 rounded-xs text-paper-muted transition-colors duration-150 hover:text-paper"
                >
                  Full profile<span className="sr-only">: {mentor.name}</span>
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
              {mentor.demo ? <DemoBadge className="mt-2" /> : null}
            </div>
          </div>
          <div className="hidden lg:col-span-4 lg:block lg:pb-1">{actions}</div>
        </header>

        {/* ── Fact sheet ─────────────────────────────────────────────── */}
        <dl className="mt-8 grid gap-x-12 gap-y-8 md:mt-12 md:grid-cols-2 md:gap-y-10 lg:grid-cols-12">
          <Fact
            label="Background"
            badge={bio?.draft ? <DraftBadge /> : null}
            className={cn("md:col-span-2", expertise ? "lg:col-span-7" : "lg:col-span-12")}
          >
            {bio ? (
              <p className="max-w-[60ch] text-lg leading-relaxed text-paper">{bio.value}</p>
            ) : (
              <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-paper-muted">
                More background is added once it’s confirmed with {mentor.firstName}.
              </p>
            )}
          </Fact>

          {expertise ? (
            <Fact
              label="Expertise"
              badge={expertise.draft ? <DraftBadge /> : null}
              className="md:col-span-2 lg:col-span-5"
            >
              <ExpertiseList items={expertise.value} draft={expertise.draft} layout="stacked" />
            </Fact>
          ) : null}

          {topics ? (
            <Fact
              label="Ask me about"
              badge={topics.draft ? <DraftBadge /> : null}
              className={cn("md:col-span-2", goodFit ? "lg:col-span-6" : "lg:col-span-12")}
            >
              <TopicList topics={topics.value} draft={topics.draft} label={`Topics ${mentor.firstName} can help with`} />
            </Fact>
          ) : null}

          {goodFit ? (
            <Fact
              label="Useful for"
              badge={goodFit.draft ? <DraftBadge /> : null}
              className={cn("md:col-span-2", topics ? "lg:col-span-6" : "lg:col-span-12")}
            >
              <TopicList topics={goodFit.value} draft={goodFit.draft} label={`Who meeting ${mentor.firstName} suits`} />
            </Fact>
          ) : null}

          <Fact label="Office hours" className={BOTTOM_SPAN[bottomCount]}>
            <AvailabilityBlocks mentor={mentor} />
          </Fact>

          {appearances.length ? (
            <Fact label="At Founders Week" className={BOTTOM_SPAN[bottomCount]}>
              <AppearanceList appearances={appearances} />
            </Fact>
          ) : null}

          <Fact label="Session" className={BOTTOM_SPAN[bottomCount]}>
            <SessionDetailsList session={mentor.session} layout="grid" showNote={false} />
          </Fact>
        </dl>

        {/* Smaller screens: the CTA closes each section. */}
        <div className="mt-8 md:mt-10 lg:hidden">{actions}</div>
      </article>
    </li>
  );
}

export function MentorSections({
  mentors,
  appearances,
  applicationsOpen,
  className,
}: {
  mentors: Mentor[];
  appearances: Record<string, AppearanceView[]>;
  applicationsOpen: boolean;
  className?: string;
}) {
  if (mentors.length === 0) return null;
  return (
    <ol className={className}>
      {mentors.map((mentor, i) => (
        <MentorDossier
          key={mentor.id}
          mentor={mentor}
          index={i}
          total={mentors.length}
          appearances={appearances[mentor.id] ?? []}
          applicationsOpen={applicationsOpen}
        />
      ))}
    </ol>
  );
}
