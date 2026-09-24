/**
 * Social image cards (1200 × 630) rendered with next/og's ImageResponse (Satori + Resvg).
 * On-brand: ink ground with the blueprint grid, warm paper type, Illinois orange as a controlled
 * accent (the ×, numerals, CTA pill, registration ticks), JetBrains Mono for metadata, Archivo
 * SemiExpanded for headlines, Instrument Serif italic as the editorial accent. The mentor portrait
 * reproduces the site's MentorPortrait orbit composition (same deterministic algorithm).
 *
 * Satori notes: every element with more than one child needs `display: flex`; no grid; glyphs must
 * exist in lib/og/fonts (arrows and diamonds are drawn as shapes).
 */
import { ImageResponse } from "next/og";
import type { AvailabilityKind } from "@/components/ui/status";
import { loadOgFonts, OG_FONT } from "./fonts";
import {
  OG_SIZE,
  titleFontSize,
  type EventCardModel,
  type MentorCardModel,
  type OgBadge,
  type OgLine,
  type OgPortrait,
  type SiteCardModel,
} from "./model";

const C = {
  ink950: "#070a12",
  ink900: "#0a0f1c",
  ink850: "#0e1526",
  ink800: "#131b30",
  paper: "#f4efe7",
  muted: "#ada89f",
  subtle: "#8e8a83",
  accent: "#ff5f05",
  accentSoft: "rgba(255,95,5,0.12)",
  accentLine: "rgba(255,95,5,0.45)",
  line: "rgba(244,239,231,0.09)",
  lineStrong: "rgba(244,239,231,0.17)",
  warning: "#f3c969",
} as const;

const mono = { fontFamily: OG_FONT.mono, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em" } as const;

async function render(node: React.ReactElement, headers?: Record<string, string>): Promise<ImageResponse> {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
    headers,
  });
}

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------

function Frame({ children, stamp }: { children: React.ReactNode; stamp: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: C.ink900,
        backgroundImage:
          "linear-gradient(to right, rgba(244,239,231,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,239,231,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        color: C.paper,
        fontFamily: OG_FONT.sans,
        padding: "56px 64px 52px",
      }}
    >
      <Ticks />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Lockup />
        <div style={{ ...mono, display: "flex", fontSize: 15, color: C.muted }}>{stamp}</div>
      </div>
      {children}
    </div>
  );
}

/** "Founders × Founders Week" — the typographic lockup (no logo is ever synthesized). */
function Lockup() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", fontFamily: OG_FONT.wide, fontWeight: 800, fontSize: 26, letterSpacing: "-0.01em" }}>
        Founders
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: OG_FONT.serif,
          fontStyle: "italic",
          fontSize: 32,
          color: C.accent,
          margin: "0 12px",
          lineHeight: 1,
        }}
      >
        ×
      </div>
      <div style={{ display: "flex", fontSize: 26, color: C.muted }}>Founders Week</div>
    </div>
  );
}

/** Orange registration ticks in the four corners. */
function Ticks() {
  const b = `2px solid ${C.accent}`;
  const base = { position: "absolute", width: 22, height: 22, display: "flex" } as const;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex" }}>
      <div style={{ ...base, left: 22, top: 22, borderLeft: b, borderTop: b }} />
      <div style={{ ...base, right: 22, top: 22, borderRight: b, borderTop: b }} />
      <div style={{ ...base, left: 22, bottom: 22, borderLeft: b, borderBottom: b }} />
      <div style={{ ...base, right: 22, bottom: 22, borderRight: b, borderBottom: b }} />
    </div>
  );
}

function Diamond({ size = 10, color = C.accent }: { size?: number; color?: string }) {
  return <div style={{ display: "flex", width: size, height: size, backgroundColor: color, transform: "rotate(45deg)" }} />;
}

/**
 * Text that wraps only between words (Satori would otherwise break "$10K/Month" after the slash).
 * Each word is its own flex item.
 */
function Words({ text, fontSize, style }: { text: string; fontSize: number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: Math.round(fontSize * 0.27), fontSize, ...style }}>
      {text
        .split(/\s+/)
        .filter(Boolean)
        .map((word, i) => (
          <span key={i}>{word}</span>
        ))}
    </div>
  );
}

function Arrow({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CtaPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        backgroundColor: C.accent,
        color: C.ink900,
        borderRadius: 6,
        padding: "16px 24px",
        fontSize: 24,
        fontWeight: 500,
      }}
    >
      <div style={{ display: "flex" }}>{label}</div>
      <Arrow size={22} color={C.ink900} />
    </div>
  );
}

