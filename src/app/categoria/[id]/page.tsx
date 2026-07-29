import { notFound } from "next/navigation";
import { ShopView } from "@/components/ShopView";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) notFound();

  const sp = await searchParams;
  return <ShopView categoryId={categoryId} searchParams={sp} />;
}
