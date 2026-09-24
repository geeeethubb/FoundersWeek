/**
 * Fonts for generated OpenGraph/Twitter images (next/og ImageResponse), read from disk — image
 * generation never fetches anything over the network.
 *
 * The files in ./fonts are static TrueType instances of the site's typefaces (Satori can't read
 * the WOFF2 files next/font serves, nor variable axes):
 *   Archivo Medium (500), Archivo SemiExpanded Bold (700) / ExtraBold (800) — the `font-wide` cut,
 *   JetBrains Mono Medium (500), Instrument Serif Italic (400).
 * All are licensed under the SIL Open Font License 1.1 (Google Fonts); the licenses ship alongside
 * them (./fonts/OFL-*.txt).
 *
 * Every string rendered in an image must be covered by these fonts: a missing glyph would make
 * Satori try to download a fallback font. Draw arrows/diamonds as shapes, not characters.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OgFont = { name: string; data: Buffer; weight: 400 | 500 | 700 | 800; style: "normal" | "italic" };

/** Family names used in image styles. */
export const OG_FONT = {
  sans: "Archivo",
  wide: "Archivo Wide",
  mono: "JetBrains Mono",
  serif: "Instrument Serif",
} as const;

const FILES: { file: string; name: string; weight: OgFont["weight"]; style: OgFont["style"] }[] = [
  { file: "Archivo-Medium.ttf", name: OG_FONT.sans, weight: 500, style: "normal" },
  { file: "Archivo-SemiExpanded-Bold.ttf", name: OG_FONT.wide, weight: 700, style: "normal" },
  { file: "Archivo-SemiExpanded-ExtraBold.ttf", name: OG_FONT.wide, weight: 800, style: "normal" },
  { file: "JetBrainsMono-Medium.ttf", name: OG_FONT.mono, weight: 500, style: "normal" },
  { file: "InstrumentSerif-Italic.ttf", name: OG_FONT.serif, weight: 400, style: "italic" },
];

let cache: Promise<OgFont[]> | null = null;

/** Loads (once per server process) every font the images use. */
export function loadOgFonts(): Promise<OgFont[]> {
  cache ??= Promise.all(
    FILES.map(async (f) => ({
      name: f.name,
      weight: f.weight,
      style: f.style,
      data: await readFile(join(process.cwd(), "lib", "og", "fonts", f.file)),
    })),
  ).catch((error) => {
    cache = null;
    throw error;
  });
  return cache;
}
