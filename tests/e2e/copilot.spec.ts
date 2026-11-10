import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

test("copilot runs real tools, cites the page, drafts a plan that the student approves in the lab", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await freshStudent(browser, { weekly_minutes: [150, 150, 150, 150, 150, 150, 150] });
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Applied Statistics" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Regression worksheet", dueAt: inDays(5), estimatedMinutes: 120 } });
    await s.page.goto(`/courses/${course.course.id}`);
    await s.page.waitForLoadState("networkidle");
    await s.page.locator('input[type="file"]').setInputFiles("tests/fixtures/statistics_module_4.pdf");
    await expect(s.page.getByText(/Indexed · 4 pages/)).toBeVisible({ timeout: 30_000 });

    await s.page.goto("/assistant");
    await expect(s.page.getByText("Scripted test model · not AI").first()).toBeVisible();
    await s.page.getByLabel("Course scope").selectOption({ label: "Applied Statistics" });
    await s.page.getByLabel("Message CatchUp Copilot").fill("What does a residual mean?");
    await s.page.getByRole("button", { name: "Send message" }).click();

    const timeline = s.page.getByRole("list", { name: "Executed tool calls" });
    // Six tools: the Coach also asks the Diagnostician what the student already knows (agent team).
    await expect(timeline.getByRole("listitem")).toHaveCount(6, { timeout: 30_000 });
    await expect(timeline).toContainText("Read what you asked it to remember · completed");
    await expect(timeline).toContainText("Asked the Diagnostician what you know · completed");
    await expect(timeline).toContainText("Searched your course notes · completed");
    await expect(timeline).toContainText("Drafted a plan (not saved) · completed");

    const facts = s.page.getByRole("region", { name: "From your course material and data" });
    await expect(facts.getByRole("link", { name: "statistics_module_4.pdf · p. 2" })).toBeVisible();
    await expect(s.page.getByRole("region", { name: "Suggestions" })).toBeVisible();

    // Persisted: the trace survives a reload.
    await s.page.reload();
    await expect(s.page.getByRole("link", { name: "statistics_module_4.pdf · p. 2" })).toBeVisible();

    // The deterministic self-check is shown on the draft, and opens to list each check.
    const badge = s.page.locator(".decision-card").getByText("Self-check passed", { exact: true });
    await expect(badge).toBeVisible();
    await badge.click();
    await expect(s.page.locator(".decision-card")).toContainText("Every block before its deadline · yes");

    await s.page.getByRole("link", { name: "Review in lab" }).click();
    const dialog = s.page.getByRole("dialog", { name: /Approve/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Self-check passed", { exact: true })).toBeVisible();
    await expect(dialog).toContainText("Review the cited notes");
    await dialog.getByRole("button", { name: "Approve plan" }).click();
    await s.page.waitForURL(/\/planner\?approved=1$/);
    await s.page.getByRole("group", { name: "Schedule view" }).getByRole("button", { name: "List" }).click();
    await expect(s.page.getByRole("link", { name: /statistics_module_4\.pdf · p\. 2/ })).toBeVisible();

    // The trust drawer explains the saved plan from the server's own records.
    await s.page.getByRole("button", { name: "Why this plan?" }).click();
    const trust = s.page.getByRole("dialog", { name: "Why you can trust this plan" });
    await expect(trust).toContainText("Approved by you");
    await expect(trust).toContainText("by the copilot, from your request");
    await expect(trust.getByText("Searched your course notes")).toBeVisible();
    await expect(trust.getByRole("link", { name: /statistics_module_4\.pdf · p\. 2/ }).first()).toBeVisible();
    await expect(trust).toContainText("calculated by a fixed algorithm");

    // The full trace: every tool the agent chose, with privacy-safe arguments, timing, model and cited pages.
    await trust.getByRole("link", { name: "Open the full agent trace" }).click();
    await s.page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
    const traceUrl = s.page.url();
    await expect(s.page.getByRole("heading", { level: 1, name: "Coach trace" })).toBeVisible();
    const steps = s.page.getByRole("list", { name: "Tool calls in the order the agent chose them" });
    await expect(steps.getByRole("listitem")).toHaveCount(6);
    await expect(steps).toContainText("search_course_material");
    await expect(steps).toContainText("check_understanding");
    await expect(steps).toContainText('query: "What does a residual mean?"');
    await expect(steps).toContainText(/\d+ ms/);
    await expect(s.page.getByRole("region", { name: "Run summary" })).toContainText("scripted-test-model");
    await expect(s.page.getByRole("region", { name: "Pages cited in the answer" }).getByRole("link", { name: /statistics_module_4\.pdf · p\. 2/ })).toBeVisible();
    await expect(s.page.getByText("Self-check passed", { exact: true })).toBeVisible();

    // Owner only: another student gets the not-found page and none of the run's data, and so does a malformed id.
    // (The app layout streams its shell first, so Next.js sends the not-found UI with status 200.)
    const other = await freshStudent(browser);
    try {
      await other.page.goto(traceUrl);
      await expect(other.page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
      await expect(other.page.getByText("What does a residual mean?")).toHaveCount(0);
      await expect(other.page.getByRole("heading", { name: /trace$/ })).toHaveCount(0);
      await other.page.goto("/runs/not-a-uuid");
      await expect(other.page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
    } finally {
      await other.cleanup();
    }

    const { data: runs } = await s.db.from("agent_runs").select("status, tool_events").eq("owner_id", s.userId);
    expect(runs).toHaveLength(1);
    expect(runs![0].status).toBe("completed");

    // The answer is streamed: answer events (checked facts, then suggestions as they're written) arrive before
    // "final". Read the raw SSE stream directly (the browser consumes the copilot's own stream).
    const sse = await (await s.page.request.post("/api/agent/run", { data: { message: "What does a residual mean?", courseId: course.course.id } })).text();
    const answerAt = sse.indexOf("event: answer");
    expect(answerAt).toBeGreaterThan(-1);
    expect(answerAt).toBeLessThan(sse.indexOf("event: final"));
    expect(sse).toMatch(/event: answer\ndata: \{"type":"fact".*"page":2/);
    expect((sse.match(/event: answer\ndata: \{"type":"text"/g) ?? []).length).toBeGreaterThan(1);
  } finally {
    await s.cleanup();
  }
});

test("copilot abstains without evidence and rejects another student's course", async ({ browser, request }) => {
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Empty course" } })).json();
    await s.page.goto("/assistant");
    await s.page.getByLabel("Course scope").selectOption({ label: "Empty course" });
    await s.page.getByLabel("Message CatchUp Copilot").fill("Explain photosynthesis from my notes");
    await s.page.getByRole("button", { name: "Send message" }).click();
    await expect(s.page.getByText(/couldn't verify that in your uploaded materials/)).toBeVisible({ timeout: 30_000 });
    await expect(s.page.getByRole("region", { name: "From your course material and data" })).toHaveCount(0);

    // The shared E2E student cannot run the agent against this student's course.
    const forged = await request.post("/api/agent/run", { data: { message: "show me everything", courseId: course.course.id } });
    expect(forged.status()).toBe(404);
    expect((await request.post("/api/agent/run", { data: { message: "x" } })).status()).toBe(400);
  } finally {
    await s.cleanup();
  }
});

test("copilot suggests a memory that is only used after the student keeps it; MCP reads the same data with a token", async ({ browser, playwright }) => {
  test.setTimeout(90_000);
  const s = await freshStudent(browser);
  try {
    const course = await (await s.page.request.post("/api/courses", { data: { title: "Biology" } })).json();
    await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Cell essay", dueAt: inDays(6), estimatedMinutes: 90 } });
    await s.page.goto("/assistant");
    const panel = s.page.getByRole("region", { name: "What the copilot remembers" });
    await expect(panel).toContainText("Nothing yet");
    await s.page.getByLabel("Message CatchUp Copilot").fill("Remember: I study best before 10am. Help me plan my week.");
    await s.page.getByRole("button", { name: "Send message" }).click();
    await expect(s.page.getByRole("list", { name: "Executed tool calls" })).toContainText("Suggested something to remember · completed", { timeout: 30_000 });

    const suggested = panel.getByRole("list", { name: "Suggested by the copilot" }).or(panel.locator(".memory-suggested"));
    await expect(suggested).toContainText("I study best before 10am");
    await panel.getByRole("button", { name: "Keep" }).click();
    await expect(panel.getByRole("list", { name: "Remembered" })).toContainText("I study best before 10am");
    await panel.getByRole("button", { name: "Edit: I study best before 10am" }).click();
    await panel.getByLabel("Edit memory").fill("I study best before 9am");
    await panel.getByRole("button", { name: "Save" }).click();
    await expect(panel.getByRole("list", { name: "Remembered" })).toContainText("I study best before 9am");
    await s.page.reload();
    await expect(s.page.getByRole("list", { name: "Remembered" })).toContainText("I study best before 9am");

    await s.page.goto("/settings");
    await s.page.getByRole("button", { name: "Create token" }).click();
    const config = await s.page.getByLabel(/MCP config/).inputValue();
    const token = /Bearer (cu_mcp_[\w-]{43})/.exec(config)![1];

    // A separate client with no cookies, like a desktop MCP app.
    const outside = await playwright.request.newContext({ baseURL: new URL(s.page.url()).origin });
    const rpc = (body: object, auth?: string) => outside.post("/api/mcp", { data: body, headers: { accept: "application/json, text/event-stream", "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
    const parse = async (res: Awaited<ReturnType<typeof rpc>>) => {
      const text = await res.text();
      const line = text.split("\n").find((l) => l.startsWith("data: "));
      return JSON.parse(line ? line.slice(6) : text);
    };
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status()).toBe(401);
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "cu_mcp_" + "x".repeat(43))).status()).toBe(401);
    const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } }, token);
    expect(init.status()).toBe(200);
    const list = await parse(await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, token));
    expect(list.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["get_catchup_pack", "get_memories", "get_overview", "get_study_plan", "list_documents", "search_course_notes"]);
    const overview = await parse(await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_overview", arguments: {} } }, token));
    expect(overview.result.content[0].text).toContain("Cell essay");
    const mem = await parse(await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_memories", arguments: {} } }, token));
    expect(mem.result.content[0].text).toContain("I study best before 9am");

    await s.page.reload();
    await expect(s.page.getByText(/last used/)).toBeVisible();
    await s.page.getByRole("button", { name: "Revoke" }).click();
    await expect(s.page.getByText("No token. Nothing outside this app can read your data.")).toBeVisible();
    expect((await rpc({ jsonrpc: "2.0", id: 5, method: "tools/list" }, token)).status()).toBe(401);
    await outside.dispose();
  } finally {
    await s.cleanup();
  }
});
