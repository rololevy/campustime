-- =============================================================================
-- CampusTime · Acreditación institucional
--
-- Una persona prueba que pertenece a una institución verificando un email
-- institucional:
--   1. Si inició sesión con un email institucional confirmado, se acredita sola
--      (accredit_login_email).
--   2. Si no, pide un código de 6 dígitos para ese email
--      (request_affiliation_code, solo servidor) y lo verifica
--      (verify_affiliation_code).
-- Si el dominio no está registrado, la afiliación queda "pending_domain" hasta
-- que se apruebe el dominio (submit_domain_request y admin_approve_domain).
-- Un email institucional acredita una sola cuenta.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Postgres otorga EXECUTE a PUBLIC en toda función nueva, y ese permiso global
-- no se puede quitar por esquema. Cada función de `private` se revoca a mano.
revoke execute on function private.set_updated_at() from public;

create type public.affiliation_status as enum ('pending_domain', 'active', 'revoked');
create type public.domain_request_status as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------

create or replace function private.email_domain_of(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(substring(btrim(p_email) from '@([^@]+)$'))
$$;

create or replace function private.hash_code(p_user_id uuid, p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_user_id::text || ':' || p_code, 'UTF8')), 'hex')
$$;

-- Proveedores de email personal: no acreditan pertenencia a ninguna institución.
create table private.webmail_domains (
  domain public.email_domain primary key
);

insert into private.webmail_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('hotmail.com'), ('hotmail.com.ar'), ('hotmail.es'),
  ('outlook.com'), ('outlook.com.ar'), ('outlook.es'), ('live.com'), ('live.com.ar'),
  ('msn.com'), ('yahoo.com'), ('yahoo.com.ar'), ('ymail.com'), ('icloud.com'), ('me.com'),
  ('mac.com'), ('protonmail.com'), ('proton.me'), ('aol.com'), ('gmx.com'), ('mail.com'),
  ('yandex.com'), ('zoho.com'), ('fibertel.com.ar'), ('arnet.com.ar'), ('speedy.com.ar');

-- -----------------------------------------------------------------------------
-- Afiliaciones
-- -----------------------------------------------------------------------------

create table public.affiliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  email public.email_address not null,
  email_domain public.email_domain not null,
  institution_id uuid references public.institutions (id) on delete restrict,
  campus_id uuid,
  -- Verdadero si la sede la asignó el dominio del email: la persona no puede cambiarla.
  campus_locked boolean not null default false,
  status public.affiliation_status not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (institution_id, campus_id)
    references public.campuses (institution_id, id)
    on delete set null (campus_id),
  check (status <> 'active' or institution_id is not null),
  check (status <> 'pending_domain' or institution_id is null)
);

comment on table public.affiliations is
  'Pertenencia verificada de una persona a una institución (y sede) mediante un email institucional.';

create unique index affiliations_email_in_use_idx on public.affiliations (email) where status <> 'revoked';
create index affiliations_user_id_idx on public.affiliations (user_id);
create index affiliations_institution_campus_idx on public.affiliations (institution_id, campus_id);
create index affiliations_pending_domain_idx on public.affiliations (email_domain) where status = 'pending_domain';

create trigger set_updated_at
  before update on public.affiliations
  for each row execute function private.set_updated_at();

-- Códigos de verificación: solo se guarda el hash. Nunca se exponen por la API.
create table private.affiliation_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email public.email_address not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index affiliation_codes_user_idx on private.affiliation_codes (user_id, created_at desc);
create index affiliation_codes_email_idx on private.affiliation_codes (email, created_at desc);

create table public.domain_requests (
  id uuid primary key default gen_random_uuid(),
  domain public.email_domain not null,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  university_name text not null check (char_length(university_name) between 2 and 160),
  campus_name text check (char_length(campus_name) between 2 and 120),
  status public.domain_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (domain, requested_by)
);

comment on table public.domain_requests is
  'Pedidos para sumar el dominio de una universidad que todavía no está registrada.';

create index domain_requests_requested_by_idx on public.domain_requests (requested_by);
create index domain_requests_pending_idx on public.domain_requests (domain) where status = 'pending';

-- Persona con al menos una afiliación activa y sin suspensión.
create or replace function private.is_accredited(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.affiliations a
    join public.profiles p on p.id = a.user_id
    where a.user_id = p_user_id
      and a.status = 'active'
      and p.suspended_at is null
  )
$$;

-- -----------------------------------------------------------------------------
-- Funciones
-- -----------------------------------------------------------------------------