const BADGE_TONES: Record<OgBadge["tone"], { color: string; border: string; background: string }> = {
  "accent-solid": { color: C.ink900, border: C.accent, background: C.accent },
  accent: { color: C.accent, border: C.accentLine, background: "transparent" },
  muted: { color: C.muted, border: C.lineStrong, background: "transparent" },
  warning: { color: C.warning, border: "rgba(243,201,105,0.45)", background: "transparent" },
};

function Badge({ badge }: { badge: OgBadge }) {
  const t = BADGE_TONES[badge.tone];
  return (
    <div
      style={{
        ...mono,
        display: "flex",
        alignItems: "center",
        height: 36,
        padding: "0 14px",
        fontSize: 15,
        letterSpacing: "0.08em",
        color: t.color,
        backgroundColor: t.background,
        border: `1.5px ${badge.line === "solid" ? "solid" : "dashed"} ${t.border}`,
        borderRadius: 3,
      }}
    >
      {badge.label}
    </div>
  );
}

/**
 * Vertical rule on the left of availability/date blocks — line style = certainty (solid confirmed,
 * dashed planned/window, dotted forthcoming). Drawn as a patterned bar: Satori has no dotted borders.
 */
function Rule({ line, color, width = 3 }: { line: OgLine; color: string; width?: number }) {
  const pattern: React.CSSProperties =
    line === "solid"
      ? { backgroundColor: color }
      : line === "dashed"
        ? {
            backgroundImage: `linear-gradient(to bottom, ${color} 0%, ${color} 58%, transparent 58%, transparent 100%)`,
            backgroundSize: `${width}px 13px`,
            backgroundRepeat: "repeat-y",
          }
        : {
            backgroundImage: `radial-gradient(circle at center, ${color} 0%, ${color} 45%, transparent 55%)`,
            backgroundSize: `${width}px ${width * 2.4}px`,
            backgroundRepeat: "repeat-y",
          };
  return <div style={{ display: "flex", width, flexShrink: 0, alignSelf: "stretch", ...pattern }} />;
}

