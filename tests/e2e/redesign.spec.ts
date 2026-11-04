import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("command palette navigates and runs actions from the keyboard", async ({ page }) => {
  await page.goto("/dashboard");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  // The shortcut listener attaches on hydration, which can land just after "load" on slow CI machines.
  // Press again only while the palette is still closed (the shortcut toggles it).
  await expect(async () => {
    if (!(await palette.isVisible())) await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("combobox", { name: "Search pages, courses and actions" }).fill("recovery lab");
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recovery$/);

  await page.getByRole("button", { name: /Search or run a command/ }).click();
  await page.getByRole("combobox").fill("theme");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("combobox").fill("zzzz-nothing");
  await expect(page.getByText("No matches. Try a page or course name.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("mission control briefing reflects real data and missed class rescue runs the copilot once", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await s.page.goto("/dashboard");
    await expect(s.page.getByText(/Start by adding a course/)).toBeVisible();
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 90 } });
    await s.page.reload();
    await expect(s.page.getByText(/1 deadline in the next 7 days · 1h 30m of recommended work/)).toBeVisible();
    const briefing = s.page.getByLabel("Your recovery briefing");
    await expect(briefing).toContainText("1 deadline in the next 7 days");
    await expect(briefing).toContainText("Your balanced plan fits");
    await expect(briefing.getByRole("link", { name: "Plan recovery" })).toHaveAttribute("href", "/recovery");

    await s.page.getByRole("link", { name: "Missed class rescue" }).click();
    await expect(s.page).toHaveURL(/\/assistant$/);
    await expect(s.page.getByRole("list", { name: "Executed tool calls" }).getByRole("listitem")).toHaveCount(5, { timeout: 30_000 });
    await expect(s.page.getByText("I missed my last class. Help me catch up before my next deadline without overloading my week.")).toBeVisible();
    await s.page.reload();
    const { data } = await s.db.from("agent_runs").select("id").eq("owner_id", s.userId);
    expect(data).toHaveLength(1);
  } finally {
    await s.cleanup();
  }
});

test("focus sanctuary saves a session and the API can complete a block", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "focus-e2e-1234" } });

    await s.page.goto("/focus");
    await s.page.waitForLoadState("networkidle");
    await expect(s.page.getByRole("timer")).toHaveText("25:00");
    await s.page.getByLabel("Study block").selectOption({ index: 1 });
    await s.page.getByRole("button", { name: "Start focus" }).click();
    await expect(s.page.getByRole("timer")).not.toHaveText("25:00");
    // A refresh resumes the running session instead of losing it.
    await s.page.reload();
    await expect(s.page.getByText("Resumed your session from where you left off.")).toBeVisible();
    await expect(s.page.getByRole("timer")).not.toHaveText("25:00");
    await s.page.getByRole("button", { name: "Pause" }).click();
    await s.page.getByRole("button", { name: "End and save" }).click();
    await expect(s.page.getByText(/Saved \d+ focused minute/)).toBeVisible();
    const { data: sessions } = await s.db.from("focus_sessions").select("completed").eq("owner_id", s.userId);
    expect(sessions).toEqual([{ completed: false }]);

    const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
    const res = await s.page.request.post("/api/focus-sessions", {
      data: { taskId: plan.tasks[0].id, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date(Date.now() - 26 * 60_000).toISOString(), completed: true, markTaskDone: true },
    });
    expect(res.status()).toBe(201);
    const after = await (await s.page.request.get("/api/study-tasks")).json();
    expect(after.plan.tasks[0].status).toBe("completed");
    const fake = await s.page.request.post("/api/focus-sessions", { data: { taskId: null, plannedMinutes: 25, focusedMinutes: 25, startedAt: new Date().toISOString(), completed: true } });
    expect(fake.status()).toBe(400);
  } finally {
    await s.cleanup();
  }
});

test("recovery lab shows route timelines and the exact changes before approval", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    await s.page.goto("/recovery");
    await expect(s.page.getByRole("img", { name: /^Next 7 days\./ }).first()).toBeVisible();
    await s.page.getByRole("button", { name: /Review and approve/ }).click();
    const changes = s.page.getByLabel("Exact changes before approval");
    await expect(changes).toContainText("Adds 1 study block (1h)");
    await expect(changes).toContainText("No current plan to replace");
  } finally {
    await s.cleanup();
  }
});

