import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuthUser, createTestDatabase, inRollback, type DbRole, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

type Who = DbRole | { role: "postgres" };

/** Cambia de rol dentro de una transacción abierta (como haría la Data API en cada request). */
async function switchTo(tx: TestDb, who: Who) {
  await tx.exec("reset role");
  if (who.role === "postgres") return;
  const claims = who.role === "authenticated" ? { sub: who.userId, role: who.role } : { role: who.role };
  await tx.exec(`set local role ${who.role}`);
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
}

/** Ejecuta algo que debería fallar sin abortar la transacción, y devuelve el mensaje. */
async function failure(tx: TestDb, run: () => Promise<unknown>): Promise<string> {
  await tx.exec("savepoint intento");
  try {
    await run();
  } catch (error) {
    await tx.exec("rollback to savepoint intento");
    return (error as Error).message;
  }
  await tx.exec("release savepoint intento");
  throw new Error("Se esperaba un error y la operación terminó bien.");
}

const unique = () => crypto.randomUUID().slice(0, 8);
const user = (userId: string) => ({ role: "authenticated", userId }) as const;
const server = { role: "service_role" } as const;

async function requestCode(tx: TestDb, userId: string, email: string): Promise<string> {
  await switchTo(tx, server);
  const { rows } = await tx.query<{ code: string }>("select code from public.request_affiliation_code($1, $2)", [
    userId,
    email,
  ]);
  return rows[0].code;
}

type Verification = { status: string; institution: string | null; campus: string | null };

async function verify(tx: TestDb, userId: string, code: string): Promise<Verification> {
  await switchTo(tx, user(userId));
  const { rows } = await tx.query<{ status: string; institution_id: string | null; campus_id: string | null }>(
    "select * from public.verify_affiliation_code($1)",
    [code],
  );
  await switchTo(tx, { role: "postgres" });
  return describeResult(tx, rows[0]);
}

async function describeResult(
  tx: TestDb,
  row: { status: string; institution_id: string | null; campus_id: string | null },
): Promise<Verification> {
  const { rows } = await tx.query<{ institution: string | null; campus: string | null }>(
    `select (select slug from public.institutions where id = $1) as institution,
            (select slug from public.campuses where id = $2) as campus`,
    [row.institution_id, row.campus_id],
  );
  return { status: row.status, ...rows[0] };
}

describe("request_affiliation_code", () => {
  it("solo la puede usar el servidor", async () => {
    const ana = await createAuthUser(db);
    const message = await inRollback(db, async (tx) => {
      await switchTo(tx, user(ana));
      return failure(tx, () =>
        tx.query("select * from public.request_affiliation_code($1, $2)", [ana, `${unique()}@frgp.utn.edu.ar`]),
      );
    });
    expect(message).toMatch(/permission denied/i);
  });

  it("genera un código de 6 dígitos y guarda solo su hash", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const code = await requestCode(tx, ana, `${unique()}@alumnos.frgp.utn.edu.ar`);
      expect(code).toMatch(/^\d{6}$/);
      await switchTo(tx, { role: "postgres" });
      const { rows } = await tx.query<{ code_hash: string }>(
        "select code_hash from private.affiliation_codes where user_id = $1",
        [ana],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0].code_hash).not.toContain(code);
    });
  });

  it("rechaza webmails y emails inválidos", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      await switchTo(tx, server);
      for (const [email, expected] of [
        ["ana@gmail.com", /webmail_not_allowed/],
        ["ana@Hotmail.com.ar", /webmail_not_allowed/],
        ["sin-arroba", /invalid_email/],
      ] as const) {
        const message = await failure(tx, () =>
          tx.query("select * from public.request_affiliation_code($1, $2)", [ana, email]),
        );
        expect(message, email).toMatch(expected);
      }
    });
  });

  it("limita los pedidos por email (3 por hora)", async () => {
    const ana = await createAuthUser(db);
    const email = `${unique()}@frba.utn.edu.ar`;
    await inRollback(db, async (tx) => {
      for (let i = 0; i < 3; i++) await requestCode(tx, ana, email);
      const message = await failure(tx, () =>
        tx.query("select * from public.request_affiliation_code($1, $2)", [ana, email]),
      );
      expect(message).toMatch(/rate_limited/);
    });
  });

  it("un email institucional acredita una sola cuenta", async () => {
    const ana = await createAuthUser(db);
    const beto = await createAuthUser(db);
    const email = `${unique()}@alumnos.frgp.utn.edu.ar`;
    await inRollback(db, async (tx) => {
      const code = await requestCode(tx, ana, email);
      expect((await verify(tx, ana, code)).status).toBe("active");

      await switchTo(tx, server);
      const other = await failure(tx, () =>
        tx.query("select * from public.request_affiliation_code($1, $2)", [beto, email]),
      );
      expect(other).toMatch(/email_in_use/);
      const same = await failure(tx, () =>
        tx.query("select * from public.request_affiliation_code($1, $2)", [ana, email]),
      );
      expect(same).toMatch(/already_affiliated/);
    });
  });
});

