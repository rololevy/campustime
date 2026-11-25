import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
