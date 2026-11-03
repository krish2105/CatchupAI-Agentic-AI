// Creates the git-ignored local auth signing key once, so `supabase start` keeps the same key
// across restarts (a new key per start invalidates every open browser session).
import { existsSync, writeFileSync } from "node:fs";

const path = "supabase/signing_keys.json";
if (!existsSync(path)) {
  const { privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const key = { ...jwk, kid: crypto.randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"], ext: true };
  writeFileSync(path, JSON.stringify([key]), { mode: 0o600 });
  console.log(`Created ${path} (local development only; git-ignored).`);
}
