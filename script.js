const el = (id) => document.getElementById(id);
const playModeSlider = el("playModeSlider");
const playMode = el("playMode");
const playModeOptions = [...document.querySelectorAll(".play-mode-option")];
let loadingDepth = 0;
const SAVE_KEY = "spotifydle-save";
const LIBRARY_KEY = "spotifydle-library";
const SETTINGS_KEY = "spotifydle-settings";
const STATS_KEY = "spotifydle-stats";
const SVG_FOLDER = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>`;
const SVG_NOTE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z"/></svg>`;
const library = el("library");
const libraryBack = el("libraryBack");
const librarySearch = el("librarySearch");
const libraryGrid = el("libraryGrid");
const backToTopBtn = el("backToTopBtn");
const libraryEmpty = el("libraryEmpty");
const breadcrumb = el("breadcrumb");
const likedSongsUri = "spotify:playlist:37i9dQZF1F5p3rmiWPIYgZ";
const shuffleBtn = el("shuffleBtn");
const topbar = el("topbar");
const playlistUrlInput = el("playlistUrlInput");
const playlistUrlBtn = el("playlistUrlBtn");
const scriptInfo = { libraryAlbums: true, libraryArtists: false };
let currentView;
const libraryPath = [];
let currentLibraryItems = [];
const libraryCache = new Map(
  JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"),
);

class BiMap {
  constructor() {
    this.forward = new Map();
    this.reverse = new Map();
  }

  set(key, value) {
    if (this.forward.has(key)) return;
    this.forward.set(key, value);
    this.reverse.set(value, key);
  }

  getByKey(key) {
    return this.forward.get(key);
  }

  getByValue(value) {
    return this.reverse.get(value);
  }

  clear() {
    this.forward.clear();
    this.reverse.clear();
  }
}

function fmtNumber(number) {
  return number.toLocaleString("en-US");
}
function renderBreadcrumb() {
  breadcrumb.innerHTML = "";
  const home = document.createElement("span");
  home.className = "crumb";
  home.textContent = "library";
  home.addEventListener("click", () => {
    libraryPath.length = 0;
    loadCurrentFolder();
  });
  breadcrumb.appendChild(home);

  libraryPath.forEach((p, idx) => {
    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = "/";
    breadcrumb.appendChild(sep);

    const crumb = document.createElement("span");
    crumb.className = "crumb";
    crumb.textContent = p.name;
    crumb.addEventListener("click", () => {
      libraryPath.length = idx + 1;
      loadCurrentFolder();
    });
    breadcrumb.appendChild(crumb);
  });

  libraryBack.hidden = libraryPath.length === 0;
}
function normalizeCover(url) {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    return parsed.pathname;
  } catch {
    return url;
  }
}
function librariesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;

  return a.every((item, i) => {
    const other = b[i];

    return (
      item.id === other.id &&
      item.type === other.type &&
      item.name === other.name &&
      normalizeCover(item.cover) === normalizeCover(other.cover)
    );
  });
}
async function getLibraryList(id) {
  const key = id ?? "root";
  if (libraryCache.has(key)) {
    const cachedLibrary = libraryCache.get(key);
    (async () => {
      const latest = await fetchLibrary(id);
      if (!librariesEqual(latest, cachedLibrary)) {
        libraryCache.set(key, latest);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify([...libraryCache]));

        renderLibraryGrid(latest);
      }
    })();
    return cachedLibrary;
  }
  const items = await fetchLibrary(id);
  libraryCache.set(key, items);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify([...libraryCache]));
  return items;
}
async function loadCurrentFolder() {
  removeURL();
  const top = libraryPath[libraryPath.length - 1];
  const id = top ? top.id : null;
  libraryGrid.innerHTML = "";
  libraryEmpty.hidden = true;
  librarySearch.value = "";

  await showLoadingOverlay();
  try {
    currentLibraryItems = await getLibraryList(id);
  } catch (err) {
    console.error("failed to load library folder:", err);
    showToast("Couldn't load your library — try again");
  }

  hideLoadingOverlay();
  renderBreadcrumb();
  renderLibraryGrid(currentLibraryItems);
}
function renderLibraryGrid(items) {
  libraryGrid.innerHTML = "";
  libraryEmpty.hidden = items.length > 0;
  items.forEach((item) => {
    if (
      (item.type === "ArtistResponseWrapper" && !scriptInfo.libraryArtists) ||
      (item.type === "AlbumResponseWrapper" && !scriptInfo.libraryAlbums)
    ) {
      return;
    }
    const card = document.createElement("button");
    card.className = "lib-item";
    const countLabel =
      item.type === "LibraryFolderResponseWrapper"
        ? `${item.count} item${item.count === 1 ? "" : "s"}`
        : item.count != null
          ? `${item.count.toLocaleString()} tracks`
          : "";
    card.innerHTML = `${libCoverHtml(item)}<div class="lib-name">${escapeHtml(item.name)}</div><div class="lib-count">${countLabel}</div>`;
    card.addEventListener("click", () => handleLibraryItemClick(item));
    libraryGrid.appendChild(card);
  });
}
function handleLibraryItemClick(item) {
  if (item.type === "LibraryFolderResponseWrapper") {
    libraryPath.push({ id: item.id, name: item.name });
    loadCurrentFolder(false);
  } else {
    selectPlaylist(item);
  }
}

