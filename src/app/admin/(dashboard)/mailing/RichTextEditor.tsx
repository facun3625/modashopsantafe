"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BoldIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, LinkIcon, ImageIcon } from "@/components/icons";
import { uploadMailImage } from "./actions";

// Editor mínimo con document.execCommand — no es lo más moderno (está
// "deprecado" hace años sin que el browser haya sacado nada que lo
// reemplace del todo para un caso simple como este), pero para negrita,
// alineación, tamaño, link e imagen alcanza de sobra sin sumar una
// librería de edición completa solo para el cuerpo del mailing.
const SIZES: Record<string, string> = {
  normal: "3",
  grande: "5",
  titulo: "6",
};

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown + preventDefault: si fuera onClick, el editor pierde el
      // foco/la selección de texto ANTES de que corra execCommand, y el
      // comando se aplica sobre nada.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-black/5 hover:text-brand-ink"
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  name,
  initialValue,
  onChange,
  placeholder,
}: {
  name: string;
  initialValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(!initialValue);

  // Sincroniza el <input hidden> con un addEventListener nativo (no el
  // onInput sintético de React) puesto DIRECTO en el contentEditable, y
  // escribe el .value a mano — no vía el prop `value` de React. Esto
  // importa por el orden de despacho del evento: el listener nativo de acá
  // corre ANTES de que el evento llegue al <form> (que está más arriba en
  // el árbol), así que cuando useFormDirty (otro listener nativo, puesto en
  // el form) lee el FormData para ver si "cambió algo", el hidden input ya
  // tiene el HTML nuevo. Si sincronizara el valor por estado de React
  // (value={html}), el re-render llega recién en el próximo tick — después
  // de que useFormDirty ya sacó la foto — y el primer tipeo no se detecta.
  useEffect(() => {
    const el = editorRef.current;
    const hidden = hiddenInputRef.current;
    if (!el || !hidden) return;

    if (initialValue) el.innerHTML = initialValue;

    function sync() {
      const next = el!.innerHTML;
      hidden!.value = next;
      setEmpty(el!.textContent?.trim() === "" && !el!.querySelector("img"));
      onChangeRef.current(next);
    }

    el.addEventListener("input", sync);
    return () => el.removeEventListener("input", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, value?: string) {
    const el = editorRef.current;
    el?.focus();
    document.execCommand(command, false, value);
    // execCommand no siempre dispara "input" solo (varía por browser/comando
    // como insertImage) — se dispara a mano para no depender de eso.
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleLink() {
    const url = window.prompt("Link (con https://)");
    if (!url) return;
    exec("createLink", url);
  }

  function handleSize(e: ChangeEvent<HTMLSelectElement>) {
    const size = SIZES[e.target.value];
    if (size) exec("fontSize", size);
    e.target.value = "";
  }

  async function handleImageFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.set("image", file);
      const result = await uploadMailImage(formData);
      if (result.ok) {
        exec("insertImage", result.url);
      } else {
        setUploadError(result.error);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 focus-within:border-brand-pink">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 bg-brand-soft/40 px-2 py-1.5">
        <ToolbarButton label="Negrita" onClick={() => exec("bold")}>
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Alinear a la izquierda" onClick={() => exec("justifyLeft")}>
          <AlignLeftIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Centrar" onClick={() => exec("justifyCenter")}>
          <AlignCenterIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Alinear a la derecha" onClick={() => exec("justifyRight")}>
          <AlignRightIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={handleSize}
          defaultValue=""
          aria-label="Tamaño de texto"
          className="h-8 cursor-pointer rounded-md border-0 bg-transparent px-1.5 text-xs text-brand-muted hover:bg-black/5 focus:outline-none"
        >
          <option value="" disabled>
            Tamaño
          </option>
          <option value="normal">Normal</option>
          <option value="grande">Grande</option>
          <option value="titulo">Título</option>
        </select>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Insertar link" onClick={handleLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Insertar imagen" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        {uploading && <span className="ml-1 text-xs text-brand-muted">Subiendo...</span>}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      </div>

      <div className="relative">
        {empty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-3 text-sm text-brand-ink/40">{placeholder}</p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[180px] px-3 py-2.5 text-sm text-brand-ink focus:outline-none [&_a]:text-brand-pink-dark [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg"
        />
      </div>

      {uploadError && <p className="border-t border-black/5 px-3 py-2 text-xs text-red-600">{uploadError}</p>}

      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialValue ?? ""} />
    </div>
  );
}
