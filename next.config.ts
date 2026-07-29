import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions (crear/editar hero slides, comprobantes de transferencia)
  // suben imágenes como multipart/form-data — el límite por defecto de 1MB
  // es demasiado chico para fotos reales. Nginx ya acepta hasta 50MB
  // (client_max_body_size), esto destraba el límite propio de Next.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
