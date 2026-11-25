# CampusTime

Banco de tiempo para la comunidad universitaria argentina: cada hora que enseñás se convierte en un crédito para aprender de otra persona. Sin dinero de por medio.

Arranca como beta en la UTN y está abierto a cualquier universidad: cada institución se suma con sus dominios de email, también los propios de cada sede o facultad.

> **Estado:** Fase 0. Hay una landing con lista de espera y el núcleo de identidad institucional en la base (instituciones, sedes, dominios y perfiles).

## Stack

- **Next.js 16** (App Router, Cache Components) + TypeScript + Tailwind CSS 4
- **Supabase**: PostgreSQL, Auth, Realtime y Storage. Las reglas de negocio viven en migraciones SQL con RLS.
- **Vercel** para la web y **Cloudflare Turnstile** como anti-bots
- **Vitest** + **PGlite**: los tests de la base corren sin Docker, sobre un Postgres en memoria

Todo funciona dentro de los planes gratuitos. El `Dockerfile` y el uso de Postgres estándar permiten migrar a AWS, GCP o Azure sin reescribir la app.

## Empezar a desarrollar

Requisitos: Node.js 24 o superior y npm. Para levantar Supabase completo en tu máquina también necesitás Docker Desktop (en Windows, con WSL2), aunque no es obligatorio.

```bash
npm install
cp .env.example .env.local   # completá las variables
npm run dev                  # http://localhost:3000
```

Sin Supabase configurado, la landing se ve igual, pero el formulario de la lista de espera devuelve un error al enviar.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Lint, verificación de tipos y tests: lo mismo que CI |
| `npm test` | Tests unitarios y de la base (PGlite, sin Docker) |
| `npm run build` | Build de producción |
| `npm run db:new <nombre>` | Crea una migración nueva |
| `npm run db:start` / `db:stop` | Levanta o apaga Supabase local (requiere Docker) |
| `npm run db:reset` | Recrea la base local aplicando migraciones y `seed.sql` |
| `npm run db:types` | Genera los tipos TypeScript desde la base local |

Para correr los tests de la base contra un Postgres real de Supabase, definí `TEST_DATABASE_URL`. Con `supabase start`, la URL es `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Base de datos

Las migraciones están en [`supabase/migrations`](supabase/migrations) y siguen cuatro reglas:

1. **RLS en todas las tablas** y permisos explícitos (`grant`/`revoke`) para `anon`, `authenticated` y `service_role`. No dependemos de la exposición automática de tablas.
2. **La lógica de negocio va en funciones SQL** con `set search_path = ''`. La app las llama desde `src/server/*`.
3. **Cada regla tiene su test** en [`tests/db`](tests/db), con casos positivos y negativos de acceso.
4. Los datos de referencia, como las instituciones y sus dominios, van en migraciones. `seed.sql` es solo para desarrollo.

Un email se asigna a una institución y a una sede según el **sufijo registrado más largo**. Por ejemplo, `ana@alumnos.frgp.utn.edu.ar` se asigna a UTN – FRGP, y `ana@utn.edu.ar` se asigna a la UTN y la persona elige su sede. Ver [`resolve_email_domain`](supabase/migrations/20261124120000_identity_core.sql).

## Despliegue gratuito

1. **Supabase**: creá dos proyectos (staging y producción) en la región São Paulo. Después corré:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Vercel**: importá el repo, cargá las variables de `.env.example` y elegí São Paulo (`gru1`) como región de funciones, junto a la base.
3. **Turnstile**: creá un widget para tu dominio en Cloudflare y cargá las dos claves.
4. **Monitoreo**: configurá un monitor de UptimeRobot sobre `/api/health` cada 5 minutos. Además de alertarte, evita que el proyecto gratuito de Supabase se pause por inactividad.

Para correr la imagen Docker:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://tu-dominio -t campustime .
docker run -p 3000:3000 -e SUPABASE_URL=... -e SUPABASE_SECRET_KEY=... campustime
```

## Antes de publicar

- [x] Completar `dataController`, `contactEmail` y `repositoryUrl` en [`src/config/site.ts`](src/config/site.ts). La política de privacidad los muestra.
- [ ] Registrar la marca "CampusTime" en el INPI (clases 41, 42 y 45). No es obligatorio para lanzar, pero protege el nombre si el proyecto crece.
- [ ] Confirmar con cada facultad regional qué dominio usan los emails de estudiantes y ajustar [la migración de referencia](supabase/migrations/20261124120200_reference_institutions.sql). FRGP ya está confirmada (`alumnos.frgp.utn.edu.ar`).
- [ ] Configurar Turnstile en producción.
- [x] En GitHub, activar private vulnerability reporting, CodeQL y push protection de secret scanning.
- [ ] Proteger la rama `main` para que no se pueda mergear con CI en rojo.

## Estructura

```
src/app/(public)/   landing, lista de espera y política de privacidad
src/app/api/        endpoints (health)
src/server/         servicios del servidor: la única puerta a la base
src/lib/            clientes, validación (Zod) y utilidades
supabase/           migraciones, seed y configuración de la CLI
tests/db/           tests de la base (PGlite o Postgres real)
```

## Contribuir

Las contribuciones son bienvenidas, sobre todo de estudiantes. Leé [CONTRIBUTING.md](CONTRIBUTING.md) y el [código de conducta](CODE_OF_CONDUCT.md). Para reportar vulnerabilidades, seguí [SECURITY.md](SECURITY.md).

## Licencia

[AGPL-3.0](LICENSE). Podés usar, estudiar, modificar y hostear el código. Si ofrecés una versión modificada como servicio, tenés que publicar tus cambios con la misma licencia.
