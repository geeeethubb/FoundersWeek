/**
 * MentorAvatar — a small mentor portrait for lists and rows (the schedule's "Scheduling in
 * progress" block, profile cross-links). Thin wrapper over the site's signature
 * `MentorPortrait` (components/ui/portrait.tsx): the approved headshot when there is one, else
 * the deterministic orbit line-art with initials.
 *
 * Props
 * - `mentor`: `{ id?, name, headshot }` from a public Mentor record. `id` drives the orbit
 *   composition (falls back to the name).
 * - `size`: "sm" (36px) · "md" (48px) · "lg" (80px) · "xl" (144–176px). Default "md".
 * - `priority`: preload the headshot (above-the-fold only).
 * - `className`: extra classes for the frame.
 *
 * Decorative next to a visible name: the orbit art is aria-hidden; a real headshot keeps its
 * content-supplied alt text.
 */
import type { Mentor } from "@/content/types";
import { MentorPortrait, type PortraitSize } from "@/components/ui/portrait";

export type MentorAvatarSize = "sm" | "md" | "lg" | "xl";

const PORTRAIT_SIZE: Record<MentorAvatarSize, PortraitSize> = { sm: "xs", md: "sm", lg: "md", xl: "lg" };

export function MentorAvatar({
  mentor,
  size = "md",
  priority = false,
  className,
}: {
  mentor: Pick<Mentor, "name" | "headshot"> & { id?: string };
  size?: MentorAvatarSize;
  priority?: boolean;
  className?: string;
}) {
  return (
    <MentorPortrait
      id={mentor.id ?? mentor.name}
      name={mentor.name}
      headshot={mentor.headshot}
      size={PORTRAIT_SIZE[size]}
      priority={priority}
      className={className}
    />
  );
}
