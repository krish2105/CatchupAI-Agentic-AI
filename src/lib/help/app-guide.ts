/**
 * The CatchUp app guide: what the copilot may say about the app itself (what it can do, where a feature is, how
 * approval, routes, the check-in, settings and privacy work). The copilot reads it through the get_app_help tool
 * and, like any tool result, a statement about the app without a page citation is kept only if this text supports
 * it (tool-fact-support.ts). Written from the app's own screens; tests/unit/app-guide.test.ts checks that every
 * page named here exists and that the numbers match the code, so the guide fails a test when the app changes.
 */
import { stem } from "@/lib/teach/feedback";

export type GuideSection = {
  id: string;
  title: string;
  /** Where it is in the app: page paths and menu names. */
  where: string;
  /** Words a student might use for this topic (matched after stemming). */
  keywords: string[];
  text: string;
};

export const APP_GUIDE: GuideSection[] = [
  {
    id: "overview",
    title: "What CatchUp can do",
    where: "Mission control (/dashboard) and the side menu",
    keywords: ["overview", "features", "feature", "help", "start", "begin", "begins", "capable", "about"],
    text:
      "CatchUp helps a student who has fallen behind get back on track. You add your courses, upload your notes as PDFs and enter or import your deadlines. " +
      "The Recovery lab then works out whether the work still fits before each deadline and offers three routes, with an honest shortfall in minutes when it doesn't fit. " +
      "The AI copilot answers questions about your deadlines, plan and notes, citing the page behind each fact. " +
      "Nothing is saved to your plan until you approve it. Other pages: the Catch-up pack for a missed lecture, the Practice arena, the Focus sanctuary, Your momentum, the Learning universe and Preferences.",
  },
  {
    id: "copilot",
    title: "The AI copilot",
    where: "AI copilot (/assistant)",
    keywords: ["copilot", "assistant", "chat", "ask", "question", "conversation", "answer", "cite", "citation", "source", "verify", "guide", "hint", "socratic", "trace", "remember", "memory"],
    text:
      "The copilot reads your deadlines, availability, progress and notes through permission-checked tools and only ever sees your own data. " +
      "Every fact about your notes cites the page it came from; when your notes don't support an answer it says \"I couldn't verify that in your uploaded materials\". " +
      "It can draft a plan, but a draft is never saved until you approve it in the Recovery lab. " +
      "A conversation keeps the last 4 turns as context; New chat starts a fresh one, and suggested follow-up questions appear under an answer. " +
      "The \"Guide me, don't tell me\" switch gives one hint at a time from your notes and the answer after two attempts or when you ask. " +
      "It only helps with your studies in CatchUp. Each answer links to a trace page listing every tool it used. You confirm anything it suggests remembering in \"What the copilot remembers\".",
  },
  {
    id: "recovery-lab",
    title: "Recovery lab and the three routes",
    where: "Recovery lab (/recovery)",
    keywords: ["route", "routes", "recovery", "lab", "compare", "difference", "shortfall", "fit", "fits", "feasible", "option", "options", "balanced", "full", "essential", "trade"],
    text:
      "The Recovery lab compares three routes calculated from your real deadlines and availability. " +
      "Deadline first: every required deadline, plus the single most important study topic. " +
      "Balanced recovery: required work plus all recommended study and review sessions. " +
      "Full recovery: everything, including optional work, if your time allows it. " +
      "Each route shows the time it needs and any shortfall in minutes. Routes that don't fit can't be approved; change your available time or deadlines, or choose a smaller route.",
  },
  {
    id: "approval",
    title: "Approving a plan",
    where: "Recovery lab (/recovery)",
    keywords: ["approve", "approval", "approved", "plan", "draft", "drafts", "save", "saved", "pending", "stale", "expired", "confirm", "accept"],
    text:
      "A plan from the copilot or the daily check-in is a pending draft until you approve it in the Recovery lab. " +
      "Before it is saved, CatchUp checks the blocks again: no overlaps, every block before its deadline, minutes that add up and all required work covered. " +
      "Approving saves the plan once, even if you press the button twice. Routes that don't fit can't be approved. " +
      "If your deadlines, available time or local calendar rules changed after the draft was made, it is refused as out of date: make a new draft. A draft that has expired also needs to be made again.",
  },
  {
    id: "schedule",
    title: "Study schedule and calendar export",
    where: "Study schedule (/planner)",
    keywords: ["schedule", "planner", "block", "blocks", "week", "month", "list", "tick", "done", "complete", "replan", "calendar", "google", "apple", "outlook", "ics", "export", "subscribe", "sync"],
    text:
      "Approved recovery tasks become your study schedule, shown in your own time zone in week, month and list views. Tick blocks off as you complete them. " +
      "If a block passes unfinished you can replan around it. " +
      "\"Add to your calendar\" puts your approved study blocks and deadlines in Google, Apple or Outlook Calendar: download a .ics copy, or subscribe with a private link that stays in sync. " +
      "The link is shown once, anyone with it can see your schedule, and you can revoke it.",
  },
  {
    id: "courses",
    title: "Courses, notes and importing deadlines",
    where: "Knowledge vault (/courses)",
    keywords: ["course", "courses", "upload", "pdf", "pdfs", "notes", "document", "documents", "file", "vault", "import", "canvas", "moodle", "classroom", "lms", "csv", "imscc", "deadline", "deadlines", "assignment", "assignments", "scanned"],
    text:
      "Add your courses in the Knowledge vault and upload your notes as PDF files, up to 10 MB and 50 pages each. Documents are stored privately, split into page-referenced passages and only searched on your behalf. " +
      "Add assignments with a due date and an estimate, or import them from Canvas, Moodle or Google Classroom: a calendar file (.ics), a spreadsheet (.csv) with a title and due date, or a course export (.imscc). " +
      "The file is read on your device and nothing is saved until you confirm.",
  },
  {
    id: "catch-up",
    title: "Catch-up pack for a missed lecture",
    where: "Catch-up pack (/catch-up)",
    keywords: ["missed", "lecture", "lectures", "class", "rescue", "pack", "catch", "summary", "slides", "transcript", "absent"],
    text:
      "Pick the slides, notes or transcript of the lecture you missed. You get a cited summary, the key terms, five check questions and a 30-minute plan, built only from that document. " +
      "You can also start it as \"Start missed class rescue\" from the command menu.",
  },
  {
    id: "practice",
    title: "Practice arena",
    where: "Practice arena (/quizzes)",
    keywords: ["practice", "quiz", "quizzes", "test", "teach", "explain", "knowledge", "revise", "revision", "arena"],
    text:
      "Explain topics in your own words and take short knowledge checks built only from your uploaded material, with the source page for every concept. " +
      "Answers are graded on the server and every attempt is saved.",
  },
  {
    id: "focus",
    title: "Focus sanctuary",
    where: "Focus sanctuary (/focus)",
    keywords: ["focus", "timer", "pomodoro", "distraction", "session", "sanctuary"],
    text: "Pick a study block, start the timer and step away from everything else. Each session is saved to your history and can complete the block it belongs to.",
  },
  {
    id: "momentum",
    title: "Your momentum and the learning universe",
    where: "Your momentum (/insights) and Learning universe (/universe)",
    keywords: ["momentum", "insights", "progress", "stats", "statistics", "universe", "island", "islands", "track"],
    text:
      "Your momentum shows numbers calculated from your completed study blocks and graded knowledge checks; nothing is estimated or illustrative. " +
      "The Learning universe is a 3D map where every island is one of your courses, coloured by your approved plan progress.",
  },
  {
    id: "checkin",
    title: "The daily check-in",
    where: "Mission control (/dashboard); switch it off in Preferences (/settings) under Daily check-in",
    keywords: ["check", "checkin", "noticed", "notice", "slipping", "behind", "daily", "dismiss", "proactive", "missed"],
    text:
      "Once a day CatchUp looks for study blocks you missed and assignments that no longer fit. If you are slipping, it drafts a fix with the planner, without an AI model, and shows the card \"CatchUp noticed something\" on Mission control with the reason. " +
      "Review and approve it, or dismiss it; nothing changes until you approve. You get at most one check-in draft a day, and you can turn it off with \"Let CatchUp check in\".",
  },
  {
    id: "local-calendar",
    title: "Local calendar: UAE week, prayer times and Ramadan",
    where: "Preferences (/settings) under Local calendar",
    keywords: ["ramadan", "prayer", "prayers", "friday", "hijri", "iftar", "maghrib", "uae", "dubai", "islamic", "fasting", "city", "local", "monday"],
    text:
      "Weeks start on Monday, as at UAE schools and universities. Every rule here is off until you turn it on. " +
      "Friday prayer break: no study block from 12:00 to 14:00 local time on Fridays, and the day's minutes are kept. " +
      "Prayer-time breaks: 15 minutes around each of the five prayers, worked out from the city you pick (8 UAE cities, two calculation methods); your location is never requested. " +
      "Ramadan mode: fewer study minutes on Ramadan days (25% fewer by default), the hour before Maghrib and 30 minutes after it kept free for iftar, and an optional later start time. " +
      "Hijri dates can be shown beside the normal date; they are approximate Umm al-Qura dates.",
  },
  {
    id: "settings",
    title: "Your week and other preferences",
    where: "Preferences (/settings)",
    keywords: ["settings", "preferences", "availability", "hours", "minutes", "weekly", "start", "time", "theme", "dark", "motion", "email", "emails", "digest", "notifications", "send", "feedback"],
    text:
      "Under Your week you set how many minutes you can study on each weekday and when your study day starts; every route and plan uses these. " +
      "Look and feel and Accessibility set the theme and motion. Study emails are optional: a morning digest and a missed-block alert. " +
      "Use CatchUp in other AI apps gives a read-only connection whose token is shown once. Send feedback goes straight to the team.",
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    where: "Preferences (/settings) under Privacy and data, the AI-use disclosure (/ai-disclosure) and the privacy notice (/privacy)",
    keywords: ["privacy", "private", "data", "delete", "account", "export", "see", "share", "personal", "disclosure", "safe", "security", "who"],
    text:
      "Only you can see your courses, notes, plans and conversations. Under Privacy and data you can export your data or delete your account. " +
      "Emails, phone numbers and Emirates ID numbers in your questions are removed before they reach the AI model. " +
      "The AI-use disclosure lists where the assistant helped, the pages it cited and what you approved, ready to attach to coursework if your school asks how you used AI. " +
      "CatchUp is not for children under 13. The privacy notice names the AI service in use.",
  },
  {
    id: "class",
    title: "Your school or class",
    where: "Preferences (/settings) under Your school or class, and the class page (/org)",
    keywords: ["school", "class", "teacher", "teachers", "code", "join", "organisation", "organization", "university"],
    text:
      "Join your class with the code your teacher gives you. Teachers see class totals only, never your notes, answers or plans, and only if you choose to share.",
  },
  {
    id: "demo",
    title: "The demo and public pages",
    where: "Sign-in page (/login), /watch, /quality and /status",
    keywords: ["demo", "trial", "synthetic", "watch", "replay", "quality", "status", "uptime", "judge", "judges", "evidence"],
    text:
      "\"Just looking?\" on the sign-in page opens a temporary demo account with synthetic data; it is deleted after 24 hours. " +
      "/watch replays recorded live copilot runs, /quality shows the test and evaluation results, and /status shows whether the app, database and AI are up.",
  },
];

