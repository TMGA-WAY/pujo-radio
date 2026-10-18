(() => {
  const config            = window.PUJO_CONFIG;
  const STORAGE_KEY       = "pujo-radio";
  const REPEAT_NEXT       = { all: "one", one: "off", off: "all" };
  const TITLE_MAX_LETTERS = 25;
  const FLIP_MS           = 300;
  const MAX_RESULTS       = 50;
  const TITLE_BATCH       = 8;
  const CUSTOM_ON_TEXT    = "Custom playlist is activated";

  const el = id => document.getElementById(id);

  const ui = {
    tabs:              el("tabs"),
    cover:             el("cover"),
    title:             el("songTitle"),
    status:            el("songStatus"),
    playBtn:           el("playBtn"),
    playIcon:          el("playIcon"),
    pauseIcon:         el("pauseIcon"),
    prevBtn:           el("prevBtn"),
    nextBtn:           el("nextBtn"),
    shuffleBtn:        el("shuffleBtn"),
    repeatBtn:         el("repeatBtn"),
    repeatOne:         el("repeatOne"),
    seek:              el("seek"),
    timeNow:           el("timeNow"),
    timeEnd:           el("timeEnd"),
    volume:            el("volume"),
    shareBtn:          el("shareBtn"),
    card:              el("card"),
    modeBtn:           el("mahalayaBtn"),
    modeTitle:         el("mahalayaTitle"),
    searchBtn:         el("searchBtn"),
    searchPanel:       el("searchPanel"),
    searchInput:       el("searchInput"),
    searchClose:       el("searchClose"),
    searchResults:     el("searchResults"),
    searchEmpty:       el("searchEmpty"),
    adjustBtn:         el("adjustBtn"),
    adjustPanel:       el("adjustPanel"),
    adjustTitle:       el("adjustTitle"),
    adjustClose:       el("adjustClose"),
    adjustList:        el("adjustList"),
    adjustEmpty:       el("adjustEmpty"),
    adjustReset:       el("adjustReset"),
    adjustSave:        el("adjustSave"),
    searchSuggest:     el("searchSuggest"),
    searchSuggestLink: el("searchSuggestLink"),
    suggestPanel:      el("suggestPanel"),
    suggestClose:      el("suggestClose"),
    suggestInput:      el("suggestInput"),
    suggestSend:       el("suggestSend"),
    toast:             el("toast"),
    ytBox:             document.querySelector(".yt-box")
  };

  const state = {
    player:      null,
    ids:         [],
    order:       [],
    pos:         0,
    shuffle:     true,
    repeat:      "all",
    started:     false,
    playing:     false,
    seeking:     false,
    errorStreak: 0,
    timer:       null,
    trackedId:   null,
    songTitle:   "",
    listKey:     null,
    lists:       {},
    failed:      {},
    playerReady: false,
    wantPlay:    false,
    toastTimer:  null,
    mahalaya:    false,
    mainKey:     null,
    found:       [],
    foundActive: 0,
    titles:      {},
    titleLoads:  {},
    titleDone:   {},
    adjustDirty: false,
    dragRow:     null
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save(patch) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSaved(), ...patch }));
    } catch (e) {
      return;
    }
  }

  function formatTime(sec) {
    if (!sec || isNaN(sec)) {
      return "0:00";
    }
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function shortTitle(text) {
    const letters = window.Intl?.Segmenter
      ? [...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(text)].map(s => s.segment)
      : Array.from(text);

    return letters.length > TITLE_MAX_LETTERS
      ? `${letters.slice(0, TITLE_MAX_LETTERS).join("").trimEnd()}...`
      : text;
  }

  function setFill(range) {
    const pct = (range.value - range.min) / (range.max - range.min) * 100;
    range.style.setProperty("--fill", `${pct}%`);
  }

  function currentIndex() {
    return state.order[state.pos];
  }

  function track(name, params) {
    window.pujoTrack(name, params);
  }

  function songParams() {
    return {
      video_id:    state.ids[currentIndex()],
      song_title:  state.songTitle,
      song_number: currentIndex() + 1,
      playlist:    state.listKey
    };
  }

  function customOrder() {
    const saved = (loadSaved().custom || {})[state.listKey];

    if (!saved || !state.ids.length) {
      return null;
    }
    const picked = [...new Set(saved.map(id => state.ids.indexOf(id)).filter(i => i >= 0))];
    const rest   = state.ids.map((_, i) => i).filter(i => !picked.includes(i));

    return [...picked, ...rest];
  }

  function buildOrder(startIndex) {
    const custom = customOrder();

    if (custom) {
      state.order = custom;
      state.pos   = Math.max(0, custom.indexOf(startIndex));
      return;
    }

    const order = state.ids.map((_, i) => i);

    if (state.shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.splice(order.indexOf(startIndex), 1);
      order.unshift(startIndex);
    }

    state.order = order;
    state.pos   = order.indexOf(startIndex);
  }

  function pickStart(exclude) {
    const top   = Math.min(findList(state.listKey).topCount || 0, state.ids.length);
    const pool  = [...Array(top || state.ids.length).keys()];
    const picks = pool.length > 1 ? pool.filter(i => i !== exclude) : pool;

    return picks[Math.floor(Math.random() * picks.length)];
  }

  function updateStatus(text = "") {
    ui.status.textContent = text;
  }

  function playAt(pos) {
    state.pos       = pos;
    state.started   = true;
    state.trackedId = null;

    const videoId = state.ids[currentIndex()];

    ui.cover.style.backgroundImage = `url("https://img.youtube.com/vi/${videoId}/hqdefault.jpg")`;
    ui.title.textContent           = "Loading…";
    updateStatus();
    save({ songs: { ...loadSaved().songs, [state.listKey]: videoId } });
    state.player.loadVideoById(videoId);
  }

  function next(fromUser) {
    if (state.pos + 1 < state.order.length) {
      playAt(state.pos + 1);
      return;
    }

    if (state.repeat === "off" && !fromUser) {
      setPlaying(false);
      updateStatus("Playlist finished");
      return;
    }

    if (state.shuffle && !customOrder()) {
      buildOrder(pickStart(currentIndex()));
    }
    playAt(0);
  }

  function goNext() {
    if (state.started) {
      track("player_action", { action: "next" });
      next(true);
    }
  }

  function goPrev() {
    if (state.started) {
      track("player_action", { action: "previous" });
      prev();
    }
  }

  function prev() {
    if (state.player.getCurrentTime() > 3) {
      state.player.seekTo(0, true);
      return;
    }
    playAt(state.pos > 0 ? state.pos - 1 : state.order.length - 1);
  }

  function togglePlay() {
    if (!state.started) {
      playAt(state.pos);
      return;
    }
    if (state.playing) {
      track("player_action", { action: "pause" });
      state.player.pauseVideo();
    } else {
      track("player_action", { action: "resume" });
      state.player.playVideo();
    }
  }

  function setPlaying(playing) {
    state.playing = playing;
    ui.playIcon.toggleAttribute("hidden", playing);
    ui.pauseIcon.toggleAttribute("hidden", !playing);
    ui.playBtn.title = playing ? "Pause" : "Play";
    ui.playBtn.setAttribute("aria-label", ui.playBtn.title);
    ui.cover.classList.toggle("is-playing", playing);
  }

  function tick() {
    if (state.seeking) {
      return;
    }
    const now = state.player.getCurrentTime() || 0;
    const end = state.player.getDuration() || 0;

    ui.seek.value           = end ? now / end * 100 : 0;
    ui.timeNow.textContent  = formatTime(now);
    ui.timeEnd.textContent  = formatTime(end);
    setFill(ui.seek);
  }

  function onStateChange(e) {
    const S = YT.PlayerState;

    if (e.data === S.PLAYING) {
      state.errorStreak = 0;
      setPlaying(true);
      state.songTitle      = state.player.getVideoData().title || "Pujo song";
      ui.title.textContent = shortTitle(state.songTitle);
      ui.title.title       = state.songTitle;
      ui.shareBtn.hidden   = false;
      updateStatus();

      if (!state.trackedId) {
        state.trackedId = state.ids[currentIndex()];
        track("song_play", songParams());
      }

      clearInterval(state.timer);
      state.timer = setInterval(tick, 250);
    } else if (e.data === S.PAUSED) {
      setPlaying(false);
    } else if (e.data === S.BUFFERING) {
      updateStatus("Loading…");
    } else if (e.data === S.ENDED) {
      clearInterval(state.timer);
      track("song_complete", songParams());

      if (state.repeat === "one") {
        state.trackedId = null;
        state.player.seekTo(0, true);
        state.player.playVideo();
      } else {
        next(false);
      }
    }
  }

  function onError(e) {
    if (!state.started || ui.playBtn.disabled) {
      return;
    }
    track("song_error", { video_id: state.ids[currentIndex()], error_code: e.data });
    state.errorStreak++;
    if (state.errorStreak >= state.ids.length) {
      setPlaying(false);
      updateStatus("These songs can't play here");
      return;
    }
    next(true);
  }

  function onReady() {
    const saved = loadSaved();

    if (typeof saved.volume === "number") {
      ui.volume.value = saved.volume;
    }
    state.player.setVolume(Number(ui.volume.value));
    setFill(ui.volume);

    state.playerReady = true;
    showList(state.listKey, false);
  }

  function allLists() {
    return config.mahalaya?.playlistId ? [...config.playlists, config.mahalaya] : config.playlists;
  }

  function findList(key) {
    return allLists().find(list => list.key === key);
  }

  function renderTabs() {
    ui.tabs.replaceChildren(...config.playlists.map(list => {
      const tab = document.createElement("button");

      tab.className   = "tab";
      tab.textContent = list.label;
      tab.dataset.key = list.key;
      tab.addEventListener("click", () => switchList(list.key));
      return tab;
    }));
  }

  function markActiveTab() {
    for (const tab of ui.tabs.children) {
      const active = tab.dataset.key === state.listKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", active);
    }
  }

  function switchList(key) {
    if (key === state.listKey) {
      return;
    }

    track("player_action", { action: `playlist_${key}` });
    closeSearch();
    closeAdjust();
    state.listKey     = key;
    state.errorStreak = 0;
    save({ playlist: key });
    markActiveTab();
    resetPlayer();
    showList(key, false);
  }

  function toggleMahalaya() {
    if (ui.card.classList.contains("is-flip-out")) {
      return;
    }
    closeSearch();
    closeAdjust();

    const on = !state.mahalaya;

    if (on) {
      state.mainKey = state.listKey;
    }
    track("player_action", { action: on ? "mahalaya_on" : "mahalaya_off" });
    ui.card.classList.add("is-flip-out");

    setTimeout(() => {
      state.mahalaya    = on;
      state.listKey     = on ? config.mahalaya.key : state.mainKey;
      state.errorStreak = 0;
      resetPlayer();
      showList(state.listKey, false);

      ui.tabs.hidden      = on;
      ui.modeTitle.hidden = !on;
      ui.modeBtn.setAttribute("aria-pressed", on);
      ui.card.classList.toggle("is-mahalaya", on);
      markActiveTab();

      ui.card.classList.replace("is-flip-out", "is-flip-in");
      setTimeout(() => ui.card.classList.remove("is-flip-in"), FLIP_MS);
    }, FLIP_MS);
  }

  function normalize(text) {
    return text
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
            .replace(/([bcdfgjklmnpqrstvwxz])h/g, "$1")
            .replace(/([aeiou])\1+/g, "$1")
            .trim();
  }

  function findSongs(query) {
    const words   = normalize(query).split(" ").filter(Boolean);
    const phrases = words.length < 2 ? words : words.slice(1).map((word, i) => `${words[i]} ${word}`);

    return state.ids
            .map((id, index) => {
              const title = state.titles[id];

              if (!title) {
                return null;
              }
              const text  = ` ${normalize(title)} `;
              const score = phrases.filter(phrase => text.includes(phrase)).length;

              return phrases.length === 0 || score > 0 ? { index, title, score } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, MAX_RESULTS);
  }

  function fetchTitle(id) {
    if (!state.titleLoads[id]) {
      const video = encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);

      state.titleLoads[id] = fetch(`https://www.youtube.com/oembed?format=json&url=${video}`)
              .then(response => (response.ok ? response.json() : null))
              .then(data => {
                if (data && data.title) {
                  state.titles[id] = data.title;
                }
              })
              .catch(() => null)
              .finally(() => {
                state.titleDone[id] = true;
              });
    }
    return state.titleLoads[id];
  }

  async function loadTitles(ids) {
    for (let i = 0; i < ids.length; i += TITLE_BATCH) {
      await Promise.all(ids.slice(i, i + TITLE_BATCH).map(fetchTitle));
      if (!ui.searchPanel.hidden) {
        renderResults(true);
      }
      if (!ui.adjustPanel.hidden && !state.adjustDirty) {
        renderAdjust();
      }
    }
  }

  function renderResults(keepActive) {
    const playing = state.started ? currentIndex() : -1;
    const loading = !state.ids.length || state.ids.some(id => !state.titleDone[id]);

    state.found       = state.ids.length ? findSongs(ui.searchInput.value) : [];
    state.foundActive = keepActive === true ? Math.min(state.foundActive, Math.max(0, state.found.length - 1)) : 0;

    ui.searchResults.replaceChildren(...state.found.map((song, i) => {
      const item   = document.createElement("li");
      const button = document.createElement("button");

      button.className   = "search__result";
      button.textContent = shortTitle(song.title);
      button.title       = song.title;
      button.setAttribute("role", "option");
      button.classList.toggle("is-playing", song.index === playing);
      button.addEventListener("click", () => playFound(i));
      item.appendChild(button);
      return item;
    }));

    ui.searchEmpty.textContent = loading ? "Loading songs…" : "No songs found";
    ui.searchEmpty.hidden      = state.found.length > 0;
    ui.searchSuggest.hidden    = state.found.length > 0 || loading || !ui.searchInput.value.trim();
    markActiveResult();
  }

  function markActiveResult() {
    [...ui.searchResults.querySelectorAll(".search__result")].forEach((button, i) => {
      const active = i === state.foundActive;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active);
      if (active) {
        button.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function playFound(i) {
    const song = state.found[i];

    if (!song || ui.playBtn.disabled) {
      return;
    }
    track("search_play", {
      search_term: ui.searchInput.value.trim().slice(0, 100),
      video_id:    state.ids[song.index],
      playlist:    state.listKey
    });
    closeSearch();
    playAt(state.order.indexOf(song.index));
  }

  function openSearch() {
    const list = findList(state.listKey);

    closeAdjust();
    closeSuggest();
    ui.searchPanel.hidden          = false;
    ui.searchInput.value           = "";
    ui.searchInput.placeholder     = `Search ${list ? list.label : ""} songs`;
    ui.searchBtn.setAttribute("aria-expanded", "true");
    renderResults();
    ui.searchInput.focus();
  }

  function closeSearch() {
    if (ui.searchPanel.hidden) {
      return;
    }
    ui.searchPanel.hidden = true;
    ui.searchBtn.setAttribute("aria-expanded", "false");
  }

  function onSearchKey(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;

      state.foundActive = Math.min(state.found.length - 1, Math.max(0, state.foundActive + step));
      markActiveResult();
    } else if (e.key === "Enter") {
      e.preventDefault();
      playFound(state.foundActive);
    } else if (e.key === "Escape") {
      closeSearch();
      ui.searchBtn.focus();
    }
  }

  function updateCustomUi() {
    const custom = Boolean(customOrder());

    ui.shuffleBtn.classList.toggle("is-disabled", custom);
    ui.shuffleBtn.setAttribute("aria-disabled", custom);
    ui.shuffleBtn.title = custom ? CUSTOM_ON_TEXT : `Shuffle: ${state.shuffle ? "on" : "off"}`;
    if (custom) {
      ui.shuffleBtn.dataset.tip = CUSTOM_ON_TEXT;
    } else {
      delete ui.shuffleBtn.dataset.tip;
    }
    ui.adjustBtn.classList.toggle("is-on", custom);
  }

  function adjustRow(id) {
    const row  = document.createElement("li");
    const grip = document.createElement("span");
    const name = document.createElement("span");
    const up   = document.createElement("button");
    const down = document.createElement("button");

    row.className   = "adjust__row";
    row.dataset.id  = id;
    grip.className  = "adjust__handle";
    grip.innerHTML  = '<svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14"/></svg>';
    grip.addEventListener("pointerdown", e => startDrag(e, row));
    name.className   = "adjust__name";
    name.textContent = shortTitle(state.titles[id]);
    name.title       = state.titles[id];

    [[up, "Move up", "M6 15l6-6 6 6", -1], [down, "Move down", "M6 9l6 6 6-6", 1]].forEach(([button, label, path, step]) => {
      button.className = "icon-btn adjust__move";
      button.title     = label;
      button.setAttribute("aria-label", `${label}: ${state.titles[id]}`);
      button.innerHTML = `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
      button.addEventListener("click", () => moveRow(row, step));
    });

    row.append(grip, name, up, down);
    return row;
  }

  function renderAdjust() {
    const custom  = customOrder();
    const order   = custom || state.ids.map((_, i) => i);
    const ids     = order.map(i => state.ids[i]).filter(id => state.titles[id]);
    const loading = !state.ids.length || state.ids.some(id => !state.titleDone[id]);

    ui.adjustList.replaceChildren(...ids.map(adjustRow));
    ui.adjustEmpty.textContent = "Loading songs…";
    ui.adjustEmpty.hidden      = ids.length > 0 && !loading;
  }

  function openAdjust() {
    const list = findList(state.listKey);

    closeSearch();
    closeSuggest();
    state.adjustDirty          = false;
    ui.adjustPanel.hidden      = false;
    ui.adjustTitle.textContent = `Adjust ${list ? list.label : ""} playlist`;
    ui.adjustBtn.setAttribute("aria-expanded", "true");
    renderAdjust();
  }

  function closeAdjust() {
    if (ui.adjustPanel.hidden) {
      return;
    }
    ui.adjustPanel.hidden = true;
    ui.adjustBtn.setAttribute("aria-expanded", "false");
  }

  function moveRow(row, step) {
    const target = step < 0 ? row.previousElementSibling : row.nextElementSibling;

    if (!target) {
      return;
    }
    state.adjustDirty = true;
    if (step < 0) {
      target.before(row);
    } else {
      target.after(row);
    }
    row.querySelector(step < 0 ? ".adjust__move" : ".adjust__move:last-of-type").focus();
  }

  function startDrag(e, row) {
    e.preventDefault();
    state.dragRow     = row;
    state.adjustDirty = true;
    row.classList.add("is-dragging");
    e.target.setPointerCapture(e.pointerId);
  }

  function onDragMove(e) {
    const row = state.dragRow;

    if (!row) {
      return;
    }
    const box  = ui.adjustList.getBoundingClientRect();
    const rows = [...ui.adjustList.children].filter(item => item !== row);
    const next = rows.find(item => {
      const r = item.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });

    if (next) {
      next.before(row);
    } else {
      ui.adjustList.appendChild(row);
    }
    if (e.clientY < box.top + 30) {
      ui.adjustList.scrollTop -= 8;
    } else if (e.clientY > box.bottom - 30) {
      ui.adjustList.scrollTop += 8;
    }
  }

  function endDrag() {
    if (state.dragRow) {
      state.dragRow.classList.remove("is-dragging");
      state.dragRow = null;
    }
  }

  function applyOrder(message, action, restart) {
    const playing = state.started && !restart ? currentIndex() : null;

    buildOrder(playing ?? (customOrder() ? customOrder()[0] : pickStart()));
    updateCustomUi();
    closeAdjust();
    showToast(message);
    track("player_action", { action });

    if (restart && state.started) {
      playAt(0);
    }
  }

  function saveAdjust() {
    const shown  = [...ui.adjustList.children].map(row => row.dataset.id);
    const hidden = state.ids.filter(id => !shown.includes(id));

    save({ custom: { ...loadSaved().custom, [state.listKey]: [...shown, ...hidden] } });
    applyOrder("Custom playlist saved", "custom_save", true);
  }

  function resetAdjust() {
    const custom = { ...loadSaved().custom };

    delete custom[state.listKey];
    save({ custom });
    applyOrder("Original order restored", "custom_reset");
  }

  function shareText(videoId) {
    return [
      state.songTitle,
      `https://youtu.be/${videoId}`,
      "",
      `More Pujo songs: ${config.siteUrl}`
    ].join("\n");
  }

  async function shareSong() {
    const videoId = state.ids[currentIndex()];
    const text    = shareText(videoId);
    const onPhone = window.matchMedia("(pointer: coarse)").matches;
    const params  = {
      video_id:   videoId,
      song_title: state.songTitle,
      playlist:   state.listKey
    };

    if (onPhone && navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) {
        return;
      }
      track("share", { ...params, method: "share_menu" });
      return;
    }

    if (await copyText(text)) {
      showToast("Link copied");
      track("share", { ...params, method: "copy" });
    } else {
      showToast("Could not copy the link");
    }
  }

  function copyNow(text) {
    const box = document.createElement("textarea");

    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity  = "0";
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, text.length);

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (e) {
      copied = false;
    }
    box.remove();

    if (!copied && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => null);
    }
  }

  function openSuggest(text) {
    closeSearch();
    closeAdjust();
    ui.suggestPanel.hidden = false;
    ui.suggestInput.value  = text || "";
    ui.suggestInput.focus();
  }

  function closeSuggest() {
    ui.suggestPanel.hidden = true;
  }

  function sendSuggest() {
    const text = ui.suggestInput.value.trim();

    if (!text) {
      ui.suggestInput.focus();
      showToast("Type a song name first");
      return;
    }

    copyNow(`Song suggestion for ${config.siteUrl.replace(/^https?:\/\//, "")}: ${text}`);
    window.open(`https://ig.me/m/${config.instagramId.replace(/^@/, "")}`, "_blank", "noopener");
    track("player_action", { action: "suggest_send" });
    closeSuggest();
    showToast("Copied! Just paste it in the chat");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const box = document.createElement("textarea");

      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity  = "0";
      document.body.appendChild(box);
      box.select();

      const copied = document.execCommand("copy");

      box.remove();
      return copied;
    }
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add("is-shown");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => ui.toast.classList.remove("is-shown"), 2000);
  }

  function resetPlayer() {
    if (state.started) {
      state.player.stopVideo();
    }
    clearInterval(state.timer);
    setPlaying(false);
    ui.shareBtn.hidden = true;

    state.started   = false;
    state.trackedId = null;
    state.songTitle = "";

    ui.title.textContent           = "Tap play to start";
    ui.title.title                 = "";
    ui.cover.style.backgroundImage = "";
    ui.seek.value                  = 0;
    ui.timeNow.textContent         = "0:00";
    ui.timeEnd.textContent         = "0:00";
    setFill(ui.seek);
  }

  function loadList(key) {
    const holder = document.createElement("div");

    ui.ytBox.appendChild(holder);

    const loader = new YT.Player(holder, {
      playerVars: { listType: "playlist", list: findList(key).playlistId },
      events:     { onReady: () => readList(key, loader, 0) }
    });
  }

  function readList(key, loader, attempt) {
    const list = loader.getPlaylist();

    if (list && list.length) {
      state.lists[key] = list.slice();
    } else if (attempt < 40) {
      setTimeout(() => readList(key, loader, attempt + 1), 250);
      return;
    } else {
      state.failed[key] = true;
    }

    loader.destroy();

    if (key === state.listKey) {
      showList(key, state.wantPlay);
    }
  }

  function showList(key, autoplay) {
    state.wantPlay = autoplay;

    if (state.failed[key]) {
      ui.playBtn.disabled = true;
      updateStatus("Could not load the playlist");
      return;
    }

    if (!state.lists[key] || !state.playerReady) {
      if (state.playing) {
        state.player.pauseVideo();
      }
      ui.playBtn.disabled = true;
      updateStatus("Loading songs…");
      return;
    }

    state.ids = state.lists[key];
    loadTitles(state.ids);

    const hasTop     = findList(key).topCount > 0;
    const savedIndex = state.ids.indexOf((loadSaved().songs || {})[key]);
    const custom     = customOrder();
    const startIndex = custom ? custom[0] : !hasTop && savedIndex >= 0 ? savedIndex : pickStart();

    buildOrder(startIndex);
    updateCustomUi();
    ui.playBtn.disabled = false;

    if (autoplay) {
      playAt(state.pos);
    } else {
      updateStatus();
    }
  }

  window.onYouTubeIframeAPIReady = () => {
    const savedKey = loadSaved().playlist;

    state.listKey = findList(savedKey) ? savedKey : config.playlists[0].key;
    markActiveTab();

    state.player = new YT.Player("ytPlayer", {
      width:      "100%",
      height:     "100%",
      playerVars: {
        controls:    1,
        playsinline: 1,
        rel:         0
      },
      events: {
        onReady,
        onStateChange,
        onError
      }
    });

    allLists().forEach(list => loadList(list.key));
  };

  renderTabs();
  ui.modeBtn.hidden = !config.mahalaya?.playlistId;
  ui.modeBtn.addEventListener("click", toggleMahalaya);
  ui.searchBtn.addEventListener("click", () => (ui.searchPanel.hidden ? openSearch() : closeSearch()));
  ui.searchClose.addEventListener("click", closeSearch);
  ui.searchInput.addEventListener("input", renderResults);
  ui.searchInput.addEventListener("keydown", onSearchKey);
  document.addEventListener("pointerdown", e => {
    if (!ui.searchPanel.hidden && !e.target.closest("#searchPanel, #searchBtn")) {
      closeSearch();
    }
    if (!ui.adjustPanel.hidden && !e.target.closest("#adjustPanel, #adjustBtn")) {
      closeAdjust();
    }
    if (!ui.suggestPanel.hidden && !e.target.closest("#suggestPanel, #searchSuggest, #searchSuggestLink")) {
      closeSuggest();
    }
  });

  ui.adjustBtn.addEventListener("click", () => (ui.adjustPanel.hidden ? openAdjust() : closeAdjust()));
  ui.searchSuggest.addEventListener("click", () => openSuggest(ui.searchInput.value.trim()));
  ui.searchSuggestLink.addEventListener("click", () => openSuggest(ui.searchInput.value.trim()));
  ui.suggestClose.addEventListener("click", closeSuggest);
  ui.suggestSend.addEventListener("click", sendSuggest);
  ui.suggestInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendSuggest();
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });
  ui.adjustClose.addEventListener("click", closeAdjust);
  ui.adjustSave.addEventListener("click", saveAdjust);
  ui.adjustReset.addEventListener("click", resetAdjust);
  ui.adjustList.addEventListener("pointermove", onDragMove);
  ui.adjustList.addEventListener("pointerup", endDrag);
  ui.adjustList.addEventListener("pointercancel", endDrag);
  ui.playBtn.addEventListener("click", togglePlay);
  ui.nextBtn.addEventListener("click", goNext);
  ui.prevBtn.addEventListener("click", goPrev);
  ui.shareBtn.addEventListener("click", shareSong);

  ui.shuffleBtn.addEventListener("click", () => {
    if (customOrder()) {
      showToast(CUSTOM_ON_TEXT);
      return;
    }
    state.shuffle = !state.shuffle;
    if (state.ids.length) {
      buildOrder(currentIndex());
    }
    ui.shuffleBtn.classList.toggle("is-on", state.shuffle);
    ui.shuffleBtn.setAttribute("aria-pressed", state.shuffle);
    ui.shuffleBtn.title = `Shuffle: ${state.shuffle ? "on" : "off"}`;
    if (state.started) {
      updateStatus();
    }
    track("player_action", { action: state.shuffle ? "shuffle_on" : "shuffle_off" });
  });

  ui.repeatBtn.addEventListener("click", () => {
    state.repeat = REPEAT_NEXT[state.repeat];
    ui.repeatBtn.classList.toggle("is-on", state.repeat !== "off");
    ui.repeatOne.hidden = state.repeat !== "one";
    ui.repeatBtn.title  = `Repeat: ${state.repeat}`;
    ui.repeatBtn.setAttribute("aria-label", ui.repeatBtn.title);
    track("player_action", { action: `repeat_${state.repeat}` });
  });

  ui.seek.addEventListener("input", () => {
    state.seeking = true;
    setFill(ui.seek);
    ui.timeNow.textContent = formatTime(ui.seek.value / 100 * (state.player?.getDuration() || 0));
  });

  ui.seek.addEventListener("change", () => {
    if (state.started) {
      state.player.seekTo(ui.seek.value / 100 * state.player.getDuration(), true);
    }
    state.seeking = false;
  });

  ui.volume.addEventListener("input", () => {
    const volume = Number(ui.volume.value);
    setFill(ui.volume);
    state.player?.setVolume(volume);
    save({ volume });
  });

  document.addEventListener("keydown", e => {
    if (ui.playBtn.disabled || e.target.closest("input")) {
      return;
    }
    if (e.code === "Space" && !e.target.closest("button")) {
      e.preventDefault();
      togglePlay();
    } else if (e.code === "ArrowRight") {
      goNext();
    } else if (e.code === "ArrowLeft") {
      goPrev();
    }
  });

  setFill(ui.seek);
  setFill(ui.volume);
})();
