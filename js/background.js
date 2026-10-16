(() => {
  const config  = window.PUJO_CONFIG;
  const stage   = document.querySelector(".stage");
  const strip   = document.getElementById("scenes");
  const dotsBox = document.getElementById("sceneDots");
  const sources = config.backgroundImages;
  const COPIES  = 3;
  const FOCUS_X = 0.66;
  const IDLE_MS = 10000;

  const images = [];

  for (let copy = 0; copy < COPIES; copy++) {
    sources.forEach((src, i) => {
      const img = new Image(1672, 941);

      img.className = "stage__scene";
      img.alt       = "";
      img.decoding  = "async";
      if (i > 0) {
        img.fetchPriority = "low";
      }
      img.src = src;
      strip.appendChild(img);
      images.push(img);
    });
  }

  const ICONS = {
    pin: "M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12zm0-9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
  };

  const tags = images.flatMap((img, n) => {
    const tag   = (config.sceneTags || [])[n % sources.length];
    const scene = n % sources.length;

    const main = Math.floor(n / sources.length) === 1;

    if (!tag || !config.pandalGuideUrl || (tag.onScreen && !main)) {
      return [];
    }

    const link  = document.createElement("a");
    const icon  = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path  = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const label = document.createElement("span");

    link.className = `scene-tag scene-tag--${tag.icon}${tag.onScreen ? " scene-tag--screen" : ""}`;
    link.href      = config.pandalGuideUrl;
    link.target    = "_blank";
    link.rel       = "noopener noreferrer";
    if (!main) {
      link.tabIndex = -1;
      link.setAttribute("aria-hidden", "true");
    }

    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    path.setAttribute("d", ICONS[tag.icon]);
    icon.appendChild(path);
    label.textContent = tag.text;
    link.append(icon, label);
    link.addEventListener("click", () => window.pujoTrack("pandal_click", { scene: scene + 1 }));

    if (tag.onScreen) {
      link.style.top = `${tag.y * 100}%`;
      stage.appendChild(link);
      return [];
    }

    strip.appendChild(link);
    return [{ link, img, tag }];
  });

  function placeTags() {
    tags.forEach(({ link, img, tag }) => {
      link.style.left = `${img.offsetLeft + img.offsetWidth * tag.x}px`;
      link.style.top  = `${tag.y * 100}%`;
    });
  }

  const dots = sources.map((_, i) => {
    const dot = document.createElement("button");

    dot.className = "scene-dot";
    dot.setAttribute("aria-label", `Scene ${i + 1}`);
    dot.addEventListener("click", () => {
      goToScene(i);
      returnLater();
    });
    dotsBox.appendChild(dot);
    return dot;
  });

  let offset    = null;
  let lastX     = 0;
  let dragging  = false;
  let idleTimer = null;

  function loopWidth() {
    return images[sources.length].offsetLeft - images[0].offsetLeft;
  }

  function middleImage(i) {
    return images[sources.length + i];
  }

  function sceneOffset(i) {
    const img    = middleImage(i);
    const view   = stage.clientWidth;
    const blend  = -parseFloat(getComputedStyle(images[1] ?? img).marginLeft) || 0;
    const left   = img.offsetLeft + blend;
    const right  = img.offsetLeft + img.offsetWidth - blend - view;
    const centre = img.offsetLeft + img.offsetWidth * (i === 0 ? FOCUS_X : 0.5) - view / 2;

    if (right < left) {
      return (left + right) / 2;
    }
    return Math.min(right, Math.max(left, centre));
  }

  function wrap(value) {
    const loop = loopWidth();

    if (loop <= 0) {
      return value;
    }
    while (value < loop) {
      value += loop;
    }
    while (value >= loop * 2) {
      value -= loop;
    }
    return value;
  }

  function show(value, animate) {
    offset = value;
    strip.classList.toggle("is-animating", Boolean(animate));
    strip.style.transform = `translate(${-offset}px, -50%)`;
    markActiveDot();
  }

  function goToScene(i) {
    const loop   = loopWidth();
    const target = sceneOffset(i);
    const near   = [target - loop, target, target + loop]
            .reduce((best, x) => (Math.abs(x - offset) < Math.abs(best - offset) ? x : best));

    show(near, true);
  }

  function shownOffset() {
    return -new DOMMatrix(getComputedStyle(strip).transform).m41;
  }

  function returnLater() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => goToScene(0), IDLE_MS);
  }

  function markActiveDot() {
    const middle = offset + stage.clientWidth / 2;
    let active   = 0;

    images.forEach((img, i) => {
      if (img.offsetLeft <= middle) {
        active = i % sources.length;
      }
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === active);
      dot.setAttribute("aria-pressed", i === active);
    });
  }

  function refresh() {
    placeTags();
    stage.classList.add("is-pannable");
    dotsBox.hidden = sources.length < 2;
    show(offset === null ? sceneOffset(0) : wrap(offset), false);
  }

  strip.addEventListener("transitionend", () => show(wrap(offset), false));

  stage.addEventListener("pointerdown", e => {
    if (!stage.classList.contains("is-pannable") || e.target.closest(".card, button, input, a")) {
      return;
    }
    clearTimeout(idleTimer);
    dragging = true;
    lastX    = e.clientX;
    show(wrap(shownOffset()), false);
    stage.classList.add("is-panning");
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove", e => {
    if (!dragging) {
      return;
    }
    show(wrap(offset - (e.clientX - lastX)), false);
    lastX = e.clientX;
  });

  const stop = () => {
    if (dragging) {
      returnLater();
    }
    dragging = false;
    stage.classList.remove("is-panning");
  };

  stage.addEventListener("pointerup", stop);
  stage.addEventListener("pointercancel", stop);

  images.forEach(img => img.addEventListener("load", refresh));
  window.addEventListener("resize", refresh);
  refresh();
})();
