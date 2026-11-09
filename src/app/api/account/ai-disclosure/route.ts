import { requireApiUser } from "@/lib/auth/session";
import { buildDisclosure } from "@/lib/disclosure/build";
import { loadDisclosure } from "@/lib/disclosure/service";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

/** The AI-use disclosure as a Markdown file the student can attach to coursework. */
export const GET = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const markdown = buildDisclosure(await loadDisclosure(supabase, user.id, Date.now()));
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="catchup-ai-use-disclosure-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
});
