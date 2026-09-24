/**
 * OpenGraph image for a mentor profile (/office-hours/<id>): approved headshot, name, verified role
 * and company, and one availability line ("Thu, Oct 1 · 10:00–11:30 AM CT" or "Scheduling in
 * progress"). Unknown ids fall back to the Office Hours card.
 */
import { getMentor, getMentors, getSite } from "@/content";
import { renderMentorCard, renderSiteCard } from "@/lib/og/cards";
import { mentorCardModel, OG_SIZE, siteCardModel } from "@/lib/og/model";

export const size = OG_SIZE;
export const contentType = "image/png";

/** One image per profile; used for its per-mentor alt text. (`params` may be a plain object or a promise.) */
export async function generateImageMetadata({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite();
  const mentor = getMentor(id);
  const alt = mentor ? mentorCardModel(mentor, site).alt : siteCardModel(site, getMentors()).alt;
  return [{ id: "card", alt, size: OG_SIZE, contentType: "image/png" }];
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite();
  const mentor = getMentor(id);
  if (!mentor) return renderSiteCard(siteCardModel(site, getMentors()));
  return renderMentorCard(mentorCardModel(mentor, site));
}
