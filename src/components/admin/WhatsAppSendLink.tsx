"use client";

import { useTransition } from "react";
import { WhatsAppIcon } from "@/components/icons";

export function WhatsAppSendLink({ href, onSent, sent }: { href: string; onSent: () => Promise<void>; sent: boolean }) {
  const [pending, start] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => start(() => onSent())}
      title={sent ? "Volver a escribir por WhatsApp (se anota otra vez)" : "Escribir por WhatsApp (queda registrado)"}
      aria-busy={pending}
      className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
    >
      <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
      {sent ? "Reenviar" : "WhatsApp"}
    </a>
  );
}
