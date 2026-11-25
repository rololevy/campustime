<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Reglas del proyecto UniTime

- Los textos de la UI van en español rioplatense con voseo. El código y los identificadores van en inglés.
- La lógica de negocio vive en funciones SQL (migraciones en `supabase/migrations`) o en `src/server/*`. Los componentes de cliente nunca escriben en la base.
- Toda tabla nueva lleva RLS, `grant`/`revoke` explícitos para `anon`, `authenticated` y `service_role`, y tests en `tests/db` con casos permitidos y denegados. No hay que asumir que Supabase expone o deja de exponer tablas automáticamente.
- Las funciones SQL llevan `set search_path = ''`. Las internas van en el esquema `private`.
- La clave secreta de Supabase solo se usa en el servidor (`src/lib/supabase/admin.ts`). Las variables `NEXT_PUBLIC_*` quedan fijas en el build: lo que el servidor deba leer en runtime necesita una variable sin ese prefijo.
- Los tests de la base corren en PGlite (PostgreSQL 19). Supabase usa 17: no uses sintaxis posterior a la 17.
- Antes de terminar un cambio, corré `npm run check` y `npm run build`.
