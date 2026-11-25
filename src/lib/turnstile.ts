import "server-only";

import { getTurnstileSecret } from "@/lib/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "invalid" | "unavailable" };

type SiteverifyResponse = { success: boolean; action?: string };

let warnedMissingSecret = false;

/**
 * Verifica el token de Cloudflare Turnstile en el servidor. Si no hay clave
 * secreta configurada (desarrollo), deja pasar y avisa una vez en producción.
 */
export async function verifyTurnstile(
  token: string | null,
  options: { expectedAction: string; remoteIp?: string | null },
): Promise<TurnstileResult> {
  const secret = getTurnstileSecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production" && !warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("[turnstile] Falta TURNSTILE_SECRET_KEY: los formularios no tienen protección anti-bots.");
    }
    return { ok: true };
  }
  if (!token) return { ok: false, reason: "missing-token" };

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (options.remoteIp) body.append("remoteip", options.remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as SiteverifyResponse;
    const ok = result.success && (!result.action || result.action === options.expectedAction);
    return ok ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
