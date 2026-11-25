import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createAuthUser, createTestDatabase, errorOf, inRollback, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

type Resolution = { institution: string; campus: string | null } | null;

async function resolve(target: TestDb, email: string): Promise<Resolution> {
  const { rows } = await target.query<{ institution: string; campus: string | null }>(
    `select i.slug as institution, c.slug as campus
       from public.resolve_email_domain($1) r
       join public.institutions i on i.id = r.institution_id
       left join public.campuses c on c.id = r.campus_id`,
    [email],
  );
  return rows[0] ?? null;
}

describe("resolve_email_domain", () => {
  it("asigna la sede cuando el dominio es propio de una facultad regional", async () => {
    expect(await resolve(db, "ana@frgp.utn.edu.ar")).toEqual({ institution: "utn", campus: "frgp" });
  });

  it("acepta subdominios del dominio de la sede", async () => {
    expect(await resolve(db, "ana@alumnos.frgp.utn.edu.ar")).toEqual({
      institution: "utn",
      campus: "frgp",
    });
  });

  it("con el dominio genérico identifica la institución y deja la sede a elegir", async () => {
    expect(await resolve(db, "ana@utn.edu.ar")).toEqual({ institution: "utn", campus: null });
    expect(await resolve(db, "ana@alumnos.utn.edu.ar")).toEqual({ institution: "utn", campus: null });
  });

  it("resuelve universidades fuera de la UTN", async () => {
    expect(await resolve(db, "juan@fi.uba.ar")).toEqual({ institution: "uba", campus: null });
    expect(await resolve(db, "juan@mdp.edu.ar")).toEqual({ institution: "unmdp", campus: null });
  });

  it("no confunde dominios que solo comparten el final", async () => {
    expect(await resolve(db, "ana@noutn.edu.ar")).toBeNull();
    expect(await resolve(db, "ana@frgputn.edu.ar")).toBeNull();
  });

  it("ignora mayúsculas y espacios", async () => {
    expect(await resolve(db, "  Ana@FRBA.UTN.EDU.AR ")).toEqual({ institution: "utn", campus: "frba" });
  });

  it("no reconoce webmails ni textos sin dominio", async () => {
    expect(await resolve(db, "ana@gmail.com")).toBeNull();
    expect(await resolve(db, "sin-arroba")).toBeNull();
    expect(await resolve(db, "")).toBeNull();
  });

  it("respeta include_subdomains = false", async () => {
    await inRollback(db, async (tx) => {
      await tx.query("update public.institution_domains set include_subdomains = false where domain = 'uba.ar'");
      expect(await resolve(tx, "juan@uba.ar")).toEqual({ institution: "uba", campus: null });
      expect(await resolve(tx, "juan@fi.uba.ar")).toBeNull();
    });
  });

  it("no usa dominios de instituciones dadas de baja", async () => {
    await inRollback(db, async (tx) => {
      await tx.query("update public.institutions set status = 'disabled' where slug = 'uba'");
      expect(await resolve(tx, "juan@fi.uba.ar")).toBeNull();
    });
  });

  it("si la sede está dada de baja, cae al dominio de la institución", async () => {
    await inRollback(db, async (tx) => {
      await tx.query("update public.campuses set status = 'disabled' where slug = 'frgp'");
      expect(await resolve(tx, "ana@frgp.utn.edu.ar")).toEqual({ institution: "utn", campus: null });
    });
  });

  it("anon puede usarla para mostrar qué universidad detectamos", async () => {
    const result = await asRole(db, { role: "anon" }, (tx) => resolve(tx, "ana@frgp.utn.edu.ar"));
    expect(result).toEqual({ institution: "utn", campus: "frgp" });
  });
});

describe("integridad del catálogo institucional", () => {
  it("cada facultad regional de la UTN tiene su dominio", async () => {
    const { rows } = await db.query<{ missing: number }>(
      `select count(*)::int as missing
         from public.campuses c
         join public.institutions i on i.id = c.institution_id
        where i.slug = 'utn'
          and c.slug <> 'rectorado'
          and not exists (select 1 from public.institution_domains d where d.campus_id = c.id)`,
    );
    expect(rows[0].missing).toBe(0);
  });

  it("no permite que un dominio apunte a la sede de otra institución", async () => {
    const message = await errorOf(
      inRollback(db, (tx) =>
        tx.query(
          `insert into public.institution_domains (domain, institution_id, campus_id)
           select 'ejemplo.edu.ar', uba.id, frgp.id
             from public.institutions uba, public.campuses frgp
            where uba.slug = 'uba' and frgp.slug = 'frgp'`,
        ),
      ),
    );
    expect(message).toMatch(/foreign key/i);
  });

  it("rechaza dominios con mayúsculas o mal formados", async () => {
    for (const domain of ["UTN.edu.ar", "utn", "-utn.edu.ar", "utn.edu.ar."]) {
      const message = await errorOf(
        inRollback(db, (tx) =>
          tx.query(
            `insert into public.institution_domains (domain, institution_id)
             select $1, id from public.institutions where slug = 'utn'`,
            [domain],
          ),
        ),
      );
      expect(message, domain).toMatch(/check constraint|violates/i);
    }
  });
});

