import Link from "next/link";
import type { Draftable, Mentor } from "@/content/types";
import { DemoBadge, DraftBadge } from "@/components/ui/badge";
import { ArrowRightIcon, ArrowUpRightIcon, LockIcon } from "@/components/ui/icons";
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
    <ol className="divide-y divide-line border-y border-line">
      {mentors.map((m, i) => (
        <MentorNote key={m.id} mentor={m} index={i + 1} total={mentors.length} />
      ))}
    </ol>
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
  push("expertise", "Expertise", mentor.expertise, (v) => v.map((e) => `${e.label} — ${e.basis}`));
  push("askMeAbout", "Ask me about", mentor.askMeAbout, (v) => v);
  push("goodFitFor", "Good fit for", mentor.goodFitFor, (v) => v);
  return out;
}

/** Profile details organizers still need from the mentor (or to verify). */
export function mentorMissing(mentor: Mentor): string[] {
  return [
    mentor.role ? null : "Title (unverified — hidden)",
    mentor.company ? null : "Company",
    mentor.bio ? null : "Bio",
    mentor.askMeAbout ? null : "Topics from the mentor",
    mentor.session.confirmed ? null : "Session format, length & location",
    mentor.headshot ? null : "Headshot (initials portrait shown)",
  ].filter((v): v is string => Boolean(v));
}

function MentorNote({ mentor, index, total }: { mentor: Mentor; index: number; total: number }) {
  const scheduling = schedulingStatus(mentor);
  const drafts = mentorDrafts(mentor);
  const missing = mentorMissing(mentor);
  const bio = mentor.bio?.status === "approved" ? mentor.bio.value : null;
  const expertise = mentor.expertise?.status === "approved" ? mentor.expertise.value : [];

  return (
    <li className="grid gap-6 py-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <div className="flex items-start gap-4">
          <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="sm" />
          <div className="min-w-0">
            <p className="mono-label text-paper-subtle tabular">
              {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </p>
            <h3
              id={`note-${mentor.id}`}
              className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug tracking-[-0.01em] text-paper"
            >
              {mentor.name}
              {mentor.demo ? <DemoBadge /> : null}
            </h3>
            <p className="mt-0.5 text-sm text-paper-muted">
              {mentor.role ?? <span className="text-paper-subtle">Title not verified</span>}
              <span className="text-paper-subtle"> · </span>
              {mentor.company ?? <span className="text-paper-subtle">Company not verified</span>}
            </p>
          </div>
        </div>
        <ul className="mt-5 space-y-0.5 text-sm">
          <li>
            <Link
              href={organizersHref({ mentor: mentor.id })}
              className="inline-flex min-h-11 items-center gap-1.5 text-paper-muted underline-offset-4 transition-colors hover:text-accent hover:underline sm:min-h-8"
            >
              Applications listing {mentor.firstName} <ArrowRightIcon className="size-3.5" />
            </Link>
          </li>
          <li>
            <a
              href={`/office-hours/${mentor.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-1.5 text-paper-muted underline-offset-4 transition-colors hover:text-accent hover:underline sm:min-h-8"
            >
              Public profile <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </li>
          <li>
            <a
              href={mentorApplyHref(mentor.id)}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-1.5 text-paper-muted underline-offset-4 transition-colors hover:text-accent hover:underline sm:min-h-8"
            >
              Application with {mentor.firstName} preselected <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
            <p className="break-all font-mono text-[0.6875rem] text-paper-subtle">{mentorApplyHref(mentor.id)}</p>
          </li>
        </ul>
      </div>

      <dl className="space-y-5 text-sm lg:col-span-8">
        <NoteRow label="Scheduling">
          {scheduling === "in-progress" ? (
            <div className="space-y-2">
              <AvailabilityBadge kind="in-progress" />
              <p className="text-paper-muted">
                No windows or slots published. Students can express interest without choosing a time; those
                applications show as “Interest only”.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {mentor.availability.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-paper">{windowLabel(w)}</span>
                  <AvailabilityBadge kind={w.time.kind === "exact" ? "window" : "window-approx"} />
                </li>
              ))}
              <li className="text-xs text-paper-subtle">
                {mentor.slots.length
                  ? `${mentor.slots.length} appointment slot${mentor.slots.length === 1 ? "" : "s"} — see Slot capacity.`
                  : "No appointment slots yet — appointments can’t be proposed or confirmed until slots are added."}
              </li>
            </ul>
          )}
          {mentor.session.note ? <p className="mt-2 text-paper-muted">{mentor.session.note}</p> : null}
          {!mentor.acceptingApplications ? (
            <p className="mt-2 text-warning">Not accepting applications — hidden from the form.</p>
          ) : null}
        </NoteRow>

        {mentor.organizerNotes ? (
          <NoteRow label="Organizer notes">
            <p className="flex gap-2.5 rounded-sm border border-line-strong bg-ink-850 px-3.5 py-3 leading-relaxed text-paper">
              <LockIcon className="mt-0.5 size-3.5 shrink-0 text-accent" />
              <span>{mentor.organizerNotes}</span>
            </p>
          </NoteRow>
        ) : null}

        {drafts.length ? (
          <NoteRow label="Awaiting approval">
            <ul className="space-y-3">
              {drafts.map((d) => (
                <li key={d.key} className="rounded-sm border border-dashed border-warning/45 px-3.5 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <DraftBadge />
                    <span className="mono-label text-paper-muted">{d.label}</span>
                  </p>
                  {Array.isArray(d.value) ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-paper marker:text-paper-subtle">
                      {d.value.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-paper">{d.value}</p>
                  )}
                  {d.note ? <p className="mt-2 text-xs text-paper-subtle">{d.note}</p> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-paper-subtle">Hidden on the public site until marked approved in content.</p>
          </NoteRow>
        ) : null}

        {bio || expertise.length ? (
          <NoteRow label="Public profile">
            <details className="group rounded-sm border border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 text-paper-muted transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
                <span>What students see now</span>
                <span aria-hidden className="font-mono text-xs text-paper-subtle group-open:hidden">
                  Show
                </span>
                <span aria-hidden className="hidden font-mono text-xs text-paper-subtle group-open:inline">
                  Hide
                </span>
              </summary>
              <div className="space-y-3 border-t border-line px-3.5 py-3">
                {bio ? <p className="leading-relaxed text-paper">{bio}</p> : null}
                {expertise.length ? (
                  <ul className="space-y-1">
                    {expertise.map((e) => (
                      <li key={e.label} className="flex flex-wrap gap-x-2">
                        <span className="text-paper">{e.label}</span>
                        <span className="text-xs leading-5 text-paper-subtle">— {e.basis}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          </NoteRow>
        ) : null}

        {missing.length ? (
          <NoteRow label="Not yet provided">
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((item) => (
                <li key={item} className="rounded-xs border border-dotted border-line-strong px-2 py-0.5 text-xs text-paper-muted">
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
      <dt className="mono-label pt-0.5 text-paper-subtle">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
