import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentor, getMentors, getScheduleEntries, getSite } from "@/content";
import { MentorActionBar, MentorCtaPanel } from "@/components/mentors/mentor-cta";
import { OtherMentors } from "@/components/mentors/other-mentors";
import {
  AppearanceList,
  AvailabilityBlocks,
  ExpertiseList,
  ProfileSection,
  SessionDetailsList,
  SourcesNote,
} from "@/components/mentors/mentor-profile";
import { TopicList } from "@/components/mentors/topic-list";
import { DemoBadge, DraftBadge } from "@/components/ui/badge";
import { ArrowLeftIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import { AVAILABILITY_BORDER_CLASSES } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import {
  availabilityHeadline,
  mentorAppearanceViews,
  mentorCta,
  mentorIndexCaption,
  mentorMetaDescription,
  visibleExpertise,
  visibleField,
  type VisibleField,
} from "@/lib/mentors-view";

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

/** Draft badge — only ever rendered in draft preview (drafts are stripped otherwise). */
function DraftMarker({ field }: { field: VisibleField<unknown> | null }) {
  if (!field?.draft) return null;
  return <DraftBadge />;
}

function DraftNote({ field }: { field: VisibleField<unknown> | null }) {
  if (!field?.draft || !field.draftNote) return null;
  return <p className="mt-3 font-mono text-xs leading-relaxed text-warning">Draft note: {field.draftNote}</p>;
}

export default async function MentorProfilePage({ params }: PageProps) {
  const { id } = await params;
  const mentor = getMentor(id);
  if (!mentor) notFound();

  const site = getSite();
  const mentors = getMentors();
  const index = mentors.findIndex((m) => m.id === mentor.id);
  const cta = mentorCta(mentor, { applicationsOpen: site.applications.open });
  const bio = visibleField(mentor.bio);
  const expertise = visibleExpertise(mentor);
  const topics = visibleField(mentor.askMeAbout);
  const goodFit = visibleField(mentor.goodFitFor);
  const appearances = mentorAppearanceViews(getScheduleEntries(), mentor.id);
  const headline = availabilityHeadline(mentor);

  return (
    <article aria-labelledby="mentor-name">
      {/* ── Header ─────────────────────────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
        <Container>
          <Link
            href="/office-hours#mentors"
            className="mono-label mt-4 -ml-1 inline-flex h-11 items-center gap-2 rounded-xs px-1 text-paper-muted transition-colors duration-150 hover:text-paper md:mt-6"
          >
            <ArrowLeftIcon className="size-3.5" />
            All mentors
          </Link>

          {/* An ID-card composition: portrait left, identity bottom-aligned beside it. */}
          <header className="relative grid gap-8 pt-4 pb-10 md:pb-14 lg:grid-cols-12 lg:items-end lg:gap-12 lg:pt-6">
            {/* Index numeral in outline — the profile's page number (decorative; the caption says it too). */}
            {index >= 0 ? (
              <p
                aria-hidden
                className="pointer-events-none absolute top-4 right-0 hidden font-wide text-[7rem] leading-[0.8] font-bold tracking-[-0.06em] text-transparent select-none [-webkit-text-stroke:1px_rgb(244_239_231/0.2)] lg:top-6 xl:block"
              >
                {String(index + 1).padStart(2, "0")}
              </p>
            ) : null}
            <div className="flex items-end gap-5 lg:col-span-4 lg:block xl:col-span-3">
              <MentorPortrait
                id={mentor.id}
                name={mentor.name}
                headshot={mentor.headshot}
                size="fluid"
                caption={index >= 0 ? mentorIndexCaption(index, mentors.length) : undefined}
                priority
                className="max-w-[9.5rem] sm:max-w-[12rem] lg:max-w-none"
              />
              {/* Mobile/tablet: the eyebrow sits beside the portrait. */}
              <p className="mono-label pb-1 text-paper-subtle lg:hidden">
                <span className="block text-paper-muted">Founders Office Hours</span>
                <span className="mt-1 block">
                  {site.week.name} {site.week.year}
                </span>
                {mentor.demo ? <DemoBadge className="mt-3" /> : null}
              </p>
            </div>

            <div className="min-w-0 lg:col-span-8 xl:col-span-9">
              <div className="mb-6 hidden flex-wrap items-center gap-2 lg:flex">
                <p className="mono-label text-paper-muted">
                  Founders Office Hours{" "}
                  <span className="text-paper-subtle">
                    · {site.week.name} {site.week.year}
                  </span>
                </p>
                {mentor.demo ? <DemoBadge /> : null}
              </div>
              <div>
                <h1
                  id="mentor-name"
                  className="font-wide text-[2.5rem] font-bold leading-[0.95] tracking-[-0.04em] text-paper sm:text-6xl lg:text-7xl"
                >
                  {mentor.name}
                </h1>
                {mentor.role || mentor.company ? (
                  <p className="mt-4 text-lg leading-snug md:text-xl">
                    {mentor.role ? <span className="text-paper-muted">{mentor.role}</span> : null}
                    {mentor.role && mentor.company ? (
                      <>
                        <span aria-hidden className="px-2.5 text-paper-subtle">
                          ·
                        </span>
                        <span className="sr-only">, </span>
                      </>
                    ) : null}
                    {mentor.company ? <span className="text-paper">{mentor.company}</span> : null}
                  </p>
                ) : null}
                {mentor.links.length ? (
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1" aria-label={`${mentor.firstName}’s links`}>
                    {mentor.links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center gap-1.5 text-[0.9375rem] text-paper underline decoration-line-strong underline-offset-[5px] transition-colors duration-150 hover:decoration-accent"
                        >
                          {link.label}
                          <ArrowUpRightIcon className="size-3.5 text-paper-muted" />
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* At a glance: office hours + first Founders Week appearance */}
                <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                  <div className={cn("rounded-xs border px-4 py-3", AVAILABILITY_BORDER_CLASSES[headline.kind])}>
                    <dt className="mono-label text-paper-subtle">Office hours · {headline.label}</dt>
                    <dd className="mt-1.5 font-mono text-sm leading-snug text-paper tabular">
                      {headline.date ? (
                        <>
                          <time dateTime={headline.dateTime ?? undefined}>{headline.date}</time> · {headline.time}
                          {headline.more > 0 ? <span className="text-paper-subtle"> +{headline.more} more</span> : null}
                        </>
                      ) : (
                        <span className="text-paper-muted">{headline.time}</span>
                      )}
                    </dd>
                  </div>
                  {appearances[0] ? (
                    <div className="rounded-xs border border-line px-4 py-3">
                      <dt className="mono-label text-paper-subtle">At Founders Week · {appearances[0].roleLabel}</dt>
                      <dd className="mt-1.5 font-mono text-sm leading-snug text-paper tabular">
                        <time dateTime={appearances[0].dateTime}>
                          {appearances[0].dateShort}
                          {appearances[0].startLabel ? ` · ${appearances[0].startLabel}` : ""}
                        </time>
                        {appearances.length > 1 ? (
                          <span className="text-paper-subtle"> +{appearances.length - 1} more</span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
          </header>
        </Container>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────────────── */}
      <Container>
        <div className="grid lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 lg:col-span-8">
            <ProfileSection
              id="background"
              label="Background"
              badge={<DraftMarker field={bio} />}
              className="border-t-0"
            >
              {bio ? (
                <>
                  <p className="max-w-[62ch] text-lg leading-relaxed text-paper md:text-xl md:leading-relaxed">
                    {bio.value}
                  </p>
                  <DraftNote field={bio} />
                </>
              ) : (
                <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-paper-muted">
                  More background is added once it’s confirmed with {mentor.firstName}.
                </p>
              )}
            </ProfileSection>

            <ProfileSection id="expertise" label="Expertise" badge={<DraftMarker field={expertise} />}>
              {expertise ? <ExpertiseList items={expertise.value} draft={expertise.draft} size="lg" /> : null}
              {!topics ? (
                <p className={cn("max-w-prose text-[0.9375rem] leading-relaxed text-paper-muted", expertise && "mt-4")}>
                  Conversation topics are being confirmed with {mentor.firstName} — tell us what you’d like to discuss
                  in your application.
                </p>
              ) : null}
            </ProfileSection>

            {topics ? (
              <ProfileSection id="ask-me-about" label="Ask me about" badge={<DraftMarker field={topics} />}>
                <TopicList
                  topics={topics.value}
                  draft={topics.draft}
                  label={`Topics ${mentor.firstName} can help with`}
                />
                <DraftNote field={topics} />
              </ProfileSection>
            ) : null}

            {goodFit ? (
              <ProfileSection id="useful-for" label="Useful for" badge={<DraftMarker field={goodFit} />}>
                <ul className="space-y-2">
                  {goodFit.value.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-paper">
                      <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
                <DraftNote field={goodFit} />
              </ProfileSection>
            ) : null}

            {appearances.length ? (
              <ProfileSection id="at-founders-week" label="At Founders Week">
                <AppearanceList appearances={appearances} size="lg" />
              </ProfileSection>
            ) : null}

            <ProfileSection id="availability" label="Office hours">
              <AvailabilityBlocks mentor={mentor} />
            </ProfileSection>

            <ProfileSection id="session-details" label="Session details">
              <SessionDetailsList session={mentor.session} />
            </ProfileSection>

            {mentor.sources.length ? (
              <ProfileSection id="sources" label="Sources">
                <SourcesNote sources={mentor.sources} />
              </ProfileSection>
            ) : null}
          </div>

          <aside aria-label={`Meet ${mentor.firstName}`} className="hidden lg:col-span-4 lg:block">
            <MentorCtaPanel mentor={mentor} cta={cta} className="sticky top-[5.5rem] mt-10" />
          </aside>
        </div>

        <OtherMentors
          mentors={mentors.filter((m) => m.id !== mentor.id)}
          applicationsOpen={site.applications.open}
          className="mt-4"
        />

        {/* Mobile: sticks to the bottom of the viewport while reading, settles here at the end. */}
        <MentorActionBar cta={cta} className="lg:hidden" />
      </Container>
    </article>
  );
}
