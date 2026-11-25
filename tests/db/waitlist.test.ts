import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createAuthUser, createTestDatabase, errorOf, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const JOIN = `select public.join_waitlist(
  p_email => $1,
  p_university_name => $2,
  p_consent_version => '2026-11-24',
  p_campus_name => $3,
  p_role_type => $4,
  p_wants_to_teach => $5,
  p_wants_to_learn => $6
)`;

describe("join_waitlist", () => {
  it("guarda la inscripción y detecta institución y sede por el dominio", async () => {
    const row = await asRole(db, { role: "service_role" }, async (tx) => {
      await tx.query(JOIN, ["ana@frgp.utn.edu.ar", "UTN", "FRGP", "estudiante", "Python", "Física I"]);
      const { rows } = await tx.query<{
        institution: string;
        campus: string;
        role_type: string;
        wants_to_teach: string;
      }>(
        `select i.slug as institution, c.slug as campus, w.role_type, w.wants_to_teach
           from public.waitlist_entries w
           join public.institutions i on i.id = w.institution_id
           join public.campuses c on c.id = w.campus_id
          where w.email = 'ana@frgp.utn.edu.ar'`,
      );
      return rows[0];
    });
    expect(row).toEqual({ institution: "utn", campus: "frgp", role_type: "estudiante", wants_to_teach: "Python" });
  });

  it("normaliza el email y guarda vacíos como nulos", async () => {
    const row = await asRole(db, { role: "service_role" }, async (tx) => {
      await tx.query(JOIN, ["  ANA@Gmail.com ", " Universidad X ", "  ", null, "", null]);
      const { rows } = await tx.query<{
        email: string;
        university_name: string;
        campus_name: string | null;
        wants_to_teach: string | null;
        institution_id: string | null;
      }>(
        "select email, university_name, campus_name, wants_to_teach, institution_id from public.waitlist_entries",
      );
      return rows[0];
    });
    expect(row).toEqual({
      email: "ana@gmail.com",
      university_name: "Universidad X",
      campus_name: null,
      wants_to_teach: null,
      institution_id: null,
    });
  });

  it("anotarse dos veces no duplica ni falla", async () => {
    const count = await asRole(db, { role: "service_role" }, async (tx) => {
      await tx.query(JOIN, ["beto@unlp.edu.ar", "UNLP", null, null, null, null]);
      await tx.query(JOIN, ["Beto@UNLP.edu.ar", "Otra", null, "docente", null, null]);
      const { rows } = await tx.query<{ n: number; university_name: string }>(
        "select count(*)::int as n, min(university_name) as university_name from public.waitlist_entries where email = 'beto@unlp.edu.ar'",
      );
      return rows[0];
    });
    expect(count).toEqual({ n: 1, university_name: "UNLP" });
  });

  it("rechaza textos demasiado largos", async () => {
    const message = await errorOf(
      asRole(db, { role: "service_role" }, (tx) =>
        tx.query(JOIN, ["largo@utn.edu.ar", "UTN", null, null, "x".repeat(301), null]),
      ),
    );
    expect(message).toMatch(/check constraint/i);
  });

  it("exige la versión de la política aceptada", async () => {
    const message = await errorOf(
      asRole(db, { role: "service_role" }, (tx) =>
        tx.query("select public.join_waitlist(p_email => 'x@utn.edu.ar', p_university_name => 'UTN', p_consent_version => null)"),
      ),
    );
    expect(message).toMatch(/null value|not-null/i);
  });
});

describe("acceso a la lista de espera", () => {
  it("anon y authenticated no pueden ejecutar join_waitlist directamente", async () => {
    const userId = await createAuthUser(db);
    for (const who of [{ role: "anon" } as const, { role: "authenticated", userId } as const]) {
      const message = await errorOf(
        asRole(db, who, (tx) => tx.query(JOIN, ["intruso@utn.edu.ar", "UTN", null, null, null, null])),
      );
      expect(message).toMatch(/permission denied/i);
    }
  });

  it("anon y authenticated no pueden leer ni escribir la tabla", async () => {
    const userId = await createAuthUser(db);
    for (const who of [{ role: "anon" } as const, { role: "authenticated", userId } as const]) {
      const selectError = await errorOf(asRole(db, who, (tx) => tx.query("select * from public.waitlist_entries")));
      expect(selectError).toMatch(/permission denied/i);

      const insertError = await errorOf(
        asRole(db, who, (tx) =>
          tx.query(
            "insert into public.waitlist_entries (email, university_name, consent_version) values ('a@b.co', 'UTN', 'v1')",
          ),
        ),
      );
      expect(insertError).toMatch(/permission denied/i);
    }
  });
});
