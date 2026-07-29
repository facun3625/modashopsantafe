import Link from "next/link";

export default async function GraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-brand-ink">¡Pedido registrado!</h1>
      <p className="mt-2 text-brand-muted">
        Recibimos tu pedido{id && <> (n.º {id.slice(0, 8)})</>} y te vamos a contactar a la brevedad para
        coordinar el pago y la entrega.
      </p>

      <Link
        href="/tienda"
        className="mt-8 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
