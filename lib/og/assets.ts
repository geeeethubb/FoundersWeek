/**
 * Images for the generated social cards, read from /public on disk and inlined as data URLs — image
 * generation never fetches anything over the network.
 *
 * - The Founders logo (`site.brand.foundersLogo`, public/brand/founders-logo.png).
 * - Approved mentor headshots (`mentor.headshot`, public/mentors/<id>.jpg).
 *
 * Only plain files directly inside those two folders are read; anything else (or a missing file)
 * resolves to null and the card falls back to text/initials.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

const cache = new Map<string, Promise<string | null>>();

async function readAsDataUrl(folder: "brand" | "mentors", file: string): Promise<string | null> {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  try {
    const data = await readFile(join(process.cwd(), "public", folder, file));
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * `/brand/founders-logo.png` → a data URL, or null when the path isn't a plain file in
 * public/brand or public/mentors, or can't be read. Cached per path.
 */
export function publicImageDataUrl(src: string | null | undefined): Promise<string | null> {
  const match = src?.match(/^\/(brand|mentors)\/([A-Za-z0-9._-]+\.(?:png|jpe?g))$/i);
  if (!match || match[2].startsWith(".")) return Promise.resolve(null);
  const key = `${match[1]}/${match[2]}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = readAsDataUrl(match[1] as "brand" | "mentors", match[2]);
    cache.set(key, hit);
  }
  return hit;
}
