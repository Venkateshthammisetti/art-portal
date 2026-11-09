// "Install the app" support. Android/Chrome fire `beforeinstallprompt` once,
// often before React has drawn anything, so it is caught here at startup (this
// file is imported in src/index.js) and kept for the parent's Install button.
// iPhone/iPad have no such event: the app shows Add to Home Screen steps instead.
import { useEffect, useState } from "react";

let deferred = null;
let installedNow = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own Install button instead of Chrome's bar
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true);

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");
export const isIOS = () => /iPhone|iPad|iPod/i.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
// Instagram / Facebook in-app browsers can't add to the Home Screen
export const isInAppBrowser = () => /FBAN|FBAV|Instagram|Line\//i.test(ua());

export const useInstallApp = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const installed = installedNow || isStandalone();
  const ios = isIOS();
  return {
    installed,
    ios,
    inAppBrowser: isInAppBrowser(),
    canPrompt: !installed && !!deferred,
    // something useful to offer: Chrome's prompt, or the iPhone steps
    available: !installed && (!!deferred || ios),
    promptInstall: async () => {
      if (!deferred) return "unavailable";
      const e = deferred;
      deferred = null; // a prompt can only be used once
      notify();
      e.prompt();
      const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (choice?.outcome === "accepted") { installedNow = true; notify(); }
      return choice?.outcome || "dismissed";
    },
  };
};
