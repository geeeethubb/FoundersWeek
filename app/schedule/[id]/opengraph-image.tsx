/**
 * OpenGraph image for an event page (/schedule/<id>): date, Founders involvement, title, time and
 * place. Only office-hours entries carry the application CTA — never the Dan Caruso fireside chat
 * or any other event. Unknown ids fall back to the site card.
 */
import { getMentors, getScheduleEntry, getSite } from "@/content";
import { renderEventCard, renderSiteCard } from "@/lib/og/cards";
import { eventCardModel, OG_SIZE, siteCardModel } from "@/lib/og/model";

export const size = OG_SIZE;
export const contentType = "image/png";

/** One image per event; used for its per-event alt text. (`params` may be a plain object or a promise.) */
export async function generateImageMetadata({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite();
  const entry = getScheduleEntry(id);
  const alt = entry ? eventCardModel(entry, site).alt : siteCardModel(site, getMentors()).alt;
  return [{ id: "card", alt, size: OG_SIZE, contentType: "image/png" }];
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite();
  const entry = getScheduleEntry(id);
  if (!entry) return renderSiteCard(siteCardModel(site, getMentors()));
  return renderEventCard(eventCardModel(entry, site));
}