-- Genera un código para verificar un email institucional. Solo la llama el
-- servidor (service_role), que obtiene p_user_id de la sesión y envía el código
-- por email. Si la pudiera llamar la persona, obtendría el código sin recibirlo.
create or replace function public.request_affiliation_code(p_user_id uuid, p_email text)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email text := lower(btrim(p_email));
  v_domain text := private.email_domain_of(lower(btrim(p_email)));
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'unknown_user';
  end if;
  if v_domain is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from private.webmail_domains w where w.domain = v_domain) then
    raise exception 'webmail_not_allowed';
  end if;
  if exists (select 1 from public.affiliations a where a.email = v_email and a.status <> 'revoked') then
    if exists (
      select 1 from public.affiliations a
      where a.email = v_email and a.status <> 'revoked' and a.user_id = p_user_id
    ) then
      raise exception 'already_affiliated';
    end if;
    raise exception 'email_in_use';
  end if;
  if (
    select count(*) from private.affiliation_codes c
    where c.user_id = p_user_id and c.created_at > now() - interval '1 hour'
  ) >= 5 or (
    select count(*) from private.affiliation_codes c
    where c.email = v_email and c.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limited';
  end if;

  v_code := lpad(
    ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text,
    6, '0'
  );

  -- Un solo código vigente por persona.
  update private.affiliation_codes c
     set consumed_at = now()
   where c.user_id = p_user_id and c.consumed_at is null;

  insert into private.affiliation_codes (user_id, email, code_hash, expires_at)
  values (p_user_id, v_email, private.hash_code(p_user_id, v_code), v_expires);

  return query select v_code, v_expires;
end;
$$;

-- Crea la afiliación para un email ya verificado.
create or replace function private.create_affiliation(p_user_id uuid, p_email text)
returns table (status text, affiliation_id uuid, institution_id uuid, campus_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_institution uuid;
  v_campus uuid;
  v_status public.affiliation_status;
  v_id uuid;
begin
  if exists (select 1 from public.affiliations a where a.email = p_email and a.status <> 'revoked') then
    return query select 'email_in_use'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  select r.institution_id, r.campus_id
    into v_institution, v_campus
  from public.resolve_email_domain(p_email) r;

  v_status := case when v_institution is null then 'pending_domain' else 'active' end;

  insert into public.affiliations (user_id, email, email_domain, institution_id, campus_id, campus_locked, status)
  values (
    p_user_id, p_email, private.email_domain_of(p_email),
    v_institution, v_campus, v_campus is not null, v_status
  )
  returning id into v_id;

  return query select v_status::text, v_id, v_institution, v_campus;
end;
$$;

-- Verifica el código que la persona recibió por email.
-- Devuelve: active | pending_domain | invalid | expired | too_many_attempts | no_code | email_in_use.
-- No lanza errores ante un código incorrecto, para que el intento quede registrado.
create or replace function public.verify_affiliation_code(p_code text)
returns table (status text, affiliation_id uuid, institution_id uuid, campus_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_row private.affiliation_codes%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_row
  from private.affiliation_codes c
  where c.user_id = v_user and c.consumed_at is null
  order by c.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'no_code'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if v_row.expires_at < now() then
    return query select 'expired'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if v_row.attempts >= 5 then
    return query select 'too_many_attempts'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if v_row.code_hash <> private.hash_code(v_user, btrim(coalesce(p_code, ''))) then
    update private.affiliation_codes c set attempts = c.attempts + 1 where c.id = v_row.id;
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  update private.affiliation_codes c set consumed_at = now() where c.id = v_row.id;
  return query select * from private.create_affiliation(v_user, v_row.email);
end;
$$;

-- Acredita con el email de inicio de sesión si es institucional y está confirmado
-- (Google o código por email). Devuelve: active | not_institutional | unverified |
-- already_affiliated | email_in_use.
create or replace function public.accredit_login_email()
returns table (status text, affiliation_id uuid, institution_id uuid, campus_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_user;

  if v_email is null or v_confirmed is null then
    return query select 'unverified'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if exists (
    select 1 from public.affiliations a
    where a.email = v_email and a.user_id = v_user and a.status <> 'revoked'
  ) then
    return query select 'already_affiliated'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if not exists (select 1 from public.resolve_email_domain(v_email)) then
    return query select 'not_institutional'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  return query select * from private.create_affiliation(v_user, v_email);
end;
$$;

-- Elige la sede cuando el dominio no la determinó (ej. utn.edu.ar).
create or replace function public.set_affiliation_campus(p_affiliation_id uuid, p_campus_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aff public.affiliations%rowtype;
begin
  select * into v_aff from public.affiliations a
  where a.id = p_affiliation_id and a.user_id = auth.uid() and a.status = 'active'
  for update;

  if not found then
    raise exception 'affiliation_not_found' using errcode = '42501';
  end if;
  if v_aff.campus_locked then
    raise exception 'campus_locked';
  end if;
  if not exists (
    select 1 from public.campuses c
    where c.id = p_campus_id and c.institution_id = v_aff.institution_id and c.status = 'active'
  ) then
    raise exception 'invalid_campus';
  end if;

  update public.affiliations a set campus_id = p_campus_id where a.id = p_affiliation_id;
end;
$$;

-- "Sumá tu universidad": pide registrar el dominio de una afiliación pendiente.
create or replace function public.submit_domain_request(p_university_name text, p_campus_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_domain text;
  v_id uuid;
begin
  select a.email_domain into v_domain
  from public.affiliations a
  where a.user_id = v_user and a.status = 'pending_domain'
  order by a.created_at desc
  limit 1;

  if v_domain is null then
    raise exception 'no_pending_affiliation' using errcode = '42501';
  end if;

  insert into public.domain_requests (domain, requested_by, university_name, campus_name)
  values (v_domain, v_user, btrim(p_university_name), nullif(btrim(p_campus_name), ''))
  on conflict (domain, requested_by) do update
    set university_name = excluded.university_name,
        campus_name = excluded.campus_name
  returning id into v_id;

  return v_id;
end;
$$;

-- Aprueba un dominio y activa las afiliaciones que esperaban por él. Por ahora
-- la ejecuta solo el servidor o un admin desde SQL; el panel llega en la Fase 3.
create or replace function public.admin_approve_domain(
  p_domain text,
  p_institution_id uuid,
  p_campus_id uuid default null,
  p_include_subdomains boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_domain text := lower(btrim(p_domain));
  v_activated integer := 0;
  v_aff record;
  v_institution uuid;
  v_campus uuid;
begin
  if exists (select 1 from private.webmail_domains w where w.domain = v_domain) then
    raise exception 'webmail_not_allowed';
  end if;

  insert into public.institution_domains (domain, institution_id, campus_id, include_subdomains)
  values (v_domain, p_institution_id, p_campus_id, p_include_subdomains)
  on conflict (domain) do update
    set institution_id = excluded.institution_id,
        campus_id = excluded.campus_id,
        include_subdomains = excluded.include_subdomains,
        status = 'active';

  for v_aff in
    select a.id, a.email from public.affiliations a where a.status = 'pending_domain' for update
  loop
    select r.institution_id, r.campus_id into v_institution, v_campus
    from public.resolve_email_domain(v_aff.email) r;

    if v_institution is not null then
      update public.affiliations a
         set status = 'active', institution_id = v_institution, campus_id = v_campus,
             campus_locked = v_campus is not null
       where a.id = v_aff.id;
      v_activated := v_activated + 1;
    end if;
    v_institution := null;
    v_campus := null;
  end loop;

  update public.domain_requests d
     set status = 'approved', reviewed_at = now()
   where d.status = 'pending'
     and exists (select 1 from public.resolve_email_domain('x@' || d.domain));

  return v_activated;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios y RLS
-- -----------------------------------------------------------------------------

grant usage on schema private to authenticated;
revoke all on function private.is_accredited(uuid) from public;
grant execute on function private.is_accredited(uuid) to authenticated;

revoke all on function private.email_domain_of(text) from public;
revoke all on function private.hash_code(uuid, text) from public;
revoke all on function private.create_affiliation(uuid, text) from public;

revoke all on public.affiliations, public.domain_requests from anon, authenticated;
grant select on public.affiliations, public.domain_requests to authenticated;
grant all on public.affiliations, public.domain_requests to service_role;

alter table public.affiliations enable row level security;
alter table public.domain_requests enable row level security;

create policy "Cada persona ve sus afiliaciones"
  on public.affiliations for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Cada persona ve sus pedidos de dominio"
  on public.domain_requests for select
  to authenticated
  using (requested_by = (select auth.uid()));

revoke all on function public.request_affiliation_code(uuid, text) from public, anon, authenticated;
grant execute on function public.request_affiliation_code(uuid, text) to service_role;

revoke all on function public.admin_approve_domain(text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_approve_domain(text, uuid, uuid, boolean) to service_role;

revoke all on function public.verify_affiliation_code(text) from public, anon;
revoke all on function public.accredit_login_email() from public, anon;
revoke all on function public.set_affiliation_campus(uuid, uuid) from public, anon;
revoke all on function public.submit_domain_request(text, text) from public, anon;
grant execute on function public.verify_affiliation_code(text) to authenticated;
grant execute on function public.accredit_login_email() to authenticated;
grant execute on function public.set_affiliation_campus(uuid, uuid) to authenticated;
grant execute on function public.submit_domain_request(text, text) to authenticated;

-- Perfiles: además del propio, cada persona acreditada ve los de otras
-- personas acreditadas y no suspendidas.
drop policy "Cada persona ve su perfil" on public.profiles;

create policy "Perfiles visibles entre personas acreditadas"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or ((select private.is_accredited((select auth.uid()))) and private.is_accredited(id))
  );
