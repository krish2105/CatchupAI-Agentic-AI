// Renders public/icon.svg to the PNG sizes install prompts need (uses the Playwright Chromium already in devDeps).
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icon.svg", "utf8");
const browser = await chromium.launch();
for (const size of [192, 512, 180]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true });
  writeFileSync(size === 180 ? "public/apple-touch-icon.png" : `public/icon-${size}.png`, png);
  await page.close();
}
await browser.close();
console.log("icons written");
