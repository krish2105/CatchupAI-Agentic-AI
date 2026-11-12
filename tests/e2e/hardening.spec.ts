import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";
import { APP_PATHS, seedPrefs } from "./helpers";

test("security headers are set and API responses are not cacheable", async ({ request }) => {
  const page = await request.get("/");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["x-powered-by"]).toBeUndefined();
  // Voice answers need the microphone on this site only; everything else sensitive stays off.
  const policy = page.headers()["permissions-policy"] ?? "";
  expect(policy).toContain("microphone=(self)");
  expect(policy).toContain("camera=()");
  expect(policy).toContain("geolocation=()");
  expect(policy).toContain("payment=()");
  const api = await request.get("/api/health");
  expect(api.headers()["cache-control"]).toContain("no-store");
});

test("health endpoint reveals no secrets or configuration", async ({ request }) => {
  const body = await (await request.get("/api/health")).text();
  expect(body).not.toMatch(/sb_secret|sk-|SUPABASE|OPENAI|postgres/i);
});

test("no-WebGL browsers get the accessible fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error simulate a browser without WebGL
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return type.startsWith("webgl") ? null : original.call(this, type as "2d", ...(rest as []));
    };
  });
  await page.goto("/universe");
  await expect(page.getByText("3D UNAVAILABLE IN THIS BROWSER")).toBeVisible();
  await expect(page.locator(".inspector")).toBeVisible();
});

test("200% zoom (720px wide) keeps every page usable without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  for (const path of APP_PATHS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});

test("the core approval loop works with reduced motion, 3D off and keyboard only", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await seedPrefs(s.page, { motion: "reduce", threeD: false });
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Keyboard course" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Essay outline", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    await s.page.goto("/recovery");
    const review = s.page.getByRole("button", { name: /Review and approve/ });
    await review.focus();
    await s.page.keyboard.press("Enter");
    const approve = s.page.getByRole("dialog").getByRole("button", { name: "Approve plan" });
    await approve.focus();
    await s.page.keyboard.press("Enter");
    await s.page.waitForURL(/\/planner\?approved=1$/);
    await s.page.getByRole("group", { name: "Schedule view" }).getByRole("button", { name: "List" }).focus();
    await s.page.keyboard.press("Enter");
    const check = s.page.getByRole("checkbox", { name: /Essay outline/ });
    await check.focus();
    await s.page.keyboard.press("Space");
    await expect(check).toHaveAttribute("aria-checked", "true");
    await expect(s.page.locator("canvas")).toHaveCount(0);
  } finally {
    await s.cleanup();
  }
});
