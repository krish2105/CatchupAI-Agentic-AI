import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { adminDb } from "../tests/e2e/admin";

/**
 * The 3-minute product demo, recorded automatically: a synthetic student ("Alex") walks through the real app.
 * Captions are drawn on screen and also written to an .srt file with the same timings.
 */
const OUT = "demo/out";
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

test("record the CatchUp AI demo", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const db = adminDb();
  const email = `demo-video-${Date.now().toString(36)}@test.catchup.local`;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await db.from("profiles").update({ display_name: "Alex", timezone: "Europe/London", weekly_minutes: [90, 90, 90, 90, 60, 120, 120], study_start_time: "08:00", onboarded_at: new Date().toISOString() }).eq("id", userId);
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email });

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const t0 = Date.now();
  const cues: { start: number; text: string }[] = [];

  async function caption(text: string) {
    cues.push({ start: Date.now() - t0, text });
    await showCaption(page, text);
  }
  // Slightly longer than strictly needed so every caption can be read comfortably.
  const hold = (ms: number) => page.waitForTimeout(Math.round(ms * 1.35));

  try {
    await page.goto("/");
    await caption("CatchUp AI helps a student who has fallen behind get back on track, using their real deadlines and notes.");
    await hold(5000);
    await page.mouse.wheel(0, 700);
    await caption("The AI only drafts. Nothing is saved until the student approves it.");
    await hold(4500);

    await page.goto(`/auth/confirm?token_hash=${link!.properties!.hashed_token}&type=magiclink&next=/dashboard`);
    await page.waitForURL(/\/dashboard$/);
    const course = await (await page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Regression worksheet", dueAt: inDays(5), estimatedMinutes: 120 } });
    await page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Module 4 quiz", dueAt: inDays(9), estimatedMinutes: 45 } });

    await page.goto(`/courses/${course.course.id}`);
    await page.waitForLoadState("networkidle");
    await caption("Alex missed a week. First, the lecture notes go into a private vault (synthetic notes in this demo).");
    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });
    await caption("Each page is indexed, so every answer can point to the exact page it came from.");
    await hold(4000);

    await page.goto("/catch-up");
    await page.getByRole("navigation", { name: "Lecture documents" }).getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await caption("Missed the lecture? A catch-up pack: a summary, key terms and check questions, each linked to its page. Built without AI.");
    await hold(5500);
    await page.getByRole("heading", { name: "Check yourself" }).scrollIntoViewIfNeeded();
    await page.getByRole("group", { name: "Answers for question 1" }).getByRole("button").first().click();
    await caption("Quick self-check, with the page to re-read if an answer is wrong.");
    await hold(4500);

    await page.goto("/assistant");
    await caption("The copilot works through permission-checked tools. This recording uses the built-in scripted test model; the live site runs an OpenAI model.");
    await page.getByLabel("Course scope").selectOption({ label: "Applied Statistics" });
    await page.getByLabel("Message CatchUp Copilot").pressSequentially("Remember: I study best in the morning. What does a residual mean?", { delay: 18 });
    await page.getByRole("button", { name: "Send message" }).click();
    const timeline = page.getByRole("list", { name: "Executed tool calls" });
    await expect(timeline.getByRole("listitem")).toHaveCount(6, { timeout: 30_000 });
    await caption("Every tool call is shown as it really ran. Facts cite the page; advice is kept separate.");
    await hold(5500);
    const memory = page.getByRole("region", { name: "What the copilot remembers" });
    await memory.scrollIntoViewIfNeeded();
    await caption("It suggested something to remember. It isn't used until Alex keeps it, and it can be edited or deleted.");
    await hold(2500);
    await memory.getByRole("button", { name: "Keep" }).click();
    await hold(3000);

    await page.goto("/recovery");
    await caption("The recovery lab compares three routes. A fixed algorithm, not AI, schedules around deadlines and free time.");
    await hold(6500);
    await page.goto("/assistant");
    await page.getByRole("link", { name: "Review in lab" }).click();
    const dialog = page.getByRole("dialog", { name: /Approve/ });
    await expect(dialog).toBeVisible();
    await showCaption(page, cues.at(-1)!.text);
    await caption("Before approving, Alex sees every block that will be added. Approval saves it exactly once.");
    await hold(5000);
    await dialog.getByRole("button", { name: "Approve plan" }).click();
    await page.waitForURL(/\/planner\?approved=1$/);
    await caption("The approved plan becomes Alex's study schedule, in their own time zone. It can also sync to a calendar.");
    await hold(5000);
    await page.getByRole("group", { name: "Schedule view" }).getByRole("button", { name: "List" }).click();
    const ticks = page.getByRole("checkbox", { name: /^Mark “.*” done$/ });
    await ticks.first().click();
    await hold(800);
    await ticks.first().click();
    await caption("Alex ticks off finished blocks.");
    await hold(3000);
    await page.getByRole("button", { name: "Why this plan?" }).click();
    const trust = page.getByRole("dialog", { name: "Why you can trust this plan" });
    await expect(trust).toBeVisible();
    await caption("'Why trust this?' shows the decision history, the pages used, the tools that ran, and what can't be known.");
    await hold(6000);
    await page.keyboard.press("Escape");

    await page.goto("/universe");
    await caption("The learning universe: each course is an island, and every finished block grows a tree.");
    await hold(6500);

    await page.goto("/insights");
    await caption("Momentum comes only from real activity: study minutes and a recovery score for keeping up with the plan.");
    await hold(6000);

    await page.goto("/settings");
    await page.getByRole("heading", { name: "Study emails" }).scrollIntoViewIfNeeded();
    await caption("Opt-in study emails, one-click unsubscribe, feedback, and a read-only link for other AI apps (MCP).");
    await page.getByRole("switch", { name: "Morning digest email" }).click();
    await hold(6000);

    await page.goto("/quality");
    await caption("Anyone can check the quality page: tests, evaluation, CI and live health, all generated, none typed in by hand.");
    await hold(6500);
    await page.mouse.wheel(0, 800);
    await hold(3000);

    await page.goto("/");
    await caption("CatchUp AI · catchupai-chi.vercel.app · evidence first, student in control.");
    await hold(5000);
    cues.push({ start: Date.now() - t0, text: "" });
  } finally {
    const video = page.video();
    await context.close();
    await db.auth.admin.deleteUser(userId);
    if (video) writeFileSync(`${OUT}/video-path.txt`, await video.path());
    writeFileSync(`${OUT}/catchup-ai-demo.srt`, toSrt(cues));
  }
});

/** Caption bar in the browser's top layer, so it stays above dialogs. */
async function showCaption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption") as (HTMLElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.setAttribute("popover", "manual");
      el.setAttribute("aria-hidden", "true");
      Object.assign(el.style, {
        position: "fixed", inset: "auto 0 28px 0", margin: "0 auto", width: "fit-content", maxWidth: "1040px", padding: "12px 20px",
        background: "rgba(16, 28, 22, 0.88)", color: "#f4f7f2", font: "500 20px/1.4 system-ui, sans-serif", borderRadius: "12px",
        border: "0", textAlign: "center", pointerEvents: "none", boxShadow: "0 8px 30px rgba(0,0,0,.25)",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    try { el.hidePopover?.(); } catch {}
    el.showPopover?.();
  }, text);
}

function toSrt(cues: { start: number; text: string }[]) {
  const ts = (ms: number) => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
  };
  return cues
    .slice(0, -1)
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(cues[i + 1].start)}\n${c.text}\n`)
    .join("\n");
}
