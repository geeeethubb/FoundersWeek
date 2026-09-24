/**
 * OpenGraph image for /office-hours (also used for its Twitter card): the Office Hours card with
 * every mentor's portrait and "Apply for Office Hours".
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
