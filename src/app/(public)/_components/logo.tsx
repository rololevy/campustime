import { siteConfig } from "@/config/site";

/** Reloj de arena: el tiempo como moneda de intercambio. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M10.5 8h11M10.5 24h11M12 8c0 4.2 4 5.6 4 8s-4 3.8-4 8M20 8c0 4.2-4 5.6-4 8s4 3.8 4 8"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.6 21.6h4.8L16 19.4z" className="fill-accent" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
    </span>
  );
}