test("smart syllabus import proposes deadlines and saves only what the student confirms", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } });
    await s.page.goto("/courses?import=syllabus");
    await s.page.waitForLoadState("networkidle");
    const dialog = s.page.getByRole("dialog", { name: /Turn a syllabus into deadlines/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Syllabus PDF").setInputFiles("tests/fixtures/syllabus.pdf");
    await dialog.getByRole("button", { name: "Find deadlines" }).click();

    const rows = s.page.getByRole("list", { name: "Detected deadlines" }).getByRole("listitem");
    await expect(rows).toHaveCount(4, { timeout: 30_000 });
    await expect(rows.first()).toContainText("p. 1");
    const before = await s.db.from("assignments").select("id").eq("owner_id", s.userId);
    expect(before.data).toEqual([]);

    await s.page.getByLabel("Include Final project report").uncheck();
    await s.page.getByLabel("Estimated hours (row 1)").fill("2");
    await s.page.getByRole("button", { name: "Add 3 deadlines" }).click();
    await expect(s.page.getByText("3 deadlines added to the course.")).toBeVisible();

    const { data } = await s.db.from("assignments").select("title, due_at, estimated_minutes").eq("owner_id", s.userId).order("due_at");
    expect(data!.map((a) => a.title)).toEqual(["Quiz 1: Regression basics", "Assignment 2 (Regression worksheet)", "Midterm exam"]);
    expect(new Date(data![0].due_at).toISOString()).toBe("2026-11-12T16:00:00.000Z");
    expect(data![0].estimated_minutes).toBe(120);
  } finally {
    await s.cleanup();
  }
});

test("privacy: export contains only your data, and account deletion requires typed confirmation", async ({ browser, request }) => {
  const s = await freshStudent(browser);
  let deleted = false;
  try {
    await s.page.request.post("/api/courses", { data: { title: "Mine only" } });
    const exported = await (await s.page.request.get("/api/account/export")).json();
    expect(exported.account.id).toBe(s.userId);
    expect(exported.courses.map((c: { title: string }) => c.title)).toEqual(["Mine only"]);
    const other = await (await request.get("/api/account/export")).json();
    expect(other.courses.map((c: { title: string }) => c.title)).not.toContain("Mine only");

    expect((await s.page.request.post("/api/account/delete", { data: { confirm: "delete" } })).status()).toBe(400);
    await s.page.goto("/settings");
    await s.page.getByRole("button", { name: "Delete account" }).click();
    const confirm = s.page.getByRole("dialog", { name: "Delete your account?" }).getByRole("button", { name: "Delete permanently" });
    await expect(confirm).toBeDisabled();
    await s.page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await confirm.click();
    await expect(s.page).toHaveURL(/\/$/);
    deleted = true;
    const { data } = await s.db.auth.admin.getUserById(s.userId);
    expect(data.user).toBeNull();
    const { data: rows } = await s.db.from("courses").select("id").eq("owner_id", s.userId);
    expect(rows).toEqual([]);
  } finally {
    if (!deleted) await s.cleanup();
    else await s.context.close();
  }
});

