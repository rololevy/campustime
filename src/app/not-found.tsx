import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="mt-4 text-muted">Puede que el link esté mal escrito o que la página ya no exista.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
