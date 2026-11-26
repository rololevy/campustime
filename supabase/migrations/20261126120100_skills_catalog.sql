-- =============================================================================
-- CampusTime · Catálogo de habilidades
--
-- Qué se puede enseñar y aprender. La búsqueda tolera tildes, mayúsculas,
-- errores de tipeo y abreviaturas (alias como "AM1" o "AGA"). Cualquier persona
-- puede proponer una habilidad: si ya existe una muy parecida, se reutiliza; si
-- no, queda "unreviewed" y un admin puede fusionar duplicados.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.skill_status as enum ('approved', 'unreviewed', 'merged');
create type public.skill_direction as enum ('teach', 'learn');
create type public.skill_level as enum ('basico', 'intermedio', 'avanzado');

-- unaccent no es IMMUTABLE; con el diccionario explícito sí se puede indexar.
create or replace function private.normalize_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))))
$$;

grant execute on function private.normalize_text(text) to anon, authenticated, service_role;
grant usage on schema private to anon;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.skill_categories (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  name text not null check (char_length(name) between 2 and 60),
  sort_order smallint not null default 100
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  name text not null check (char_length(name) between 2 and 80),
  category_id uuid not null references public.skill_categories (id) on delete restrict,
  aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
  status public.skill_status not null default 'unreviewed',
  merged_into uuid references public.skills (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'merged') = (merged_into is not null))
);

comment on table public.skills is 'Materias y habilidades que se pueden enseñar o aprender.';

create index skills_category_id_idx on public.skills (category_id);
create index skills_merged_into_idx on public.skills (merged_into);
create index skills_created_by_idx on public.skills (created_by);
create index skills_name_trgm_idx on public.skills
  using gin (private.normalize_text(name) extensions.gin_trgm_ops);

create trigger set_updated_at
  before update on public.skills
  for each row execute function private.set_updated_at();

create table public.user_skills (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  direction public.skill_direction not null,
  level public.skill_level,
  description text check (char_length(description) <= 280),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id, direction)
);

comment on table public.user_skills is 'Qué enseña y qué quiere aprender cada persona.';

create index user_skills_skill_direction_idx on public.user_skills (skill_id, direction);

-- -----------------------------------------------------------------------------
-- Funciones
-- -----------------------------------------------------------------------------

-- Busca por nombre y alias. "analisis mate", "am1" o "fisica 1" encuentran la materia.
create or replace function public.search_skills(p_query text, p_limit integer default 10)
returns table (id uuid, slug text, name text, category_slug text, score real)
language sql
stable
set search_path = ''
as $$
  with q as (select private.normalize_text(p_query) as text)
  select s.id, s.slug::text, s.name, c.slug::text, m.score
  from public.skills s
  join public.skill_categories c on c.id = s.category_id
  cross join q
  cross join lateral (
    select greatest(
      extensions.word_similarity(q.text, private.normalize_text(s.name)),
      coalesce((
        select max(extensions.similarity(q.text, private.normalize_text(a)))
        from unnest(s.aliases) as a
      ), 0),
      case when private.normalize_text(s.name) like q.text || '%' then 1 else 0 end
    )::real as score
  ) m
  where s.status <> 'merged'
    and char_length(q.text) >= 2
    and m.score >= 0.4
  order by m.score desc, s.status = 'approved' desc, s.name
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
$$;

