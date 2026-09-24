/**
 * sitemap.xml — public pages only, as absolute URLs from getSiteUrl(): home, Office Hours (the
 * application lives there, #apply), the Calendar, every mentor profile and every calendar entry.
 * Demo content is never listed; organizer pages, the API and applicant status links never are.
 */
import type { MetadataRoute } from "next";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import { getSiteUrl } from "@/lib/config";
import { mentorProfileHref } from "@/lib/mentors-view";
import { eventHref } from "@/lib/schedule/url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = getSite().week.lastReviewed;
  const url = (path: string) => `${base}${path === "/" ? "" : path}`;

  const pages: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: url("/office-hours"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: url("/schedule"), lastModified, changeFrequency: "daily", priority: 0.9 },
  ];
  const mentors: MetadataRoute.Sitemap = getMentors()
    .filter((m) => !m.demo)
    .map((m) => ({ url: url(mentorProfileHref(m.id)), lastModified, changeFrequency: "daily", priority: 0.8 }));
  const events: MetadataRoute.Sitemap = getScheduleEntries()
    .filter((e) => !e.demo)
    .map((e) => ({
      url: url(eventHref(e.id)),
      lastModified,
      changeFrequency: "daily",
      priority: e.featuredRank !== null ? 0.8 : 0.6,
    }));
  return [...pages, ...mentors, ...events];
}
