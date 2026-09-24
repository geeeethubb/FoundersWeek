import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { BrandLockup } from "./brand";
import { ApplyNavButton, SiteNav } from "./site-nav";

/**
 * Sticky header: logo + "Founders Week 2026" · Office Hours · Calendar · Apply.
 * Height: 73px from md; 122px on phones, where a 49px nav row sits below. html's scroll-padding-top
 * (globals.css) keeps anchors clear — update it if these heights change.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <Container className="flex h-[4.5rem] items-center justify-between gap-6">
        <Link href="/" className="-mx-1 rounded-xs px-1 py-1" aria-label="Founders Week 2026 home">
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label="Primary" className="hidden md:block">
            <SiteNav />
          </nav>
          <ApplyNavButton className="md:ml-2" />
        </div>
      </Container>
      <nav aria-label="Primary" className="border-t border-line md:hidden">
        <Container className="py-0.5">
          <SiteNav className="-mx-3" />
        </Container>
      </nav>
    </header>
  );
}