describe("verify_affiliation_code", () => {
  it("acredita en UTN-FRGP con un email de alumnos de la FRGP y deja la sede fija", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const code = await requestCode(tx, ana, `${unique()}@alumnos.frgp.utn.edu.ar`);
      const wrong = code === "000000" ? "111111" : "000000";
      expect((await verify(tx, ana, wrong)).status).toBe("invalid");
      expect(await verify(tx, ana, code)).toEqual({ status: "active", institution: "utn", campus: "frgp" });
      expect((await verify(tx, ana, code)).status).toBe("no_code");

      const { rows } = await tx.query<{ campus_locked: boolean }>(
        "select campus_locked from public.affiliations where user_id = $1",
        [ana],
      );
      expect(rows[0].campus_locked).toBe(true);
    });
  });

  it("bloquea el código después de 5 intentos fallidos", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const code = await requestCode(tx, ana, `${unique()}@frba.utn.edu.ar`);
      const wrong = code === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) expect((await verify(tx, ana, wrong)).status).toBe("invalid");
      expect((await verify(tx, ana, code)).status).toBe("too_many_attempts");
    });
  });

  it("rechaza códigos vencidos", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const code = await requestCode(tx, ana, `${unique()}@frba.utn.edu.ar`);
      await switchTo(tx, { role: "postgres" });
      await tx.query("update private.affiliation_codes set expires_at = now() - interval '1 minute' where user_id = $1", [
        ana,
      ]);
      expect((await verify(tx, ana, code)).status).toBe("expired");
    });
  });

  it("solo vale el último código pedido", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const first = await requestCode(tx, ana, `${unique()}@frba.utn.edu.ar`);
      const second = await requestCode(tx, ana, `${unique()}@frba.utn.edu.ar`);
      if (first !== second) expect((await verify(tx, ana, first)).status).toBe("invalid");
      expect((await verify(tx, ana, second)).status).toBe("active");
    });
  });

  it("anon no puede verificar códigos", async () => {
    const message = await inRollback(db, async (tx) => {
      await switchTo(tx, { role: "anon" });
      return failure(tx, () => tx.query("select * from public.verify_affiliation_code('123456')"));
    });
    expect(message).toMatch(/permission denied/i);
  });
});

