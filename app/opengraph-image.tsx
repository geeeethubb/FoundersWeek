/**
 * Site-wide OpenGraph image (and, via app/twitter-image.tsx, the Twitter card): Founders Office
 * Hours — the headline, every mentor's headshot and "Apply for Office Hours", in the Founders
 * brand. Mentor profiles and event pages have their own images.
 */
import { getMentors, getSite } from "@/content";
import { renderSiteCard } from "@/lib/og/cards";
import { OG_SIZE, siteCardModel } from "@/lib/og/model";

export const alt = siteCardModel(getSite(), getMentors()).alt;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderSiteCard(siteCardModel(getSite(), getMentors()));
}
