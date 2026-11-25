import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnv } from "@/lib/env";

/**
 * Cliente con la clave secreta: saltea RLS. Usalo solo en código de servidor
 * que ya validó la entrada y los permisos, y nunca lo pases al navegador.
 */
export function createAdminClient() {
  const { url, secretKey } = getSupabaseAdminEnv();
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
