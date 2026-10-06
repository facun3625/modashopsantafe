// Enlaces de video de los slides de portada: un LINK a un archivo de video (.mp4 / .webm), o de Google Drive o Dropbox
// (se convierten al enlace de descarga directa). No se aceptan reproductores de YouTube/Vimeo: la portada reproduce el
// archivo en silencio y en bucle.

export type VideoCheck = { url: string; warning?: string } | { error: string };

const DRIVE_FILE = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/;
const DRIVE_ID = /^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]{10,})/;
const SAFE = /^https:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%\[\]]+$/;

export function checkVideoUrl(raw: string): VideoCheck {
  const input = (raw ?? "").trim();
  if (!input) return { error: "Pegá el enlace del video" };
  if (!input.startsWith("https://")) return { error: "El enlace tiene que empezar con https://" };
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(input)) {
    return { error: "YouTube y Vimeo no se pueden usar acá: usá el enlace a un archivo de video (.mp4 o .webm)." };
  }
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders|docs\.google\.com|photos\.app\.goo\.gl|photos\.google\.com|1drv\.ms|onedrive\.live\.com|wetransfer\.com|we\.tl/i.test(input)) {
    return { error: "Ese enlace abre una página o una carpeta, no el archivo del video. Usá el enlace directo al archivo." };
  }

  const drive = input.match(DRIVE_FILE) ?? input.match(DRIVE_ID);
  if (drive) {
    return {
      url: `https://drive.google.com/uc?export=download&id=${drive[1]}`,
      warning: "Google Drive limita los archivos grandes y la cantidad de descargas: si el video no se ve, usá un enlace directo.",
    };
  }
  if (/^https:\/\/(www\.)?dropbox\.com\//i.test(input)) {
    const u = new URL(input);
    u.hostname = "dl.dropboxusercontent.com";
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return { url: u.toString(), warning: "Dropbox limita el tráfico de los archivos muy vistos: para una portada con mucha visita conviene otro hosting." };
  }
  if (!SAFE.test(input)) return { error: "El enlace tiene caracteres que no se pueden usar" };
  return { url: input };
}

// Versión para guardar/mostrar: el enlace normalizado o vacío si no es válido
export function normalizeVideoUrl(raw: string): string {
  const r = checkVideoUrl(raw);
  return "url" in r ? r.url : "";
}
