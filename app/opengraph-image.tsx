/**
 * Site-wide OpenGraph image (and, via app/twitter-image.tsx, the Twitter card): Founders Office
 * Hours first — the headline, every mentor's portrait and "Apply for Office Hours". Mentor
 * profiles, event pages and /office-hours have their own images.
 */
import { getMentors, getScheduleDays, getSite } from "@/content";
import { renderSiteCard } from "@/lib/og/cards";
import { OG_SIZE, siteCardModel } from "@/lib/og/model";

export const alt = siteCardModel(getSite(), getMentors(), getScheduleDays()).alt;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderSiteCard(siteCardModel(getSite(), getMentors(), getScheduleDays()));
}