test.describe("one-click demo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a visitor can explore a seeded demo account without signing up", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Try the demo/ }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
    await expect(page.getByText("Demo account.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
    await expect(page.getByLabel("Your recovery briefing")).toContainText("deadlines in the next 7 days");
    // The guided tour opens on its own for demo accounts and walks the real screens.
    const tour = page.getByRole("region", { name: "Mission control" });
    await expect(page.getByText("Guided tour · 1 of 9")).toBeVisible();
    await expect(tour).toBeVisible();
    await page.getByRole("button", { name: /Next: Missed class rescue/ }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.getByText("Guided tour · 2 of 9")).toBeVisible();
    await page.getByRole("button", { name: "Close the tour" }).click();
    await expect(page.getByRole("button", { name: "Resume tour (2/9)" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Resume tour (2/9)" })).toBeVisible();
    await page.goto("/courses");
    await expect(page.getByText(/1\/1 indexed/)).toBeVisible();
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Leave the demo" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the cleanup job refuses requests without the cron secret", async ({ request }) => {
    expect((await request.get("/api/cron/cleanup-demo")).status()).toBe(403);
    expect((await request.get("/api/cron/cleanup-demo", { headers: { authorization: "Bearer wrong" } })).status()).toBe(403);
  });
});

test("smart replanner counts completed blocks and offers a replan after a missed session", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Long essay", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 180 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    expect((await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "replan-e2e-0001" } })).ok()).toBeTruthy();

    const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
    const [first, second] = plan.tasks as { id: string; durationMinutes: number }[];
    expect((await s.page.request.patch(`/api/study-tasks/${first.id}`, { data: { status: "completed" } })).ok()).toBeTruthy();

    // Completed time is no longer required.
    const recovery = await (await s.page.request.get("/api/recovery")).json();
    const essential = recovery.plan.scenarios.find((x: { key: string }) => x.key === "essential");
    expect(essential.requiredMinutes).toBe(180 - first.durationMinutes);

    // Move the next block into the past: it is now a missed session.
    const yesterday = Date.now() - 86400_000;
    await s.db.from("study_tasks").update({ starts_at: new Date(yesterday).toISOString(), ends_at: new Date(yesterday + second.durationMinutes * 60_000).toISOString() }).eq("id", second.id);
    await s.page.goto("/dashboard");
    await expect(s.page.getByRole("heading", { name: /You missed 1 study block/ })).toBeVisible();
    await s.page.getByRole("link", { name: /Replan from now/ }).click();
    await expect(s.page).toHaveURL(/\/recovery\?replan=1/);
    await expect(s.page.getByText(/Replanning around 1 missed block/)).toBeVisible();
  } finally {
    await s.cleanup();
  }
});

test("teach-it-back checks an explanation against cited pages and starts a targeted retest", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/quizzes");
    await s.page.waitForLoadState("networkidle");
    await s.page.getByLabel("Topic to explain").fill("residuals");
    await s.page.getByLabel("Your explanation").fill("A residual is the observed value minus the predicted value. Large residuals mean the model fits that point poorly, and least squares makes the squared residuals as small as possible overall.");
    await s.page.getByRole("button", { name: "Check my explanation" }).click();

    const feedback = s.page.getByLabel("Teach-back feedback");
    await expect(feedback).toContainText(/% of key concepts/);
    const concepts = feedback.getByRole("list", { name: "Key concepts from your notes" });
    await expect(concepts.getByRole("link", { name: /module_4\.pdf · p\. \d/ }).first()).toBeVisible();
    await expect(s.page.getByRole("list", { name: "Recent explanations" })).toContainText("residuals");

    // This short explanation leaves concepts out, so a targeted retest on exactly those is offered.
    await feedback.getByRole("button", { name: /Practise \d missing/ }).click();
    await expect(s.page.getByText(/Review:/).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await s.cleanup();
  }
});

test("rubric decoder turns a brief into an editable, page-linked checklist the student can tick off", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Regression report", dueAt: new Date(Date.now() + 6 * 86400_000).toISOString(), estimatedMinutes: 240 } });
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/assignment_brief.pdf");
    await expect(s.page.getByText(/Indexed · 2 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.getByRole("button", { name: "Decode brief for Regression report" }).click();
    const dialog = s.page.getByRole("dialog", { name: "Turn the brief into a checklist" });
    await dialog.getByRole("button", { name: "Decode brief" }).click();
    const rows = dialog.getByRole("list", { name: "Decoded items" }).getByRole("listitem");
    await expect(rows.filter({ hasText: "Criterion · 40%" })).toHaveCount(1);
    const total = await rows.count();
    expect(total).toBeGreaterThanOrEqual(8);
    // Drop one item; only the kept ones are saved.
    await dialog.getByLabel("Keep item 1", { exact: true }).uncheck();
    await dialog.getByRole("button", { name: `Save checklist (${total - 1})` }).click();
    await expect(dialog).toBeHidden();

    const summary = s.page.getByText(new RegExp(`Preparation checklist · 0/${total - 1} ready`));
    await expect(summary).toBeVisible();
    await summary.click();
    const list = s.page.getByRole("list", { name: "Checklist for Regression report" });
    await expect(list.getByRole("link", { name: "p. 2" }).first()).toBeVisible();
    await list.getByRole("checkbox").first().check();
    await expect(s.page.getByText(new RegExp(`Preparation checklist · 1/${total - 1} ready`))).toBeVisible();
    await s.page.reload();
    await expect(s.page.getByText(new RegExp(`Preparation checklist · 1/${total - 1} ready`))).toBeVisible();
  } finally {
    await s.cleanup();
  }
});

