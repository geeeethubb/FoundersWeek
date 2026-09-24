/**
 * Mentor portrait — the site's signature visual for people.
 *
 * With an approved headshot: the photo, cropped (never stretched) into the frame.
 * Without one: an elegant initials plate over a deterministic line-art "orbit" drawn from the
 * mentor's id — every mentor gets a distinct, stable composition in the same visual language
 * (blueprint grid, hairline orbits, registration marks, one orange point). Purely decorative:
 * always render the person's name as text nearby; the portrait itself is aria-hidden unless it's
 * a real photo.
 */
import Image from "next/image";
import { cn } from "@/lib/cn";

export type PortraitSize = "xs" | "sm" | "md" | "lg" | "fluid";

export interface PortraitProps {
  /** Stable id (drives the composition). */
  id: string;
  name: string;
  headshot?: { src: string; alt: string; width: number; height: number } | null;
  size?: PortraitSize;
  /** Optional mono caption in the top-left corner, e.g. "01 / 04". Hidden below `md`. */
  caption?: string;
  className?: string;
  /** Loads eagerly (use for above-the-fold portraits). */
  priority?: boolean;
}

/** FNV-1a → 32-bit unsigned. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random sequence in [0, 1). */
function sequence(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  return (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w[0]!.toUpperCase()).join("");
}

const SIZE_CLASSES: Record<PortraitSize, string> = {
  xs: "size-9",
  sm: "size-12",
  md: "size-20",
  lg: "size-36 sm:size-44",
  fluid: "w-full aspect-[4/5]",
};

const INITIAL_CLASSES: Record<PortraitSize, string> = {
  xs: "text-[0.8125rem]",
  sm: "text-base",
  md: "text-2xl",
  lg: "text-5xl sm:text-6xl",
  fluid: "text-[clamp(3rem,9vw,6.5rem)]",
};

function OrbitArt({ id, detailed }: { id: string; detailed: boolean }) {
  const rand = sequence(hash(id));
  // Orbit center sits in the upper-right quadrant so initials (bottom-left) stay clear.
  const cx = 58 + rand() * 22;
  const cy = 22 + rand() * 20;
  const base = 16 + rand() * 8;
  const rings = [base, base * 1.72, base * 2.55, base * 3.4];
  const pointRing = rings[1 + Math.floor(rand() * 2)];
  // Keep the orange point inside the visible frame (square crops show roughly y 15–110).
  let angle = rand() * Math.PI * 2;
  for (let i = 0; i < 16; i++) {
    const x = cx + Math.cos(angle) * pointRing;
    const y = cy + Math.sin(angle) * pointRing;
    if (x > 12 && x < 90 && y > 18 && y < 72) break;
    angle += Math.PI / 8;
  }
  // Rounded: trig results can differ in the last digit between server and browser (hydration).
  const px = round3(cx + Math.cos(angle) * pointRing);
  const py = round3(cy + Math.sin(angle) * pointRing);
  const tilt = (rand() - 0.5) * 40;
  const arcStart = rand() * 360;
  const stars = Array.from({ length: detailed ? 7 : 0 }, () => ({ x: rand() * 100, y: rand() * 100, r: 0.25 + rand() * 0.35 }));

  return (
    <svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <pattern id={`grid-${id}`} width="12.5" height="12.5" patternUnits="userSpaceOnUse">
          <path d="M12.5 0H0V12.5" fill="none" stroke="rgb(244 239 231 / 0.05)" strokeWidth="0.3" />
        </pattern>
        <radialGradient id={`glow-${id}`} cx={`${cx}%`} cy={`${(cy / 125) * 100}%`} r="60%">
          <stop offset="0%" stopColor="rgb(255 95 5 / 0.14)" />
          <stop offset="100%" stopColor="rgb(255 95 5 / 0)" />
        </radialGradient>
      </defs>
      <rect width="100" height="125" fill={`url(#grid-${id})`} />
      {detailed ? <rect width="100" height="125" fill={`url(#glow-${id})`} /> : null}
      <g transform={`rotate(${tilt} ${cx} ${cy})`} fill="none">
        {rings.map((r, i) => (
          <ellipse
            key={r}
            cx={cx}
            cy={cy}
            rx={r}
            ry={r * (detailed ? 0.92 : 1)}
            stroke={`rgb(244 239 231 / ${i === 1 ? 0.26 : 0.14})`}
            strokeWidth={i === 1 ? 0.45 : 0.3}
            strokeDasharray={i === 2 ? "1.2 1.6" : undefined}
          />
        ))}
        {detailed ? (
          <path
            d={describeArc(cx, cy, rings[3], arcStart, arcStart + 70)}
            stroke="rgb(255 95 5 / 0.75)"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        ) : null}
      </g>
      {/* Crosshair at the orbit center */}
      <path
        d={`M${cx - 2.2} ${cy}H${cx + 2.2}M${cx} ${cy - 2.2}V${cy + 2.2}`}
        stroke="rgb(244 239 231 / 0.35)"
        strokeWidth="0.35"
      />
      {/* The orange point + its tether */}
      <line x1={cx} y1={cy} x2={px} y2={py} stroke="rgb(255 95 5 / 0.35)" strokeWidth="0.3" strokeDasharray="0.8 1.2" />
      <circle cx={px} cy={py} r={detailed ? 1.5 : 2.2} fill="#ff5f05" />
      {detailed ? <circle cx={px} cy={py} r="3.6" fill="none" stroke="rgb(255 95 5 / 0.45)" strokeWidth="0.3" /> : null}
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="rgb(244 239 231 / 0.35)" />
      ))}
    </svg>
  );
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: round3(cx + r * Math.cos(rad)), y: round3(cy + r * Math.sin(rad)) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function MentorPortrait({ id, name, headshot, size = "md", caption, className, priority }: PortraitProps) {
  const detailed = size === "lg" || size === "fluid" || size === "md";
  const frame = cn(
    "relative isolate block shrink-0 overflow-hidden rounded-sm border border-line-strong bg-ink-850",
    SIZE_CLASSES[size],
    className,
  );

  if (headshot) {
    return (
      <span className={frame}>
        <Image
          src={headshot.src}
          alt={headshot.alt}
          width={headshot.width}
          height={headshot.height}
          priority={priority}
          sizes={size === "fluid" ? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" : "176px"}
          className="size-full object-cover"
        />
        <Registration size={size} />
      </span>
    );
  }

  return (
    <span className={frame} aria-hidden>
      <OrbitArt id={id} detailed={detailed} />
      {caption && (size === "lg" || size === "fluid") ? (
        <span className="mono-label absolute left-3 top-3 text-paper-subtle">{caption}</span>
      ) : null}
      <span
        className={cn(
          "absolute font-wide font-extrabold leading-none tracking-[-0.04em] text-paper",
          size === "xs" || size === "sm" ? "inset-0 flex items-center justify-center" : "bottom-[8%] left-[9%]",
          INITIAL_CLASSES[size],
        )}
      >
        {initialsOf(name)}
      </span>
      <Registration size={size} />
    </span>
  );
}

/** Corner registration marks — the site's quiet technical frame. */
function Registration({ size }: { size: PortraitSize }) {
  if (size === "xs") return null;
  const tick = size === "sm" ? "size-1.5" : "size-2.5";
  return (
    <>
      <span className={cn("absolute left-1 top-1 border-l border-t border-accent/70", tick)} />
      <span className={cn("absolute bottom-1 right-1 border-b border-r border-accent/70", tick)} />
    </>
  );
}
