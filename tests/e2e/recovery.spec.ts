import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

test.describe("recovery lab → approval → planner", () => {
  test("approve a feasible route once (double click), reload, complete a task", async ({ browser }) => {
    const s = await freshStudent(browser);
    try {
      const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
      await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Regression worksheet", dueAt: inDays(5), estimatedMinutes: 200 } });

      await s.page.goto("/recovery");
      const essential = s.page.getByRole("button", { name: /Essential rescue/ });
      await expect(essential).toHaveAttribute("aria-pressed", "true");
      await expect(essential).toContainText("Fits your time");
      await s.page.getByRole("button", { name: /Review and approve/ }).click();

      const dialog = s.page.getByRole("dialog", { name: /Approve/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("list", { name: "Proposed tasks" }).getByRole("listitem")).toHaveCount(3); // 90 + 90 + 20
      const approve = dialog.getByRole("button", { name: "Approve plan" });
      await approve.dblclick();
      await s.page.waitForURL(/\/planner\?approved=1$/);
      await expect(s.page.getByText("Plan approved and saved.")).toBeVisible();

      const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
      expect(plan.tasks).toHaveLength(3);
      const { data: plans } = await s.db.from("study_plans").select("id").eq("owner_id", s.userId);
      expect(plans).toHaveLength(1);

      await s.page.reload();
      await expect(s.page.getByText("0 / 3")).toBeVisible();
      await s.page.getByRole("checkbox", { name: /Regression worksheet \(part 1 of 3\)/ }).click();
      await expect(s.page.getByText("1 / 3")).toBeVisible();
      await s.page.reload();
      await expect(s.page.getByRole("checkbox", { name: /part 1 of 3/ })).toHaveAttribute("aria-checked", "true");

      await s.page.goto("/dashboard");
      await expect(s.page.getByText(/1 of 3 approved tasks done/)).toBeVisible();
    } finally {
      await s.cleanup();
    }
  });

  test("rejecting a proposal saves nothing", async ({ browser }) => {
    const s = await freshStudent(browser);
    try {
      const course = await (await s.page.request.post("/api/courses", { data: { title: "Programming" } })).json();
      await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Loops exercise", dueAt: inDays(3), estimatedMinutes: 60 } });
      await s.page.goto("/recovery");
      await s.page.getByRole("button", { name: /Review and approve/ }).click();
      await s.page.getByRole("dialog").getByRole("button", { name: "Reject" }).click();
      await expect(s.page.getByRole("dialog")).toBeHidden();
      const { plan } = await (await s.page.request.get("/api/study-tasks")).json();
      expect(plan).toBeNull();
      const { data } = await s.db.from("action_proposals").select("status").eq("owner_id", s.userId);
      expect(data?.map((p) => p.status)).toEqual(["rejected"]);
    } finally {
      await s.cleanup();
    }
  });

  test("an overloaded schedule shows the honest shortfall and cannot be approved", async ({ browser }) => {
    const s = await freshStudent(browser, { weekly_minutes: [60, 60, 60, 60, 60, 60, 60] });
    try {
      const course = await (await s.page.request.post("/api/courses", { data: { title: "Statistics" } })).json();
      await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Big project", dueAt: inDays(2), estimatedMinutes: 540 } });
      await s.page.goto("/recovery");
      await expect(s.page.getByRole("button", { name: /Essential rescue/ })).toContainText(/Short by \d+h/);
      await expect(s.page.getByRole("button", { name: /Review and approve/ })).toBeDisabled();
      await expect(s.page.getByText("Infeasible routes can't be approved.")).toBeVisible();

      // What-if: more weekly time makes it fit, but approval requires saving that availability first.
      await s.page.getByLabel(/STUDY TIME PER WEEK/).fill("2400");
      await expect(s.page.getByRole("button", { name: /Essential rescue/ })).toContainText("Fits your time");
      await expect(s.page.getByRole("button", { name: /Review and approve/ })).toBeDisabled();
      await s.page.getByRole("button", { name: "Save this availability" }).click();
      await expect(s.page.getByRole("button", { name: /Review and approve/ })).toBeEnabled();

      // The API refuses to approve an infeasible proposal even if called directly.
      await s.page.request.patch("/api/profile", { data: { weeklyMinutes: [60, 60, 60, 60, 60, 60, 60] } });
      const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
      expect(draft.proposal.feasible).toBe(false);
      const res = await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "abcdef123456" } });
      expect(res.status()).toBe(409);
      expect((await res.json()).error.code).toBe("infeasible");
    } finally {
      await s.cleanup();
    }
  });

  test("approval requires an idempotency key and rejects other students' proposals", async ({ browser, request }) => {
    const s = await freshStudent(browser);
    try {
      const course = await (await s.page.request.post("/api/courses", { data: { title: "Stats" } })).json();
      await s.page.request.post("/api/assignments", { data: { courseId: course.course.id, title: "Quiz prep", dueAt: inDays(4), estimatedMinutes: 60 } });
      const draft = await (await s.page.request.post("/api/proposals", { data: { scenario: "essential" } })).json();
      expect((await s.page.request.post(`/api/proposals/${draft.proposal.id}/approve`)).status()).toBe(400);
      // `request` is the shared E2E student: a different tenant.
      expect((await request.get(`/api/proposals/${draft.proposal.id}`)).status()).toBe(404);
      expect((await request.post(`/api/proposals/${draft.proposal.id}/approve`, { headers: { "idempotency-key": "abcdef123456" } })).status()).toBe(404);
      expect((await request.post(`/api/proposals/${draft.proposal.id}/reject`)).status()).toBe(404);
      const { data } = await s.db.from("action_proposals").select("status").eq("id", draft.proposal.id).single();
      expect(data?.status).toBe("pending");
    } finally {
      await s.cleanup();
    }
  });
});
