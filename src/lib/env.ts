import "server-only";

/**
 * Variables de entorno del servidor. Se leen en cada llamada (no al cargar el
 * módulo) para que una misma imagen Docker sirva en varios entornos.
 */

class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Falta la variable de entorno ${name}. Revisá .env.example.`);
    this.name = "MissingEnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new MissingEnvError(name);
  return value;
}

export function getSupabaseAdminEnv() {
  return {
    // Next.js fija las variables NEXT_PUBLIC_* durante el build, también en el
    // servidor. SUPABASE_URL se lee en runtime y permite reutilizar una imagen.
    url: required("SUPABASE_URL", process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    // Clave secreta nueva (sb_secret_…) o service_role legacy. Saltea RLS: solo servidor.
    secretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

/** Devuelve la clave secreta de Turnstile, o `null` si no está configurado. */
export function getTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET_KEY || null;
}
