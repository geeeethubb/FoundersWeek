import Link from "next/link";
import { getMentors } from "@/content";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { mentorAffiliation, mentorProfileHref } from "@/lib/mentors-view";

/** Unknown mentor id: say so plainly, then link to every mentor's profile and the application. */
export default function MentorNotFound() {
  const mentors = getMentors();
  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text sm:text-5xl">
          We couldn’t find that mentor.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-text-muted">
          The link might be out of date. You can find every mentor on the Office Hours page.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ButtonLink href="/office-hours#apply" size="lg" className="group/cta">
            {PRIMARY_CTA_LABEL}
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
          </ButtonLink>
          <Link
            href="/office-hours#mentors"
            className="inline-flex h-11 items-center text-[0.9375rem] text-text-muted underline decoration-line-strong underline-offset-4 hover:text-text hover:decoration-charcoal"
          >
            See all mentors
          </Link>
        </div>

        {mentors.length ? (
          <section aria-labelledby="mentor-links-heading" className="mt-14">
            <h2 id="mentor-links-heading" className="text-xl font-semibold tracking-tight text-text">
              Mentors
            </h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {mentors.map((m) => {
                const affiliation = mentorAffiliation(m);
                return (
                  <li key={m.id}>
                    <Link
                      href={mentorProfileHref(m.id)}
                      className="group -mx-3 flex min-h-11 flex-col justify-center rounded-sm px-3 py-3 transition-colors duration-150 hover:bg-surface-subtle"
                    >
                      <span className="font-medium text-text group-hover:underline group-hover:underline-offset-4">
                        {m.name}
                      </span>
                      {affiliation ? <span className="text-sm text-text-muted">{affiliation}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </Container>
  );
}
