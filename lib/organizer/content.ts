/**
 * The organizer directory built from live content (drafts and organizer notes included — this
 * module is only used by the protected organizer pages and APIs).
 */
import "server-only";
import { getMentorsForOrganizers } from "@/content";
import { buildOrganizerDirectory, type OrganizerDirectory } from "./directory";

export function getOrganizerDirectory(): OrganizerDirectory {
  return buildOrganizerDirectory(getMentorsForOrganizers());
}
