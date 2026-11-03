/** Daily study digest and missed-block alert, as plain text + simple HTML. Returns null when there's nothing to say. */
export type DigestInput = {
  name: string;
  timezone: string;
  today: { title: string; startsAt: string; minutes: number }[];
  missed: { title: string; minutes: number }[];
  deadlines: { title: string; dueAt: string }[];
  appUrl: string;
  unsubscribeUrl: string;
  wantsDigest: boolean;
  wantsMissed: boolean;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function buildDigest(d: DigestInput): { subject: string; text: string; html: string } | null {
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: d.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: d.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const lines: string[] = [];
  if (d.wantsMissed && d.missed.length) {
    lines.push(`You missed ${d.missed.length} study block${d.missed.length === 1 ? "" : "s"} (${d.missed.reduce((s, m) => s + m.minutes, 0)} min). That's okay: replan from now and keep what you finished.`);
  }
  if (d.wantsDigest && (d.today.length || d.deadlines.length)) {
    if (d.today.length) lines.push(`Next 24 hours: ${d.today.map((t) => `${time(t.startsAt)} ${t.title} (${t.minutes} min)`).join(" · ")}`);
    if (d.deadlines.length) lines.push(`Coming up: ${d.deadlines.map((a) => `${a.title}, ${day(a.dueAt)}`).join(" · ")}`);
  }
  if (!lines.length) return null;
  const missedFirst = d.wantsMissed && d.missed.length > 0;
  const subject = missedFirst ? "Let's get back on track today" : `${d.today.length} block${d.today.length === 1 ? "" : "s"}${d.deadlines.length ? `, ${d.deadlines.length} deadline${d.deadlines.length === 1 ? "" : "s"}` : ""} coming up`;
  const cta = missedFirst ? `${d.appUrl}/recovery?replan=1` : `${d.appUrl}/planner`;
  const text = `Hi ${d.name},\n\n${lines.join("\n\n")}\n\nOpen CatchUp AI: ${cta}\n\nYou chose to get these emails. Stop them: ${d.unsubscribeUrl}\n`;
  const html = `<p>Hi ${esc(d.name)},</p>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p><a href="${esc(cta)}">Open CatchUp AI</a></p><p style="color:#667;font-size:12px">You chose to get these emails. <a href="${esc(d.unsubscribeUrl)}">Stop them</a>.</p>`;
  return { subject: `CatchUp AI · ${subject}`, text, html };
}
