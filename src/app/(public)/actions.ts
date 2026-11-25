"use server";

import { headers } from "next/headers";

import { verifyTurnstile } from "@/lib/turnstile";
import { parseWaitlistForm, type WaitlistFormState } from "@/lib/validation/waitlist";
import { joinWaitlist } from "@/server/waitlist";

export async function submitWaitlist(
  _previous: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const parsed = parseWaitlistForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const requestHeaders = await headers();
  const remoteIp =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const token = formData.get("cf-turnstile-response");
  const captcha = await verifyTurnstile(typeof token === "string" ? token : null, {
    expectedAction: "waitlist",
    remoteIp,
  });
  if (!captcha.ok) {
    return {
      status: "error",
      message:
        captcha.reason === "unavailable"
          ? "No pudimos verificar el formulario. Probá de nuevo en unos minutos."
          : "No pudimos confirmar que no sos un robot. Completá la verificación y volvé a enviar.",
      values: parsed.values,
    };
  }

  try {
    await joinWaitlist(parsed.data);
  } catch (error) {
    console.error("[waitlist]", (error as Error).message);
    return {
      status: "error",
      message: "No pudimos guardar tu inscripción. Probá de nuevo en unos minutos.",
      values: parsed.values,
    };
  }

  return { status: "success" };
}
