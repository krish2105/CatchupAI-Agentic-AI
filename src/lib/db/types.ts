/** Browser-safe DTOs (camelCase). Never include owner_id-based secrets or embeddings. */
export type Profile = {
  id: string;
  displayName: string | null;
  timezone: string;
  weeklyMinutes: number[];
  studyStartTime: string;
  onboarded: boolean;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  assignmentCount: number;
  documentCount: number;
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  notes: string;
  dueAt: string;
  estimatedMinutes: number;
  required: boolean;
  status: "todo" | "in_progress" | "completed";
  updatedAt: string;
};
