/** Plain-language names for the copilot's tools (safe for client components). */
export const TOOL_LABEL: Record<string, string> = {
  get_study_preferences: "Read your availability",
  list_courses: "Listed your courses",
  list_assignments: "Listed your assignments",
  search_course_material: "Searched your course notes",
  get_learning_progress: "Checked your plan progress",
  draft_recovery_plan: "Drafted a plan (not saved)",
  get_student_memory: "Read what you asked it to remember",
  suggest_memory: "Suggested something to remember (needs your OK)",
  get_app_help: "Read the CatchUp guide",
  check_understanding: "Asked the Diagnostician what you know",
  start_practice: "Asked the Quizmaster for a practice session",
};

/** The privacy-safe argument summary recorded with each call, as `tool(key: value, …)`. */
export const toolCallText = (tool: string, args: Record<string, unknown>) => `${tool}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})`;
