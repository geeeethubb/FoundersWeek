import { cn } from "@/lib/cn";
import { AlertIcon, InfoIcon } from "./icons";

/** Page-width wrapper with consistent gutters. */
export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
}) {
  return <Tag className={cn("mx-auto w-full max-w-[76rem] px-5 sm:px-8", className)}>{children}</Tag>;
}

/** Monospaced uppercase label, optionally with a section index ("01"). */
export function Eyebrow({
  index,
  className,
  children,
  as: Tag = "p",
}: {
  index?: string;
  className?: string;
  children: React.ReactNode;
  as?: "p" | "span" | "h2" | "h3" | "div";
}) {
  return (
    <Tag className={cn("mono-label flex items-center gap-2 text-paper-muted", className)}>
      {index ? <span className="text-accent tabular">{index}</span> : null}
      {index ? <span aria-hidden className="h-px w-5 bg-line-strong" /> : null}
      <span>{children}</span>
    </Tag>
  );
}

/** Section heading block: eyebrow + title + optional lede + optional actions. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lede,
  actions,
  id,
  className,
  as: Heading = "h2",
}: {
  index?: string;
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-col gap-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <Eyebrow index={index} className="mb-4">
            {eyebrow}
          </Eyebrow>
        ) : null}
        <Heading
          id={id}
          className="font-wide text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-paper sm:text-4xl"
        >
          {title}
        </Heading>
        {lede ? <div className="mt-4 text-base leading-relaxed text-paper-muted sm:text-lg">{lede}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export type NoticeTone = "info" | "warning" | "danger" | "success" | "neutral" | "demo";

const noticeTones: Record<NoticeTone, string> = {
  info: "border-info/30 bg-info-soft text-paper",
  warning: "border-warning/35 bg-warning-soft text-paper",
  danger: "border-danger/40 bg-danger-soft text-paper",
  success: "border-success/35 bg-success-soft text-paper",
  neutral: "border-line-strong bg-ink-850 text-paper",
  demo: "border-info/40 border-dashed bg-info-soft text-paper",
};

const noticeIcon: Record<NoticeTone, string> = {
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
  neutral: "text-paper-muted",
  demo: "text-info",
};

/** Inline callout for status, caveats and errors. */
export function Notice({
  tone = "neutral",
  title,
  children,
  className,
  role,
  icon = true,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
  icon?: boolean;
}) {
  const Icon = tone === "danger" || tone === "warning" ? AlertIcon : InfoIcon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-sm border px-4 py-3 text-sm leading-relaxed", noticeTones[tone], className)}>
      {icon ? <Icon className={cn("mt-0.5 size-4 shrink-0", noticeIcon[tone])} /> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold text-paper">{title}</p> : null}
        {children ? <div className={cn("text-paper-muted", title ? "mt-1" : null)}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Initials fallback for mentor headshots. */
export function Monogram({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  // First letters of the first and last words ("Vikram “Vik” Lakhwara" → "VL").
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const sizes = {
    sm: "size-10 text-sm",
    md: "size-14 text-lg",
    lg: "size-20 text-2xl",
    xl: "size-28 text-4xl",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line-strong bg-ink-850 font-wide font-bold tracking-[-0.02em] text-paper",
        sizes[size],
        className,
      )}
    >
      {/* Registration ticks: a quiet technical frame. */}
      <span className="absolute left-1 top-1 h-1.5 w-1.5 border-l border-t border-accent/70" />
      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 border-b border-r border-accent/70" />
      {initials}
    </span>
  );
}

/** Label/value row used in detail panels. */
export function MetaRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[7.5rem_1fr] gap-4 border-t border-line py-3 text-sm sm:grid-cols-[9rem_1fr]", className)}>
      <dt className="mono-label pt-0.5 text-paper-subtle">{label}</dt>
      <dd className="min-w-0 text-paper">{children}</dd>
    </div>
  );
}

/** Screen-reader-only text. */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
