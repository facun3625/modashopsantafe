"use client";

import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { DownloadIcon, ShareIcon } from "@/components/icons";

// La Push API pide la VAPID public key como ArrayBuffer — conversión
// estándar del formato base64url en que se guarda/expone.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer;
}

async function subscribeToPush(vapidPublicKey: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  }).catch(() => {});
}

// Chrome/Firefox/Edge en iOS corren sobre WebKit pero no pueden instalar —
// esa capacidad no existe fuera de Safari en iOS.
function detectIOS() {
  if (typeof navigator === "undefined") return { isIOS: false, isIOSNonSafari: false };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIOSNonSafari = /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
  return { isIOS, isIOSNonSafari };
}

export function InstallPwaButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSNonSafari, setIsIOSNonSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js", { scope: "/" }).catch(console.error);
    const frame = window.requestAnimationFrame(() => {
      const ios = detectIOS();
      setIsIOS(ios.isIOS);
      setIsIOSNonSafari(ios.isIOSNonSafari);
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function handleClick() {
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }
    await promptInstall();
    const response = await fetch("/api/push/public-key", { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const result = await response.json() as { publicKey?: string };
      if (result.publicKey) await subscribeToPush(result.publicKey);
    }
  }

  const showButton = !isStandalone && (canInstall || isIOS);
  if (!showButton) return null;

  return (
    <div className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={handleClick}
        className="flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
      >
        <DownloadIcon className="h-4 w-4 shrink-0" />
        Descargar Web App
      </button>

      {showIOSHelp && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-4 text-left text-sm text-brand-ink shadow-lg sm:left-1/2 sm:-translate-x-1/2">
          {isIOSNonSafari ? (
            <p>Abrí este sitio en Safari para poder instalarlo — desde Chrome/Firefox en iOS no se puede.</p>
          ) : (
            <p className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                Tocá <ShareIcon className="h-4 w-4 shrink-0" /> (Compartir) abajo,
              </span>
              <span>y después &ldquo;Agregar a inicio&rdquo;.</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowIOSHelp(false)}
            className="mt-3 cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
