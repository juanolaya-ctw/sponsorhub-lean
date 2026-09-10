import Link from "next/link";
import { CrearEventoForm } from "./crear-evento-form";

export default async function CrearEventoPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin/selector-evento"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Eventos
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Nuevo evento</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crea un workspace para gestionar sponsors, compromisos y catálogo.
      </p>
      <CrearEventoForm />
    </main>
  );
}
