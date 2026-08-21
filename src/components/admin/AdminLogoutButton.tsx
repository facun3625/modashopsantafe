"use client";

import { signOut } from "next-auth/react";
import { LogoutIcon } from "@/components/icons";

export function AdminLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
      Cerrar sesión
    </button>
  );
}
