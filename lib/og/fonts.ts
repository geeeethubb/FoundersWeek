/**
 * Fonts for generated OpenGraph/Twitter images (next/og ImageResponse), read from disk — image
 * generation never fetches anything over the network.
 *
 * One family, Archivo (the site's typeface), as static TrueType instances (Satori can't read the
 * WOFF2 files next/font serves, nor variable axes):
 *   - Archivo Medium (500) — body, labels, buttons;
 *   - Archivo SemiExpanded Bold (700) — headlines and names.
 * Licensed under the SIL Open Font License 1.1 (Google Fonts); the license ships alongside them
 * (./fonts/OFL-Archivo.txt).
 *
 * Every string rendered in an image must be covered by these fonts: a missing glyph would make
 * Satori try to download a fallback font. Draw arrows as shapes, not characters.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OgFont = { name: string; data: Buffer; weight: 500 | 700; style: "normal" };

/** Family name used in image styles. */
export const OG_FONT_FAMILY = "Archivo";

/** Font files, by weight (tests read these to check glyph coverage). */
export const OG_FONT_FILES = {
  500: "Archivo-Medium.ttf",
  700: "Archivo-SemiExpanded-Bold.ttf",
} as const;

let cache: Promise<OgFont[]> | null = null;

/** Loads (once per server process) every font the images use. */
export function loadOgFonts(): Promise<OgFont[]> {
  cache ??= Promise.all(
    ([500, 700] as const).map(async (weight) => ({
      name: OG_FONT_FAMILY,
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "lib", "og", "fonts", OG_FONT_FILES[weight])),
    })),
  ).catch((error) => {
    cache = null;
    throw error;
  });
  return cache;
}
