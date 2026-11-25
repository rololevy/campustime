import { describe, expect, it } from "vitest";

import { parseWaitlistForm } from "./waitlist";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const valid = {
  email: "  Ana@FRGP.utn.edu.ar ",
  universityName: " UTN ",
  campusName: "FRGP",
  roleType: "estudiante",
  wantsToTeach: "Python, Excel",
  wantsToLearn: "Física I",
  consent: "on",
};

describe("parseWaitlistForm", () => {
  it("normaliza el email y recorta espacios", () => {
    const result = parseWaitlistForm(form(valid));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      email: "ana@frgp.utn.edu.ar",
      universityName: "UTN",
      campusName: "FRGP",
      roleType: "estudiante",
      wantsToTeach: "Python, Excel",
      wantsToLearn: "Física I",
      consent: "on",
    });
  });

  it("acepta solo lo obligatorio y trata los espacios en blanco como vacío", () => {
    const result = parseWaitlistForm(
      form({ email: "a@unlp.edu.ar", universityName: "UNLP", campusName: "   ", wantsToTeach: " ", consent: "on" }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.campusName).toBeUndefined();
    expect(result.data.wantsToTeach).toBeUndefined();
    expect(result.data.roleType).toBeUndefined();
  });

  it("exige el consentimiento", () => {
    const withoutConsent = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "consent"));
    const result = parseWaitlistForm(form(withoutConsent));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.consent).toMatch(/consentimiento/);
  });

  it("marca cada campo inválido con un mensaje en castellano", () => {
    const result = parseWaitlistForm(
      form({ email: "no-es-un-email", universityName: "U", roleType: "rector", consent: "on" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toMatch(/email/);
    expect(result.fieldErrors.universityName).toMatch(/universidad/);
    expect(result.fieldErrors.roleType).toMatch(/opción/);
  });

  it("respeta los mismos límites que la base de datos", () => {
    const result = parseWaitlistForm(
      form({ ...valid, wantsToTeach: "x".repeat(301), campusName: "A", universityName: "U".repeat(121) }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.wantsToTeach).toMatch(/300/);
    expect(result.fieldErrors.campusName).toMatch(/al menos 2/);
    expect(result.fieldErrors.universityName).toMatch(/120/);
  });

  it("devuelve lo escrito para no perderlo al corregir", () => {
    const result = parseWaitlistForm(form({ email: "mal", universityName: "UTN", wantsToLearn: "Química" }));
    expect(result.success).toBe(false);
    expect(result.values).toEqual({ email: "mal", universityName: "UTN", wantsToLearn: "Química" });
  });

  it("ignora campos que no son del formulario", () => {
    const result = parseWaitlistForm(form({ ...valid, isAdmin: "true", institution_id: "x" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.data)).not.toContain("isAdmin");
    expect(Object.keys(result.data)).not.toContain("institution_id");
  });
});
