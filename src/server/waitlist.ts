import "server-only";

import { siteConfig } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WaitlistInput } from "@/lib/validation/waitlist";

/**
 * Anota a una persona en la lista de espera. La función SQL detecta la
 * institución y la sede por el dominio del email y no hace nada si el email ya
 * estaba anotado.
 */
export async function joinWaitlist(input: WaitlistInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("join_waitlist", {
    p_email: input.email,
    p_university_name: input.universityName,
    p_consent_version: siteConfig.privacyPolicyVersion,
    p_campus_name: input.campusName ?? null,
    p_role_type: input.roleType ?? null,
    p_wants_to_teach: input.wantsToTeach ?? null,
    p_wants_to_learn: input.wantsToLearn ?? null,
  });
  if (error) throw new Error(`join_waitlist falló (${error.code}): ${error.message}`);
}
