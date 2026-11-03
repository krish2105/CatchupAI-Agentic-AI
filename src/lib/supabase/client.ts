"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserClient() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
