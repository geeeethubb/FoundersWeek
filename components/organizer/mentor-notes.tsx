import Link from "next/link";
import type { Draftable, Mentor } from "@/content/types";
import { DemoBadge, DraftBadge } from "@/components/ui/badge";
import { ArrowRightIcon, ArrowUpRightIcon, ChevronDownIcon, LockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge } from "@/components/ui/status";
import { mentorApplyHref, schedulingStatus } from "@/lib/mentors";
import { windowLabel } from "@/lib/organizer/directory";
import { organizersHref } from "@/lib/organizer/filters";

/**
 * Organizer-only context for each mentor: scheduling state, constraints (`organizerNotes`),
 * copy awaiting approval (drafts) and what's still missing. NOTHING here is public — this renders
 * only under /organizers, from `getMentorsForOrganizers()`.
 */
export function MentorNotes({ mentors }: { mentors: Mentor[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {mentors.map((m) => (
        <MentorNote key={m.id} mentor={m} />
      ))}
    </ul>
  );
}

type DraftEntry = {
  key: "bio" | "expertise" | "askMeAbout" | "goodFitFor";
  label: string;
  value: string | string[];
  note?: string;
};

/** Every mentor field that exists only as an unapproved draft (never rendered publicly). */
export function mentorDrafts(mentor: Mentor): DraftEntry[] {
  const out: DraftEntry[] = [];
  const push = <T,>(key: DraftEntry["key"], label: string, field: Draftable<T> | null, map: (v: T) => string | string[]) => {
    if (field?.status === "draft") out.push({ key, label, value: map(field.value), note: field.note });
  };
  push("bio", "Bio", mentor.bio, (v) => v);
  push("expertise", "Expertise", mentor.expertise, (v) => v.map((e) => `${e.label} (basis: ${e.basis})`));
  push("askMeAbout", "Ask me about", mentor.askMeAbout, (v) => v);
  push("goodFitFor", "Good fit for", mentor.goodFitFor, (v) => v);
  return out;
}

/** Profile details organizers still need from the mentor (or to verify). */
export function mentorMissing(mentor: Mentor): string[] {
  return [
    mentor.role ? null : "Title (unverified, so hidden)",
    mentor.company ? null : "Company",
    mentor.bio ? null : "Bio",
    mentor.askMeAbout ? null : "Topics from the mentor",
    mentor.session.confirmed ? null : "Session format, length & location",
    mentor.headshot ? null : "Headshot (initials portrait shown)",
  ].filter((v): v is string => Boolean(v));
}

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline sm:min-h-8";

function MentorNote({ mentor }: { mentor: Mentor }) {
  const scheduling = schedulingStatus(mentor);
  const drafts = mentorDrafts(mentor);
  const missing = mentorMissing(mentor);
  const bio = mentor.bio?.status === "approved" ? mentor.bio.value : null;
  const expertise = mentor.expertise?.status === "approved" ? mentor.expertise.value : [];
  const applyHref = mentorApplyHref(mentor.id);

  return (
    <li className="grid gap-6 py-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <div className="flex items-center gap-4">
          <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="sm" />
          <div className="min-w-0">
            <h3 id={`note-${mentor.id}`} className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-text">
              {mentor.name}
              {mentor.demo ? <DemoBadge /> : null}
            </h3>
            <p className="mt-0.5 text-sm text-text-muted">
              {mentor.role ?? <span className="text-text-subtle">Title not verified</span>}
              {" · "}
              {mentor.company ?? <span className="text-text-subtle">Company not verified</span>}
            </p>
          </div>
        </div>
        <ul className="mt-4">
          <li>
            <Link href={organizersHref({ mentor: mentor.id })} className={LINK}>
              Applications listing {mentor.firstName} <ArrowRightIcon className="size-3.5" />
            </Link>
          </li>
          <li>
            <a href={`/office-hours/${mentor.id}`} target="_blank" rel="noopener" className={LINK}>
              Public profile <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </li>
          <li>
            <a href={applyHref} target="_blank" rel="noopener" className={LINK}>
              Application with {mentor.firstName} preselected <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
            <p className="break-all text-xs text-text-subtle">{applyHref}</p>
          </li>
        </ul>
      </div>

      <dl className="space-y-5 text-sm lg:col-span-8">
        <NoteRow label="Scheduling">
          {scheduling === "in-progress" ? (
            <AvailabilityBadge kind="in-progress" />
          ) : (
            <ul className="space-y-2">
              {mentor.availability.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-text tabular">{windowLabel(w)}</span>
                  <AvailabilityBadge kind={w.time.kind === "exact" ? "window" : "window-approx"} />
                </li>
              ))}
              <li className="text-text-subtle">
                {mentor.slots.length
                  ? `${mentor.slots.length} appointment slot${mentor.slots.length === 1 ? "" : "s"} (see Slot capacity).`
                  : "No appointment slots yet."}
              </li>
            </ul>
          )}
          {mentor.session.note ? <p className="mt-2 leading-relaxed text-text-muted">{mentor.session.note}</p> : null}
          {!mentor.acceptingApplications ? (
            <p className="mt-2 font-medium text-warning">Not accepting applications, so they’re left off the form.</p>
          ) : null}
        </NoteRow>

        {mentor.organizerNotes ? (
          <NoteRow label="Organizer notes">
            <p className="flex gap-2.5 rounded-md bg-surface-subtle px-4 py-3 leading-relaxed text-text">
              <LockIcon className="mt-0.5 size-3.5 shrink-0 text-text-subtle" />
              <span>{mentor.organizerNotes}</span>
            </p>
          </NoteRow>
        ) : null}

        {drafts.length ? (
          <NoteRow label="Awaiting approval">
            <ul className="space-y-3">
              {drafts.map((d) => (
                <li key={d.key} className="rounded-md bg-warning-soft px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <DraftBadge />
                    <span className="font-medium text-text">{d.label}</span>
                  </p>
                  {Array.isArray(d.value) ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-text marker:text-text-subtle">
                      {d.value.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-text">{d.value}</p>
                  )}
                  {d.note ? <p className="mt-2 text-xs text-text-muted">{d.note}</p> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-subtle">Hidden on the public site until marked approved in content.</p>
          </NoteRow>
        ) : null}

        {bio || expertise.length ? (
          <NoteRow label="Public profile">
            <details className="group">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-medium text-text underline-offset-4 hover:underline sm:min-h-8 [&::-webkit-details-marker]:hidden">
                <ChevronDownIcon className="size-4 -rotate-90 text-text-muted transition-transform duration-150 group-open:rotate-0" />
                <span className="group-open:hidden">Show what students see</span>
                <span className="hidden group-open:inline">Hide what students see</span>
              </summary>
              <div className="mt-2 space-y-3 rounded-md bg-surface-subtle px-4 py-3">
                {bio ? <p className="leading-relaxed text-text">{bio}</p> : null}
                {expertise.length ? (
                  <div>
                    <ul className="space-y-1.5">
                      {expertise.map((e) => (
                        <li key={e.label}>
                          <span className="text-text">{e.label}</span>
                          <span className="block text-xs text-text-subtle">Basis (internal): {e.basis}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-text-subtle">Students only see the expertise labels, never the basis.</p>
                  </div>
                ) : null}
              </div>
            </details>
          </NoteRow>
        ) : null}

        {missing.length ? (
          <NoteRow label="Not yet provided">
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((item) => (
                <li key={item} className="rounded-xs bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </NoteRow>
        ) : null}
      </dl>
    </li>
  );
}

function NoteRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="pt-0.5 font-medium text-text-subtle">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
