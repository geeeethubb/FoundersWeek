/**
 * OpenGraph image for a mentor profile (/office-hours/<id>): portrait, name, verified role ·
 * organization, availability state ("Availability window · Thu, Oct 1 · 10:00–11:30 AM CT" or
 * "Scheduling in progress") and the mentor's CTA wording. Unknown ids fall back to the Office
 * Hours card.
 */
import { getMentors, getScheduleDays, getSite } from "@/content";
import { renderMentorCard, renderSiteCard } from "@/lib/og/cards";
import { mentorCardModel, OG_SIZE, siteCardModel, weekStamp } from "@/lib/og/model";

export const size = OG_SIZE;
export const contentType = "image/png";

/** One image per profile; used for its per-mentor alt text. (`params` may be a plain object or a promise.) */
export async function generateImageMetadata({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await params;
  const mentors = getMentors();
  const index = mentors.findIndex((m) => m.id === id);
  const alt =
    index >= 0
      ? mentorCardModel(mentors[index], index, mentors.length).alt
      : siteCardModel(getSite(), mentors, getScheduleDays()).alt;
  return [{ id: "card", alt, size: OG_SIZE, contentType: "image/png" }];
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite();
  const mentors = getMentors();
  const days = getScheduleDays();
  const index = mentors.findIndex((m) => m.id === id);
  if (index < 0) return renderSiteCard(siteCardModel(site, mentors, days));
  const model = mentorCardModel(mentors[index], index, mentors.length, { applicationsOpen: site.applications.open });
  return renderMentorCard(model, weekStamp(site, days));
}
