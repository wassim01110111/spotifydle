const modes = [
  {
    page: "spotifydle",
    eyebrow: "Daily puzzle",
    title: "Spotifydle",
    desc: "Guess the track/artists based on a snippet and hints.",
    colors: ["#6C3FC5", "#3A2266"],
    icon: `<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.3" fill="#fff" stroke="none"/><circle cx="16" cy="8" r="1.3" fill="#fff" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="#fff" stroke="none"/><circle cx="8" cy="16" r="1.3" fill="#fff" stroke="none"/><circle cx="16" cy="16" r="1.3" fill="#fff" stroke="none"/>`,
  },
  {
    page: "wrapped",
    eyebrow: "Your year",
    title: "Wrapped",
    desc: "Top artists, top tracks, and the minutes that gave you away.",
    colors: ["#FF6B35", "#D6006E"],
    icon: `<path d="M12 3v18M4 8h16M6 8l-1 13h14l-1-13" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 8a3 3 0 016 0" stroke-linecap="round"/>`,
  },
  {
    page: "spotiduel",
    eyebrow: "Head to head",
    title: "spotiduel",
    desc: "Two tracks enter. One track wins. Choose a playlist or album and battle through the rounds.",
    colors: ["#1DB954", "#0B6E3A"],
    icon: `<path d="M5 20V10M12 20V4M19 20v-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 20h18" stroke-linecap="round"/>`,
  },
  {
    page: "spotimatch",
    eyebrow: "Swipe to curate",
    title: "SpotiMatch",
    desc: "Swipe through your music library. Keep the tracks you love, discard the ones you don't, or swipe up to save a favorite.",
    colors: ["#1DB954", "#8A2BE2"],
    icon: `<path d="M7 4h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-2 4-2-4H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M8 10h8M8 13h5" stroke-linecap="round"/>
         <path d="M19 4v3M17.5 5.5h3" stroke-linecap="round"/>`,
  },
  {
    page: "spotisort",
    eyebrow: "Sort beyond Spotify",
    title: "SpotiSort",
    desc: "Organize your Spotify playlists with sorting options Spotify doesn't offer. Filter, group, and reorder your tracks exactly the way you want.",
    colors: ["#1DB954", "#191414"],
    icon: `<path d="M5 5h14v14H5z" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M8 9h8M8 12h6M8 15h4" stroke-linecap="round"/>
       <path d="m17 13 2 2-2 2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
];

const grid = document.getElementById("grid");

function renderTile(mode) {
  const [c1, c2] = mode.colors;
  const href = `${mode?.subfolder ? mode.subfolder : mode.page}/${mode.page}.html`;
  const imgUrl = `assets/${mode.page}.png`;

  const a = document.createElement("a");
  a.className = "tile";
  a.href = href;
  a.setAttribute("aria-label", `Open ${mode.title}`);

  a.innerHTML = `
      <div class="tile-base" style="background:radial-gradient(120% 140% at 100% 0%, ${c1}, ${c2} 70%)"></div>
      <div class="tile-media" style="background-image:url('${imgUrl}')"></div>
      <div class="tile-scrim"></div>
      <div class="sticker">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8">${mode.icon}</svg>
      </div>
      <div class="tile-content">
        <div class="tile-eyebrow">${mode.eyebrow}</div>
        <div class="tile-title">${mode.title}</div>
        <div class="tile-desc">${mode.desc}</div>
      </div>
      <div class="play-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.4"><path d="M7 17L17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    `;
  return a;
}

modes.forEach((mode) => grid.appendChild(renderTile(mode)));
