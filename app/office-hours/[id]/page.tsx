import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentor, getMentors, getScheduleEntries, getSite } from "@/content";
import {
  AppearanceList,
  isProse,
  LabelList,
  OfficeHoursLines,
  ProfileSection,
  TagList,
} from "@/components/mentors/mentor-profile";
import { DemoBadge, DraftBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import {
  applyToMeetLabel,
  availabilityLines,
  availabilityNote,
  mentorAction,
  mentorAppearanceViews,
  mentorMetaDescription,
  visibleExpertise,
  visibleField,
  type VisibleField,
} from "@/lib/mentors-view";

/**
 * A mentor’s profile: portrait, name, verified role and company, LinkedIn, office-hours line and the
 * Apply button up top; then the approved bio, what they can help with (labels only) and their
 * Founders Week appearances (→ calendar). Unknown mentor ids render ./not-found.tsx.
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams(): { id: string }[] {
  return getMentors().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const mentor = getMentor(id);
  if (!mentor) return { title: "Mentor not found" };
  const description = mentorMetaDescription(mentor);
  const title = `${mentor.name} · Office Hours`;
  return {
    title,
    description,
    alternates: { canonical: `/office-hours/${mentor.id}` },
    openGraph: { title: `Founders Office Hours with ${mentor.name}`, description, type: "profile" },
    twitter: { card: "summary_large_image", title: `Founders Office Hours with ${mentor.name}`, description },
  };
}

/** Draft badge (and the organizer's note) — only ever present in draft preview. */
function DraftMark({ field }: { field: VisibleField<unknown> | null }) {
  if (!field?.draft) return null;
  return <DraftBadge />;
}

function DraftNote({ field }: { field: VisibleField<unknown> | null }) {
  if (!field?.draft || !field.draftNote) return null;
  return <p className="mt-3 text-sm leading-relaxed text-warning">Draft note: {field.draftNote}</p>;
}

export default async function MentorProfilePage({ params }: PageProps) {
  const { id } = await params;
  const mentor = getMentor(id);
  if (!mentor) notFound();

  const site = getSite();
  const action = mentorAction(mentor, { applicationsOpen: site.applications.open });
  const applyLabel = applyToMeetLabel(mentor);
  const bio = visibleField(mentor.bio);
  const expertise = visibleExpertise(mentor);
  const topics = visibleField(mentor.askMeAbout);
  const goodFit = visibleField(mentor.goodFitFor);
  const appearances = mentorAppearanceViews(getScheduleEntries(), mentor.id);

  const applyAction = action.open ? (
    <ButtonLink href={action.href} size="lg" className="group/cta w-full sm:w-auto">
      {applyLabel}
      <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
    </ButtonLink>
  ) : (
    <p className="text-sm leading-relaxed text-text-muted">{action.reason}</p>
  );

  return (
    <article aria-labelledby="mentor-name">
      <Container className="pt-6 pb-16 md:pt-8 md:pb-24">
        <Link
          href="/office-hours#mentors"
          className="-ml-1 inline-flex h-11 items-center gap-2 rounded-xs px-1 text-[0.9375rem] text-text-muted transition-colors duration-150 hover:text-text"
        >
          <ArrowLeftIcon className="size-4" />
          All mentors
        </Link>

        <div className="mt-6 grid gap-8 md:mt-10 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
          <div className="w-36 sm:w-44 md:w-full">
            <div className="md:sticky md:top-32">
              <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="fluid" priority />
            </div>
          </div>

          <div className="min-w-0 max-w-2xl">
            <header>
              <h1 id="mentor-name" className="text-4xl font-bold leading-[1.1] tracking-tight text-text sm:text-5xl">
                {mentor.name}
              </h1>
              {mentor.role || mentor.company ? (
                <p className="mt-3 text-lg leading-snug text-text-muted sm:text-xl">
                  {mentor.role}
                  {mentor.role && mentor.company ? <span className="sr-only">, </span> : null}
                  {mentor.company ? <span className="mt-0.5 block text-charcoal">{mentor.company}</span> : null}
                </p>
              ) : null}
              {mentor.demo ? <DemoBadge className="mt-3" /> : null}
              {mentor.links.length ? (
                <ul className="mt-3 flex flex-wrap gap-x-6" aria-label={`${mentor.firstName}’s links`}>
                  {mentor.links.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-charcoal"
                      >
                        {link.label}
                        <ArrowUpRightIcon className="size-3.5 text-text-subtle" />
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-8 border-t border-line pt-6">
                <h2 className="text-sm font-semibold text-text">Office hours</h2>
                <OfficeHoursLines
                  lines={availabilityLines(mentor)}
                  note={availabilityNote(mentor)}
                  className="mt-2"
                />
                <div className="mt-6">{applyAction}</div>
              </div>
            </header>

            <div className="mt-14 space-y-12 md:mt-16 md:space-y-14">
              <ProfileSection id="about" title="About" badge={<DraftMark field={bio} />}>
                {bio ? (
                  <>
                    <p className="text-base leading-relaxed text-text-muted sm:text-lg sm:leading-relaxed">
                      {bio.value}
                    </p>
                    <DraftNote field={bio} />
                  </>
                ) : (
                  <p className="text-base leading-relaxed text-text-muted">
                    We’ll add more background once {mentor.firstName} confirms it.
                  </p>
                )}
              </ProfileSection>

              {mentor.backgroundTags?.length ? (
                <ProfileSection id="background" title="Background">
                  <TagList tags={mentor.backgroundTags} label={`${mentor.firstName}’s background`} />
                </ProfileSection>
              ) : null}

              {/* With no approved topic list but a suggested fit, the fit says it better. */}
              {expertise || !goodFit ? (
                <ProfileSection id="can-help-with" title="Can help with" badge={<DraftMark field={expertise} />}>
                  {expertise ? (
                    <>
                      <LabelList labels={expertise.value.map((e) => e.label)} />
                      <DraftNote field={expertise} />
                    </>
                  ) : (
                    <p className="text-base leading-relaxed text-text-muted">
                      We’re still confirming topics with {mentor.firstName}. Tell us what you’d like to talk about in
                      your application.
                    </p>
                  )}
                </ProfileSection>
              ) : null}

              {topics ? (
                <ProfileSection
                  id="ask-me-about"
                  title={`Ask ${mentor.firstName} about`}
                  badge={<DraftMark field={topics} />}
                >
                  <LabelList labels={topics.value} />
                  <DraftNote field={topics} />
                </ProfileSection>
              ) : null}

              {goodFit ? (
                <ProfileSection
                  id="useful-for"
                  title={isProse(goodFit.value) ? "Good fit for" : "Useful for"}
                  badge={<DraftMark field={goodFit} />}
                >
                  {isProse(goodFit.value) ? (
                    goodFit.value.map((text) => (
                      <p key={text} className="text-base leading-relaxed text-text-muted sm:text-lg sm:leading-relaxed">
                        {text}
                      </p>
                    ))
                  ) : (
                    <LabelList labels={goodFit.value} />
                  )}
                  <DraftNote field={goodFit} />
                </ProfileSection>
              ) : null}

              {appearances.length ? (
                <ProfileSection id="at-founders-week" title={`${mentor.firstName} at ${site.week.name}`}>
                  <AppearanceList appearances={appearances} />
                </ProfileSection>
              ) : null}
            </div>

            {/* End of the profile: the same action again, plus the way back to everyone else. */}
            <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 md:mt-16">
              {action.open ? applyAction : null}
              <Link
                href="/office-hours#mentors"
                className="inline-flex h-11 items-center text-[0.9375rem] text-text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text hover:decoration-charcoal"
              >
                See all mentors
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </article>
  );
}
