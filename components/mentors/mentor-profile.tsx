/**
 * Building blocks for a mentor profile (/office-hours/<id>). Server components.
 *
 * - `ProfileSection` — an <h2> section of the profile body. Props: `id`, `title`, `badge`
 *   (e.g. a Draft badge in draft preview), `className`, `children`.
 * - `LabelList` — a short list of plain labels ("Can help with"). Labels only: the internal basis
 *   of an expertise item is never passed in.
 * - `AppearanceList` — Founders Week sessions the mentor speaks at or hosts, each linking to its
 *   calendar entry ("Speaking Fri, Oct 2 · 1:55–2:25 PM CT" · title · program block).
 * - `OfficeHoursLines` — the mentor's published windows/slots as plain lines, or "Scheduling in
 *   progress", then the session rule ("Each session is 25 minutes, …", from `site.officeHours`;
 *   never a session count), the place once it's set (building, then street address) and the
 *   public note from content. Never implies a booking.
 */
import Link from "next/link";
import { ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SCHEDULING_IN_PROGRESS_LABEL } from "@/lib/mentors";
import {
  appearanceLabel,
  type AppearanceView,
  type AvailabilityLine,
  type OfficeHoursPlace,
} from "@/lib/mentors-view";

export function ProfileSection({
  id,
  title,
  badge,
  className,
  children,
}: {
  id: string;
  title: string;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-32", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
          {title}
        </h2>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LabelList({ labels, label }: { labels: string[]; label?: string }) {
  return (
    <ul aria-label={label} className="space-y-2.5">
      {labels.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-relaxed text-text-muted sm:text-lg">
          <span aria-hidden className="mt-3 h-0.5 w-3 shrink-0 rounded-full bg-accent sm:mt-3.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Short background tags ("Medtech", "University spinouts") as quiet chips. */
export function TagList({ tags, label }: { tags: string[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[0.9375rem] leading-snug text-charcoal"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

/** Full sentences read as prose; short items read as a list. */
export function isProse(items: string[]): boolean {
  return items.length > 0 && items.every((item) => /[.?!]["”’)]?$/.test(item.trim()));
}

export function AppearanceList({ appearances }: { appearances: AppearanceView[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {appearances.map((a) => (
        <li key={a.key}>
          <Link
            href={a.href}
            className="group -mx-3 block rounded-sm px-3 py-4 transition-colors duration-150 hover:bg-surface-subtle"
          >
            <p className="text-sm text-text-muted">
              <time dateTime={a.dateTime}>{appearanceLabel(a)}</time>
            </p>
            <p className="mt-1 font-medium leading-snug text-text underline decoration-transparent underline-offset-4 transition-colors duration-150 group-hover:decoration-charcoal">
              {a.title}
            </p>
            {a.context || a.venue ? (
              <p className="mt-1 text-sm leading-snug text-text-subtle">
                {[a.context, a.venue].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OfficeHoursLines({
  lines,
  sessionRule = null,
  place = null,
  note,
  className,
}: {
  lines: AvailabilityLine[];
  /** `sessionRuleLine(mentor, site.officeHours)`: one short line under the window lines, or null. */
  sessionRule?: string | null;
  /** `officeHoursPlace(mentor)`: where the office hours happen, or null while it isn't set. */
  place?: OfficeHoursPlace | null;
  note: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      {lines.length ? (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line.text} className="flex items-start gap-2 text-base leading-snug text-text">
              <ClockIcon className="mt-0.5 size-4 shrink-0 text-text-subtle" />
              <span>
                <time dateTime={line.dateTime ?? undefined}>{line.date}</time> · {line.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-base leading-snug text-text">
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-text-subtle" />
          {SCHEDULING_IN_PROGRESS_LABEL}
        </p>
      )}
      {/* Indented under the line text (past the clock icon): a detail of those times. */}
      {sessionRule ? <p className="mt-1 pl-6 text-sm leading-snug text-text-muted">{sessionRule}</p> : null}
      {place ? (
        <p className="mt-2 flex items-start gap-2 text-base leading-snug text-text">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-text-subtle" />
          <span>
            {place.venue}
            {place.address ? (
              <>
                <span className="sr-only">, </span>
                <span className="mt-0.5 block text-sm text-text-muted">{place.address}</span>
              </>
            ) : null}
          </span>
        </p>
      ) : null}
      {note ? <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">{note}</p> : null}
    </div>
  );
}