describe("RLS del catálogo institucional", () => {
  it("anon ve las instituciones, sedes y dominios activos", async () => {
    const counts = await asRole(db, { role: "anon" }, async (tx) => {
      const { rows } = await tx.query<{ i: number; c: number; d: number }>(
        `select (select count(*) from public.institutions)::int as i,
                (select count(*) from public.campuses)::int as c,
                (select count(*) from public.institution_domains)::int as d`,
      );
      return rows[0];
    });
    expect(counts.i).toBeGreaterThan(20);
    expect(counts.c).toBeGreaterThan(25);
    expect(counts.d).toBeGreaterThan(50);
  });

  it("anon no ve lo que está dado de baja", async () => {
    await db.exec("begin");
    try {
      await db.query("update public.institutions set status = 'disabled' where slug = 'uba'");
      await db.exec("set local role anon");
      const { rows } = await db.query("select 1 from public.institutions where slug = 'uba'");
      expect(rows).toHaveLength(0);
    } finally {
      await db.exec("rollback");
    }
  });

  it("anon y authenticated no pueden escribir en el catálogo", async () => {
    const userId = await createAuthUser(db);

    for (const who of [{ role: "anon" } as const, { role: "authenticated", userId } as const]) {
      const insertError = await errorOf(
        asRole(db, who, (tx) =>
          tx.query(
            "insert into public.institutions (slug, name, kind) values ('falsa', 'Universidad Falsa', 'universidad_privada')",
          ),
        ),
      );
      expect(insertError).toMatch(/permission denied/i);

      const updateError = await errorOf(
        asRole(db, who, (tx) => tx.query("update public.institution_domains set include_subdomains = false")),
      );
      expect(updateError).toMatch(/permission denied/i);
    }
  });
});

describe("perfiles", () => {
  it("se crea el perfil al registrarse, con el nombre que informa Google", async () => {
    const userId = await createAuthUser(db, { full_name: "  Ana Pérez  " });
    const { rows } = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [userId],
    );
    expect(rows[0].display_name).toBe("Ana Pérez");
  });

  it("sin nombre informado, el perfil arranca vacío (nunca se deriva del email)", async () => {
    const userId = await createAuthUser(db);
    const { rows } = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [userId],
    );
    expect(rows[0].display_name).toBe("");
  });

  it("cada persona ve solo su perfil", async () => {
    const ana = await createAuthUser(db, { full_name: "Ana" });
    await createAuthUser(db, { full_name: "Beto" });

    const visible = await asRole(db, { role: "authenticated", userId: ana }, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select id from public.profiles");
      return rows.map((r) => r.id);
    });
    expect(visible).toEqual([ana]);
  });

  it("una persona puede editar su nombre y su bio", async () => {
    const ana = await createAuthUser(db);
    const result = await asRole(db, { role: "authenticated", userId: ana }, async (tx) => {
      const update = await tx.query(
        "update public.profiles set display_name = 'Ana', bio = 'Estudiante de Sistemas' where id = $1",
        [ana],
      );
      const { rows } = await tx.query<{ display_name: string }>(
        "select display_name from public.profiles where id = $1",
        [ana],
      );
      return { affected: update.affectedRows, name: rows[0].display_name };
    });
    expect(result).toEqual({ affected: 1, name: "Ana" });
  });

  it("no puede editar el perfil de otra persona", async () => {
    const ana = await createAuthUser(db);
    const beto = await createAuthUser(db, { full_name: "Beto" });
    const affected = await asRole(db, { role: "authenticated", userId: ana }, async (tx) => {
      const update = await tx.query("update public.profiles set display_name = 'Hackeado' where id = $1", [beto]);
      return update.affectedRows;
    });
    expect(affected).toBe(0);
  });

  it("no puede tocar columnas que solo maneja el servidor", async () => {
    const ana = await createAuthUser(db);
    const message = await errorOf(
      asRole(db, { role: "authenticated", userId: ana }, (tx) =>
        tx.query("update public.profiles set suspended_at = null where id = $1", [ana]),
      ),
    );
    expect(message).toMatch(/permission denied/i);
  });

  it("anon no ve perfiles", async () => {
    const message = await errorOf(asRole(db, { role: "anon" }, (tx) => tx.query("select * from public.profiles")));
    expect(message).toMatch(/permission denied/i);
  });
});
