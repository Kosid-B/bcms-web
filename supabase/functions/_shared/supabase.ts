import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

import { requiredEnv } from "./env.ts";

const supabaseUrl = requiredEnv("SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getUserFromAuthHeader(authHeader: string | null) {
  if (!authHeader) return null;

  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
