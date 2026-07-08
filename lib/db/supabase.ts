import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns a lazily-initialized Supabase client authenticated as service_role.
 * This client has full bypass of RLS and must NEVER be used client-side.
 * It is safe only in server-side Node.js API routes.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are not configured. " +
        "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  client = createClient(url, key, {
    auth: {
      // Disable automatic session persistence — this is a server-side client
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
