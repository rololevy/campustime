-- =============================================================================
-- CampusTime · Datos de referencia: instituciones, sedes y dominios
--
-- Carga inicial para la lista de espera y la acreditación. Los dominios por
-- sede siguen el patrón oficial de los sitios de cada facultad regional
-- (frXX.utn.edu.ar). Hay que validarlos con cada FR: los emails de estudiantes
-- pueden usar otro dominio o un subdominio. Un dominio que no coincide con
-- ningún email no rompe nada. Los cambios posteriores van en migraciones nuevas
-- o desde el panel de administración.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Universidad Tecnológica Nacional
-- -----------------------------------------------------------------------------

insert into public.institutions (slug, name, short_name, kind, province)
values ('utn', 'Universidad Tecnológica Nacional', 'UTN', 'universidad_nacional', null);

insert into public.campuses (institution_id, slug, name, short_name, city, province)
select i.id, c.slug, c.name, c.short_name, c.city, c.province
from public.institutions i
cross join (values
  ('rectorado', 'Rectorado', 'Rectorado', 'Ciudad Autónoma de Buenos Aires', 'Ciudad Autónoma de Buenos Aires'),
  ('fra', 'Facultad Regional Avellaneda', 'FRA', 'Avellaneda', 'Buenos Aires'),
  ('frbb', 'Facultad Regional Bahía Blanca', 'FRBB', 'Bahía Blanca', 'Buenos Aires'),
  ('frba', 'Facultad Regional Buenos Aires', 'FRBA', 'Ciudad Autónoma de Buenos Aires', 'Ciudad Autónoma de Buenos Aires'),
  ('frch', 'Facultad Regional Chubut', 'FRCH', 'Puerto Madryn', 'Chubut'),
  ('frcu', 'Facultad Regional Concepción del Uruguay', 'FRCU', 'Concepción del Uruguay', 'Entre Ríos'),
  ('frcon', 'Facultad Regional Concordia', 'FRCON', 'Concordia', 'Entre Ríos'),
  ('frc', 'Facultad Regional Córdoba', 'FRC', 'Córdoba', 'Córdoba'),
  ('frd', 'Facultad Regional Delta', 'FRD', 'Campana', 'Buenos Aires'),
  ('frgp', 'Facultad Regional General Pacheco', 'FRGP', 'General Pacheco', 'Buenos Aires'),
  ('frh', 'Facultad Regional Haedo', 'FRH', 'Haedo', 'Buenos Aires'),
  ('frlp', 'Facultad Regional La Plata', 'FRLP', 'La Plata', 'Buenos Aires'),
  ('frlr', 'Facultad Regional La Rioja', 'FRLR', 'La Rioja', 'La Rioja'),
  ('frm', 'Facultad Regional Mendoza', 'FRM', 'Mendoza', 'Mendoza'),
  ('frn', 'Facultad Regional Neuquén', 'FRN', 'Plaza Huincul', 'Neuquén'),
  ('frp', 'Facultad Regional Paraná', 'FRP', 'Paraná', 'Entre Ríos'),
  ('frra', 'Facultad Regional Rafaela', 'FRRa', 'Rafaela', 'Santa Fe'),
  ('frrq', 'Facultad Regional Reconquista', 'FRRq', 'Reconquista', 'Santa Fe'),
  ('frre', 'Facultad Regional Resistencia', 'FRRe', 'Resistencia', 'Chaco'),
  ('frro', 'Facultad Regional Rosario', 'FRRo', 'Rosario', 'Santa Fe'),
  ('frsfco', 'Facultad Regional San Francisco', 'FRSFco', 'San Francisco', 'Córdoba'),
  ('frsn', 'Facultad Regional San Nicolás', 'FRSN', 'San Nicolás de los Arroyos', 'Buenos Aires'),
  ('frsr', 'Facultad Regional San Rafael', 'FRSR', 'San Rafael', 'Mendoza'),
  ('frsc', 'Facultad Regional Santa Cruz', 'FRSC', 'Río Gallegos', 'Santa Cruz'),
  ('frsf', 'Facultad Regional Santa Fe', 'FRSF', 'Santa Fe', 'Santa Fe'),
  ('frtdf', 'Facultad Regional Tierra del Fuego', 'FRTDF', 'Río Grande', 'Tierra del Fuego'),
  ('frtl', 'Facultad Regional Trenque Lauquen', 'FRTL', 'Trenque Lauquen', 'Buenos Aires'),
  ('frt', 'Facultad Regional Tucumán', 'FRT', 'San Miguel de Tucumán', 'Tucumán'),
  ('frvt', 'Facultad Regional Venado Tuerto', 'FRVT', 'Venado Tuerto', 'Santa Fe'),
  ('frvm', 'Facultad Regional Villa María', 'FRVM', 'Villa María', 'Córdoba')
) as c (slug, name, short_name, city, province)
where i.slug = 'utn';

-- Dominio genérico: identifica la UTN y la persona elige su sede.
insert into public.institution_domains (domain, institution_id, campus_id, include_subdomains)
select 'utn.edu.ar', i.id, null, true
from public.institutions i
where i.slug = 'utn';

