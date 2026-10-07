(() => {
  const config            = window.PUJO_CONFIG;
  const STORAGE_KEY       = "pujo-radio";
  const REPEAT_NEXT       = { all: "one", one: "off", off: "all" };
  const TITLE_MAX_LETTERS = 25;
  const FLIP_MS           = 300;

  const el = id => document.getElementById(id);

  const ui = {
    tabs:       el("tabs"),
    cover:      el("cover"),
    title:      el("songTitle"),
    status:     el("songStatus"),
    playBtn:    el("playBtn"),
    playIcon:   el("playIcon"),
    pauseIcon:  el("pauseIcon"),
    prevBtn:    el("prevBtn"),
    nextBtn:    el("nextBtn"),
    shuffleBtn: el("shuffleBtn"),
    repeatBtn:  el("repeatBtn"),
    repeatOne:  el("repeatOne"),
    seek:       el("seek"),
    timeNow:    el("timeNow"),
    timeEnd:    el("timeEnd"),
    volume:     el("volume"),
    shareBtn:   el("shareBtn"),
    card:       el("card"),
    modeBtn:    el("mahalayaBtn"),
    modeTitle:  el("mahalayaTitle"),
    toast:      el("toast"),
    ytBox:      document.querySelector(".yt-box")
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
    mainKey:     null
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

  function buildOrder(startIndex) {
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

    if (state.shuffle) {
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

    const hasTop     = findList(key).topCount > 0;
    const savedIndex = state.ids.indexOf((loadSaved().songs || {})[key]);
    const startIndex = !hasTop && savedIndex >= 0 ? savedIndex : pickStart();

    buildOrder(startIndex);
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
  ui.playBtn.addEventListener("click", togglePlay);
  ui.nextBtn.addEventListener("click", goNext);
  ui.prevBtn.addEventListener("click", goPrev);
  ui.shareBtn.addEventListener("click", shareSong);

  ui.shuffleBtn.addEventListener("click", () => {
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
