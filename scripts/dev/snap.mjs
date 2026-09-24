// Screenshot pages at desktop and mobile widths (full page) and report console errors.
//
//   BASE_URL=http://localhost:3101 node scripts/dev/snap.mjs --out <dir> home schedule "schedule?day=2026-10-01"
//   Pass paths WITHOUT a leading slash ("home" = /). Git Bash rewrites arguments that start with "/".
//   Options: --widths 1440,390   --no-full (viewport only)
//
// Look at the PNGs afterwards (they're named <slug>-<width>.png).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
let out = "shots";
let widths = [1440, 390];
let full = true;
const paths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = args[++i];
  else if (args[i] === "--widths") widths = args[++i].split(",").map(Number);
  else if (args[i] === "--no-full") full = false;
  else paths.push(toPath(args[i]));
}
function toPath(arg) {
  if (arg === "home" || arg === "." || arg === "/") return "/";
  if (/^[a-z]:[\/]/i.test(arg)) throw new Error(`"${arg}" looks like a rewritten path — pass paths without a leading slash`);
  return arg.startsWith("/") ? arg : `/${arg}`;
}
const base = process.env.BASE_URL ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
let failures = 0;
for (const p of paths.length ? paths : ["/"]) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const problems = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(300);
    const slug = (p.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_") || "home").slice(0, 80);
    const file = path.join(out, `${slug}-${width}.png`);
    await page.screenshot({ path: file, fullPage: full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(
      `${res?.status()} ${p} @${width}px → ${file}${overflow > 1 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`,
    );
    for (const pr of problems) console.log(`   ${pr}`);
    if (!res || res.status() >= 500 || overflow > 1) failures++;
    await context.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
