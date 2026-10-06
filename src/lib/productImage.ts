// URLs de las fotos de productos. Antes las fotos viajaban incrustadas en el HTML (base64), lo que hacía pesar cada
// página de la tienda ~1-2 MB y no dejaba que el navegador las guardara. Ahora cada foto se pide aparte a
// /api/product-image/[id], que la trae de Odoo una vez y la sirve con caché. Sin dependencias de servidor: se usa
// también desde el navegador.
export type ImageSize = 128 | 512 | 1024 | 1920;

// `version` (la fecha de última modificación del producto en Odoo) cambia la URL cuando cambia la foto, así el
// navegador puede guardarla mucho tiempo sin mostrar una vieja.
export function productImageUrl(id: number, size: ImageSize, version?: string | null): string {
  return `/api/product-image/${id}?s=${size}${version ? `&v=${encodeURIComponent(version)}` : ""}`;
}

// Para mostrar una imagen que puede venir como URL (lo nuevo) o como base64 (carritos guardados en el navegador antes
// de este cambio).
export function imageSrc(value: string | false | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("http") || value.startsWith("data:")) return value;
  return `data:image/png;base64,${value}`;
}
