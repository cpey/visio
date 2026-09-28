// Screenshots of the dev server (mock hass) for visual checks.
// Usage: PLAYWRIGHT_BROWSERS_PATH=../.tools/ms-playwright node scripts/screenshot.mjs <url> <outdir> [light|dark]
import { chromium } from "playwright";

const [url = "http://localhost:5199/", out = ".", theme = "light"] = process.argv.slice(2);
const browser = await chromium.launch();
const shots = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.viewport, deviceScaleFactor: s.deviceScaleFactor ?? 1, isMobile: s.isMobile, hasTouch: s.hasTouch });
  const errors = [];
  await page.addInitScript((t) => localStorage.setItem("visio-theme", t), theme);
  s.name = `${s.name}-${theme}`;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: true });
  // Open the side pane.
  await page.locator("visio-panel").locator("button[aria-label='Open menu']").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${s.name}-menu.png` });
  // Settings: device tab with one row expanded, then the other tabs.
  const panel = page.locator("visio-panel");
  await panel.getByRole("button", { name: "Settings" }).click();
  await page.waitForTimeout(400);
  await panel.locator(".row__head").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${s.name}-settings.png`, fullPage: true });
  for (const tab of ["Blinds", "Layouts"]) {
    await panel.getByRole("tab", { name: new RegExp(tab) }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${s.name}-settings-${tab.toLowerCase()}.png`, fullPage: true });
  }
  console.log(s.name, errors.length ? `errors: ${errors.join(" | ")}` : "no errors");
  await page.close();
}
await browser.close();