// ---------------------------------------------------------------------------
// Portrait (same composition as components/ui/portrait.tsx)
// ---------------------------------------------------------------------------

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sequence(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const polar = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: r3(cx + r * Math.cos(rad)), y: r3(cy + r * Math.sin(rad)) };
  };
  const s = polar(end);
  const e = polar(start);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${end - start <= 180 ? 0 : 1} 0 ${e.x} ${e.y}`;
}

/** Orbit line-art for a portrait of `width` × `height` (viewBox 100 × 125, sliced to fit). */
function OrbitArt({ id, width, height }: { id: string; width: number; height: number }) {
  const rand = sequence(hash(id));
  const cx = 58 + rand() * 22;
  const cy = 22 + rand() * 20;
  const base = 16 + rand() * 8;
  const rings = [base, base * 1.72, base * 2.55, base * 3.4];
  const pointRing = rings[1 + Math.floor(rand() * 2)];
  let angle = rand() * Math.PI * 2;
  for (let i = 0; i < 16; i++) {
    const x = cx + Math.cos(angle) * pointRing;
    const y = cy + Math.sin(angle) * pointRing;
    if (x > 12 && x < 90 && y > 18 && y < 72) break;
    angle += Math.PI / 8;
  }
  const px = r3(cx + Math.cos(angle) * pointRing);
  const py = r3(cy + Math.sin(angle) * pointRing);
  const tilt = (rand() - 0.5) * 40;
  const arcStart = rand() * 360;
  const stars = Array.from({ length: 7 }, () => ({ x: rand() * 100, y: rand() * 100, r: 0.25 + rand() * 0.35 }));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      <defs>
        <radialGradient id="g" cx={`${cx}%`} cy={`${(cy / 125) * 100}%`} r="60%">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="125" fill="url(#g)" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`v${i}`} d={`M${i * 12.5} 0V125`} stroke={C.paper} strokeOpacity="0.05" strokeWidth="0.3" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <path key={`h${i}`} d={`M0 ${i * 12.5}H100`} stroke={C.paper} strokeOpacity="0.05" strokeWidth="0.3" />
      ))}
      <g transform={`rotate(${r3(tilt)} ${r3(cx)} ${r3(cy)})`} fill="none">
        {rings.map((r, i) => (
          <ellipse
            key={i}
            cx={r3(cx)}
            cy={r3(cy)}
            rx={r3(r)}
            ry={r3(r * 0.92)}
            stroke={C.paper}
            strokeOpacity={i === 1 ? 0.28 : 0.15}
            strokeWidth={i === 1 ? 0.45 : 0.3}
            strokeDasharray={i === 2 ? "1.2 1.6" : undefined}
          />
        ))}
        <path d={arcPath(cx, cy, rings[3], arcStart, arcStart + 70)} stroke={C.accent} strokeOpacity="0.8" strokeWidth="0.6" strokeLinecap="round" />
      </g>
      <path d={`M${r3(cx - 2.2)} ${r3(cy)}H${r3(cx + 2.2)}M${r3(cx)} ${r3(cy - 2.2)}V${r3(cy + 2.2)}`} stroke={C.paper} strokeOpacity="0.35" strokeWidth="0.35" />
      <line x1={r3(cx)} y1={r3(cy)} x2={px} y2={py} stroke={C.accent} strokeOpacity="0.4" strokeWidth="0.3" strokeDasharray="0.8 1.2" />
      <circle cx={px} cy={py} r="1.5" fill={C.accent} />
      <circle cx={px} cy={py} r="3.6" fill="none" stroke={C.accent} strokeOpacity="0.45" strokeWidth="0.3" />
      {stars.map((s, i) => (
        <circle key={i} cx={r3(s.x)} cy={r3(s.y)} r={r3(s.r)} fill={C.paper} fillOpacity="0.35" />
      ))}
    </svg>
  );
}

function Portrait({
  portrait,
  width,
  height,
  initialsSize,
  showCaption = true,
}: {
  portrait: OgPortrait;
  width: number;
  height: number;
  initialsSize: number;
  showCaption?: boolean;
}) {
  const tick = Math.max(10, Math.round(width / 16));
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        overflow: "hidden",
        backgroundColor: C.ink850,
        border: `1.5px solid ${C.lineStrong}`,
        borderRadius: 4,
      }}
    >
      <OrbitArt id={portrait.id} width={width} height={height} />
      {showCaption && portrait.caption ? (
        <div style={{ ...mono, position: "absolute", left: 14, top: 12, fontSize: 13, color: C.subtle, display: "flex" }}>
          {portrait.caption}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: Math.round(width * 0.09),
          bottom: Math.round(height * 0.07),
          display: "flex",
          fontFamily: OG_FONT.wide,
          fontWeight: 800,
          fontSize: initialsSize,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: C.paper,
        }}
      >
        {portrait.initials}
      </div>
      <div style={{ position: "absolute", left: 5, top: 5, width: tick, height: tick, borderLeft: `1.5px solid ${C.accentLine}`, borderTop: `1.5px solid ${C.accentLine}`, display: "flex" }} />
      <div style={{ position: "absolute", right: 5, bottom: 5, width: tick, height: tick, borderRight: `1.5px solid ${C.accentLine}`, borderBottom: `1.5px solid ${C.accentLine}`, display: "flex" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Site default: Founders Office Hours first. */
export async function renderSiteCard(model: SiteCardModel): Promise<ImageResponse> {
  const tiles = model.portraits.slice(0, 4);
  const cols = tiles.length > 2 ? 2 : Math.max(1, tiles.length);
  const tile = tiles.length > 2 ? 164 : 200;
  return render(
    <Frame stamp={model.stamp}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 660 }}>
          <div style={{ ...mono, display: "flex", alignItems: "center", gap: 14, fontSize: 17, color: C.accent }}>
            <Diamond />
            <div style={{ display: "flex" }}>{model.kicker}</div>
          </div>
          <Words
            text={model.headline}
            fontSize={70}
            style={{ marginTop: 22, fontFamily: OG_FONT.wide, fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.045em" }}
          />
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT.serif,
              fontStyle: "italic",
              fontSize: 84,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginTop: 2,
            }}
          >
            {model.headlineAccent}
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 25, lineHeight: 1.4, color: C.muted, maxWidth: 620 }}>
            {model.sub}
          </div>
        </div>
        {tiles.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", width: cols * tile + (cols - 1) * 12, gap: 12 }}>
            {tiles.map((p) => (
              <Portrait key={p.id} portrait={p} width={tile} height={tile} initialsSize={Math.round(tile * 0.3)} />
            ))}
          </div>
        ) : null}
      </div>
      <BottomBar meta={model.meta} cta={model.cta} />
    </Frame>,
  );
}

function BottomBar({ meta, cta }: { meta: string; cta: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1.5px solid ${C.line}`,
        paddingTop: 24,
      }}
    >
      <div style={{ ...mono, display: "flex", fontSize: 16, color: C.muted }}>{meta}</div>
      {cta ? <CtaPill label={cta} /> : null}
    </div>
  );
}

