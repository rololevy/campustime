import Link from "next/link";

import { Logo } from "./logo";

const NAV = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#universidades", label: "Universidades" },
  { href: "/#preguntas", label: "Preguntas" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/#sumate"
          className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sumate a la beta
        </Link>
      </div>
    </header>
  );
}
