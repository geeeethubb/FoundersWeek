/**
 * Social image cards (1200 × 630) rendered with next/og's ImageResponse (Satori + Resvg), in the
 * Founders brand: white ground, charcoal Archivo type, the Founders logo, approved mentor
 * headshots, and golden orange only as a short accent rule, small indicators and the CTA fill.
 * Logo and headshots are read from /public on disk (./assets.ts) — nothing is fetched.
 *
 * Satori notes: every element with more than one child needs `display: flex`; no grid; glyphs must
 * exist in lib/og/fonts (arrows are drawn as shapes).
 */
import { ImageResponse } from "next/og";
import { getSite } from "@/content";
import { publicImageDataUrl } from "./assets";
import { loadOgFonts, OG_FONT_FAMILY } from "./fonts";
import {
  OG_SIZE,
  titleFontSize,
  type EventCardModel,
  type MentorCardModel,
  type OgInvolvementTone,
  type OgPerson,
  type SiteCardModel,
} from "./model";

/** Brand palette (app/globals.css). */
const C = {
  white: "#ffffff",
  text: "#262626",
  charcoal: "#3c3c3c",
  muted: "#555555",
  subtle: "#6b6b6b",
  line: "#e8e8e6",
  lineStrong: "#d6d6d3",
  surfaceMuted: "#eeeeee",
  accent: "#ff9600",
  accentSoft: "#fff4e5",
  accentStrong: "#a35500",
} as const;

async function render(node: React.ReactElement): Promise<ImageResponse> {
  return new ImageResponse(node, { ...OG_SIZE, fonts: await loadOgFonts() });
}

/** The logo as a data URL with its display width at `height`, or null (typographic fallback). */
async function loadLogo(height: number): Promise<{ src: string; width: number; height: number } | null> {
  const logo = getSite().brand.foundersLogo;
  if (!logo) return null;
  const src = await publicImageDataUrl(logo.src);
  return src ? { src, height, width: Math.round((logo.width / logo.height) * height) } : null;
}

async function headshots(people: OgPerson[]): Promise<Map<string, string>> {
  const pairs = await Promise.all(people.map(async (p) => [p.id, await publicImageDataUrl(p.headshot)] as const));
  return new Map(pairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1])));
}

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------

type Logo = Awaited<ReturnType<typeof loadLogo>>;

function Frame({ logo, label, children }: { logo: Logo; label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.white,
        color: C.text,
        fontFamily: OG_FONT_FAMILY,
        fontWeight: 500,
        padding: "52px 72px 56px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 28,
          borderBottom: `2px solid ${C.surfaceMuted}`,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori renders plain <img>; the card's alt text lives on the route.
          <img src={logo.src} width={logo.width} height={logo.height} />
        ) : (
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: C.charcoal, letterSpacing: "-0.02em" }}>
            Founders
          </div>
        )}
        <div style={{ display: "flex", fontSize: 24, color: C.subtle }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

/** The short orange accent rule above a kicker. */
function AccentRule() {
  return <div style={{ display: "flex", width: 64, height: 5, borderRadius: 3, backgroundColor: C.accent }} />;
}

/**
 * Text that wraps only between words (Satori would otherwise break "$10K/Month" after the slash).
 * Each word is its own flex item.
 */
function Words({ text, fontSize, style }: { text: string; fontSize: number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: Math.round(fontSize * 0.26), fontSize, ...style }}>
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
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
        color: C.text,
        borderRadius: 8,
        padding: "16px 26px",
        fontSize: 25,
        flexShrink: 0,
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      <div style={{ display: "flex" }}>{label}</div>
      <Arrow size={22} color={C.text} />
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <div
      style={{ display: "flex", width: 12, height: 12, borderRadius: 6, backgroundColor: on ? C.accent : C.lineStrong }}
    />
  );
}

/** A circular or rounded-square headshot; initials on pale gray when there's no photo. */
function Headshot({
  person,
  src,
  size,
  radius,
  ring = 0,
}: {
  person: OgPerson;
  src: string | undefined;
  size: number;
  radius: number;
  ring?: number;
}) {
  const box: React.CSSProperties = {
    display: "flex",
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    backgroundColor: C.surfaceMuted,
    flexShrink: 0,
    // Satori can't take `border: undefined` — only set it for a ring.
    ...(ring ? { border: `${ring}px solid ${C.white}` } : {}),
  };
  if (src) {
    return (
      <div style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori renders plain <img>. */}
        <img src={src} width={size - ring * 2} height={size - ring * 2} style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{ ...box, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: Math.round(size * 0.34), fontWeight: 700, color: C.charcoal }}>
        {person.initials}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Site default: Founders Office Hours, every mentor, "Apply for Office Hours". */
export async function renderSiteCard(model: SiteCardModel): Promise<ImageResponse> {
  const [logo, photos] = await Promise.all([loadLogo(64), headshots(model.people)]);
  const shown = model.people.slice(0, 6);
  return render(
    <Frame logo={logo} label={model.label}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <AccentRule />
        <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: C.accentStrong, fontWeight: 700 }}>
          {model.kicker}
        </div>
        <Words
          text={model.headline}
          fontSize={70}
          style={{ marginTop: 14, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.text, maxWidth: 980 }}
        />
        {model.sub ? (
          <div style={{ display: "flex", marginTop: 20, fontSize: 28, color: C.muted }}>{model.sub}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 1 }}>
          {shown.length ? (
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {shown.map((p, i) => (
                <div key={p.id} style={{ display: "flex", marginLeft: i === 0 ? 0 : -14 }}>
                  <Headshot person={p} src={photos.get(p.id)} size={80} radius={40} ring={4} />
                </div>
              ))}
            </div>
          ) : null}
          {model.peopleLine ? (
            <Words
              text={model.peopleLine}
              fontSize={22}
              style={{ color: C.charcoal, maxWidth: 280, lineHeight: 1.35 }}
            />
          ) : null}
        </div>
        {model.cta ? <CtaPill label={model.cta} /> : null}
      </div>
    </Frame>,
  );
}

