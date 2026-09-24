import Image from "next/image";
import { getSite } from "@/content";
import { cn } from "@/lib/cn";

/**
 * "Founders × Founders Week" lockup. If an approved Founders logo is configured in
 * content/site.ts (brand.foundersLogo), it is rendered at its intrinsic aspect ratio;
 * otherwise a typographic lockup is used. No logo is ever synthesized.
 */
export function BrandLockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { brand } = getSite();
  const logo = brand.foundersLogo;
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-paper", className)}>
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          className="h-6 w-auto"
          priority
        />
      ) : (
        <span className="font-wide text-[0.9375rem] font-extrabold tracking-[-0.01em]">Founders</span>
      )}
      <span aria-hidden className="font-serif text-lg italic leading-none text-accent">
        ×
      </span>
      <span className={cn("text-[0.9375rem] font-medium tracking-[-0.005em] text-paper-muted", compact && "max-[359px]:sr-only")}>
        Founders Week
      </span>
      {logo ? null : <span className="sr-only">(Founders – Illinois Entrepreneurs)</span>}
    </span>
  );
}
