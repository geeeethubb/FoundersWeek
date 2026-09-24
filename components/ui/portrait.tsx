/**
 * Mentor portrait: the approved headshot (cropped to the frame, never stretched), or simple
 * initials when no photo is available. Decorative when it's initials — always render the
 * person's name as text nearby.
 */
import Image from "next/image";
import { cn } from "@/lib/cn";

export type PortraitSize = "xs" | "sm" | "md" | "lg" | "fluid";

export interface PortraitProps {
  /** Stable id (kept for API compatibility). */
  id: string;
  name: string;
  headshot?: { src: string; alt: string; width: number; height: number } | null;
  size?: PortraitSize;
  /** Retired: decorative captions are no longer rendered. */
  caption?: string;
  className?: string;
  /** Loads eagerly (use for above-the-fold portraits). */
  priority?: boolean;
}

export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  return (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w[0]!.toUpperCase()).join("");
}

const SIZE_CLASSES: Record<PortraitSize, string> = {
  xs: "size-9 rounded-full",
  sm: "size-12 rounded-full",
  md: "size-20 rounded-md",
  lg: "size-36 sm:size-44 rounded-md",
  fluid: "w-full aspect-square rounded-md",
};

const INITIAL_CLASSES: Record<PortraitSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-4xl",
  fluid: "text-5xl",
};

const IMAGE_SIZES: Record<PortraitSize, string> = {
  xs: "36px",
  sm: "48px",
  md: "80px",
  lg: "176px",
  fluid: "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw",
};

export function MentorPortrait({ name, headshot, size = "md", className, priority }: PortraitProps) {
  const frame = cn("relative block shrink-0 overflow-hidden bg-surface-muted", SIZE_CLASSES[size], className);
  if (headshot) {
    return (
      <span className={frame}>
        <Image
          src={headshot.src}
          alt={headshot.alt}
          width={headshot.width}
          height={headshot.height}
          priority={priority}
          sizes={IMAGE_SIZES[size]}
          className="size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className={cn(frame, "flex items-center justify-center")} aria-hidden>
      <span className={cn("font-semibold tracking-tight text-charcoal", INITIAL_CLASSES[size])}>{initialsOf(name)}</span>
    </span>
  );
}
