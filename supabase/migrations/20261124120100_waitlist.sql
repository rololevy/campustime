-- =============================================================================
-- UniTime · Lista de espera
--
-- Personas interesadas antes del lanzamiento. Sirve para abrir por oleadas y
-- para sembrar el catálogo con lo que la comunidad quiere enseñar y aprender.
-- Solo el servidor (service_role) lee y escribe: no hay políticas para anon ni
-- authenticated.
-- =============================================================================

create domain public.email_address as text
  check (
    value = lower(value)
    and char_length(value) <= 254
    and value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email public.email_address not null unique,
  university_name text not null check (char_length(university_name) between 2 and 120),
  campus_name text check (char_length(campus_name) between 2 and 120),
  role_type public.member_role,
  wants_to_teach text check (char_length(wants_to_teach) <= 300),
  wants_to_learn text check (char_length(wants_to_learn) <= 300),
  -- Detectados por el dominio del email, si está registrado.
  institution_id uuid references public.institutions (id) on delete set null,
  campus_id uuid references public.campuses (id) on delete set null,
  -- Versión de la política de privacidad aceptada.
  consent_version text not null check (char_length(consent_version) between 1 and 32),
  consented_at timestamptz not null default now(),
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.waitlist_entries is
  'Inscripciones a la lista de espera previas al lanzamiento.';

create index waitlist_entries_institution_id_idx on public.waitlist_entries (institution_id);
create index waitlist_entries_campus_id_idx on public.waitlist_entries (campus_id);

alter table public.waitlist_entries enable row level security;
revoke all on public.waitlist_entries from anon, authenticated;
grant all on public.waitlist_entries to service_role;

-- Inscribe un email en la lista de espera. Si ya estaba inscripto no hace nada,
-- para no revelar quién se anotó.
create or replace function public.join_waitlist(
  p_email text,
  p_university_name text,
  p_consent_version text,
  p_campus_name text default null,
  p_role_type public.member_role default null,
  p_wants_to_teach text default null,
  p_wants_to_learn text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_institution_id uuid;
  v_campus_id uuid;
begin
  select r.institution_id, r.campus_id
    into v_institution_id, v_campus_id
  from public.resolve_email_domain(v_email) as r;

  insert into public.waitlist_entries (
    email, university_name, campus_name, role_type,
    wants_to_teach, wants_to_learn,
    institution_id, campus_id, consent_version
  )
  values (
    v_email,
    btrim(p_university_name),
    nullif(btrim(p_campus_name), ''),
    p_role_type,
    nullif(btrim(p_wants_to_teach), ''),
    nullif(btrim(p_wants_to_learn), ''),
    v_institution_id,
    v_campus_id,
    p_consent_version
  )
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.join_waitlist(
  text, text, text, text, public.member_role, text, text
) from public, anon, authenticated;
grant execute on function public.join_waitlist(
  text, text, text, text, public.member_role, text, text
) to service_role;
