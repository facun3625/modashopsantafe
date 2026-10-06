"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModalProvider } from "@/lib/authModal";
import { AuthModal } from "@/components/AuthModal";
import { FavoritesProvider } from "@/lib/favorites";

export function Providers({ children, cartAutoCloseSeconds }: { children: React.ReactNode; cartAutoCloseSeconds: number }) {
  return (
    <SessionProvider>
      <FavoritesProvider>
        <CartProvider autoCloseSeconds={cartAutoCloseSeconds}>
          <AuthModalProvider>
            {children}
            <CartDrawer />
            <AuthModal />
          </AuthModalProvider>
        </CartProvider>
      </FavoritesProvider>
    </SessionProvider>
  );
}