describe("Sumá tu universidad", () => {
  it("un dominio desconocido queda pendiente y se activa al aprobarlo", async () => {
    const ana = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      const email = `${unique()}@alumnos.unsj.edu.ar`;
      const code = await requestCode(tx, ana, email);
      expect(await verify(tx, ana, code)).toEqual({ status: "pending_domain", institution: null, campus: null });

      await switchTo(tx, user(ana));
      await tx.query("select public.submit_domain_request('Universidad Nacional de San Juan', 'FCEFN')");
      const own = await tx.query<{ domain: string; status: string }>("select domain, status from public.domain_requests");
      expect(own.rows).toEqual([{ domain: "alumnos.unsj.edu.ar", status: "pending" }]);

      await switchTo(tx, { role: "postgres" });
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.institutions (slug, name, short_name, kind, province) values ('unsj', 'Universidad Nacional de San Juan', 'UNSJ', 'universidad_nacional', 'San Juan') returning id",
      );

      await switchTo(tx, server);
      const activated = await tx.query<{ n: number }>("select public.admin_approve_domain('unsj.edu.ar', $1) as n", [
        rows[0].id,
      ]);
      expect(activated.rows[0].n).toBe(1);

      await switchTo(tx, { role: "postgres" });
      const after = await tx.query<{ status: string; request: string }>(
        `select a.status, (select status from public.domain_requests where requested_by = $1) as request
           from public.affiliations a where a.user_id = $1`,
        [ana],
      );
      expect(after.rows[0]).toEqual({ status: "active", request: "approved" });
    });
  });

  it("no se puede pedir un dominio sin una afiliación pendiente", async () => {
    const ana = await createAuthUser(db);
    const message = await inRollback(db, async (tx) => {
      await switchTo(tx, user(ana));
      return failure(tx, () => tx.query("select public.submit_domain_request('Universidad Falsa')"));
    });
    expect(message).toMatch(/no_pending_affiliation/);
  });

  it("solo el servidor aprueba dominios", async () => {
    const ana = await createAuthUser(db);
    const message = await inRollback(db, async (tx) => {
      await switchTo(tx, user(ana));
      return failure(tx, () =>
        tx.query("select public.admin_approve_domain('falsa.edu.ar', (select id from public.institutions limit 1))"),
      );
    });
    expect(message).toMatch(/permission denied/i);
  });
});

describe("accredit_login_email", () => {
  async function accredit(tx: TestDb, userId: string) {
    await switchTo(tx, user(userId));
    const { rows } = await tx.query<{ status: string; institution_id: string | null; campus_id: string | null }>(
      "select * from public.accredit_login_email()",
    );
    await switchTo(tx, { role: "postgres" });
    return describeResult(tx, rows[0]);
  }

  it("acredita sola a quien inició sesión con un email institucional confirmado", async () => {
    const ana = await createAuthUser(db, {}, { email: `${unique()}@frba.utn.edu.ar` });
    await inRollback(db, async (tx) => {
      expect(await accredit(tx, ana)).toEqual({ status: "active", institution: "utn", campus: "frba" });
      expect((await accredit(tx, ana)).status).toBe("already_affiliated");
    });
  });

  it("no acredita emails personales ni sin confirmar", async () => {
    const gmail = await createAuthUser(db, {}, { email: `${unique()}@gmail.com` });
    const unconfirmed = await createAuthUser(db, {}, { email: `${unique()}@frba.utn.edu.ar`, confirmed: false });
    await inRollback(db, async (tx) => {
      expect((await accredit(tx, gmail)).status).toBe("not_institutional");
      expect((await accredit(tx, unconfirmed)).status).toBe("unverified");
    });
  });
});

