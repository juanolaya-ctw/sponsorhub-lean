import { EventSidebar } from "@/components/admin/EventSidebar";
import { getEventoBySlug } from "@/lib/admin/eventos";

export default async function EventoLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ evento: string }>;
}>) {
  const { evento: slug } = await params;
  const { evento } = await getEventoBySlug(slug);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <EventSidebar slug={evento.slug} nombre={evento.nombre} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
