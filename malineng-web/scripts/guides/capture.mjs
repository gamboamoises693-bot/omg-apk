// Takes the screenshots of the how-to guides from the REAL app (a build that talks to the local emulators),
// puts a red circle on what the resident should press, and writes src/data/guides.json.
// Usage (see run.sh): node capture.mjs [guideId ...]   (no ids = every guide)
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RESIDENT, NEWBIE } from "./seed.mjs";
import { GUIDES } from "./spec.mjs";

// Playwright is installed globally (npm i -g playwright); createRequire also finds it through NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const OUT_DIR = join(root, "public", "guides");
const DATA = join(root, "src", "data", "guides.json");
const BASE = process.env.GUIDE_BASE || "http://localhost:8765";
const ONLY = process.argv.slice(2);

mkdirSync(OUT_DIR, { recursive: true });

/** Draws the red circle (and the step number) over an element, in the page itself, so it is part of the screenshot. */
async function ring(page, selector, label) {
  const loc = page.locator(selector).first();
  // Centre it, so it is not hidden behind the bottom bar.
  await loc.evaluate((el) => el.scrollIntoView({ block: "center" }), null, { timeout: 8000 });
  await page.waitForTimeout(250);
  const box = await loc.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.evaluate(({ box, label }) => {
    const pad = 5;
    const r = document.createElement("div");
    r.id = "guide-ring";
    Object.assign(r.style, {
      position: "fixed", left: `${box.x - pad}px`, top: `${box.y - pad}px`, width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px`,
      border: "4px solid #D6303D", borderRadius: "14px", boxShadow: "0 0 0 5px rgba(214,48,61,.28)", zIndex: "2147483647", pointerEvents: "none",
    });
    const n = document.createElement("div");
    n.textContent = String(label);
    Object.assign(n.style, {
      position: "absolute", left: "-14px", top: "-16px", width: "28px", height: "28px", borderRadius: "50%", background: "#D6303D", color: "#fff",
      font: "800 15px Inter, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
    });
    r.appendChild(n);
    document.body.appendChild(r);
  }, { box, label });
}

/** The raffle pop-up ("Kasali ka sa raffle!") covers the page the first time; close it so it never ends up in a picture. */
async function dismiss(page) {
  const b = page.locator("text=Sige, salamat").first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  await page.waitForTimeout(300);
}

async function act(page, a) {
  if (a.click) await page.locator(a.click).first().click({ timeout: 8000 });
  else if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1]);
  else if (a.goto) {
    await page.goto(BASE + a.goto);
    await page.waitForTimeout(1800);
    await dismiss(page);
  }
  else if (a.wait) await page.waitForTimeout(a.wait);
  else if (a.press) await page.keyboard.press(a.press);
  await page.waitForTimeout(a.settle ?? 500);
}

const browser = await chromium.launch();
/** One browser per kind of person: "resident" (verified, default), "newbie" (not verified yet) or "guest" (not logged in). */
const pages = new Map();
async function pageFor(who) {
  if (pages.has(who)) return pages.get(who);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1.5, locale: "fil-PH" });
  // Only the local app and the emulators: nothing from the internet gets into the pictures.
  await ctx.route("**/*", (r) => (/localhost|127\.0\.0\.1/.test(r.request().url()) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  page error:", e.message));
  if (who !== "guest") {
    const acc = who === "newbie" ? NEWBIE : RESIDENT;
    await page.goto(`${BASE}/login/`);
    await page.waitForTimeout(800);
    await page.fill("input[type=email]", acc.email);
    await page.fill("input[type=password]", acc.password);
    await page.click("button[type=submit]");
    await page.waitForTimeout(2500);
  }
  pages.set(who, page);
  return page;
}

const old = existsSync(DATA) ? JSON.parse(readFileSync(DATA, "utf8")).guides : [];
const done = new Map(old.map((g) => [g.id, g]));

for (const g of GUIDES) {
  if (ONLY.length && !ONLY.includes(g.id)) continue;
  console.log(`guide ${g.id}`);
  const page = await pageFor(g.as ?? "resident");
  const steps = [];
  try {
    for (let i = 0; i < g.steps.length; i++) {
      const s = g.steps[i];
      for (const a of s.before ?? []) await act(page, a);
      await dismiss(page);
      await page.waitForTimeout(300);
      console.log(`  step ${i + 1}: ${page.url().replace(BASE, "")}`);
      await ring(page, s.ring, i + 1);
      const img = `${g.id}-${i + 1}.jpg`;
      const buf = await page.screenshot({ type: "jpeg", quality: 72 });
      writeFileSync(join(OUT_DIR, img), buf);
      await page.evaluate(() => document.getElementById("guide-ring")?.remove());
      steps.push({ tl: s.tl, en: s.en, img, w: 585, h: 1170 });
      for (const a of s.after ?? []) await act(page, a);
    }
    done.set(g.id, { id: g.id, routes: g.routes, group: g.group, title: g.title, steps });
  } catch (err) {
    console.log(`  FAILED ${g.id}: ${err.message.split("\n")[0]}`);
    await page.screenshot({ path: join(here, `failed-${g.id}.png`) }).catch(() => {});
  }
}

// Keep the order of the spec; guides that were not (re)captured keep what they had.
const guides = GUIDES.map((g) => done.get(g.id)).filter(Boolean);
writeFileSync(DATA, JSON.stringify({ guides }, null, 2) + "\n");
console.log(`wrote ${guides.length} guides`);
await browser.close();
