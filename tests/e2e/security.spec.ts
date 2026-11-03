import { expect, test } from "@playwright/test";
import { APP_PATHS } from "./helpers";

test("every page carries a nonce-based CSP and renders with no CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(msg.text())) violations.push(msg.text());
  });
  for (const path of ["/", "/login", ...APP_PATHS]) {
    const res = await page.goto(path);
    const csp = res!.headers()["content-security-policy"] ?? "";
    expect(csp, path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    // Inline scripts only run with the request's nonce.
    const unnonced = await page.$$eval("script:not([src])", (els) => els.filter((s) => !(s as HTMLScriptElement).nonce).length);
    expect(unnonced, path).toBe(0);
  }
  await page.goto("/universe");
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("state-changing API calls from another site are refused; same-site calls work", async ({ page }) => {
  const cross = await page.request.post("/api/courses", { headers: { origin: "https://evil.example" }, data: { title: "CSRF probe" } });
  expect(cross.status()).toBe(403);
  expect((await cross.json()).error.code).toBe("forbidden_origin");
  const crossDelete = await page.request.delete("/api/courses/00000000-0000-4000-8000-000000000000", { headers: { origin: "https://evil.example" } });
  expect(crossDelete.status()).toBe(403);
  const base = new URL(test.info().project.use.baseURL!).origin;
  const same = await page.request.post("/api/courses", { headers: { origin: base }, data: { title: "Same-site course" } });
  expect(same.status()).toBe(201);
  await page.request.delete(`/api/courses/${(await same.json()).course.id}`, { headers: { origin: base } });
});

test("health check reveals nothing beyond liveness; HSTS is set", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(await res.json()).toEqual({ status: "ok" });
  expect((await request.get("/")).headers()["strict-transport-security"]).toContain("max-age=");
});

test("installable app manifest and icons are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = await manifest.json();
  expect(json).toMatchObject({ name: "CatchUp AI", start_url: "/dashboard", display: "standalone" });
  for (const icon of ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]) expect((await request.get(icon)).status()).toBe(200);
});

test("preferences show usage against fair-use limits", async ({ page }) => {
  await page.goto("/settings");
  const usage = page.getByRole("list", { name: "Usage against limits" });
  await expect(usage).toContainText("AI copilot runs");
  await expect(usage).toContainText("/ 30");
});

test("email-link landing refuses invalid codes and open redirects", async ({ request }) => {
  const bad = await request.get("/auth/confirm?code=not-a-real-code&next=/dashboard", { maxRedirects: 0 });
  expect(bad.status()).toBe(307);
  expect(bad.headers()["location"]).toContain("/login?error=link");
  const evil = await request.get("/auth/confirm?code=x&next=//evil.example", { maxRedirects: 0 });
  expect(evil.headers()["location"]).not.toContain("evil.example");
});
