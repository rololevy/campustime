import { connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Chequeo de salud para el monitor de uptime: confirma que la base responde.
 * Consultarla cada pocos minutos además evita que el proyecto gratuito de
 * Supabase se pause por inactividad antes del lanzamiento.
 */
export async function GET() {
  await connection();
  const headers = { "cache-control": "no-store" };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("institutions").select("id").limit(1);
    if (error) throw error;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}
