import { useEffect, useState, useCallback } from "react";

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const beforeHandler = (e) => {
      try {
        e.preventDefault();
      } catch (err) {}
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      try {
        localStorage.setItem("pwa_installed", "true");
      } catch (err) {}
    };

    window.addEventListener("beforeinstallprompt", beforeHandler);
    window.addEventListener("appinstalled", installedHandler);

    // initial checks: localStorage or display-mode standalone
    try {
      const stored = localStorage.getItem("pwa_installed");
      if (stored === "true") {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } catch (err) {}

    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
        try {
          localStorage.setItem("pwa_installed", "true");
        } catch (err) {}
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } catch (err) {}

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        try {
          localStorage.setItem("pwa_installed", "true");
        } catch (err) {}
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
      return choice;
    } catch (err) {
      console.error("Install prompt failed:", err);
      return null;
    }
  }, [deferredPrompt]);

  const markInstalled = useCallback(() => {
    try {
      localStorage.setItem("pwa_installed", "true");
    } catch (err) {}
    setDeferredPrompt(null);
    setIsInstallable(false);
  }, []);

  return { deferredPrompt, isInstallable, promptInstall, markInstalled };
}
