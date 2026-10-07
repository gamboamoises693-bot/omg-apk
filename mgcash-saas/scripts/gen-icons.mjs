// Renders public/icons/icon.svg to PNG (192, 512) using the system Chromium via Playwright.
// Usage: NODE_PATH=$(npm root -g) node scripts/gen-icons.mjs   (only needed when the icon changes)
// Uses a globally installed playwright so it is not a project dependency.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await writeFile(new URL(`../public/icons/icon-${size}.png`, import.meta.url), await page.screenshot({ omitBackground: true }));
    await page.close();
  }
  console.log("Icons generated.");
} finally {
  await browser.close();
}
