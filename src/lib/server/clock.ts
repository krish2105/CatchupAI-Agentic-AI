import "server-only";
import { connection } from "next/server";

/** Request-time clock for Server Components (keeps Date.now() out of render bodies). */
export async function renderTime(): Promise<number> {
  await connection();
  return Date.now();
}
