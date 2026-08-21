import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";

// Manual de uso del panel de administración — HTML autocontenido (con las
// capturas embebidas en base64) generado aparte, no una página React común.
// Vive fuera de /public a propósito: si estuviera ahí, cualquiera con el
// link directo al archivo lo vería sin pasar por el chequeo de admin de acá
// abajo.
const MANUAL_PATH = path.join(process.cwd(), "src", "content", "moda-manual.html");

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const html = await readFile(MANUAL_PATH, "utf-8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
