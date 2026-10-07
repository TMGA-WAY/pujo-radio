(() => {
  const id = (window.PUJO_CONFIG.instagramId || "").trim().replace(/^@/, "");

  if (!id) {
    return;
  }

  const WIDTH = 55;
  const url   = `https://www.instagram.com/${id}/`;
  const full  = "#".repeat(WIDTH);

  const center = text => {
    const space = Math.max(4, WIDTH - text.length - 2);
    const left  = Math.floor(space / 2);

    return `${"#".repeat(left)} ${text} ${"#".repeat(space - left)}`;
  };

  const banner = [
    full,
    full,
    full,
    full,
    full,
    center(url),
    full,
    full,
    full,
    full,
    full
  ].join("\n");

  const block = [full, full, full, full, full].join("\n");
  const style = "font-family: monospace; color: #ffb627; font-weight: bold;";

  document.insertBefore(document.createComment(`\n${banner}\n\n${url}\n`), document.documentElement);

  console.log(`%c${block}`, style);
  console.log(url);
  console.log(`%c${block}`, style);
})();
