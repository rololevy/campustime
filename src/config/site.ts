/**
 * Datos del sitio. Todos los textos de la interfaz toman el nombre de acá, así
 * que cambiarlo es tocar una sola línea.
 *
 * Antes de publicar, completá `dataController` y `contactEmail`: la política de
 * privacidad los muestra y la Ley 25.326 exige identificar al responsable.
 */
export const siteConfig = {
  name: "CampusTime",
  tagline: "Banco de tiempo universitario",
  description:
    "Enseñá lo que sabés y aprendé lo que te falta. Por cada hora que enseñás ganás un crédito para aprender de otra persona de la comunidad universitaria. Sin dinero de por medio.",
  // `||` y no `??`: un build arg de Docker sin valor llega como texto vacío.
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "es_AR",
  /** Responsable de la base de datos (nombre y apellido o razón social). */
  dataController: "Orlando Aguilera",
  /** Email para consultas y para ejercer los derechos de acceso, rectificación y supresión. */
  contactEmail: "orlando.aguilera@alumnos.frgp.utn.edu.ar",
  /** Repositorio público (AGPL-3.0). */
  repositoryUrl: "https://github.com/rololevy/campustime",
  /** Versión vigente de la política de privacidad; se guarda con cada consentimiento. */
  privacyPolicyVersion: "2026-11-24",
} as const;
