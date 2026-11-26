import Link from "next/link";

import { siteConfig } from "@/config/site";

import { WaitlistForm } from "./_components/waitlist-form";

const primaryButton =
  "inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 font-semibold transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Principles />
      <Universities />
      <Join />
      <Faq />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-primary-soft to-transparent"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24 lg:pb-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-muted">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            Beta en la UTN · Abierto a todas las universidades
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Enseñá lo que sabés. Aprendé lo que te falta.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted">
            {siteConfig.name} es un banco de tiempo para la comunidad universitaria: cada hora que enseñás se convierte en
            un crédito para aprender de otra persona. Sin plata de por medio.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="#sumate" className={primaryButton}>
              Quiero sumarme
            </Link>
            <Link href="#como-funciona" className={secondaryButton}>
              Cómo funciona
            </Link>
          </div>
        </div>
        <SessionPreview />
      </div>
    </section>
  );
}

function SessionPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-md">
      <figcaption className="sr-only">
        Ejemplo ilustrativo: Lucía le enseña una hora de Análisis Matemático I a Tomás y gana un crédito.
      </figcaption>
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent-soft blur-2xl" />
      <div aria-hidden="true" className="rounded-3xl border border-border bg-background p-5 shadow-xl shadow-primary/5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted">Sesión</span>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            Confirmada por ambos
          </span>
        </div>
        <p className="mt-4 text-xl font-semibold">Análisis Matemático I</p>
        <p className="mt-1 text-sm text-muted">Martes 18:00 · 1 hora · Videollamada</p>

        <ul className="mt-5 space-y-3">
          <PersonRow initials="LG" name="Lucía" role="Enseña" delta="+1 crédito" gain />
          <PersonRow initials="TM" name="Tomás" role="Aprende" delta="−1 crédito" />
        </ul>

        <div className="mt-5 rounded-2xl bg-surface p-4 text-sm">
          <p className="font-semibold">Match recíproco</p>
          <p className="mt-1 text-muted">Tomás enseña inglés. La semana que viene Lucía aprende con él.</p>
        </div>
      </div>
    </figure>
  );
}

