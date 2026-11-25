import Link from "next/link";

import { siteConfig } from "@/config/site";

import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted">
            {siteConfig.tagline}. Un proyecto de código abierto para que la comunidad universitaria argentina
            aprenda en red.
          </p>
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
          <Link href="/privacidad" className="hover:text-foreground">
            Política de privacidad
          </Link>
          {siteConfig.repositoryUrl ? (
            <a href={siteConfig.repositoryUrl} className="hover:text-foreground" rel="noopener noreferrer">
              Código fuente (AGPL-3.0)
            </a>
          ) : (
            <span>Código abierto · AGPL-3.0</span>
          )}
          {siteConfig.contactEmail ? (
            <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-foreground">
              Contacto
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
