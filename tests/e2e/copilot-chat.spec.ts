import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const REDIRECT = /I can only help with your studies in CatchUp/;

test("copilot conversation: follow-ups continue the same chat, off-topic requests are redirected, New chat starts fresh", async ({ browser }) => {
  const s = await freshStudent(browser);
  const runs = async () => (await s.db.from("agent_runs").select("id, thread_id, request_text").eq("owner_id", s.userId).order("created_at")).data ?? [];
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Worksheet", dueAt: new Date(Date.now() + 4 * 86400_000).toISOString(), estimatedMinutes: 120 } });
    await s.page.goto("/assistant");

    const input = s.page.getByLabel("Message CatchUp Copilot");
    await input.fill("I missed Monday's class. What should I do?");
    await input.press("Enter");
    const followUp = s.page.getByRole("group", { name: "Ask a follow-up" }).getByRole("button", { name: "What should I study first this week?" });
    await expect(followUp).toBeVisible({ timeout: 30_000 });

    // A follow-up continues the same conversation.
    await followUp.click();
    await expect(s.page.locator(".chat-bubble.user")).toHaveCount(2, { timeout: 30_000 });
    await expect(s.page.getByRole("group", { name: "Ask a follow-up" })).toHaveCount(1);
    await expect.poll(async () => (await runs()).length).toBe(2);
    const [first, second] = await runs();
    expect(first.thread_id).toBeTruthy();
    expect(second.thread_id).toBe(first.thread_id);

    // Off-topic: the fixed redirect is shown, never what the model wrote.
    await input.fill("Write me a poem about the sea");
    await input.press("Enter");
    await expect(s.page.getByText(REDIRECT).last()).toBeVisible({ timeout: 30_000 });
    await expect(s.page.getByText("Here is a poem about the sea")).toHaveCount(0);

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await expect(s.page.locator(".chat-bubble.user")).toHaveCount(3);
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }

    // New chat: the next message starts another conversation.
    await s.page.getByRole("button", { name: "New chat" }).click();
    await expect(s.page.locator(".chat-bubble.user")).toHaveCount(0);
    await input.fill("What is due this week?");
    await input.press("Enter");
    await expect(s.page.locator(".chat-bubble.user")).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(async () => (await runs()).length).toBe(4);
    const all = await runs();
    expect(all[3].thread_id).toBeTruthy();
    expect(all[3].thread_id).not.toBe(first.thread_id);
  } finally {
    await s.cleanup();
  }
});