test("calendar export: .ics download and a private feed link that can be revoked", async ({ browser, playwright }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Essay; part 1, draft", dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "calendar-e2e-0001" } });

    const ics = await s.page.request.get("/api/calendar/ics");
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:Due: Essay\; part 1\\, draft");

    await s.page.goto("/planner");
    await s.page.getByRole("button", { name: "Create private link" }).click();
    const link = await s.page.getByLabel(/Your private link/).inputValue();
    expect(link).toMatch(/\/api\/calendar\/feed\/[A-Za-z0-9_-]{43}$/);

    // A calendar app has no session: the link alone works.
    // The link's host comes from NEXT_PUBLIC_APP_URL (the dev server locally); the token is what matters, so
    // request its path from the server under test.
    const anonymous = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
    const feedPath = new URL(link).pathname;
    const feed = await anonymous.get(feedPath);
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain("Due: Essay");

    await s.page.getByRole("button", { name: "Revoke link" }).click();
    await expect(s.page.getByRole("button", { name: "Create private link" })).toBeVisible();
    expect((await anonymous.get(feedPath)).status()).toBe(404);
    expect((await anonymous.get(feedPath.replace(/[A-Za-z0-9_-]{43}$/, "x".repeat(43)))).status()).toBe(404);
    await anonymous.dispose();
  } finally {
    await s.cleanup();
  }
});

test("weekly review recommends from real numbers and saves the student's reflection", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 120 } });
    const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
    await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "week-e2e-00001" } });
    const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
    const block = plan.tasks[0] as { id: string; durationMinutes: number };
    // Make the first block a missed session earlier today.
    const start = Date.now() - 3 * 3600_000;
    await s.db.from("study_tasks").update({ starts_at: new Date(start).toISOString(), ends_at: new Date(start + block.durationMinutes * 60_000).toISOString() }).eq("id", block.id);

    await s.page.goto("/insights");
    const recs = s.page.getByRole("list", { name: "Recommended next steps" });
    await expect(recs.getByRole("link").first()).toContainText("Replan around 1 missed block");
    // Recovery score: the one block due so far was missed (0%); completing it lifts today's score to 100%.
    await expect(s.page.getByRole("heading", { name: "Recovery score" })).toBeVisible();
    await expect(s.page.getByText("0% today")).toBeVisible();
    expect((await s.page.request.patch(`/api/study-tasks/${block.id}`, { data: { status: "completed" } })).ok()).toBe(true);
    await s.page.reload();
    await expect(s.page.getByText("100% today")).toBeVisible();
    await s.page.getByLabel("What went well this week?").fill("Finished the reading early.");
    await s.page.getByLabel("One focus for next week").fill("Start the worksheet on Monday.");
    await s.page.getByRole("button", { name: "Save reflection" }).click();
    await expect(s.page.getByRole("button", { name: "Saved" })).toBeVisible();
    await s.page.reload();
    await expect(s.page.getByLabel("What went well this week?")).toHaveValue("Finished the reading early.");
  } finally {
    await s.cleanup();
  }
});