function fetchLibrary(id = null) {
  return sendMessage({
    type: "getLibrary",
    id,
    albums: scriptInfo.libraryAlbums,
    artists: scriptInfo.libraryArtists,
  });
}
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      console.log(message, response);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (response?.notConnected) {
        window.location.href = "notconnected.html";
        return;
      }

      if (response?.error) {
        reject(new Error(response.error));
        return;
      }

      resolve(response);
    });
  });
}

function uriToUrl(uri) {
  if (!uri || typeof uri !== "string") return null;

  return uri
    .replaceAll(":", "/")
    .replace("spotify", "https://open.spotify.com");
}

function uriToId(uri) {
  return uri.slice(uri.lastIndexOf(":") + 1);
}

function getDay() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const loadingOverlay = el("loadingOverlay");
function showLoadingOverlay() {
  loadingDepth += 1;
  loadingOverlay.hidden = false;
  return new Promise(requestAnimationFrame);
}
function hideLoadingOverlay() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth === 0) loadingOverlay.hidden = true;
}
function showToast(message, color = null) {
  const toastContainer = el("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  if (color) {
    toast.style.background = color;
  }
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 2400);
}
function libCoverHtml(item) {
  if (item.type === "LibraryFolderResponseWrapper")
    return `<div class="lib-cover type-folder">${SVG_FOLDER}</div>`;
  if (item.cover)
    return `<div class="lib-cover"><img class="lib-cover-img" src="${item.cover}" alt=""></div>`;
  return `<div class="lib-cover type-playlist no-cover">${SVG_NOTE}</div>`;
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
function renderBreadcrumb() {
  breadcrumb.innerHTML = "";
  const home = document.createElement("span");
  home.className = "crumb";
  home.textContent = "library";
  home.addEventListener("click", () => {
    libraryPath.length = 0;
    loadCurrentFolder();
  });
  breadcrumb.appendChild(home);

  libraryPath.forEach((p, idx) => {
    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = "/";
    breadcrumb.appendChild(sep);

    const crumb = document.createElement("span");
    crumb.className = "crumb";
    crumb.textContent = p.name;
    crumb.addEventListener("click", () => {
      libraryPath.length = idx + 1;
      loadCurrentFolder();
    });
    breadcrumb.appendChild(crumb);
  });

  libraryBack.hidden = libraryPath.length === 0;
}

if (libraryBack) {
  libraryBack.addEventListener("click", () => {
    libraryPath.pop();
    loadCurrentFolder();
  });
}

if (librarySearch) {
  librarySearch.addEventListener("input", () => {
    const q = librarySearch.value.trim().toLowerCase();
    if (!q) {
      renderLibraryGrid(currentLibraryItems);
      return;
    }
    const seen = new Set();
    const results = [...libraryCache.values()].flat().filter((item) => {
      if (seen.has(item.id) || !item.name.toLowerCase().includes(q))
        return false;
      seen.add(item.id);
      return true;
    });
    renderLibraryGrid(results);
  });
}

async function randomWalk(folderId, blacklist = new Set()) {
  const items = await getLibraryList(folderId);

  const candidates = items.filter((item) => !blacklist.has(item.id));

  const results = [];

  for (const item of candidates) {
    if (item.type === "LibraryFolderResponseWrapper") {
      if (item.count === 0) {
        blacklist.add(item.id);
        continue;
      }

      const found = await randomWalk(item.id, blacklist);

      if (found !== null) {
        results.push(found);
      } else {
        blacklist.add(item.id);
      }
    } else {
      results.push(item);
    }
  }

  if (results.length === 0) {
    return null;
  }

  return results[Math.floor(Math.random() * results.length)];
}

if (shuffleBtn) {
  shuffleBtn.addEventListener("click", async () => {
    shuffleBtn.disabled = true;
    await showLoadingOverlay();
    let pick = null;
    try {
      pick = await randomWalk(null, new Set());
    } catch (err) {
      console.error("shuffle failed:", err);
      showToast("Shuffle failed — try again");
    } finally {
      hideLoadingOverlay();
    }
    shuffleBtn.disabled = false;
    if (!pick) {
      libraryEmpty.hidden = false;
      libraryEmpty.textContent = "no playable playlists found";
      return;
    }
    selectPlaylist(pick);
  });
}

if (topbar) {
  const goToMenu = document.createElement("button");

  goToMenu.id = "goToMenu";
  goToMenu.textContent = "Menu";
  goToMenu.type = "button";

  topbar.appendChild(goToMenu);
  goToMenu.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("index.html");
  });
}
function parsePlaylistUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return null;

  const allowedTypes = new Set(["playlist"]);

  if (scriptInfo.libraryAlbums) {
    allowedTypes.add("album");
  }

  if (scriptInfo.libraryArtists) {
    allowedTypes.add("artist");
  }

  const types = [...allowedTypes].join("|");

  let m = value.match(new RegExp(`^spotify:(${types}):([a-zA-Z0-9]+)$`));

  if (m) {
    return `spotify:${m[1]}:${m[2]}`;
  }

  try {
    const u = new URL(value);

    if (u.hostname.includes("spotify.com")) {
      const pathMatch = u.pathname.match(
        new RegExp(`\\/(${types})\\/([a-zA-Z0-9]+)`),
      );

      if (pathMatch) {
        return `spotify:${pathMatch[1]}:${pathMatch[2]}`;
      }
    }

    return null;
  } catch {
    if (/^[a-zA-Z0-9]{16,}$/.test(value)) {
      return `spotify:playlist:${value}`;
    }

    return null;
  }
}

