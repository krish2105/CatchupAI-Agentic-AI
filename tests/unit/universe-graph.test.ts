import { describe, expect, it } from "vitest";
import type { Assignment, Course } from "@/lib/db/types";
import { buildUniverseGraph } from "@/lib/universe/graph";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const course = (id: string): Course => ({ id, title: id, description: "", createdAt: "", assignmentCount: 0, documentCount: 0 });
const assignment = (id: string, courseId: string, dueAt: string, status: Assignment["status"] = "todo", required = true): Assignment => ({
  id, courseId, title: id, notes: "", dueAt, estimatedMinutes: 60, required, status, updatedAt: "",
});

describe("buildUniverseGraph", () => {
  it("marks courses with overdue required work as needs_work", () => {
    const g = buildUniverseGraph([course("stats")], [assignment("a", "stats", "2026-11-09T00:00:00Z")], [], [], NOW);
    expect(g.nodes[0]).toMatchObject({ status: "needs_work", progress: null });
  });

  it("ignores overdue optional work", () => {
    const g = buildUniverseGraph([course("stats")], [assignment("a", "stats", "2026-11-09T00:00:00Z", "todo", false)], [], [], NOW);
    expect(g.nodes[0].status).toBe("no_data");
  });

  it("derives progress only from active plan tasks", () => {
    const g = buildUniverseGraph(
      [course("stats")],
      [assignment("a", "stats", "2026-11-12T00:00:00Z")],
      [{ courseId: "stats", status: "completed" }, { courseId: "stats", status: "todo" }, { courseId: "stats", status: "cancelled" }],
      [],
      NOW,
    );
    expect(g.nodes[0]).toMatchObject({ status: "on_track", progress: 50 });
  });

  it("marks all-complete courses as mastered", () => {
    const g = buildUniverseGraph([course("stats")], [assignment("a", "stats", "2026-11-09T00:00:00Z", "completed")], [], [], NOW);
    expect(g.nodes[0].status).toBe("mastered");
  });
});