const STOP = new Set(
  "a an and any are can could did do does doing for from get got have how i if in into is it its me my of on or please show tell that the their them then there this to us use using was what when where which who why will with would you your yours catchup catchup's app".split(" "),
);
const key = (word: string) => stem(word).replace(/e$/, "");
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(key);

const INDEX = APP_GUIDE.map((s) => ({ section: s, keys: new Set([...s.keywords.map(key), ...words(s.title)]) }));

/** The sections that best match a question (at most `limit`); the overview when nothing matches. */
export function findGuideSections(question: string, limit = 3): GuideSection[] {
  const asked = new Set(words(question));
  const scored = INDEX.map(({ section, keys }, i) => ({ section, i, score: [...asked].filter((w) => keys.has(w)).length }))
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || x.i - y.i);
  return scored.length ? scored.slice(0, limit).map((s) => s.section) : [APP_GUIDE[0]];
}

/** The tool result: the matching sections, then the titles of the others so the model can ask for one. */
export function guideToolResult(sections: GuideSection[]): string {
  const shown = new Set(sections.map((s) => s.id));
  const body = sections.map((s) => `## ${s.title} (where: ${s.where})\n${s.text}`).join("\n\n");
  const others = APP_GUIDE.filter((s) => !shown.has(s.id)).map((s) => s.title).join("; ");
  return `CATCHUP_GUIDE: CatchUp's own help text. Describe the app only from this.\n\n${body}\n\nOther guide topics: ${others}.`;
}