async function loadPlaylistFromUrlInput() {
  const uri = parsePlaylistUrl(playlistUrlInput.value);
  if (!uri) {
    showToast("This link is not supported.");
    return;
  }
  playlistUrlInput.value = "";
  return await selectPlaylist({
    id: uri,
    name: false,
    count: null,
  });
}
if (playlistUrlBtn) {
  playlistUrlBtn.addEventListener("click", loadPlaylistFromUrlInput);
  playlistUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadPlaylistFromUrlInput();
    }
  });
}
if (playMode) {
  playMode.style.setProperty("--option-count", playModeOptions.length);

  const columns = Math.min(4, playModeOptions.length);
  const rows = Math.ceil(playModeOptions.length / columns);

  playMode.style.setProperty("--mobile-columns", columns);
  playMode.style.setProperty("--mobile-rows", rows);
}

function setPlayMode(mode) {
  const index = playModeOptions.findIndex(
    (option) => option.dataset.mode === mode,
  );

  if (index === -1) return;

  playModeOptions.forEach((option, optionIndex) => {
    const active = optionIndex === index;

    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", String(active));
  });

  if (!playModeSlider) return;

  const isMobile = window.matchMedia("(max-aspect-ratio: 1/1)").matches;

  if (isMobile) {
    const columns = Math.min(4, playModeOptions.length);
    const rows = Math.ceil(playModeOptions.length / columns);

    const column = index % columns;
    const row = Math.floor(index / columns);

    const playModeWidth = playMode.clientWidth;
    const playModeHeight = playMode.clientHeight;

    const cellWidth = (playModeWidth - 6) / columns;
    const cellHeight = (playModeHeight - 6) / rows;

    playModeSlider.style.width = `${cellWidth}px`;
    playModeSlider.style.height = `${cellHeight}px`;

    playModeSlider.style.transform = `translate3d(${column * cellWidth}px, ${row * cellHeight}px, 0)`;
  } else {
    playModeSlider.style.transform = `translateX(${index * 100}%)`;
  }
}
function fmtData(total, bestImage = true) {
  const playlistInfo = total?.data?.playlistV2;
  const items = playlistInfo?.content?.items;
  if (!playlistInfo || !items || items.length === 0) {
    return null;
  }
  const res = {
    items: [],
    info: {
      id: playlistInfo.uri,
      count: playlistInfo.content.totalCount,
      name: playlistInfo.name,
      owner: playlistInfo.ownerV2.data.name,
      description: playlistInfo.description,
    },
  };
  for (const item of items) {
    const track = item?.itemV2?.data;
    if (!track?.uri || !item?.uid || track.__typename === "LocalTrack") {
      continue;
    }

    const final_res = {
      id: track.uri,
      playcount: parseInt(track.playcount),
      name: track.name ?? null,
      artists: track.artists?.items?.map((artist) => artist.profile.name) ?? [],
      artistUris: track.artists?.items?.map((artist) => artist.uri) ?? [],
      release_date: track.albumOfTrack?.date?.isoString ?? null,
      playable: track.playability.playable,
      album: {
        artists:
          track.albumOfTrack?.artists?.items?.map(
            (artist) => artist.profile.name,
          ) ?? [],
        artistUris:
          track.albumOfTrack?.artists?.items?.map((artist) => artist.uri) ?? [],
        name: track.albumOfTrack?.name ?? null,
        id: track.albumOfTrack?.uri ?? null,

        image: getBestImage(
          track.albumOfTrack?.coverArt?.sources ?? track?.coverArt?.sources,
          bestImage,
        ),
      },
      duration:
        track?.trackDuration?.totalMilliseconds ??
        track?.episodeDuration?.totalMilliseconds ??
        null,
      uid: track.uid,
      addedAt: item?.addedAt?.isoString,
    };
    if (track.__typename === "Episode") {
      final_res.artists = [track?.podcastV2?.data?.name];
      final_res.artistUris = [track?.podcastV2?.data?.uri];
    }
    res.items.push(final_res);
  }
  return res;
}
function getBestImage(sources, bestImage = true) {
  if (!sources?.length) return null;

  const first = sources[0];
  const last = sources[sources.length - 1];

  return (
    bestImage
      ? last.height > first.height
        ? last
        : first
      : last.height < first.height
        ? last
        : first
  ).url;
}
function formatDate(isoString) {
  return new Date(isoString).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function durationMs(duration) {
  return Math.floor(Number(duration) / 1000);
}
function fmtDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
function fmtTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}
function handleSpotifyParameter() {
  const url = new URL(window.location.href);
  const parameter = url.searchParams.get("uri");
  if (parameter) {
    const [service, type, id] = parameter.split(":");

    const valid =
      service === "spotify" &&
      id &&
      (type === "playlist" ||
        (type === "album" && scriptInfo.libraryAlbums) ||
        (type === "artist" && scriptInfo.libraryArtists));

    if (valid) {
      selectPlaylist({
        id: parameter,
        name: false,
        count: null,
      });
      return true;
    }
  }
  return false;
}
function setURL(key, param = "uri") {
  const url = new URL(window.location.href);
  url.searchParams.set(param, key);
  window.history.replaceState({}, "", url);
}
function removeURL(param = "uri") {
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  window.history.replaceState({}, "", url);
}
