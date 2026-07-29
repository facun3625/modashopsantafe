import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Chequeo optimista (lee el rol desde el JWT de la cookie, sin ir a la DB)
// para proteger /admin. `middleware.ts` fue renombrado a `proxy.ts` en esta
// versión de Next.js. No hay login propio del panel: se usa el mismo login
// del sitio (AuthModal); si esa cuenta no es admin, se manda al home.
export default auth((req) => {
  const isAdmin = req.auth?.user?.role === "admin";

  if (!isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