/** A mentor: headshot, name, verified role and company, one availability line. */
export async function renderMentorCard(model: MentorCardModel): Promise<ImageResponse> {
  const [logo, photos] = await Promise.all([loadLogo(56), headshots([model.person])]);
  const nameSize = model.name.length > 18 ? 58 : 68;
  return render(
    <Frame logo={logo} label={model.label}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <Headshot person={model.person} src={photos.get(model.person.id)} size={312} radius={20} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <AccentRule />
          <div style={{ display: "flex", marginTop: 18, fontSize: 24, color: C.accentStrong, fontWeight: 700 }}>
            Founders Office Hours
          </div>
          <Words
            text={model.name}
            fontSize={nameSize}
            style={{ marginTop: 12, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.03em", color: C.text }}
          />
          {model.role ? (
            <div style={{ display: "flex", marginTop: 16, fontSize: 30, color: C.charcoal }}>{model.role}</div>
          ) : null}
          {model.company ? (
            <div style={{ display: "flex", marginTop: model.role ? 4 : 16, fontSize: 30, color: C.muted }}>
              {model.company}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 28,
              fontSize: 25,
              color: model.availability.known ? C.charcoal : C.subtle,
            }}
          >
            <Dot on={model.availability.known} />
            <div style={{ display: "flex" }}>{model.availability.text}</div>
          </div>
        </div>
      </div>
      {model.cta ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <CtaPill label={model.cta} />
        </div>
      ) : null}
    </Frame>,
  );
}

const BADGE: Record<OgInvolvementTone, { color: string; background: string; border: string }> = {
  solid: { color: C.text, background: C.accent, border: C.accent },
  soft: { color: C.accentStrong, background: C.accentSoft, border: "rgba(255,150,0,0.5)" },
  neutral: { color: C.subtle, background: "#f7f7f6", border: C.line },
};

function Badge({ label, tone }: { label: string; tone: OgInvolvementTone }) {
  const t = BADGE[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 40,
        padding: "0 16px",
        fontSize: 21,
        fontWeight: 700,
        color: t.color,
        backgroundColor: t.background,
        border: `1.5px solid ${t.border}`,
        borderRadius: 6,
      }}
    >
      {label}
    </div>
  );
}

/** An event (or an office-hours window). Events never carry an application CTA. */
export async function renderEventCard(model: EventCardModel): Promise<ImageResponse> {
  const logo = await loadLogo(56);
  const size = titleFontSize(model.title);
  return render(
    <Frame logo={logo} label={model.label}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <div style={{ display: "flex", width: 210, gap: 24, flexShrink: 0 }}>
          <div style={{ display: "flex", width: 5, borderRadius: 3, backgroundColor: C.accent }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{model.weekday}</div>
            <div
              style={{
                display: "flex",
                fontSize: 120,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: C.text,
                marginTop: 6,
              }}
            >
              {model.day}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: C.muted, marginTop: 8 }}>{model.month}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {model.involvement || model.status ? (
            <div style={{ display: "flex", gap: 12 }}>
              {model.involvement ? <Badge label={model.involvement.label} tone={model.involvement.tone} /> : null}
              {model.status ? <Badge label={model.status} tone="neutral" /> : null}
            </div>
          ) : null}
          <Words
            text={model.title}
            fontSize={size}
            style={{
              marginTop: model.involvement || model.status ? 22 : 0,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              color: C.text,
            }}
          />
          {model.people.length ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 16, gap: 4 }}>
              {model.people.map((p) => (
                <div key={p.name} style={{ display: "flex", fontSize: 24, color: C.muted }}>
                  <span style={{ color: C.charcoal, fontWeight: 700 }}>{p.name}</span>
                  {p.title ? <span style={{ marginLeft: 10 }}>{p.title}</span> : null}
                </div>
              ))}
              {model.morePeople ? (
                <div style={{ display: "flex", fontSize: 22, color: C.subtle }}>and {model.morePeople} more</div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 6, fontSize: 26, color: C.charcoal }}>
            <div style={{ display: "flex" }}>{model.when}</div>
            <div style={{ display: "flex", color: C.muted }}>{model.where}</div>
          </div>
        </div>
      </div>
      {model.cta ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <CtaPill label={model.cta} />
        </div>
      ) : null}
    </Frame>,
  );
}