-- Dominios por facultad regional: asignan la sede automáticamente.
insert into public.institution_domains (domain, institution_id, campus_id, include_subdomains)
select c.slug || '.utn.edu.ar', c.institution_id, c.id, true
from public.campuses c
join public.institutions i on i.id = c.institution_id
where i.slug = 'utn'
  and c.slug <> 'rectorado';

-- -----------------------------------------------------------------------------
-- Otras universidades (dominio principal; las sedes se suman a pedido)
-- -----------------------------------------------------------------------------

with data (slug, name, short_name, kind, province, domain) as (
  values
    ('uba', 'Universidad de Buenos Aires', 'UBA', 'universidad_nacional', 'Ciudad Autónoma de Buenos Aires', 'uba.ar'),
    ('unlp', 'Universidad Nacional de La Plata', 'UNLP', 'universidad_nacional', 'Buenos Aires', 'unlp.edu.ar'),
    ('unc', 'Universidad Nacional de Córdoba', 'UNC', 'universidad_nacional', 'Córdoba', 'unc.edu.ar'),
    ('unr', 'Universidad Nacional de Rosario', 'UNR', 'universidad_nacional', 'Santa Fe', 'unr.edu.ar'),
    ('unlam', 'Universidad Nacional de La Matanza', 'UNLaM', 'universidad_nacional', 'Buenos Aires', 'unlam.edu.ar'),
    ('unq', 'Universidad Nacional de Quilmes', 'UNQ', 'universidad_nacional', 'Buenos Aires', 'unq.edu.ar'),
    ('unsam', 'Universidad Nacional de San Martín', 'UNSAM', 'universidad_nacional', 'Buenos Aires', 'unsam.edu.ar'),
    ('ungs', 'Universidad Nacional de General Sarmiento', 'UNGS', 'universidad_nacional', 'Buenos Aires', 'ungs.edu.ar'),
    ('unl', 'Universidad Nacional del Litoral', 'UNL', 'universidad_nacional', 'Santa Fe', 'unl.edu.ar'),
    ('uncuyo', 'Universidad Nacional de Cuyo', 'UNCuyo', 'universidad_nacional', 'Mendoza', 'uncuyo.edu.ar'),
    ('unt', 'Universidad Nacional de Tucumán', 'UNT', 'universidad_nacional', 'Tucumán', 'unt.edu.ar'),
    ('uns', 'Universidad Nacional del Sur', 'UNS', 'universidad_nacional', 'Buenos Aires', 'uns.edu.ar'),
    ('unmdp', 'Universidad Nacional de Mar del Plata', 'UNMdP', 'universidad_nacional', 'Buenos Aires', 'mdp.edu.ar'),
    ('unla', 'Universidad Nacional de Lanús', 'UNLa', 'universidad_nacional', 'Buenos Aires', 'unla.edu.ar'),
    ('undav', 'Universidad Nacional de Avellaneda', 'UNDAV', 'universidad_nacional', 'Buenos Aires', 'undav.edu.ar'),
    ('unaj', 'Universidad Nacional Arturo Jauretche', 'UNAJ', 'universidad_nacional', 'Buenos Aires', 'unaj.edu.ar'),
    ('unlu', 'Universidad Nacional de Luján', 'UNLu', 'universidad_nacional', 'Buenos Aires', 'unlu.edu.ar'),
    ('unne', 'Universidad Nacional del Nordeste', 'UNNE', 'universidad_nacional', 'Corrientes', 'unne.edu.ar'),
    ('unsa', 'Universidad Nacional de Salta', 'UNSa', 'universidad_nacional', 'Salta', 'unsa.edu.ar'),
    ('uncoma', 'Universidad Nacional del Comahue', 'UNCo', 'universidad_nacional', 'Neuquén', 'uncoma.edu.ar'),
    ('untref', 'Universidad Nacional de Tres de Febrero', 'UNTREF', 'universidad_nacional', 'Buenos Aires', 'untref.edu.ar'),
    ('itba', 'Instituto Tecnológico de Buenos Aires', 'ITBA', 'universidad_privada', 'Ciudad Autónoma de Buenos Aires', 'itba.edu.ar'),
    ('uade', 'Universidad Argentina de la Empresa', 'UADE', 'universidad_privada', 'Ciudad Autónoma de Buenos Aires', 'uade.edu.ar'),
    ('uca', 'Pontificia Universidad Católica Argentina', 'UCA', 'universidad_privada', 'Ciudad Autónoma de Buenos Aires', 'uca.edu.ar'),
    ('austral', 'Universidad Austral', 'Austral', 'universidad_privada', 'Buenos Aires', 'austral.edu.ar'),
    ('udesa', 'Universidad de San Andrés', 'UdeSA', 'universidad_privada', 'Buenos Aires', 'udesa.edu.ar'),
    ('utdt', 'Universidad Torcuato Di Tella', 'UTDT', 'universidad_privada', 'Ciudad Autónoma de Buenos Aires', 'utdt.edu'),
    ('up', 'Universidad de Palermo', 'UP', 'universidad_privada', 'Ciudad Autónoma de Buenos Aires', 'palermo.edu')
),
inserted as (
  insert into public.institutions (slug, name, short_name, kind, province)
  select slug, name, short_name, kind::public.institution_kind, province
  from data
  returning id, slug
)
insert into public.institution_domains (domain, institution_id, campus_id, include_subdomains)
select d.domain, ins.id, null, true
from data d
join inserted ins on ins.slug = d.slug;
