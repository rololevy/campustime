# Cómo contribuir

¡Gracias por sumarte! UniTime es un proyecto abierto pensado para que estudiantes de cualquier universidad puedan aportar.

## Flujo de trabajo

1. Buscá un issue (los `good first issue` son ideales para empezar) o abrí uno nuevo para charlar la idea antes de programar.
2. Creá una rama desde `main` con un nombre descriptivo, por ejemplo `feat/lista-de-espera-csv`.
3. Antes de abrir el PR, corré `npm run check`. Tiene que pasar lint, tipos y tests.
4. Abrí el PR explicando qué cambia y por qué. Si toca la interfaz, sumá capturas en celular y en escritorio.

## Convenciones

- **Idioma:** el código, los identificadores y los nombres de archivos van en inglés. Los textos de la interfaz, los comentarios y la documentación van en español rioplatense, con voseo ("Anotate", "Publicá").
- **Base de datos:** toda tabla nueva necesita RLS, permisos explícitos y tests en `tests/db`, con casos de acceso permitido y denegado. Las funciones SQL llevan `set search_path = ''`. Nunca edites una migración que ya se aplicó en producción: creá una nueva con `npm run db:new`.
- **Lógica de negocio:** va en funciones SQL o en `src/server/*`, nunca en componentes de cliente.
- **Accesibilidad:** cada campo tiene su `label`, los errores se asocian con `aria-describedby` y los colores respetan contraste AA en modo claro y oscuro.

## Datos y secretos

- No subas datos reales de personas, ni siquiera en tests. Usá datos inventados.
- No subas claves ni archivos `.env`. Si subiste una por error, avisá enseguida para rotarla.
