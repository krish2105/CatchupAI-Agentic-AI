/**
 * Short-lived, per-student cache for the copilot's read tools (preferences, assignments, course search).
 *
 * Models often repeat the same read within a run, or across two questions a few seconds apart. A hit skips the
 * database queries and, for search, the embedding request (which counts against the provider's quota). It does
 * not save chat-model requests: every tool call is still a model turn.
 *
 * Correctness rules:
 * - Keys always include the student's id, so one student's data can never be served to another.
 * - Any write by that student clears their entries: every authenticated non-GET API request calls
 *   `invalidateStudent` at its start and again when it finishes (see lib/http/request-scope.ts), and the
 *   agent's own writes do too.
 * - A per-student generation number is part of the key, so a read that started before a write and finishes after
 *   it is stored under the old generation and is never served.
 * - Entries live at most TTL_MS. The cache is per server instance; another instance can serve an entry up to
 *   TTL_MS old after a write it did not see. That bound is the documented trade-off.
 */
export const TOOL_CACHE = { ttlMs: 60_000, maxEntries: 500 } as const;

type Entry = { at: number; value: unknown };
const entries = new Map<string, Entry>();
const generations = new Map<string, number>();

const generation = (studentId: string) => generations.get(studentId) ?? 0;
const keyFor = (studentId: string, tool: string, args: unknown, gen: number) => `${studentId}\u0000${gen}\u0000${tool}\u0000${JSON.stringify(args)}`;

/** Returns the cached value for this student/tool/args, or loads and stores it. */
export async function cachedRead<T>(studentId: string, tool: string, args: unknown, load: () => Promise<T>, now: () => number = Date.now): Promise<{ value: T; hit: boolean }> {
  const gen = generation(studentId);
  const key = keyFor(studentId, tool, args, gen);
  const found = entries.get(key);
  if (found && now() - found.at < TOOL_CACHE.ttlMs) return { value: found.value as T, hit: true };
  if (found) entries.delete(key);
  const value = await load();
  // Don't store a result read across a write (the generation moved on while loading).
  if (generation(studentId) === gen) {
    entries.set(key, { at: now(), value });
    while (entries.size > TOOL_CACHE.maxEntries) entries.delete(entries.keys().next().value as string);
  }
  return { value, hit: false };
}

/** Clears everything cached for this student (call on any write). */
export function invalidateStudent(studentId: string) {
  generations.set(studentId, generation(studentId) + 1);
  const prefix = `${studentId}\u0000`;
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

/** Test helper. */
export function clearToolCache() {
  entries.clear();
  generations.clear();
}

export const toolCacheSize = () => entries.size;
