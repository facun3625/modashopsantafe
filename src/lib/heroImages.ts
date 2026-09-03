export function heroImageUrl(slide: {
  id: string;
  imageData: Uint8Array | null;
  imageUrl: string | null;
  updatedAt: Date;
}): string | null {
  if (slide.imageData) {
    return `/api/hero-images/${encodeURIComponent(slide.id)}?v=${slide.updatedAt.getTime()}`;
  }

  return slide.imageUrl;
}