test("learning trail: a confirmed prerequisite shows in the universe with a study order", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const intro = (await (await s.page.request.post("/api/courses", { data: { title: "Intro to Programming" } })).json()).course.id;
    const stats = (await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json()).course.id;
    await s.page.goto(`/courses/${stats}`);
    await s.page.getByLabel("Course this builds on").selectOption({ label: "Intro to Programming" });
    await s.page.getByRole("button", { name: "Add link" }).click();
    await expect(s.page.getByRole("list", { name: "Courses this builds on" })).toContainText("Intro to Programming");
    // A loop is refused.
    const loop = await s.page.request.post(`/api/courses/${intro}/prerequisites`, { data: { requiresCourseId: stats } });
    expect(loop.status()).toBe(409);

    await s.page.goto("/universe");
    await s.page.getByRole("group", { name: "Universe view" }).getByRole("button", { name: "List" }).click();
    await expect(s.page.getByRole("list", { name: "Courses and topics" })).toContainText("Builds on Intro to Programming");
    await expect(s.page.getByLabel("Suggested study order")).toContainText("Intro to Programming → Applied Statistics");
  } finally {
    await s.cleanup();
  }
});

test("catch-up pack: cited summary, key terms, self-check and a 30-minute plan sent for approval", async ({ browser }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 60 } });
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/catch-up");
    await s.page.getByRole("navigation", { name: "Lecture documents" }).getByRole("link").first().click();
    await expect(s.page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect(s.page.getByRole("link", { name: /^p\. \d$/ }).first()).toBeVisible();
    await expect(s.page.getByRole("heading", { name: "Key terms" })).toBeVisible();
    const first = s.page.getByRole("group", { name: "Answers for question 1" });
    await first.getByRole("button").first().click();
    await expect(s.page.getByText(/Correct\.|The answer is/).first()).toBeVisible();
    const thumbs = s.page.getByRole("group", { name: "Did this pack help you catch up?" });
    await thumbs.getByRole("button", { name: "No, not helpful" }).click();
    await thumbs.getByLabel(/What went wrong/).fill("Too short for page 3");
    await thumbs.getByRole("button", { name: "Send" }).click();
    await expect(thumbs.getByRole("status")).toHaveText("Thanks, noted.");

    await s.page.getByRole("button", { name: "Add a 30-minute catch-up to my plan" }).click();
    await expect(s.page).toHaveURL(/\/recovery\?proposal=/);
    const dialog = s.page.getByRole("dialog", { name: /Approve/ });
    await expect(dialog).toContainText("Catch up: statistics_module_4.pdf");
  } finally {
    await s.cleanup();
  }
});

test("preferences: opt-in study emails persist and feedback is saved", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await s.page.goto("/settings");
    const digest = s.page.getByRole("switch", { name: "Morning digest email" });
    await expect(digest).toHaveAttribute("aria-checked", "false");
    await digest.click();
    await expect(digest).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await (await s.page.request.get("/api/nudges/prefs")).json()).prefs.dailyDigest).toBe(true);
    await s.page.reload();
    await expect(s.page.getByRole("switch", { name: "Morning digest email" })).toHaveAttribute("aria-checked", "true");
    await expect(s.page.getByRole("switch", { name: "Missed-block alert email" })).toHaveAttribute("aria-checked", "false");

    await s.page.getByLabel(/What helped, what got in the way/).fill("The calm planner view helps a lot.");
    await s.page.getByRole("button", { name: "Send feedback" }).click();
    await expect(s.page.getByText("Thanks, your feedback was saved.")).toBeVisible();
    const exported = await (await s.page.request.get("/api/account/export")).json();
    expect(exported.feedback[0]).toMatchObject({ kind: "general", comment: "The calm planner view helps a lot.", page: "/settings" });
    expect(exported.emailPreferences[0]).toMatchObject({ daily_digest: true, missed_alert: false });
  } finally {
    await s.cleanup();
  }
});

test("public quality page shows real counts and live status without signing in", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/quality");
  await expect(page).toHaveURL(/\/quality$/);
  await expect(page.getByRole("heading", { name: "How we know it works." })).toBeVisible();
  await expect(page.getByText(/Database · \d+ ms round trip/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Automated tests" })).toBeVisible();
  await expect(page.getByText(/\d+ passed/).first()).toBeVisible();
  await expect(page.getByText(/Row-level security on all \d+ tables/)).toBeVisible();
  await context.close();
});
