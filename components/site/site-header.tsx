import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { BrandLockup } from "./brand";
import { ApplyNavButton, SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-900/95 supports-[backdrop-filter]:bg-ink-900/90">
      <Container className="flex h-14 items-center justify-between gap-6 md:h-16">
        <Link href="/" className="-mx-1 rounded-xs px-1 py-1" aria-label="Founders × Founders Week — home">
          <BrandLockup compact />
        </Link>
        <nav aria-label="Primary" className="hidden h-full items-center gap-8 md:flex">
          <SiteNav variant="desktop" />
          <ApplyNavButton />
        </nav>
        <ApplyNavButton className="md:hidden" />
      </Container>
      <nav aria-label="Primary" className="border-t border-line md:hidden">
        <Container>
          <SiteNav variant="mobile" />
        </Container>
      </nav>
    </header>
  );
}
