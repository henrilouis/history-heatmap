// Renders Chrome Web Store screenshots and the small promo tile from a
// production build backed by seeded demo history. No real history is read.
// Usage: npm run screenshots   (CHROME_PATH=/path/to/chrome to override)
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { build, preview } from "vite";
import { generateDemoHistory } from "./store/demo-history.mjs";
import { installFakeChrome } from "./store/fake-chrome.mjs";

const OUTPUT = "docs/store";
const TIME_ZONE = "Europe/Amsterdam";
// The demo "now": a Friday afternoon, a few minutes after the last visit.
const END = "2026-10-09T17:20";
const NOW =
  Temporal.PlainDateTime.from(END).toZonedDateTime(TIME_ZONE)
    .epochMilliseconds +
  10 * 60_000;
const VIEWPORT = { width: 1280, height: 800 };

/** Store screenshots, in listing order. */
const SHOTS = [
  { file: "01-days-light.png", route: "#/days", colorScheme: "light" },
  { file: "02-hours-light.png", route: "#/hours", colorScheme: "light" },
  { file: "03-stats-light.png", route: "#/stats", colorScheme: "light" },
  { file: "04-days-dark.png", route: "#/days", colorScheme: "dark" },
  {
    file: "05-stats-dark.png",
    route: "#/stats",
    colorScheme: "dark",
    // Show the highlight cards rather than repeating the top of the page.
    scrollTo: "Your busiest day",
  },
];

const PROMO_TILE = { file: "promo-small-440x280.png", width: 440, height: 280 };

/** A deterministic, brand-neutral monogram favicon per website. */
function monogram(pageUrl) {
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const letter = host[0].toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="8" fill="oklch(58% 0.16 ${hash % 360})"/>
  <text x="16" y="22" font-family="system-ui, sans-serif" font-size="17" font-weight="700" fill="white" text-anchor="middle">${letter}</text>
</svg>`;
}

/** Store screenshots must not have an alpha channel (24-bit PNG or JPEG). */
async function assertOpaquePng(path, { width, height }) {
  const png = await readFile(path);
  const actual = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  const colorType = png[25];
  if (actual.width !== width || actual.height !== height) {
    throw new Error(`${path} is ${actual.width}x${actual.height}`);
  }
  // 2 = truecolour RGB; 6 = RGBA, which the store rejects.
  if (colorType !== 2) {
    throw new Error(`${path} has PNG colour type ${colorType}, expected RGB`);
  }
}

async function capture(browser, url, demo, shot) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: shot.colorScheme,
    locale: "en-US",
    timezoneId: TIME_ZONE,
    reducedMotion: "reduce",
  });
  try {
    await context.clock.setFixedTime(NOW);
    await context.addInitScript(installFakeChrome, { ...demo, now: NOW });
    await context.route("**/_favicon/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: monogram(
          new URL(route.request().url()).searchParams.get("pageUrl"),
        ),
      }),
    );

    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.goto(`${url}${shot.route}`);
    await page.locator("header [role=status]").waitFor({ state: "detached" });
    await page
      .locator(shot.route === "#/stats" ? ".stats .grid" : "main")
      .waitFor();
    if (shot.scrollTo) {
      // Place the card just below the sticky header.
      await page
        .locator(".stats .grid > *")
        .filter({
          has: page.getByRole("heading", { name: shot.scrollTo, exact: true }),
        })
        .evaluate((card) => {
          const wrapper = card.closest(".wrapper");
          wrapper.scrollTop +=
            card.getBoundingClientRect().top -
            wrapper.querySelector("header").getBoundingClientRect().bottom -
            24;
        });
    }
    await page.evaluate(() => document.fonts.ready);
    // Let favicons, resize observers and virtualized rows settle.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    if (errors.length) throw errors[0];

    const path = join(OUTPUT, shot.file);
    await page.screenshot({ path, animations: "disabled", caret: "hide" });
    await assertOpaquePng(path, VIEWPORT);
    console.log(`  ${path}`);
  } finally {
    await context.close();
  }
}

async function capturePromoTile(browser) {
  const { file, width, height } = PROMO_TILE;
  const icon = await readFile("public/icon128.png");
  const html = (
    await readFile("scripts/store/promo-tile.html", "utf8")
  ).replace("%ICON%", `data:image/png;base64,${icon.toString("base64")}`);
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(html, { waitUntil: "load" });
    const path = join(OUTPUT, file);
    await page.screenshot({ path });
    await assertOpaquePng(path, { width, height });
    console.log(`  ${path}`);
  } finally {
    await page.close();
  }
}

const outDir = await mkdtemp(join(tmpdir(), "history-heatmap-screenshots-"));
let server;
let browser;
try {
  await build({ logLevel: "warn", build: { outDir, emptyOutDir: true } });
  server = await preview({
    logLevel: "warn",
    build: { outDir },
    preview: { port: 0, open: false },
  });
  const url = server.resolvedUrls.local[0];

  const demo = generateDemoHistory({ timeZone: TIME_ZONE, end: END });
  const visits = Object.values(demo.visitsByUrl).flat().length;
  console.log(`Demo history: ${demo.items.length} URLs, ${visits} visits`);

  browser = await chromium.launch(
    process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: "chrome" },
  );
  await mkdir(OUTPUT, { recursive: true });
  for (const shot of SHOTS) await capture(browser, url, demo, shot);
  await capturePromoTile(browser);
} finally {
  await browser?.close();
  await server?.close();
  await rm(outDir, { recursive: true, force: true });
}