describe("set_affiliation_campus", () => {
  it("con el dominio genérico la persona elige su sede, solo de su institución", async () => {
    const ana = await createAuthUser(db, {}, { email: `${unique()}@utn.edu.ar` });
    await inRollback(db, async (tx) => {
      await switchTo(tx, user(ana));
      const { rows } = await tx.query<{ affiliation_id: string; campus_id: string | null }>(
        "select affiliation_id, campus_id from public.accredit_login_email()",
      );
      expect(rows[0].campus_id).toBeNull();
      const id = rows[0].affiliation_id;

      await tx.query("select public.set_affiliation_campus($1, (select id from public.campuses where slug = 'frgp'))", [
        id,
      ]);
      const after = await tx.query<{ slug: string }>(
        "select c.slug from public.affiliations a join public.campuses c on c.id = a.campus_id where a.id = $1",
        [id],
      );
      expect(after.rows[0].slug).toBe("frgp");

      await switchTo(tx, { role: "postgres" });
      await tx.query(
        "insert into public.campuses (institution_id, slug, name) select id, 'fi', 'Facultad de Ingeniería' from public.institutions where slug = 'uba'",
      );
      await switchTo(tx, user(ana));
      const message = await failure(tx, () =>
        tx.query(
          "select public.set_affiliation_campus($1, (select c.id from public.campuses c join public.institutions i on i.id = c.institution_id where i.slug = 'uba' and c.slug = 'fi'))",
          [id],
        ),
      );
      expect(message).toMatch(/invalid_campus/);
    });
  });

  it("no deja cambiar la sede que asignó el dominio ni tocar afiliaciones ajenas", async () => {
    const ana = await createAuthUser(db, {}, { email: `${unique()}@frgp.utn.edu.ar` });
    const beto = await createAuthUser(db);
    await inRollback(db, async (tx) => {
      await switchTo(tx, user(ana));
      const { rows } = await tx.query<{ affiliation_id: string }>("select affiliation_id from public.accredit_login_email()");
      const id = rows[0].affiliation_id;
      const locked = await failure(tx, () =>
        tx.query("select public.set_affiliation_campus($1, (select id from public.campuses where slug = 'frba'))", [id]),
      );
      expect(locked).toMatch(/campus_locked/);

      await switchTo(tx, user(beto));
      const foreign = await failure(tx, () =>
        tx.query("select public.set_affiliation_campus($1, (select id from public.campuses where slug = 'frba'))", [id]),
      );
      expect(foreign).toMatch(/affiliation_not_found/);
    });
  });
});

describe("visibilidad", () => {
  it("cada persona ve solo sus afiliaciones y no puede crearlas a mano", async () => {
    const ana = await createAuthUser(db, {}, { email: `${unique()}@frba.utn.edu.ar` });
    const beto = await createAuthUser(db, {}, { email: `${unique()}@frgp.utn.edu.ar` });
    await inRollback(db, async (tx) => {
      for (const id of [ana, beto]) {
        await switchTo(tx, user(id));
        await tx.query("select * from public.accredit_login_email()");
      }
      await switchTo(tx, user(ana));
      const { rows } = await tx.query<{ user_id: string }>("select user_id from public.affiliations");
      expect(rows.map((r) => r.user_id)).toEqual([ana]);

      const insert = await failure(tx, () =>
        tx.query(
          "insert into public.affiliations (user_id, email, email_domain, institution_id, status) select $1, 'falso@utn.edu.ar', 'utn.edu.ar', id, 'active' from public.institutions where slug = 'utn'",
          [ana],
        ),
      );
      expect(insert).toMatch(/permission denied/i);

      const codes = await failure(tx, () => tx.query("select * from private.affiliation_codes"));
      expect(codes).toMatch(/permission denied/i);

      await switchTo(tx, { role: "anon" });
      const anon = await failure(tx, () => tx.query("select * from public.affiliations"));
      expect(anon).toMatch(/permission denied/i);
    });
  });

  it("los perfiles se ven solo entre personas acreditadas y no suspendidas", async () => {
    const ana = await createAuthUser(db, { full_name: "Ana" }, { email: `${unique()}@frba.utn.edu.ar` });
    const beto = await createAuthUser(db, { full_name: "Beto" }, { email: `${unique()}@frgp.utn.edu.ar` });
    const caro = await createAuthUser(db, { full_name: "Caro" }, { email: `${unique()}@gmail.com` });
    await inRollback(db, async (tx) => {
      for (const id of [ana, beto]) {
        await switchTo(tx, user(id));
        await tx.query("select * from public.accredit_login_email()");
      }
      const visibleTo = async (id: string) => {
        await switchTo(tx, user(id));
        const { rows } = await tx.query<{ id: string }>("select id from public.profiles where id = any($1)", [
          [ana, beto, caro],
        ]);
        return rows.map((r) => r.id).sort();
      };

      expect(await visibleTo(ana)).toEqual([ana, beto].sort());
      expect(await visibleTo(caro)).toEqual([caro]);

      await switchTo(tx, { role: "postgres" });
      await tx.query("update public.profiles set suspended_at = now() where id = $1", [beto]);
      expect(await visibleTo(ana)).toEqual([ana]);
    });
  });
});
