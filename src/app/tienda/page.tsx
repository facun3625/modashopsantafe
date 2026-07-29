import { ShopView } from "@/components/ShopView";

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  return <ShopView searchParams={sp} />;
}
