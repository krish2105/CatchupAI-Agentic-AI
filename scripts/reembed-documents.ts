/**
 * Re-embeds documents after the embedding model changes (for example when the app moved its embeddings to OpenAI),
 * using the embedder the current environment selects (see embeddingProvider in src/lib/rag/embed.ts).
 *
 *   npx tsx scripts/reembed-documents.ts               # dry run against the local stack: counts only
 *   npx tsx scripts/reembed-documents.ts --apply       # re-embed
 *   npx tsx scripts/reembed-documents.ts --owner <id>  # one student only
 *
 * Refuses a non-local Supabase unless --allow-remote is given (owner only; it spends embedding quota).
 * Never prints keys.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (.env.local).");
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
  if (!local && !flag("allow-remote")) throw new Error("This is not the local stack. Re-run with --allow-remote if you are the owner and mean it.");

  // Loaded after the environment so the embedder sees the keys; server-only is a no-op outside Next.js bundling.
  const { getEmbedder } = await import("../src/lib/rag/embed");
  const { reembedDocuments } = await import("../src/lib/rag/reembed");
  const embedder = getEmbedder();
  if (!embedder) throw new Error("No embedding provider is configured (set OPENAI_API_KEY).");

  const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = await reembedDocuments({ admin: admin as never, embedder, ownerId: arg("owner"), apply: flag("apply") });
  console.log(JSON.stringify({ target: local ? "local" : "remote", provider: embedder.provider, ...report }, null, 2));
  if (!report.applied) console.log("Dry run: nothing changed. Add --apply to re-embed.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
