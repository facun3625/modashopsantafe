import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slide = await prisma.heroSlide.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true, updatedAt: true },
  });

  if (!slide?.imageData || !slide.imageMime) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(slide.imageData), {
    headers: {
      "Content-Type": slide.imageMime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": slide.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
