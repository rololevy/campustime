import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createAuthUser, createTestDatabase, errorOf, inRollback, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const unique = () => crypto.randomUUID().slice(0, 8);

async function search(target: TestDb, query: string): Promise<string[]> {
  const { rows } = await target.query<{ slug: string }>("select slug from public.search_skills($1)", [query]);
  return rows.map((r) => r.slug);
}

/** Crea una persona acreditada (email institucional confirmado). */
async function accreditedUser(target: TestDb): Promise<string> {
  const id = await createAuthUser(target, {}, { email: `${unique()}@frba.utn.edu.ar` });
  await target.query(
    `insert into public.affiliations (user_id, email, email_domain, institution_id, campus_id, campus_locked, status)
     select $1, u.email, split_part(u.email, '@', 2), r.institution_id, r.campus_id, r.campus_id is not null, 'active'
       from auth.users u, public.resolve_email_domain(u.email) r
      where u.id = $1`,
    [id],
  );
  return id;
}

describe("search_skills", () => {
  it("encuentra materias sin tildes, por abreviatura o con errores de tipeo", async () => {
    expect((await search(db, "analisis mate"))[0]).toBe("analisis-matematico-1");
    expect((await search(db, "AM1"))[0]).toBe("analisis-matematico-1");
    expect((await search(db, "aga"))[0]).toBe("algebra-y-geometria-analitica");
    expect((await search(db, "algebra"))[0]).toBe("algebra-y-geometria-analitica");
    expect(await search(db, "fisica 1")).toContain("fisica-1");
    expect((await search(db, "pyton"))[0]).toBe("python");
  });

  it("no devuelve resultados para textos sin relación o demasiado cortos", async () => {
    expect(await search(db, "zzzqqq")).toEqual([]);
    expect(await search(db, "a")).toEqual([]);
  });

  it("anon puede buscar en el catálogo", async () => {
    const result = await asRole(db, { role: "anon" }, (tx) => search(tx, "excel"));
    expect(result[0]).toBe("excel");
  });
});

describe("create_skill", () => {
  it("reutiliza una habilidad existente en vez de duplicarla", async () => {
    const ana = await createAuthUser(db);
    const ids = await asRole(db, { role: "authenticated", userId: ana }, async (tx) => {
      const existing = await tx.query<{ id: string }>("select id from public.skills where slug = 'analisis-matematico-1'");
      const created = [];
      for (const name of ["analisis matematico i", "  Análisis   Matemático I ", "AM1"]) {
        const { rows } = await tx.query<{ id: string }>(
          "select public.create_skill($1, 'materias-basicas') as id",
          [name],
        );
        created.push(rows[0].id);
      }
      return { existing: existing.rows[0].id, created };
    });
    expect(new Set(ids.created)).toEqual(new Set([ids.existing]));
  });

  it("crea habilidades nuevas sin revisar, visibles en la búsqueda", async () => {
    const ana = await createAuthUser(db);
    const result = await asRole(db, { role: "authenticated", userId: ana }, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select public.create_skill('Arduino', 'programacion') as id");
      const skill = await tx.query<{ slug: string; status: string; created_by: string }>(
        "select slug, status, created_by from public.skills where id = $1",
        [rows[0].id],
      );
      return { skill: skill.rows[0], found: await search(tx, "arduino") };
    });
    expect(result.skill).toEqual({ slug: "arduino", status: "unreviewed", created_by: ana });
    expect(result.found[0]).toBe("arduino");
  });

  it("limita a 10 habilidades nuevas por día y valida los datos", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: ana, role: "authenticated" }),
      ]);
      for (let i = 0; i < 10; i++) {
        await tx.query("select public.create_skill($1, 'arte-y-deporte')", [`Habilidad ${unique()} ${i}`]);
      }
      await tx.exec("savepoint s");
      const limited = await errorOf(tx.query("select public.create_skill('Malabares extremos', 'arte-y-deporte')"));
      expect(limited).toMatch(/rate_limited/);
      await tx.exec("rollback to savepoint s");
      const category = await errorOf(tx.query("select public.create_skill('Ajedrez', 'no-existe')"));
      expect(category).toMatch(/invalid_category/);
    });
  });

  it("anon no puede crear habilidades ni escribir en el catálogo", async () => {
    const call = await errorOf(asRole(db, { role: "anon" }, (tx) => tx.query("select public.create_skill('Ajedrez', 'arte-y-deporte')")));
    expect(call).toMatch(/permission denied/i);
    const ana = await createAuthUser(db);
    const insert = await errorOf(
      asRole(db, { role: "authenticated", userId: ana }, (tx) =>
        tx.query("insert into public.skills (slug, name, category_id, status) select 'trampa', 'Trampa', id, 'approved' from public.skill_categories limit 1"),
      ),
    );
    expect(insert).toMatch(/permission denied/i);
  });
});

describe("user_skills", () => {
  it("cada persona administra solo sus habilidades", async () => {
    const ana = await createAuthUser(db);
    const beto = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: ana, role: "authenticated" }),
      ]);
      await tx.query(
        `insert into public.user_skills (user_id, skill_id, direction, level)
         select $1, id, 'teach', 'avanzado' from public.skills where slug = 'python'`,
        [ana],
      );
      const updated = await tx.query("update public.user_skills set level = 'intermedio' where user_id = $1", [ana]);
      expect(updated.affectedRows).toBe(1);

      await tx.exec("savepoint s");
      const foreign = await errorOf(
        tx.query(
          "insert into public.user_skills (user_id, skill_id, direction) select $1, id, 'learn' from public.skills where slug = 'excel'",
          [beto],
        ),
      );
      expect(foreign).toMatch(/row-level security/i);
      await tx.exec("rollback to savepoint s");
    });
  });

  it("las habilidades se ven entre personas acreditadas, no las de quien no lo está", async () => {
    const ana = await accreditedUser(db);
    const beto = await accreditedUser(db);
    const caro = await createAuthUser(db, {}, { email: `${unique()}@gmail.com` });
    for (const id of [ana, beto, caro]) {
      await db.query(
        "insert into public.user_skills (user_id, skill_id, direction) select $1, id, 'teach' from public.skills where slug = 'excel'",
        [id],
      );
    }

    const visibleTo = (id: string) =>
      asRole(db, { role: "authenticated", userId: id }, async (tx) => {
        const { rows } = await tx.query<{ user_id: string }>(
          "select user_id from public.user_skills where user_id = any($1)",
          [[ana, beto, caro]],
        );
        return rows.map((r) => r.user_id).sort();
      });

    expect(await visibleTo(ana)).toEqual([ana, beto].sort());
    expect(await visibleTo(caro)).toEqual([caro]);
  });
});
