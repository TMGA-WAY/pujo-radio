(() => {
  const id = (window.PUJO_CONFIG.gaMeasurementId || "").trim();

  if (!/^G-[A-Z0-9]+$/.test(id)) {
    window.pujoTrack = () => {};
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag      = function gtag() { window.dataLayer.push(arguments); };

  window.gtag("js", new Date());
  window.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src   = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.pujoTrack = (name, params) => window.gtag("event", name, params);

  document.getElementById("gaNotice")?.removeAttribute("hidden");
})();
