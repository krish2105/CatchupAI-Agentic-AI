import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromDbError } from "@/lib/http/errors";
import { deleteUser, signedInUser } from "./helpers";

const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");

/** Re-signs a real access token's claims with a key the server has never seen (as after a key rotation). */
async function resignWithUnknownKey(token: string) {
  const payload = token.split(".")[1];
  const key = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid: crypto.randomUUID() })));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(signature)}`;
}

describe("database rejects a token signed by an unknown key", () => {
  let user: Awaited<ReturnType<typeof signedInUser>>;
  beforeAll(async () => { user = await signedInUser("session"); });
  afterAll(async () => { await deleteUser(user.id); });

  it("maps the PostgREST JWT error to session_expired (401), which pages recover from", async () => {
    const { data } = await user.db.auth.getSession();
    const forged = await resignWithUnknownKey(data.session!.access_token);
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${forged}` } },
    });
    const { error } = await db.from("courses").select("id");
    expect(error?.code).toMatch(/^PGRST30[123]$/);
    const mapped = fromDbError(error!);
    expect(mapped.status).toBe(401);
    expect(mapped.code).toBe("session_expired");
  });
});
