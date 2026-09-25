/**
 * The organizer directory built from live content (drafts and organizer notes included — this
 * module is only used by the protected organizer pages and APIs), with sessions generated from
 * exact windows under the site's office-hours rule (site.officeHours).
 */
import "server-only";
import { getMentorsForOrganizers, getSite } from "@/content";
import { buildOrganizerDirectory, type OrganizerDirectory } from "./directory";

export function getOrganizerDirectory(): OrganizerDirectory {
  return buildOrganizerDirectory(getMentorsForOrganizers(), getSite().officeHours);
}