const AVAILABILITY_LINE: Record<AvailabilityKind, { line: OgLine; color: string }> = {
  window: { line: "dashed", color: C.lineStrong },
  "window-approx": { line: "dotted", color: C.lineStrong },
  "in-progress": { line: "dotted", color: C.lineStrong },
  proposed: { line: "dashed", color: "rgba(243,201,105,0.6)" },
  confirmed: { line: "solid", color: "rgba(111,211,164,0.6)" },
};

/** A mentor: portrait, name, verified role · organization, availability state and CTA wording. */
export async function renderMentorCard(model: MentorCardModel, meta: string): Promise<ImageResponse> {
  const nameSize = model.name.length > 18 ? 62 : 76;
  const a = AVAILABILITY_LINE[model.availability.kind];
  return render(
    <Frame stamp={model.stamp}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <Portrait portrait={model.portrait} width={272} height={340} initialsSize={104} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Words
            text={model.name}
            fontSize={nameSize}
            style={{ fontFamily: OG_FONT.wide, fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.04em" }}
          />
          {model.roleLine ? (
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: C.paper }}>{model.roleLine}</div>
          ) : null}
          <div style={{ display: "flex", marginTop: 34, gap: 20 }}>
            <Rule line={a.line} color={a.color} />
            <div style={{ display: "flex", flexDirection: "column", paddingTop: 2, paddingBottom: 2 }}>
              <div style={{ ...mono, display: "flex", fontSize: 16, color: C.muted }}>{model.availability.label}</div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontFamily: OG_FONT.mono,
                  fontSize: 25,
                  lineHeight: 1.35,
                  color: model.availability.kind === "in-progress" ? C.muted : C.paper,
                }}
              >
                {model.availability.value}
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomBar meta={meta} cta={model.cta} />
    </Frame>,
  );
}

/** An event (or an office-hours window). Events never carry an application CTA. */
export async function renderEventCard(model: EventCardModel): Promise<ImageResponse> {
  const size = titleFontSize(model.title);
  return render(
    <Frame stamp={model.stamp}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <div style={{ display: "flex", width: 214, gap: 24 }}>
          <Rule line={model.certainty} color={C.accent} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...mono, display: "flex", fontSize: 20, color: C.muted }}>{model.weekday}</div>
            <div
              style={{
                display: "flex",
                fontFamily: OG_FONT.wide,
                fontWeight: 800,
                fontSize: 132,
                lineHeight: 0.9,
                letterSpacing: "-0.06em",
                marginTop: 8,
              }}
            >
              {model.day}
            </div>
            <div style={{ ...mono, display: "flex", fontSize: 20, color: C.subtle, marginTop: 12 }}>{model.month}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {model.rank || model.badges.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              {model.rank ? (
                <div style={{ ...mono, display: "flex", fontSize: 16, color: C.accent, marginRight: 8 }}>{model.rank}</div>
              ) : null}
              {model.badges.map((b) => (
                <Badge key={b.label} badge={b} />
              ))}
            </div>
          ) : null}
          <Words
            text={model.title}
            fontSize={size}
            style={{ marginTop: 26, fontFamily: OG_FONT.wide, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.035em" }}
          />
          {model.people ? (
            <div style={{ display: "flex", marginTop: 18, fontSize: 27, color: C.muted }}>{model.people}</div>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: model.people ? 18 : 28,
              fontFamily: OG_FONT.mono,
              fontSize: 25,
              color: C.paper,
              gap: 16,
            }}
          >
            <div style={{ display: "flex" }}>{model.when}</div>
            <div style={{ display: "flex", color: C.subtle }}>·</div>
            <div style={{ display: "flex", color: model.where.endsWith("forthcoming") ? C.muted : C.paper }}>{model.where}</div>
          </div>
        </div>
      </div>
      <BottomBar meta={model.detail ?? ""} cta={model.cta} />
    </Frame>,
  );
}
