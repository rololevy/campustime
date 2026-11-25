-- =============================================================================
-- CampusTime · Núcleo de identidad institucional
--
-- Instituciones, sedes, dominios de email y perfiles.
-- Cada institución puede tener varios dominios y cada dominio puede apuntar a
-- una sede. El dominio de un email se resuelve por el sufijo registrado más
-- largo: un dominio propio de una sede (ej. frgp.utn.edu.ar) gana sobre el
-- genérico de la institución (utn.edu.ar).
--
-- Los privilegios se otorgan de forma explícita para no depender de la
-- exposición automática de tablas de la Data API de Supabase.
-- =============================================================================

-- Esquema interno para funciones auxiliares. No figura en los esquemas
-- expuestos por la Data API.
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.institution_kind as enum (
  'universidad_nacional',
  'universidad_provincial',
  'universidad_privada',
  'instituto_universitario'
);

create type public.record_status as enum ('active', 'disabled');

create type public.member_role as enum ('estudiante', 'docente', 'nodocente');

create domain public.slug as text
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(value) <= 64);

create domain public.ar_province as text
  check (value in (
    'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
    'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ));

-- Dominio DNS en minúsculas, sin "@" ni punto final.
create domain public.email_domain as text
  check (
    value = lower(value)
    and char_length(value) <= 253
    and value ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  );

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Instituciones
-- -----------------------------------------------------------------------------

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  name text not null check (char_length(name) between 3 and 160),
  short_name text check (char_length(short_name) between 2 and 24),
  kind public.institution_kind not null,
  province public.ar_province,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.institutions is
  'Universidades e institutos universitarios que pueden acreditar a su comunidad.';
comment on column public.institutions.province is
  'Provincia de la sede principal. Nulo si la institución tiene alcance nacional.';

create trigger set_updated_at
  before update on public.institutions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sedes (facultades regionales, campus, unidades académicas)
-- -----------------------------------------------------------------------------

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  slug public.slug not null,
  name text not null check (char_length(name) between 3 and 160),
  short_name text check (char_length(short_name) between 2 and 24),
  city text check (char_length(city) between 2 and 80),
  province public.ar_province,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, slug),
  -- Permite que institution_domains garantice que la sede sea de la misma institución.
  unique (institution_id, id)
);

comment on table public.campuses is
  'Sedes de una institución (ej. facultades regionales de la UTN).';

create trigger set_updated_at
  before update on public.campuses
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Dominios de email institucionales
-- -----------------------------------------------------------------------------

create table public.institution_domains (
  id uuid primary key default gen_random_uuid(),
  domain public.email_domain not null unique,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  campus_id uuid,
  include_subdomains boolean not null default true,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (institution_id, campus_id)
    references public.campuses (institution_id, id)
    on delete set null (campus_id)
);

comment on table public.institution_domains is
  'Dominios de email que acreditan pertenencia a una institución y, opcionalmente, a una sede.';
comment on column public.institution_domains.include_subdomains is
  'Si es verdadero, también acredita subdominios (ej. alumnos.frgp.utn.edu.ar).';

create index institution_domains_institution_campus_idx
  on public.institution_domains (institution_id, campus_id);

create trigger set_updated_at
  before update on public.institution_domains
  for each row execute function private.set_updated_at();

-- Resuelve la institución y la sede de un email por el sufijo más largo.
-- Devuelve cero filas si el dominio no está registrado o está dado de baja.
create or replace function public.resolve_email_domain(p_email text)
returns table (institution_id uuid, campus_id uuid, matched_domain text)
language sql
stable
set search_path = ''
as $$
  with parts as (
    select string_to_array(lower(substring(trim(p_email) from '@([^@]+)$')), '.') as labels
  ),
  candidates as (
    select array_to_string(p.labels[i:], '.') as candidate, i = 1 as is_exact
    from parts p
    cross join generate_series(1, coalesce(array_length(p.labels, 1), 0)) as i
  )
  select d.institution_id, d.campus_id, d.domain::text
  from candidates c
  join public.institution_domains d on d.domain = c.candidate
  join public.institutions inst on inst.id = d.institution_id
  left join public.campuses cam on cam.id = d.campus_id
  where d.status = 'active'
    and inst.status = 'active'
    and (c.is_exact or d.include_subdomains)
    and (d.campus_id is null or cam.status = 'active')
  order by char_length(d.domain) desc
  limit 1;
$$;

comment on function public.resolve_email_domain(text) is
  'Institución y sede asociadas al dominio de un email (sufijo registrado más largo).';

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 500),
  role_type public.member_role,
  avatar_path text check (char_length(avatar_path) <= 200),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos públicos de cada persona dentro de la plataforma.';
comment on column public.profiles.suspended_at is
  'Fecha de suspensión por moderación. Solo la modifica el servidor.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Crea el perfil al registrarse. Toma el nombre que informa Google, si existe;
-- nunca deriva el nombre del email.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privilegios y RLS
-- -----------------------------------------------------------------------------

alter table public.institutions enable row level security;
alter table public.campuses enable row level security;
alter table public.institution_domains enable row level security;
alter table public.profiles enable row level security;

-- Catálogo institucional: lectura pública de lo activo; solo el servidor escribe.
revoke all on public.institutions, public.campuses, public.institution_domains
  from anon, authenticated;
grant select on public.institutions, public.campuses, public.institution_domains
  to anon, authenticated;
grant all on public.institutions, public.campuses, public.institution_domains
  to service_role;

create policy "Instituciones activas visibles para todos"
  on public.institutions for select
  to anon, authenticated
  using (status = 'active');

create policy "Sedes activas visibles para todos"
  on public.campuses for select
  to anon, authenticated
  using (status = 'active');

create policy "Dominios activos visibles para todos"
  on public.institution_domains for select
  to anon, authenticated
  using (status = 'active');

revoke all on function public.resolve_email_domain(text) from public;
grant execute on function public.resolve_email_domain(text)
  to anon, authenticated, service_role;

-- Perfiles: por ahora cada persona ve y edita solo el suyo. La visibilidad
-- entre personas acreditadas llega con las afiliaciones (Fase 1).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, role_type, avatar_path) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "Cada persona ve su perfil"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Cada persona edita su perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
