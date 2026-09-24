import Link from "next/link";
import { getMentors, getSite } from "@/content";
import { OtherMentors } from "@/components/mentors/other-mentors";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";

/** Unknown mentor id: say so plainly, then show every mentor with their application link. */
export default function MentorNotFound() {
  const mentors = getMentors();
  return (
    <Container className="pt-10 pb-8 md:pt-16 md:pb-12">
      <Eyebrow>Founders Office Hours · Not found</Eyebrow>
      <h1 className="mt-5 font-wide text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-5xl">
        We couldn’t find that mentor.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">
        The link may be out of date, or the profile may have moved. Every confirmed mentor is listed on the Office Hours
        page.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/office-hours#mentors" size="lg">
          <ArrowLeftIcon className="size-4" />
          All mentors
        </ButtonLink>
        <Link
          href="/office-hours#apply"
          className="inline-flex h-12 items-center px-2 text-[0.9375rem] text-paper-muted underline-offset-4 hover:text-paper hover:underline"
        >
          {PRIMARY_CTA_LABEL}
        </Link>
      </div>
      <OtherMentors
        mentors={mentors}
        applicationsOpen={getSite().applications.open}
        title="Founders Office Hours"
        className="mt-14 md:mt-20"
      />
    </Container>
  );
}
