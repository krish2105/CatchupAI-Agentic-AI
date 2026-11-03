/** Data contract for the 3D universe. Built server-side from the student's own records only. */
export type NodeStatus = "on_track" | "needs_work" | "mastered" | "no_data";

export type UniverseTopic = {
  id: string;
  label: string;
  kind: "document" | "assignment";
  status: NodeStatus;
};

export type UniverseNode = {
  id: string;
  label: string;
  status: NodeStatus;
  /** Percent of approved tasks completed for this course; null when there is no plan evidence. */
  progress: number | null;
  summary: string;
  href: string;
  /** Earliest upcoming incomplete assignment deadline (ISO) — orders the deadline path. */
  nextDueAt?: string | null;
  topics: UniverseTopic[];
};

export type UniverseGraph = { nodes: UniverseNode[] };

export const STATUS_LABEL: Record<NodeStatus, string> = {
  on_track: "On track",
  needs_work: "Needs work",
  mastered: "Completed",
  no_data: "No plan yet",
};
