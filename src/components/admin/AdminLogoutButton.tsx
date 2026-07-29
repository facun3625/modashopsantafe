"use client";

import { signOut } from "next-auth/react";
import { LogoutIcon } from "@/components/icons";

export function AdminLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <LogoutIcon className="h-4 w-4 shrink-0" />
      Cerrar sesión
    </button>
  );
}
