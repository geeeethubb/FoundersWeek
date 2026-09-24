import { isDemoContentEnabled, isDraftPreviewEnabled } from "@/content";

/** Persistent strip whenever fictional demo content or draft copy is visible. */
export function PreviewBanner() {
  const demo = isDemoContentEnabled();
  const drafts = isDraftPreviewEnabled();
  if (!demo && !drafts) return null;
  const parts = [
    demo ? "Demo content is visible — fictional items are marked DEMO and never ship to production." : null,
    drafts ? "Draft mentor copy is visible — marked DRAFT, hidden on the public site." : null,
  ].filter(Boolean);
  return (
    <div role="note" className="border-b border-dashed border-info/40 bg-info-soft">
      <p className="mx-auto max-w-[76rem] px-5 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-info sm:px-8">
        Preview · {parts.join(" ")}
      </p>
    </div>
  );
}
