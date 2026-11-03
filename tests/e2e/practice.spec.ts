import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("generate a knowledge check, answer it, see sourced results, and real insights", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/insights");
    await expect(s.page.getByText("Not enough evidence yet")).toBeVisible();

    await s.page.goto("/quizzes");
    await s.page.getByRole("button", { name: "Generate check" }).click();
    for (let i = 0; i < 5; i++) {
      const group = s.page.getByRole("radiogroup");
      await expect(group).toBeVisible();
      await group.getByRole("radio").first().click();
      await s.page.getByRole("button", { name: /Next question|Submit answers/ }).click();
    }
    await expect(s.page.getByText(/You scored \d+%/)).toBeVisible();
    const answers = s.page.getByRole("list", { name: "Answers with sources" }).getByRole("listitem");
    await expect(answers).toHaveCount(5);
    await expect(answers.first().getByRole("link", { name: /statistics_module_4\.pdf · p\. \d/ })).toBeVisible();
    await s.page.getByRole("button", { name: "Done" }).click();
    await expect(s.page.getByRole("list", { name: "Previous checks" }).getByRole("listitem")).toHaveCount(1);

    await s.page.goto("/insights");
    const { data: attempt } = await s.db.from("quiz_attempts").select("score_percent").eq("owner_id", s.userId).single();
    await expect(s.page.getByText(`${Math.round(Number(attempt!.score_percent))}%`).first()).toBeVisible();
    await expect(s.page.getByText("Whole course").first()).toBeVisible();
    await expect(s.page.getByRole("img", { name: /Completed study minutes per day/ })).toBeVisible();
  } finally {
    await s.cleanup();
  }
});
