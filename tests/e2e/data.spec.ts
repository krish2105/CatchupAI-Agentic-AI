import { expect, test } from "@playwright/test";
import { adminDb, createOtherTenant } from "./admin";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("app pages redirect to login and APIs return 401", async ({ page, request }) => {
    await page.goto("/planner");
    await expect(page).toHaveURL(/\/login\?next=%2Fplanner/);
    const res = await request.get("/api/courses");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  test("open redirects are refused on the magic-link route", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=bogus&type=email&next=//evil.example");
    await expect(page).toHaveURL(/\/login\?error=link/);
  });
});

test.describe("courses and assignments", () => {
  test("create a course and assignment through the UI; data persists after reload", async ({ page }) => {
    await page.goto("/courses");
    await page.getByRole("button", { name: /new course|create your first course/i }).first().click();
    await page.getByLabel("Course title").fill("Applied Statistics E2E");
    await page.getByLabel("Description (optional)").fill("Regression and sampling");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Applied Statistics E2E" })).toBeVisible();

    await page.getByRole("button", { name: "Add assignment" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Regression worksheet");
    await page.getByLabel(/^Due/).fill("2030-01-15T16:00");
    await page.getByLabel("Estimated hours").fill("4");
    await page.getByRole("button", { name: "Save assignment" }).click();
    await expect(page.getByText("Regression worksheet", { exact: true })).toBeVisible();
    await expect(page.getByText(/15 Jan.*16:00/)).toBeVisible();
    // Stored as an instant: 16:00 in the profile zone (Asia/Dubai) = 12:00 UTC.
    const listed = await (await page.request.get("/api/assignments")).json();
    const saved = listed.assignments.find((a: { title: string }) => a.title === "Regression worksheet");
    expect(new Date(saved.dueAt).toISOString()).toBe("2030-01-15T12:00:00.000Z");

    await page.reload();
    await expect(page.getByText("Regression worksheet", { exact: true })).toBeVisible();
    await page.getByLabel("Status for Regression worksheet").selectOption("completed");
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Status for Regression worksheet")).toHaveValue("completed");

    await page.goto("/universe");
    await expect(page.getByRole("button", { name: /Applied Statistics E2E/ })).toBeVisible();
  });

  test("API validates input strictly", async ({ request }) => {
    expect((await request.post("/api/courses", { data: {} })).status()).toBe(400);
    expect((await request.post("/api/courses", { data: { title: "x", ownerId: "00000000-0000-0000-0000-000000000000" } })).status()).toBe(400);
    expect((await request.get("/api/courses/not-a-uuid")).status()).toBe(400);
    const tooBig = await request.post("/api/courses", { data: { title: "x", description: "y".repeat(70_000) } });
    expect(tooBig.status()).toBe(413);
  });
});

test.describe("cross-tenant access through direct API URLs", () => {
  test("another student's course and assignment are invisible and immutable", async ({ request }) => {
    const other = await createOtherTenant();
    try {
      expect((await request.get(`/api/courses/${other.courseId}`)).status()).toBe(404);
      expect((await request.patch(`/api/courses/${other.courseId}`, { data: { title: "pwned" } })).status()).toBe(404);
      expect((await request.delete(`/api/courses/${other.courseId}`)).status()).toBe(404);
      expect((await request.patch(`/api/assignments/${other.assignmentId}`, { data: { title: "pwned" } })).status()).toBe(404);
      expect((await request.delete(`/api/assignments/${other.assignmentId}`)).status()).toBe(404);
      const inject = await request.post("/api/assignments", {
        data: { courseId: other.courseId, title: "planted", dueAt: "2030-01-01T00:00:00Z", estimatedMinutes: 30 },
      });
      expect(inject.status()).toBe(404);
      const list = await (await request.get("/api/courses")).json();
      expect(list.courses.map((c: { id: string }) => c.id)).not.toContain(other.courseId);
      const listed = await (await request.get(`/api/assignments?courseId=${other.courseId}`)).json();
      expect(listed.assignments).toEqual([]);

      const { data } = await adminDb().from("courses").select("title").eq("id", other.courseId).single();
      expect(data?.title).toBe("Private course of B");
    } finally {
      await other.cleanup();
    }
  });
});
