/** Student-confirmed prerequisite links between courses: "course builds on requires". */
export type PrereqEdge = { courseId: string; requiresId: string };

/** Adding course → requires creates a cycle when `requires` already (transitively) builds on `course`. */
export function wouldCreateCycle(edges: PrereqEdge[], courseId: string, requiresId: string): boolean {
  if (courseId === requiresId) return true;
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.courseId, [...(next.get(e.courseId) ?? []), e.requiresId]);
  const seen = new Set<string>();
  const stack = [requiresId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === courseId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}

/** A study order that respects every link (foundations first); ties keep the given order. */
export function studyOrder(ids: string[], edges: PrereqEdge[]): string[] {
  const known = new Set(ids);
  const pending = new Map(ids.map((id) => [id, new Set(edges.filter((e) => e.courseId === id && known.has(e.requiresId)).map((e) => e.requiresId))]));
  const order: string[] = [];
  while (order.length < ids.length) {
    const ready = ids.find((id) => !order.includes(id) && [...pending.get(id)!].every((r) => order.includes(r)));
    if (!ready) break; // only possible with a cycle, which the API prevents
    order.push(ready);
  }
  return order;
}
