/**
 * MentorPreviews — every office-hours mentor, compact: headshot, name, verified role and company,
 * and one availability line. Each card links to the mentor's profile.
 *
 * Layout, balanced for however many mentors there are: one row of up to six cards from `xl`;
 * compact horizontal rows below that (two columns from `sm`, three from `lg` when the count divides
 * by three, with an odd last card centered in two-column rows). Every mentor is always visible, no
 * carousel.
 *
 * From `xl` each card is a subgrid of three shared rows (photo; name, role and company;
 * availability), so the rule above each availability line sits at the same height across the row
 * however many lines a name, role or window takes. An exact time range never breaks
 * ("10:00–11:30 AM CT" stays on one line).
 *
 * Server component.
 */
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { balancedColumns } from "@/lib/columns";
import type { MentorPreview } from "./home-model";

/** Literal class names so Tailwind generates them. */
const XL_COLUMNS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

/** Up to six across; beyond that, the row width (4 or 3) that leaves the fullest last row (9 → 3, 8 → 4). */
export function previewColumns(count: number): number {
  return count <= 6 ? Math.max(1, count) : balancedColumns(count, 4);
}

export function MentorPreviews({ mentors }: { mentors: MentorPreview[] }) {
  if (!mentors.length) return null;
  const thirds = mentors.length % 3 === 0;
  // Two-column rows centre an odd last card; three-column rows (lg) are used only when they fill evenly.
  const oddCount = mentors.length % 2 === 1;
  const columns = previewColumns(mentors.length);

  return (
    <section id="mentors" aria-labelledby="mentors-heading">
      <Container className="pb-16 md:pb-20">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-line pt-10 md:pt-12">
          <h2 id="mentors-heading" className="text-2xl font-semibold tracking-tight text-text sm:text-[1.75rem]">
            Who you can meet
          </h2>
          <Link
            href="/office-hours"
            className="group/all -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-xs text-sm font-medium text-charcoal transition-colors hover:text-text"
          >
            All mentor profiles
            <ArrowRightIcon className="size-3.5 text-text-subtle transition-transform duration-150 group-hover/all:translate-x-0.5 group-hover/all:text-accent-strong" />
          </Link>
        </div>

        <ul
          className={cn(
            "mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-8 xl:gap-x-5 xl:gap-y-0",
            thirds && "lg:grid-cols-3",
            XL_COLUMNS[columns],
          )}
        >
          {mentors.map((m, i) => (
            <li
              key={m.id}
              className={cn(
                // xl: the card spans three shared rows (see MentorCard). The list has no row gap there,
                // so a second row of cards (seven or more mentors) is spaced here.
                "min-w-0 xl:row-span-3 xl:grid xl:grid-rows-subgrid xl:gap-0",
                i >= columns && "xl:pt-5",
                // An odd last card sits centered under the two-column rows (sm–xl).
                oddCount && i === mentors.length - 1 && mentors.length > 1
                  ? cn(
                      "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.5rem)] xl:col-span-1 xl:mx-0 xl:w-auto",
                      thirds && "lg:col-span-1 lg:mx-0 lg:w-auto",
                    )
                  : null,
              )}
            >
              <MentorCard mentor={m} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function MentorCard({ mentor: m }: { mentor: MentorPreview }) {
  const a = m.availability;
  return (
    <article className="group relative flex h-full items-center gap-4 rounded-md border border-line bg-surface p-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-sm sm:p-4 xl:row-span-3 xl:grid xl:h-auto xl:grid-rows-subgrid xl:items-stretch xl:gap-0 xl:p-3">
      <div className="w-[4.5rem] shrink-0 xl:w-full">
        <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="fluid" priority />
      </div>
      {/* xl: `contents`, so who they are and their availability each take a shared row. */}
      <div className="flex min-w-0 flex-1 flex-col xl:contents">
        <div className="xl:px-1.5 xl:pt-4">
          <h3 className="text-base font-semibold leading-snug text-text">
            <Link
              href={m.href}
              className="rounded-xs decoration-accent decoration-2 underline-offset-4 after:absolute after:inset-0 after:rounded-md group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {m.name}
            </Link>
          </h3>
          {m.role || m.company ? (
            <p className="mt-0.5 text-sm leading-snug text-text-muted">
              {m.role ? <span className="xl:block">{m.role}</span> : null}
              {m.role && m.company ? <span className="xl:sr-only">, </span> : null}
              {m.company ? <span className="xl:block">{m.company}</span> : null}
            </p>
          ) : null}
        </div>
        {/* The third row at xl, top-aligned so every card's rule lines up. */}
        <div className="mt-2 xl:mt-0 xl:px-1.5 xl:pb-1.5 xl:pt-4">
          <p className="flex items-start gap-2 text-[0.8125rem] leading-snug xl:border-t xl:border-line xl:pt-3">
            <span
              aria-hidden
              className={cn("mt-[0.3rem] size-1.5 shrink-0 rounded-full", a.known ? "bg-accent" : "bg-line-strong")}
            />
            {a.known ? (
              <span className="text-charcoal">
                <time dateTime={a.dateTime} className="font-medium">
                  {a.date}
                </time>
                <span aria-hidden className="xl:hidden">
                  {" · "}
                </span>
                <span className="sr-only">, </span>
                {/* An exact range stays whole; a rough window ("Morning, before noon CT") may wrap. */}
                <span className={cn("tabular xl:block", a.exact && "whitespace-nowrap")}>{a.time}</span>
                {a.more > 0 ? <span className="text-text-subtle"> + {a.more} more</span> : null}
              </span>
            ) : (
              <span className="text-text-subtle">{a.label}</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
