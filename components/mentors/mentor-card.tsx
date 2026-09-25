/**
 * Mentor cards for /office-hours — the one place students scan who they can meet.
 *
 * - `MentorGrid` — every mentor, always visible (no carousel). One column on phones and tablets;
 *   two columns from `lg`, where an odd last card sits centered at half width so the grid stays
 *   balanced (six mentors → 2 · 2 · 2; five → 2 · 2 · 1). Props: `mentors`, `applicationsOpen`, `className`.
 * - `MentorCard` — a horizontal card: approved headshot, name, verified role and company, up to
 *   three "Can help with" labels (never their internal basis), ONE availability line, a
 *   "Select mentor" action that opens the application (#apply) with this mentor — and their only
 *   window — preselected, and a quiet link to the full profile.
 *
 * Longer bios, the full "Can help with" list and Founders Week appearances live on the profile
 * (/office-hours/<id>). Server components.
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { DemoBadge } from "@/components/ui/badge";
import { ArrowRightIcon, ClockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import { mentorCardView, SELECT_MENTOR_LABEL, type MentorCardView } from "@/lib/mentors-view";

export function MentorGrid({
  mentors,
  applicationsOpen = true,
  className,
}: {
  mentors: Mentor[];
  applicationsOpen?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-5 lg:grid-cols-2 lg:gap-6", className)}>
      {mentors.map((mentor, i) => (
        <li
          key={mentor.id}
          className="lg:[&:last-child:nth-child(odd)]:col-span-2 lg:[&:last-child:nth-child(odd)]:mx-auto lg:[&:last-child:nth-child(odd)]:w-[calc((100%_-_1.5rem)/2)]"
        >
          <MentorCard card={mentorCardView(mentor, { applicationsOpen })} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}

export function MentorCard({ card, priority }: { card: MentorCardView; priority?: boolean }) {
  const { availability, action } = card;
  const nameId = `${card.anchor}-name`;
  // Cards in a row share its height. `grid-rows-[auto_1fr]` keeps the name/role row at its own
  // height and gives the extra space to the body (whose actions sit at the bottom), so the gap
  // under the role is the same in the shorter card of a row as in the taller one.
  return (
    <article
      id={card.anchor}
      aria-labelledby={nameId}
      className="grid h-full scroll-mt-32 grid-cols-[5rem_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-4 gap-y-5 rounded-md border border-line bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-sm sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-x-6 sm:p-6"
    >
      <MentorPortrait
        id={card.id}
        name={card.name}
        headshot={card.headshot}
        size="fluid"
        priority={priority}
        className="sm:row-span-2"
      />

      <div className="self-center sm:self-start">
        <h3 id={nameId} className="text-lg font-semibold leading-snug tracking-tight text-text sm:text-xl">
          {card.name}
        </h3>
        {card.role || card.company ? (
          <p className="mt-1 text-[0.9375rem] leading-snug text-text-muted">
            {/* Role, then the company on its own line (no separator to strand when a long role wraps). */}
            {card.role}
            {card.role && card.company ? <span className="sr-only">, </span> : null}
            {card.company ? <span className="block text-charcoal">{card.company}</span> : null}
          </p>
        ) : null}
        {card.demo ? <DemoBadge className="mt-2" /> : null}
      </div>

      <div className="col-span-2 flex min-w-0 flex-col sm:col-span-1 sm:col-start-2">
        {card.help.length ? (
          <div>
            <p className="text-sm font-medium text-text">Can help with</p>
            <ul className="mt-2 space-y-1.5">
              {card.help.map((label) => (
                <li key={label} className="flex gap-2.5 text-[0.9375rem] leading-snug text-text-muted">
                  <span aria-hidden className="mt-[9px] h-0.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : card.intro ? (
          <p className="text-[0.9375rem] leading-relaxed text-text-muted">{card.intro}</p>
        ) : null}

        <p className="mt-4 flex items-start gap-2 text-sm leading-snug text-text">
          <ClockIcon className="mt-px size-4 shrink-0 text-text-subtle" />
          <span>
            <span className="sr-only">Office hours: </span>
            {availability.date ? (
              <>
                <time dateTime={availability.dateTime ?? undefined}>{availability.date}</time>
                {" · "}
                {availability.detail}
                {availability.more > 0 ? <span className="text-text-muted"> · +{availability.more} more</span> : null}
              </>
            ) : (
              <span className="text-text-muted">{availability.detail}</span>
            )}
          </span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
          {action.open ? (
            <Link
              href={action.href}
              className="group/select inline-flex h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-[0.9375rem] font-medium text-text transition-colors duration-150 hover:border-charcoal hover:bg-surface-subtle"
            >
              {SELECT_MENTOR_LABEL}
              <span className="sr-only">: {card.name}</span>
              <ArrowRightIcon className="size-4 text-text-subtle transition-transform duration-150 group-hover/select:translate-x-0.5" />
            </Link>
          ) : (
            <p className="text-sm text-text-muted">{action.label}</p>
          )}
          <Link
            href={card.profileHref}
            className="inline-flex h-11 items-center text-[0.9375rem] text-text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text hover:decoration-charcoal"
          >
            Profile
            <span className="sr-only">: {card.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
