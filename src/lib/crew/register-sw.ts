let crewSwInit = false;

export function registerCrewServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (crewSwInit) return;
  crewSwInit = true;

  const register = () => {
    navigator.serviceWorker
      .register("/crew-sw.js", { scope: "/crew/" })
      .catch(() => {});
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }

  window.addEventListener("online", () => {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage("replay-queue");
    });
  });
}