-- Propone una habilidad. Si ya existe una equivalente, devuelve esa.
create or replace function public.create_skill(p_name text, p_category_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_norm text := private.normalize_text(p_name);
  v_category uuid;
  v_existing uuid;
  v_slug text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_name';
  end if;

  select c.id into v_category from public.skill_categories c where c.slug = p_category_slug;
  if v_category is null then
    raise exception 'invalid_category';
  end if;

  select s.id into v_existing
  from public.skills s
  where s.status <> 'merged'
    and (
      private.normalize_text(s.name) = v_norm
      or extensions.similarity(private.normalize_text(s.name), v_norm) >= 0.8
      or exists (select 1 from unnest(s.aliases) a where private.normalize_text(a) = v_norm)
    )
  order by extensions.similarity(private.normalize_text(s.name), v_norm) desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  if (
    select count(*) from public.skills s
    where s.created_by = v_user and s.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limited';
  end if;

  v_slug := btrim(regexp_replace(v_norm, '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then
    raise exception 'invalid_name';
  end if;
  v_slug := left(v_slug, 50);
  if exists (select 1 from public.skills s where s.slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;

  insert into public.skills (slug, name, category_id, status, created_by)
  values (v_slug, v_name, v_category, 'unreviewed', v_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios y RLS
-- -----------------------------------------------------------------------------

alter table public.skill_categories enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;

revoke all on public.skill_categories, public.skills, public.user_skills from anon, authenticated;
grant select on public.skill_categories, public.skills to anon, authenticated;
grant select, insert, update, delete on public.user_skills to authenticated;
grant all on public.skill_categories, public.skills, public.user_skills to service_role;

create policy "Categorías visibles para todos"
  on public.skill_categories for select
  to anon, authenticated
  using (true);

create policy "Habilidades vigentes visibles para todos"
  on public.skills for select
  to anon, authenticated
  using (status <> 'merged');

create policy "Cada persona ve sus habilidades y las de personas acreditadas"
  on public.user_skills for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or ((select private.is_accredited((select auth.uid()))) and private.is_accredited(user_id))
  );

create policy "Cada persona agrega sus habilidades"
  on public.user_skills for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Cada persona edita sus habilidades"
  on public.user_skills for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Cada persona borra sus habilidades"
  on public.user_skills for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.search_skills(text, integer) from public;
grant execute on function public.search_skills(text, integer) to anon, authenticated, service_role;

revoke all on function public.create_skill(text, text) from public, anon;
grant execute on function public.create_skill(text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Datos iniciales: materias básicas comunes de ingeniería y habilidades generales
-- -----------------------------------------------------------------------------

insert into public.skill_categories (slug, name, sort_order) values
  ('materias-basicas', 'Materias básicas', 10),
  ('programacion', 'Programación y tecnología', 20),
  ('idiomas', 'Idiomas', 30),
  ('herramientas', 'Herramientas y software', 40),
  ('habilidades-academicas', 'Habilidades académicas', 50),
  ('arte-y-deporte', 'Arte, música y deporte', 60);

insert into public.skills (slug, name, category_id, aliases, status)
select v.slug, v.name, c.id, v.aliases, 'approved'
from (values
  ('materias-basicas', 'analisis-matematico-1', 'Análisis Matemático I', array['AM1', 'AM I', 'Análisis 1', 'Análisis I']),
  ('materias-basicas', 'analisis-matematico-2', 'Análisis Matemático II', array['AM2', 'AM II', 'Análisis 2', 'Análisis II']),
  ('materias-basicas', 'algebra-y-geometria-analitica', 'Álgebra y Geometría Analítica', array['AGA', 'Álgebra', 'Geometría Analítica']),
  ('materias-basicas', 'fisica-1', 'Física I', array['Física 1', 'F1']),
  ('materias-basicas', 'fisica-2', 'Física II', array['Física 2', 'F2']),
  ('materias-basicas', 'quimica-general', 'Química General', array['Química']),
  ('materias-basicas', 'probabilidad-y-estadistica', 'Probabilidad y Estadística', array['PyE', 'Estadística', 'Probabilidad']),
  ('materias-basicas', 'sistemas-de-representacion', 'Sistemas de Representación', array['Dibujo técnico', 'SR']),
  ('materias-basicas', 'ingenieria-y-sociedad', 'Ingeniería y Sociedad', array['IyS']),
  ('materias-basicas', 'ingles-1', 'Inglés I', array['Inglés 1', 'Inglés técnico']),
  ('materias-basicas', 'ingles-2', 'Inglés II', array['Inglés 2']),
  ('materias-basicas', 'economia', 'Economía', array[]::text[]),
  ('materias-basicas', 'legislacion', 'Legislación', array[]::text[]),
  ('programacion', 'programacion-basica', 'Programación básica', array['Algoritmos', 'Fundamentos de programación']),
  ('programacion', 'python', 'Python', array[]::text[]),
  ('programacion', 'java', 'Java', array[]::text[]),
  ('programacion', 'javascript', 'JavaScript', array['JS', 'TypeScript']),
  ('programacion', 'c-cpp', 'C y C++', array['C', 'C++']),
  ('programacion', 'sql-y-bases-de-datos', 'SQL y bases de datos', array['SQL', 'Bases de datos']),
  ('idiomas', 'ingles-conversacional', 'Inglés conversacional', array['Inglés', 'English']),
  ('idiomas', 'portugues', 'Portugués', array[]::text[]),
  ('idiomas', 'frances', 'Francés', array[]::text[]),
  ('herramientas', 'excel', 'Excel', array['Planillas de cálculo', 'Google Sheets']),
  ('herramientas', 'autocad', 'AutoCAD', array['CAD']),
  ('herramientas', 'matlab', 'MATLAB', array['Octave']),
  ('herramientas', 'git-y-github', 'Git y GitHub', array['Git', 'GitHub']),
  ('herramientas', 'latex', 'LaTeX', array[]::text[]),
  ('habilidades-academicas', 'tecnicas-de-estudio', 'Técnicas de estudio', array['Organización del estudio']),
  ('habilidades-academicas', 'redaccion-de-informes', 'Redacción de informes', array['Redacción', 'Escritura académica']),
  ('habilidades-academicas', 'oratoria', 'Oratoria y presentaciones', array['Oratoria', 'Presentaciones']),
  ('arte-y-deporte', 'guitarra', 'Guitarra', array[]::text[]),
  ('arte-y-deporte', 'dibujo', 'Dibujo', array['Ilustración']),
  ('arte-y-deporte', 'fotografia', 'Fotografía', array[]::text[])
) as v (category_slug, slug, name, aliases)
join public.skill_categories c on c.slug = v.category_slug;
