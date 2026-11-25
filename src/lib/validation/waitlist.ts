import * as z from "zod";

export const MEMBER_ROLES = ["estudiante", "docente", "nodocente"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  nodocente: "Nodocente",
};

/** Texto opcional: espacios en blanco cuentan como vacío. */
function optionalText(min: number, max: number) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(
      z
        .string()
        .min(min, { error: `Usá al menos ${min} caracteres.` })
        .max(max, { error: `Usá como máximo ${max} caracteres.` })
        .optional(),
    )
    .optional();
}

export const waitlistSchema = z.object({
  email: z
    .string({ error: "Ingresá tu email." })
    .trim()
    .toLowerCase()
    .max(254, { error: "El email es demasiado largo." })
    .pipe(z.email({ error: "Revisá el email: no parece válido." })),
  universityName: z
    .string({ error: "Contanos en qué universidad estás." })
    .trim()
    .min(2, { error: "Contanos en qué universidad estás." })
    .max(120, { error: "Usá como máximo 120 caracteres." }),
  campusName: optionalText(2, 120),
  roleType: z.enum(MEMBER_ROLES, { error: "Elegí una opción de la lista." }).optional(),
  wantsToTeach: optionalText(1, 300),
  wantsToLearn: optionalText(1, 300),
  consent: z.literal("on", { error: "Necesitamos tu consentimiento para guardar tus datos." }),
});

export type WaitlistInput = z.output<typeof waitlistSchema>;
export type WaitlistField = keyof z.input<typeof waitlistSchema>;

const FIELDS = Object.keys(waitlistSchema.shape) as WaitlistField[];

export type WaitlistFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<WaitlistField, string>>;
      /** Lo que la persona escribió, para no perderlo si hay que corregir algo. */
      values?: Partial<Record<WaitlistField, string>>;
    };

export type ParsedWaitlistForm =
  | { success: true; data: WaitlistInput; values: Partial<Record<WaitlistField, string>> }
  | {
      success: false;
      fieldErrors: Partial<Record<WaitlistField, string>>;
      values: Partial<Record<WaitlistField, string>>;
    };

/** Lee y valida el formulario. Los campos vacíos se tratan como ausentes. */
export function parseWaitlistForm(formData: FormData): ParsedWaitlistForm {
  const values: Partial<Record<WaitlistField, string>> = {};
  for (const field of FIELDS) {
    const raw = formData.get(field);
    if (typeof raw === "string" && raw !== "") values[field] = raw;
  }

  const result = waitlistSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data, values };

  const fieldErrors: Partial<Record<WaitlistField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as WaitlistField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { success: false, fieldErrors, values };
}