function PersonRow({
  initials,
  name,
  role,
  delta,
  gain = false,
}: {
  initials: string;
  name: string;
  role: string;
  delta: string;
  gain?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
      <span className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-full text-sm font-semibold ${
            gain ? "bg-primary text-primary-foreground" : "bg-surface-strong"
          }`}
        >
          {initials}
        </span>
        <span>
          <span className="block font-medium">{name}</span>
          <span className="block text-sm text-muted">{role}</span>
        </span>
      </span>
      <span className={`text-sm font-semibold ${gain ? "text-success" : "text-muted"}`}>{delta}</span>
    </li>
  );
}

const STEPS = [
  {
    title: "Acreditate",
    body: "Entrás con Google o con un código por email, y confirmás con tu mail institucional que sos parte de la universidad.",
  },
  {
    title: "Publicá qué sabés y qué buscás",
    body: "Materias, idiomas, programación, música: lo que puedas enseñar y lo que quieras aprender. Te sugerimos con quién hacer match.",
  },
  {
    title: "Coordiná la videollamada",
    body: "Pedí una sesión en los horarios de la otra persona. Cuando la acepta, comparte el link de Meet (o la que prefieran) y arreglan los detalles por el chat.",
  },
  {
    title: "Confirmá y sumá",
    body: "Al terminar, confirman que la sesión se hizo y recién ahí el crédito pasa de una cuenta a la otra. Después se califican.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="Una hora enseñada, una hora para aprender"
          description="El crédito es el tiempo: no importa la materia ni el nivel. Así circula la ayuda dentro de la comunidad."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-background p-6">
              <span className="grid size-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    title: "Tu tiempo es la moneda",
    body: "Una hora enseñada vale un crédito, sea Álgebra o guitarra. Nadie cobra ni paga con plata.",
  },
  {
    title: "Nadie queda afuera",
    body: "Arrancás con créditos de bienvenida, y cualquiera puede donar los suyos a quien todavía no tiene algo para ofrecer.",
  },
  {
    title: "Comunidad verificada",
    body: "Solo participan personas acreditadas con el mail de su universidad. Hay reseñas, reportes y moderación.",
  },
  {
    title: "Siempre por videollamada",
    body: "Aprendé con gente de otras facultades y universidades del país sin moverte, y sin encontrarte en persona con alguien que no conocés.",
  },
];

function Principles() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Por qué créditos de tiempo"
        title="Aprender en red, sin que el dinero sea una barrera"
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border p-6">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-2 text-muted">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 rounded-2xl bg-accent-soft px-5 py-4 text-sm">
        <strong className="font-semibold">Se enseña, no se hace la tarea por otro.</strong> {siteConfig.name} es para
        explicar y acompañar: pedir TPs o exámenes resueltos va contra las normas y se modera.
      </p>
    </section>
  );
}

function Universities() {
  return (
    <section id="universidades" className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <SectionHeading
          eyebrow="Universidades"
          title="Empieza en la UTN, abierto a todo el país"
          description="La beta arranca en una facultad regional de la UTN y se abre sede por sede, para que cada comunidad empiece con gente suficiente para enseñar y aprender."
        />
        <ul className="space-y-4">
          <li className="rounded-2xl border border-border bg-background p-6">
            <h3 className="font-semibold">Cualquier universidad puede sumarse</h3>
            <p className="mt-2 text-muted">
              Alcanza con registrar sus dominios de email, también los propios de cada sede o facultad.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-background p-6">
            <h3 className="font-semibold">Gratis y de código abierto</h3>
            <p className="mt-2 text-muted">
              El código es público (AGPL-3.0): cualquier institución puede auditarlo, mejorarlo o proponer
              cambios.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Join() {
  return (
    <section id="sumate" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Lista de espera"
        title="Sumate antes del lanzamiento"
        description="Anotate y contanos qué podés enseñar y qué querés aprender. Con eso armamos el catálogo inicial y decidimos qué sedes abrir primero."
        align="center"
      />
      <div className="mt-10">
        <WaitlistForm />
      </div>
    </section>
  );
}

const FAQ = [
  {
    question: "¿Cuesta algo?",
    answer: `No. ${siteConfig.name} es gratis y no hay pagos entre personas: el intercambio es solo con créditos de tiempo.`,
  },
  {
    question: "¿Y si todavía no tengo nada para enseñar?",
    answer:
      "Casi todo el mundo sabe algo que a otra persona le sirve. Igual, arrancás con créditos de bienvenida y podés recibir donaciones de la comunidad.",
  },
  {
    question: "Mi universidad no aparece, ¿puedo anotarme?",
    answer:
      "Sí. Anotate con el nombre de tu universidad y la sumamos registrando sus dominios de email. Si además quiere participar de forma oficial, puede tener sus propios moderadores.",
  },
  {
    question: "¿Las sesiones son presenciales o virtuales?",
    answer:
      "Virtuales, por Meet o la videollamada que prefieran. Así podés aprender con gente de cualquier sede o universidad, y nadie tiene que encontrarse en persona con alguien que no conoce.",
  },
  {
    question: "¿Cuándo recibo el crédito por enseñar?",
    answer:
      "Cuando la sesión termina y se confirma que se hizo. Al pedir la sesión, el crédito de quien aprende queda reservado; si confirma, pasa a tu cuenta. Si confirmás vos y la otra persona no objeta en 72 horas, también. Si la sesión no se hace, la reserva vuelve a quien la pidió.",
  },
  {
    question: "¿Cuándo arranca?",
    answer:
      "La beta está planeada para el primer cuatrimestre de 2027. Si te anotás, te avisamos cuando abramos en tu sede.",
  },
  {
    question: "¿Qué hacen con mis datos?",
    answer:
      "Solo usamos lo necesario para avisarte del lanzamiento y planificar la apertura. No los vendemos ni los usamos para publicidad.",
    link: { href: "/privacidad", label: "Leé la política de privacidad" },
  },
];

function Faq() {
  return (
    <section id="preguntas" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que más nos preguntan" align="center" />
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-background">
          {FAQ.map((item) => (
            <details key={item.question} className="group p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-strong text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-muted">
                {item.answer}{" "}
                {item.link ? (
                  <Link href={item.link.href} className="font-medium text-primary underline underline-offset-2">
                    {item.link.label}
                  </Link>
                ) : null}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "start" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-lg text-pretty text-muted">{description}</p> : null}
    </div>
  );
}
