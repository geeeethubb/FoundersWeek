import Image from "next/image";
import { getSite } from "@/content";
import { cn } from "@/lib/cn";

/**
 * Founders logo + a small "Founders Week 2026" label.
 *
 * The logo is public/brand/founders-logo.png: a tight crop of the supplied artwork
 * (public/brand/founders-logo-original.png, kept intact) with only the foreground mark and
 * wordmark — the white background and pale background emblem removed, original colors and
 * proportions unchanged. Rendered by height with auto width, so it is never distorted.
 */
export function BrandLockup({
  className,
  size = "md",
  showWeek = true,
}: {
  className?: string;
  size?: "md" | "lg";
  showWeek?: boolean;
}) {
  const { brand, week } = getSite();
  const logo = brand.foundersLogo;
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          className={cn("w-auto", size === "lg" ? "h-12" : "h-9 md:h-10")}
          priority
        />
      ) : (
        <span className="text-lg font-extrabold tracking-tight text-charcoal">Founders</span>
      )}
      {showWeek ? (
        <span className="border-l border-line-strong pl-3 text-[0.8125rem] font-medium leading-tight text-text-muted max-[359px]:sr-only">
          {week.name}
          <br className="sm:hidden" />
          <span className="sm:ml-1">{week.year}</span>
        </span>
      ) : null}
    </span>
  );
}
