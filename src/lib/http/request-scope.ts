import { AsyncLocalStorage } from "node:async_hooks";
import { invalidateStudent } from "@/lib/agents/tool-cache";

/**
 * Per-request scope set by `route()`. It lets `requireApiUser()` learn the HTTP method without every handler
 * passing it, so that any authenticated write clears that student's cached tool reads.
 */
type Scope = { method: string; studentId: string | null };
const storage = new AsyncLocalStorage<Scope>();

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function runInRequestScope<T>(method: string, fn: () => Promise<T>): Promise<T> {
  const scope: Scope = { method: method.toUpperCase(), studentId: null };
  return storage.run(scope, async () => {
    try {
      return await fn();
    } finally {
      // Again after the handler: a cache read that raced the write is dropped too.
      if (scope.studentId) invalidateStudent(scope.studentId);
    }
  });
}

/** Called once the request's student is known. On a write, clears that student's cache before the write runs. */
export function noteAuthenticatedStudent(studentId: string) {
  const scope = storage.getStore();
  if (!scope || READ_METHODS.has(scope.method)) return;
  scope.studentId = studentId;
  invalidateStudent(studentId);
}
