import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminDb, createOtherTenant } from "./admin";

test.describe("documents and evidence search", () => {
  test("upload a PDF, wait for indexing, search with page citations and open the source", async ({ page }) => {
    const course = await (await page.request.post("/api/courses", { data: { title: `Docs E2E ${Date.now()}` } })).json();
    await page.goto(`/courses/${course.course.id}`);

    await page.waitForLoadState("networkidle");

    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("Search this course's documents").fill("What does a residual mean?");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const first = page.getByRole("list", { name: "Matching passages" }).getByRole("listitem").first();
    await expect(first.getByRole("link")).toHaveText("statistics_module_4.pdf · p. 2");
    await expect(first).toContainText("A residual equals observed Y minus predicted");

    const href = await first.getByRole("link").getAttribute("href");
    const source = await page.request.get(href!, { maxRedirects: 0 });
    expect(source.status()).toBe(302);
    const signed = source.headers()["location"];
    expect(signed).toMatch(/\/storage\/v1\/object\/sign\/course-documents\/.+#page=2$/);
    const pdf = await page.request.get(signed.split("#")[0]);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.getByLabel("Search this course's documents").fill("photosynthesis chlorophyll");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("I couldn't verify that in your uploaded materials.")).toBeVisible();
  });

  test("scanned/no-text PDFs fail visibly with a reason", async ({ page }) => {
    const course = await (await page.request.post("/api/courses", { data: { title: `Scan E2E ${Date.now()}` } })).json();
    await page.goto(`/courses/${course.course.id}`);
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/no_text.pdf");
    await expect(page.getByText(/No selectable text found/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Google Docs/)).toBeVisible(); // the message says how to fix it
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  });

  test("the API rejects non-PDF registrations", async ({ request }) => {
    const course = await (await request.post("/api/courses", { data: { title: "Validation" } })).json();
    const exe = await request.post("/api/documents", { data: { courseId: course.course.id, filename: "payload.exe", sizeBytes: 100 } });
    expect(exe.status()).toBe(400);
    const huge = await request.post("/api/documents", { data: { courseId: course.course.id, filename: "big.pdf", sizeBytes: 11 * 1024 * 1024 } });
    expect(huge.status()).toBe(400);
  });

  test("another student's documents cannot be read, processed, opened or searched", async ({ request }) => {
    const other = await createOtherTenant();
    const db = adminDb();
    try {
      const bytes = readFileSync("tests/fixtures/statistics_module_4.pdf");
      const { data: doc } = await db
        .from("documents")
        .insert({ owner_id: other.ownerId, course_id: other.courseId, filename: "private.pdf", size_bytes: bytes.byteLength })
        .select("id, storage_path")
        .single();
      await db.storage.from("course-documents").upload(doc!.storage_path, bytes, { contentType: "application/pdf" });

      expect((await request.get(`/api/documents/${doc!.id}`)).status()).toBe(404);
      expect((await request.post(`/api/documents/${doc!.id}/process`)).status()).toBe(404);
      expect((await request.get(`/api/documents/${doc!.id}/source?page=1`, { maxRedirects: 0 })).status()).toBe(404);
      expect((await request.delete(`/api/documents/${doc!.id}`)).status()).toBe(404);
      expect((await request.get(`/api/courses/${other.courseId}/search?q=residual`)).status()).toBe(404);
      const plant = await request.post("/api/documents", { data: { courseId: other.courseId, filename: "plant.pdf", sizeBytes: 100 } });
      expect(plant.status()).toBe(404);
      const { data: still } = await db.from("documents").select("status").eq("id", doc!.id).single();
      expect(still?.status).toBe("uploaded");
    } finally {
      await other.cleanup();
    }
  });
});
