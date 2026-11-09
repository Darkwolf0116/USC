import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client; the session lives in cookies so `src/proxy.ts` can read it. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const env = getSupabaseEnv();
  if (!env) return null;
  browserClient = createBrowserClient(env.url, env.publishableKey);
  return browserClient;
}
