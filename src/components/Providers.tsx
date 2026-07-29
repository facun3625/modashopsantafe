"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModalProvider } from "@/lib/authModal";
import { AuthModal } from "@/components/AuthModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <AuthModalProvider>
          {children}
          <CartDrawer />
          <AuthModal />
        </AuthModalProvider>
      </CartProvider>
    </SessionProvider>
  );
}
