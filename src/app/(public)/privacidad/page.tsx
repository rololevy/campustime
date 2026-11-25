import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos guarda ${siteConfig.name}, para qué los usa y cómo ejercer tus derechos.`,
};

const PENDING = "(a completar antes de publicar)";

export default function PrivacyPage() {
  const controller = siteConfig.dataController || PENDING;
  const contact = siteConfig.contactEmail;

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">Versión {siteConfig.privacyPolicyVersion}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Política de privacidad</h1>
        <p className="mt-4 text-lg text-muted">
          Esta versión cubre la lista de espera previa al lanzamiento. Cuando abra la plataforma la vamos a
          ampliar y te vamos a avisar antes de que cambie.
        </p>
      </header>

      <div className="mt-10 space-y-10 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-3 [&_p]:text-muted [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted">
        <section>
          <h2>Quién es responsable de tus datos</h2>
          <p>
            Responsable de la base de datos: <strong className="text-foreground">{controller}</strong>.
            {" "}Contacto:{" "}
            {contact ? (
              <a href={`mailto:${contact}`} className="font-medium text-primary underline underline-offset-2">
                {contact}
              </a>
            ) : (
              <strong className="text-foreground">{PENDING}</strong>
            )}
            .
          </p>
        </section>

        <section>
          <h2>Qué datos guardamos</h2>
          <ul>
            <li>Tu email.</li>
            <li>La universidad, la sede y el rol que nos indiques (estudiante, docente o nodocente).</li>
            <li>Lo que contaste que podés enseñar y que querés aprender.</li>
            <li>La institución y la sede que detectamos a partir del dominio de tu email, si está registrado.</li>
            <li>La fecha en que te anotaste y la versión de esta política que aceptaste.</li>
          </ul>
          <p>No pedimos DNI, teléfono, domicilio ni contraseñas.</p>
        </section>

        <section>
          <h2>Para qué los usamos</h2>
          <ul>
            <li>Avisarte cuando abramos en tu universidad o sede.</li>
            <li>Planificar la apertura por oleadas, según dónde haya más gente anotada.</li>
            <li>Armar el catálogo inicial de materias y habilidades. Para esto usamos datos agregados, sin identificarte.</li>
          </ul>
          <p>No vendemos tus datos, no los cedemos a terceros para publicidad y no te vamos a mandar spam.</p>
        </section>

        <section>
          <h2>Con qué base legal</h2>
          <p>
            Con tu consentimiento, que nos das al anotarte, conforme a la Ley 25.326 de Protección de los Datos
            Personales. Podés retirarlo en cualquier momento pidiendo la baja.
          </p>
        </section>

        <section>
          <h2>Dónde se guardan y quiénes nos ayudan a procesarlos</h2>
          <ul>
            <li>
              <strong className="text-foreground">Supabase</strong>: base de datos, con servidores en São Paulo,
              Brasil.
            </li>
            <li>
              <strong className="text-foreground">Vercel</strong>: alojamiento del sitio web, con infraestructura
              en distintos países, incluido Estados Unidos.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare</strong>: verificación anti-bots del formulario
              (Turnstile).
            </li>
          </ul>
          <p>
            Al anotarte aceptás que tus datos se alojen en servidores fuera de la Argentina, con proveedores que
            aplican medidas de seguridad técnicas y organizativas. Usamos estos servicios solo para operar{" "}
            {siteConfig.name}.
          </p>
        </section>

        <section>
          <h2>Cuánto tiempo los conservamos</h2>
          <p>
            Hasta que abramos en tu universidad y, como máximo, doce meses después. Si pedís la baja antes, los
            borramos.
          </p>
        </section>

        <section>
          <h2>Cómo los protegemos</h2>
          <p>
            Toda la comunicación viaja cifrada (HTTPS). La lista de espera no es accesible desde el navegador:
            solo la lee el servidor de {siteConfig.name}, con acceso restringido.
          </p>
        </section>

        <section>
          <h2>Tus derechos</h2>
          <p>
            Podés pedir acceso a tus datos, que los corrijamos, los actualicemos o los borremos escribiendo al
            contacto indicado arriba. Respondemos los pedidos de acceso dentro de los 10 días corridos y los de
            rectificación o supresión dentro de los 5 días hábiles, como establece la ley.
          </p>
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm">
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en
            forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al
            efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO
            A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la
            atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus
            derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
          </p>
        </section>

        <section>
          <h2>Cambios en esta política</h2>
          <p>
            Si la cambiamos, publicamos la nueva versión en esta página con su fecha y te avisamos por email
            antes de que rija.
          </p>
        </section>
      </div>
    </article>
  );
}
