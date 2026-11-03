(() => {
  "use strict";

  /* ------------------------------------------------------------
     CONFIG
  ------------------------------------------------------------ */

  const LEVEL_XP = 200;
  const LEVEL_SCALING = 1.15;
  const MAX_ARTISTS_CAP = 8;
  const TIMER_MIN = 5;
  const TIMER_MAX = 300;
  const TIMER_DEFAULT = 120;

  const XP_CONFIG = {
    difficulty: {
      easy: { start: 100, mult: 1 },
      medium: { start: 50, mult: 2.5 },
      hard: { start: 25, mult: 5 },
      extreme: { start: 1, mult: 200 },
    },
    guessModeMult: { both: 1.5, track: 1, artist: 1, either: 0.5 },
    wrongPenalty: 5,
    completeBonus: 50,
    deathModeCompleteMult: 2,
    timerBonusMaxMult: 2,
    dailyBonus: 40,
    dailyBonusDifficultyMult: { easy: 1, medium: 1.3, hard: 1.6, extreme: 2 },
    artistBonusPerExtra: 0.25,
  };

  /* ------------------------------------------------------------
     DOM
  ------------------------------------------------------------ */

  const scoreReadout = el("scoreReadout");
  const scoreValue = el("scoreValue");
  const disc = el("disc");
  const albumImg = el("albumImg");
  const tonearm = el("tonearm");
  const playBtn = el("playBtn");
  const playIcon = el("playIcon");
  const pauseIcon = el("pauseIcon");
  const progressFill = el("progressFill");
  const clipTime = el("clipTime");
  const timerReadout = el("timerReadout");
  const timerValue = el("timerValue");
  const audio = el("audio");
  const playlistTag = el("playlistTag");
  const gameBackBtn = el("gameBackBtn");

  const factsRow = el("factsRow");

  const trackForm = el("trackForm");
  const trackInput = el("trackInput");
  const trackStatus = el("trackStatus");
  const trackReveal = el("trackReveal");
  const artistForm = el("artistForm");
  const artistInput = el("artistInput");
  const artistStatus = el("artistStatus");
  const artistReveal = el("artistReveal");
  const answerLog = el("answerLog");

  const result = el("result");
  const resultImg = el("resultImg");
  const resultTag = el("resultTag");
  const resultTrack = el("resultTrack");
  const resultArtists = el("resultArtists");
  const resultScore = el("resultScore");
  const gameCard = el("gameCard");
  const skipBtn = el("skipBtn");
  const resultAnotherBtn = el("resultAnotherBtn");
  const resultLibraryBtn = el("resultLibraryBtn");
  const resultActions = el("resultActions");

  const deathScreen = el("deathScreen");
  const deathPlaylistName = el("deathPlaylistName");
  const deathGuessed = el("deathGuessed");
  const deathPct = el("deathPct");
  const deathRetryBtn = el("deathRetryBtn");
  const deathLibraryBtn = el("deathLibraryBtn");
  const deathCover = el("deathCover");
  const deathTrack = el("deathTrack");
  const deathArtists = el("deathArtists");
  const deathRunScore = el("deathRunScore");
  const deathReason = el("deathReason");

  const completeScreen = el("completeScreen");
  const completePlaylistName = el("completePlaylistName");
  const completeBonus = el("completeBonus");
  const completeNote = el("completeNote");
  const completeReplayBtn = el("completeReplayBtn");
  const completeLibraryBtn = el("completeLibraryBtn");
  const completeRunScore = el("completeRunScore");

  const library = el("library");
  const featured = el("featured");

  const libraryEmpty = el("libraryEmpty");
  const featuredGrid = el("featuredGrid");

  const profileBadge = el("profileBadge");
  const profileLevel = el("profileLevel");
  const profileBarFill = el("profileBarFill");
  const statsBtn = el("statsBtn");
  const resetStatBtn = el("resetStatBtn");
  const settingsBtn = el("settingsBtn");
  const achievementsBtn = el("achievementsBtn");
  const modalOverlay = el("modalOverlay");
  const modalClose = el("modalClose");
  const settingsPanel = el("settingsPanel");
  const statsPanel = el("statsPanel");
  const achievementsPanel = el("achievementsPanel");
  const difficultySeg = el("difficultySeg");
  const guessModeSeg = el("guessModeSeg");
  const deathModeToggle = el("deathModeToggle");
  const statsGrid = el("statsGrid");
  const statsHintList = el("statsHintList");
  const statsPlaylistList = el("statsPlaylistList");
  const statsAchievements = el("statsAchievements");
  const statsAchievementsCount = el("statsAchievementsCount");

  const statsDailyStreakList = el("statsDailyStreakList");

  const maxArtistsGroup = el("maxArtistsGroup");
  const maxArtistsStepper = el("maxArtistsStepper");
  const maxArtistsMinus = el("maxArtistsMinus");
  const maxArtistsValue = el("maxArtistsValue");
  const maxArtistsPlus = el("maxArtistsPlus");
  const allArtistsToggle = el("allArtistsToggle");
  const saveSettingsBtn = el("saveSettingsBtn");
  const saveSettingsDiv = el("saveSettingsDiv");

  const timerModeToggle = el("timerModeToggle");
  const timerSecondsRow = el("timerSecondsRow");
  const timerSecondsStepper = el("timerSecondsStepper");
  const timerSecondsMinus = el("timerSecondsMinus");
  const timerSecondsValue = el("timerSecondsValue");
  const timerSecondsPlus = el("timerSecondsPlus");

  let preloadTrack;
  let runScoreTotal = 0;
  const CIRC = 578;
  const preloading = true;
  /* ------------------------------------------------------------
     SETTINGS / STATS PERSISTENCE
  ------------------------------------------------------------ */
  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      let maxArtists = raw?.maxArtists;
      if (maxArtists !== "all") {
        maxArtists =
          Number.isFinite(maxArtists) && maxArtists >= 1
            ? Math.floor(maxArtists)
            : 1;
      }
      const timerSeconds = Number.isFinite(raw?.timerSeconds)
        ? Math.min(TIMER_MAX, Math.max(TIMER_MIN, raw.timerSeconds))
        : TIMER_DEFAULT;
      return {
        difficulty: raw?.difficulty || "easy",
        guessMode: raw?.guessMode || "both",
        deathMode: !!raw?.deathMode,
        maxArtists,
        timerMode: !!raw?.timerMode,
        timerSeconds,
      };
    } catch {
      return {
        difficulty: "easy",
        guessMode: "both",
        deathMode: false,
        maxArtists: 1,
        timerMode: false,
        timerSeconds: TIMER_DEFAULT,
      };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadStats(reset = false) {
    const blank = {
      wins: 0,
      losses: 0,
      roundsPlayed: 0,
      totalScore: 0,
      xp: 0,
      deaths: 0,
      timeouts: 0,
      highestDeathStreak: 0,
      longestWinStreak: 0,
      hintFreeWins: 0,
      tracksSkipped: 0,
      playlistsCompleted: 0,
      snippetListenSeconds: 0,
      fastestWinSeconds: null,
      hintsUsed: {},
      artistGuessCounts: {},
      playlists: {},
      dailyStreak: {},
      dailiesCompleted: 0,
    };

    if (reset) return structuredClone(blank);

    try {
      const raw = JSON.parse(localStorage.getItem(STATS_KEY)) || {};

      return Object.fromEntries(
        Object.entries(blank).map(([key, defaultValue]) => {
          const value = raw[key];

          if (key === "dailyStreak") {
            return [
              key,
              Object.fromEntries(
                Object.entries(value || {}).map(([playlist, data]) => [
                  playlist,
                  {
                    ...data,
                    streak: exceededTwoDays(data.lastWon) ? 0 : data.streak,
                  },
                ]),
              ),
            ];
          }
          if (typeof defaultValue === "number") {
            return [
              key,
              typeof value === "number" && Number.isFinite(value)
                ? value
                : defaultValue,
            ];
          }

          if (defaultValue !== null && typeof defaultValue === "object") {
            return [
              key,
              value && typeof value === "object"
                ? value
                : structuredClone(defaultValue),
            ];
          }

          return [key, value !== undefined ? value : defaultValue];
        }),
      );
    } catch {
      return structuredClone(blank);
    }
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function exceededTwoDays(lastWon) {
    if (!lastWon) return true;
    const today = getDay();

    const todayDate = new Date(`${today}T00:00:00Z`);
    const lastWonDate = new Date(`${lastWon}T00:00:00Z`);

    const daysSinceLastWon = (todayDate - lastWonDate) / (1000 * 60 * 60 * 24);

    return daysSinceLastWon >= 2;
  }

  let settings = loadSettings();
  let stats = loadStats();
  let pendingSettings = createReactiveSettings({ ...settings });
  renderSettingsUI();
  let resetConfirmTimeout = null;
  let resetConfirming = false;
  const resetStatBtnText = resetStatBtn.textContent;
  resetStatBtn.addEventListener("click", () => {
    if (!resetConfirming) {
      resetConfirming = true;
      resetStatBtn.textContent = "Are you sure you want to reset?";

      resetConfirmTimeout = setTimeout(() => {
        resetConfirming = false;
        resetStatBtn.textContent = resetStatBtnText;
      }, 1000);

      return;
    }

    clearTimeout(resetConfirmTimeout);
    sendMessage({ type: "reset" });
    resetConfirming = false;
    resetStatBtn.textContent = resetStatBtnText;

    stats = loadStats(true);
    saveStats();
    // Achievements are derived from stats, so a stats reset clears unlocks
    // too — otherwise you'd keep "Century Club" forever after zeroing wins.
    unlockedAchievements = {};
    saveAchievements();
    pendingSettings = createReactiveSettings({ ...settings });
    renderProfileBadge();
    renderStatsPanel();
    window.location.reload();
  });

  function createReactiveSettings(target) {
    return new Proxy(target, {
      set(obj, prop, value) {
        obj[prop] = value;

        renderSettingsUI();

        return true;
      },
    });
  }
  let lastNumericMaxArtists =
    typeof settings.maxArtists === "number" ? settings.maxArtists : 1;

  /* ------------------------------------------------------------
     STATE
  ------------------------------------------------------------ */
  let activePlaylist = null; // { id, name, count }
  let state = {};
  let loadingNext = false;
  let playedTracks = [];
  let runWins = 0; // correct guesses since this playlist was (re)selected
  let runPlayed = 0;
  let currentStreak = 0; // consecutive wins, any mode — breaks on any non-win
  let currentView = "library"; // "library" | "game" | "result" | "death" | "complete"

  function freshState(track = {}) {
    return {
      track: {
        ...(state?.track ?? {}),
        ...(track ?? {}),
      },
      startScore: XP_CONFIG.difficulty[settings.difficulty].start,
      snippetLevelIdx: 0,
      coverStage: 0,
      dateRevealed: false,
      durationRevealed: false,
      hintsCost: 0,
      tracksSkipped: 0,
      wrongGuesses: [],
      trackGuessed: false,
      guessedArtists: [],
      ended: false,
      died: false,
      randomHintUsed: false,
      timedOut: false,
      isPlaying: false,
      finished: false,
      raf: null,
      lastPlayStartPos: 0,
      roundStartedAt: Date.now(),
      timerTotal: settings.timerMode ? settings.timerSeconds : null,
      timerRemaining: settings.timerMode ? settings.timerSeconds : null,
    };
  }

  function saveGame() {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state,
        audioSrc: audio.src,
        trackInput: trackInput.value,
        artistInput: artistInput.value,
        activePlaylist,
        playedTracks,
        runWins,
        runPlayed,
        currentStreak,
      }),
    );
  }

  /* ------------------------------------------------------------
     HELPERS
  ------------------------------------------------------------ */
  function normalize(s) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+-\s+.*$/, "")
      .replace(/[œŒ]/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/Æ/g, "ae")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length,
      n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [
      i,
      ...Array(n).fill(0),
    ]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function fuzzyMatch(guess, target) {
    const g = normalize(guess),
      t = normalize(target);
    if (!g) return false;
    if (g === t) return true;
    if (g.length <= 3 || t.length <= 3) return false;

    const gClean = g.replace(/[^a-z0-9]/g, "");
    const tClean = t.replace(/[^a-z0-9]/g, "");
    if (gClean === tClean) return true;
    if (
      Math.abs(gClean.length - tClean.length) <= 2 &&
      levenshtein(gClean, tClean) <= 1
    )
      return true;

    const gWords = g.split(" ").filter(Boolean);
    const tWords = t.split(" ").filter(Boolean);
    if (gWords.length === tWords.length) {
      if ([...gWords].sort().join(" ") === [...tWords].sort().join(" "))
        return true;
    }

    const len = Math.max(g.length, t.length);
    let maxDist;
    if (len <= 5) maxDist = 0;
    else if (len <= 10) maxDist = 1;
    else if (len <= 20) maxDist = 2;
    else maxDist = 3;

    if (Math.abs(g.length - t.length) > maxDist + 2) return false;
    return levenshtein(g, t) <= maxDist;
  }

  function fmtReleaseDate(dateString) {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function fmtSecondsShort(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  function artistTarget() {
    if (!state) return 1;
    const total = state.track.artists.length;
    if (settings.maxArtists === "all") return total;
    return Math.min(settings.maxArtists, total);
  }

  function isArtistDone() {
    if (!state) return false;
    return state.guessedArtists.length >= artistTarget();
  }

  function currentMaxArtistsNumeric() {
    return typeof pendingSettings.maxArtists === "number"
      ? pendingSettings.maxArtists
      : lastNumericMaxArtists;
  }

  function currentScore() {
    const start =
      typeof state.startScore === "number" && Number.isFinite(state.startScore)
        ? state.startScore
        : XP_CONFIG.difficulty[settings.difficulty].start;
    const penalty =
      state.hintsCost + state.wrongGuesses.length * XP_CONFIG.wrongPenalty;
    return Math.max(0, start - penalty);
  }

  function updateScore() {
    scoreValue.textContent = currentScore();
    saveGame();
  }

  function addFact(label, value) {
    const pill = document.createElement("span");
    pill.className = "fact-pill";
    pill.innerHTML = `${label} <b>${value}</b>`;
    factsRow.appendChild(pill);
  }

  /* ------------------------------------------------------------
     PROFILE / STATS RENDERING
  ------------------------------------------------------------ */
  const LEVEL_TITLES = [
    { min: 1, title: "Newcomer", color: "#808080" },
    { min: 3, title: "Casual Listener", color: "#9E9E9E" },
    { min: 5, title: "Tune Seeker", color: "#8BC34A" },
    { min: 8, title: "Crate Digger", color: "#7CB342" },
    { min: 12, title: "Music Enthusiast", color: "#43A047" },
    { min: 16, title: "Song Explorer", color: "#26A69A" },
    { min: 20, title: "Music Aficionado", color: "#00ACC1" },
    { min: 25, title: "Audio Adventurer", color: "#29B6F6" },
    { min: 30, title: "Audiophile", color: "#1E88E5" },
    { min: 38, title: "Track Hunter", color: "#3949AB" },
    { min: 45, title: "Playlist Curator", color: "#5E35B1" },
    { min: 55, title: "Sound Collector", color: "#673AB7" },
    { min: 65, title: "Melody Specialist", color: "#8E24AA" },
    { min: 75, title: "Maestro", color: "#AB47BC" },
    { min: 90, title: "Rhythm Expert", color: "#D81B60" },
    { min: 105, title: "Harmony Keeper", color: "#E53935" },
    { min: 125, title: "Genre Explorer", color: "#F4511E" },
    { min: 150, title: "Music Scholar", color: "#FB8C00" },
    { min: 175, title: "Discography Detective", color: "#FF9800" },
    { min: 200, title: "Sound Archivist", color: "#FDD835" },
    { min: 250, title: "Music Historian", color: "#C0CA33" },
    { min: 300, title: "Audio Alchemist", color: "#9CCC65" },
    { min: 375, title: "Sonic Architect", color: "#26C6DA" },
    { min: 450, title: "Playlist Prophet", color: "#00ACC1" },
    { min: 550, title: "Melody Master", color: "#039BE5" },
    { min: 650, title: "Sound Sage", color: "#3949AB" },
    { min: 800, title: "Music Oracle", color: "#7E57C2" },
    { min: 950, title: "Living Encyclopedia", color: "#AB47BC" },
    { min: 1100, title: "Legendary Listener", color: "#EC407A" },
    { min: 1300, title: "Master of Sound", color: "#EF5350" },
    { min: 1600, title: "Sonic Legend", color: "#FF7043" },
    { min: 2000, title: "Ultimate Audiophile", color: "#FFA726" },
    { min: 2500, title: "Grand Maestro", color: "#FFCA28" },
    { min: 3000, title: "The Music Sage", color: "#FFD700" },
    { min: 4000, title: "The Sound Immortal", color: "#FFFFFF" },
  ];

  function getLevel(level) {
    let lvl = LEVEL_TITLES[0];
    for (const t of LEVEL_TITLES) {
      if (level >= t.min) lvl = t;
      else break;
    }
    return lvl;
  }
  function getXp() {
    return (
      Math.floor(
        Math.log(1 + (stats.xp * (LEVEL_SCALING - 1)) / LEVEL_XP) /
          Math.log(LEVEL_SCALING),
      ) + 1
    );
  }

  function renderProfileBadge() {
    const level = getXp();

    const currentLevelXP =
      (LEVEL_XP * (Math.pow(LEVEL_SCALING, level - 1) - 1)) /
      (LEVEL_SCALING - 1);

    const nextLevelXP =
      (LEVEL_XP * (Math.pow(LEVEL_SCALING, level) - 1)) / (LEVEL_SCALING - 1);

    const into = stats.xp - currentLevelXP;
    const needed = nextLevelXP - currentLevelXP;

    const lvlInfo = getLevel(level);

    profileLevel.textContent = `Lv. ${level} · ${lvlInfo.title}`;

    profileBarFill.style.width = `${(into / needed) * 100}%`;

    profileBadge.title = `${nextLevelXP - stats.xp} XP left before next level`;

    profileBadge.style.background = `linear-gradient(
        135deg,
        ${lvlInfo.color},
        rgba(0, 0, 0, 0.25)
    )`;
  }

  function mostGuessedArtistLabel() {
    const entries = Object.entries(stats.artistGuessCounts || {});
    if (!entries.length) return "—";
    entries.sort((a, b) => b[1] - a[1]);
    return `${entries[0][0]} (${entries[0][1]})`;
  }

  function renderStatsPanel() {
    const avg = stats.roundsPlayed
      ? Math.round(stats.totalScore / stats.roundsPlayed)
      : 0;

    const winRate = stats.roundsPlayed
      ? Math.round((stats.wins / stats.roundsPlayed) * 100)
      : 0;

    const level = getXp();

    statsGrid.innerHTML = `
    <div><span class="stat-value">Lv. ${level}</span><span class="stat-label">${escapeHtml(getLevel(level).title)}</span></div>
    <div><span class="stat-value">${stats.roundsPlayed}</span><span class="stat-label">rounds played</span></div>
    <div><span class="stat-value">${stats.wins}</span><span class="stat-label">guessed</span></div>
    <div><span class="stat-value">${stats.losses}</span><span class="stat-label">failed</span></div>
    <div><span class="stat-value">${winRate}%</span><span class="stat-label">win rate</span></div>
    <div><span class="stat-value">${avg}</span><span class="stat-label">avg score</span></div>
    <div><span class="stat-value">${stats.xp}</span><span class="stat-label">total xp</span></div>
    <div><span class="stat-value">${stats.deaths}</span><span class="stat-label">deaths</span></div>
    <div><span class="stat-value">${stats.timeouts}</span><span class="stat-label">timeouts</span></div>
    <div><span class="stat-value">${stats.highestDeathStreak}</span><span class="stat-label">best death-mode streak</span></div>
    <div><span class="stat-value">${stats.longestWinStreak}</span><span class="stat-label">longest win streak</span></div>
    <div><span class="stat-value">${stats.hintFreeWins}</span><span class="stat-label">hint-free wins</span></div>
    <div><span class="stat-value">${stats.tracksSkipped}</span><span class="stat-label">tracks skipped</span></div>
    <div><span class="stat-value">${stats.playlistsCompleted}</span><span class="stat-label">playlists completed</span></div>
    <div><span class="stat-value">${stats.dailiesCompleted}</span><span class="stat-label">dailies completed</span></div>
    <div><span class="stat-value">${fmtSecondsShort(stats.snippetListenSeconds)}</span><span class="stat-label">snippet listen time</span></div>
    <div><span class="stat-value">${stats.fastestWinSeconds != null ? fmtSecondsShort(stats.fastestWinSeconds) : "—"}</span><span class="stat-label">fastest win</span></div>
    <div><span class="stat-value" style="font-size:14px;">${escapeHtml(mostGuessedArtistLabel())}</span><span class="stat-label">most guessed artist</span></div>
  `;

    // Dynamic over whatever hints are currently registered — a new
    // HINT_DEFS entry shows up here automatically, nothing to edit.
    statsHintList.innerHTML = Object.keys(HINT_DEFS)
      .map((k) => {
        const label = HINT_DEFS[k].label || k;
        return `<div class="stats-hint-row"><span>${escapeHtml(label)}</span><span>${stats.hintsUsed[k] || 0}</span></div>`;
      })
      .join("");

    const sortedPlaylists = Object.entries(stats.playlists)
      .sort((a, b) => b[1].plays - a[1].plays)
      .slice(0, 5);

    statsPlaylistList.innerHTML = sortedPlaylists.length
      ? sortedPlaylists
          .map(
            ([, p]) =>
              `<div class="stats-playlist-row"><span>${escapeHtml(p.name)}</span><span>${p.plays} plays</span></div>`,
          )
          .join("")
      : `<div class="stats-playlist-row"><span>nothing played yet</span></div>`;

    const sortedDailyStreaks = Object.entries(stats.dailyStreak)
      .sort((a, b) => b[1].streak - a[1].streak)
      .slice(0, 5);

    statsDailyStreakList.innerHTML = sortedDailyStreaks.length
      ? sortedDailyStreaks
          .map(
            ([playlist, data]) =>
              `<div class="stats-playlist-row">
              <span>${escapeHtml(playlist)}</span>
              <span>${data.streak} day${data.streak === 1 ? "" : "s"}</span>
            </div>`,
          )
          .join("")
      : `<div class="stats-playlist-row"><span>no daily streaks yet</span></div>`;
  }

  function renderAchievementsPanel() {
    if (!statsAchievements) return;

    const unlockedCount = ACHIEVEMENTS.filter(
      (a) => unlockedAchievements[a.id],
    ).length;

    if (statsAchievementsCount) {
      statsAchievementsCount.textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`;
    }

    statsAchievements.innerHTML = ACHIEVEMENTS.map((a) => {
      const unlocked = !!unlockedAchievements[a.id];

      return `
      <div class="achievement-chip ${unlocked ? "unlocked" : "locked"}">
        <span class="ach-icon">${unlocked ? a.icon : "🔒"}</span>
        <span class="ach-name">${escapeHtml(a.name)}</span>
        <span class="achievement-description">
          ${escapeHtml(a.desc)}
        </span>
      </div>
    `;
    }).join("");
  }

  /* ------------------------------------------------------------
     SETTINGS UI
  ------------------------------------------------------------ */

  function settingsDirty() {
    return Object.keys(pendingSettings).some(
      (key) => pendingSettings[key] !== settings[key],
    );
  }

  function renderSettingsUI() {
    [...difficultySeg.children].forEach((btn) =>
      btn.classList.toggle(
        "active",
        btn.dataset.value === pendingSettings.difficulty,
      ),
    );
    [...guessModeSeg.children].forEach((btn) =>
      btn.classList.toggle(
        "active",
        btn.dataset.value === pendingSettings.guessMode,
      ),
    );
    deathModeToggle.checked = pendingSettings.deathMode;

    const isAll = pendingSettings.maxArtists === "all";
    allArtistsToggle.checked = isAll;
    maxArtistsValue.textContent = isAll
      ? "all"
      : String(currentMaxArtistsNumeric());
    maxArtistsMinus.disabled = isAll;
    maxArtistsPlus.disabled = isAll;
    maxArtistsStepper.classList.toggle("disabled", isAll);

    timerModeToggle.checked = pendingSettings.timerMode;
    timerSecondsRow.hidden = !pendingSettings.timerMode;
    timerSecondsValue.textContent = fmtSecondsShort(
      pendingSettings.timerSeconds,
    );
    timerSecondsMinus.disabled = pendingSettings.timerSeconds <= TIMER_MIN;
    timerSecondsPlus.disabled = pendingSettings.timerSeconds >= TIMER_MAX;

    saveSettingsDiv.hidden = !settingsDirty();
  }

  difficultySeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-opt");
    if (!btn) return;
    pendingSettings.difficulty = btn.dataset.value;
  });

  guessModeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-opt");
    if (!btn) return;
    pendingSettings.guessMode = btn.dataset.value;
    applyGuessModeVisibility();
    if (state && !state.ended) renderState();
  });

  deathModeToggle.addEventListener("change", () => {
    pendingSettings.deathMode = deathModeToggle.checked;
  });

  maxArtistsMinus.addEventListener("click", () => {
    if (pendingSettings.maxArtists === "all") return;
    pendingSettings.maxArtists = Math.max(1, currentMaxArtistsNumeric() - 1);
    lastNumericMaxArtists = pendingSettings.maxArtists;
    if (state && !state.ended) renderState();
  });

  maxArtistsPlus.addEventListener("click", () => {
    if (pendingSettings.maxArtists === "all") return;
    pendingSettings.maxArtists = Math.min(
      MAX_ARTISTS_CAP,
      currentMaxArtistsNumeric() + 1,
    );
    lastNumericMaxArtists = pendingSettings.maxArtists;
    if (state && !state.ended) renderState();
  });

  allArtistsToggle.addEventListener("change", () => {
    if (allArtistsToggle.checked) {
      pendingSettings.maxArtists = "all";
    } else {
      pendingSettings.maxArtists = lastNumericMaxArtists;
    }
    if (state && !state.ended) renderState();
  });

  timerModeToggle.addEventListener("change", () => {
    pendingSettings.timerMode = timerModeToggle.checked;
  });

  function getTimerStep() {
    const seconds = pendingSettings.timerSeconds;

    if (seconds < 30) return 5;
    if (seconds < 60) return 10;
    if (seconds < 90) return 15;
    if (seconds < 120) return 30;

    return 30;
  }

  timerSecondsMinus.addEventListener("click", () => {
    pendingSettings.timerSeconds = Math.max(
      TIMER_MIN,
      pendingSettings.timerSeconds - getTimerStep(),
    );
  });

  timerSecondsPlus.addEventListener("click", () => {
    pendingSettings.timerSeconds = Math.min(
      TIMER_MAX,
      pendingSettings.timerSeconds + getTimerStep(),
    );
  });

  saveSettingsBtn.addEventListener("click", () => {
    if (!settingsDirty()) return;

    settings.difficulty = pendingSettings.difficulty;
    settings.deathMode = pendingSettings.deathMode;
    settings.maxArtists = pendingSettings.maxArtists;
    settings.guessMode = pendingSettings.guessMode;
    settings.timerMode = pendingSettings.timerMode;
    settings.timerSeconds = pendingSettings.timerSeconds;
    skipBtn.hidden = settings.deathMode;
    saveSettings();
    closeModal();
    restartRound();
  });

  async function restartRound() {
    if (loadingNext) return;
    if (activePlaylist) {
      loadingNext = true;
      playedTracks = [];
      preloadTrack = null;
      runWins = 0;
      setPlaylistTag();
      runPlayed = 0;
      runScoreTotal = 0;
      await startRound(activePlaylist);
      loadingNext = false;
    } else {
      console.log("cannot restart round because no active playlist");
    }
  }

  function applyGuessModeVisibility() {
    trackForm.hidden = pendingSettings.guessMode === "artist";
    artistForm.hidden = pendingSettings.guessMode === "track";
    maxArtistsGroup.hidden = pendingSettings.guessMode === "track";
  }

  function openModal(panel) {
    settingsPanel.hidden = panel !== "settings";
    statsPanel.hidden = panel !== "stats";
    achievementsPanel.hidden = panel !== "achievements";
    if (panel === "settings") {
      pendingSettings = createReactiveSettings({ ...settings });
    } else if (panel === "stats") {
      renderStatsPanel();
    } else if (panel === "achievements") {
      renderAchievementsPanel();
    }
    modalOverlay.hidden = false;
  }
  function closeModal() {
    pendingSettings = createReactiveSettings({ ...settings });
    modalOverlay.hidden = true;
  }

  statsBtn.addEventListener("click", () => openModal("stats"));
  settingsBtn.addEventListener("click", () => openModal("settings"));
  achievementsBtn.addEventListener("click", () => openModal("achievements"));
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  /* ------------------------------------------------------------
     VIEW SWITCHING
  ------------------------------------------------------------ */
  function hideAllViews() {
    featured.hidden = true;
    library.hidden = true;
    gameCard.hidden = true;
    result.hidden = true;
    resultActions.hidden = false;
    deathScreen.hidden = true;
    completeScreen.hidden = true;
  }

  function showLibraryView() {
    hideAllViews();
    library.hidden = false;
    featured.hidden = false;
    scoreReadout.hidden = true;
    currentView = "library";
  }
  function showGameView() {
    hideAllViews();
    gameCard.hidden = false;
    scoreReadout.hidden = false;
    currentView = "game";
  }
  function showResultView() {
    hideAllViews();
    result.hidden = false;
    scoreReadout.hidden = false;
    currentView = "result";
  }
  function endPlaylist() {
    localStorage.removeItem(SAVE_KEY);
    state.finished = true;
  }
  function showDeathView() {
    hideAllViews();
    endPlaylist();
    deathScreen.hidden = false;
    deathRunScore.textContent = runScoreTotal;
    scoreReadout.hidden = false;
    currentView = "death";
  }
  function showCompleteView() {
    if (
      activePlaylist.daily &&
      state.tracksSkipped < 1 &&
      !state.track.finished &&
      runWins > 0 &&
      !state.died &&
      (!state.timerTotal || state.timerRemaining > 0)
    ) {
      if (stats.dailyStreak?.[activePlaylist.name]?.lastWon !== getDay()) {
        sendMessage({ name: activePlaylist.name, type: "finishedDaily" });
        document.getElementById(activePlaylist.name).hidden = false;
        const streakEl = document.getElementById(
          `streak-${activePlaylist.name}`,
        );
        stats.dailiesCompleted++;
        stats.dailyStreak[activePlaylist.name] = {
          lastWon: getDay(),
          streak: exceededTwoDays(
            stats.dailyStreak?.[activePlaylist.name]?.lastWon,
          )
            ? 1
            : stats.dailyStreak[activePlaylist.name].streak + 1,
        };
        streakEl.textContent = stats.dailyStreak[activePlaylist.name].streak;
        streakEl.parentElement.hidden = false;
        saveStats();
      }
    }
    completeRunScore.textContent = runScoreTotal;
    localStorage.removeItem(SAVE_KEY);
    hideAllViews();
    renderResult();
    result.hidden = false;
    resultActions.hidden = true;
    completeScreen.hidden = false;
    scoreReadout.hidden = false;
    currentView = "complete";
  }

  /* ------------------------------------------------------------
     LOADING OVERLAY
  ------------------------------------------------------------ */

  function updateDailyTimers() {
    const now = new Date();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const remaining = tomorrow - now;

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const text =
      `${hours}h ${minutes.toString().padStart(2, "0")}m ` +
      `${seconds.toString().padStart(2, "0")}s`;

    document.querySelectorAll(".daily-time-left").forEach((el) => {
      el.textContent = text;
    });
  }

  /* ------------------------------------------------------------
     LIBRARY
  ------------------------------------------------------------ */

  async function renderFeaturedGrid() {
    const items = await sendMessage({ type: "getFeatured" });
    for (const [name, item] of Object.entries(items)) {
      item.name = name;
      const card = document.createElement("button");
      card.className = "lib-item daily";
      const countLabel = `${item.count} item${item.count === 1 ? "" : "s"}`;
      card.innerHTML = `${libCoverHtml(item)}<div class="lib-name">${escapeHtml(name)}</div><div class="lib-count">${countLabel}</div>`;
      if (item.daily) {
        card.addEventListener("click", () => dailyRound(item));
        const timer = document.createElement("div");
        timer.className = "daily-time-left";
        timer.id = name;
        const cover = card.querySelector(".lib-cover");
        const streakEl = document.createElement("div");
        const streak = stats.dailyStreak?.[name]?.streak ?? 0;
        streakEl.className = "lib-streak";

        streakEl.innerHTML = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.5 2.5c.5 3.2-1.2 5.2-2.8 7.1-1.2 1.5-2.2 2.8-2.2 5
      0 3.4 2.5 6 6 6s6-2.5 6-6c0-2.8-1.4-5-3.5-7.1
      .1 2-1 3.5-2.2 4.3.2-3.5-1.2-6.5-1.3-9.3z"/>
  </svg>
  <span id="streak-${name}">${streak}</span>
`;
        card.appendChild(streakEl);
        streakEl.hidden = streak === 0;
        cover.appendChild(timer);
        timer.hidden = !item.finished;
      } else {
        card.addEventListener("click", () => selectPlaylist(item));
      }
      featuredGrid.appendChild(card);
    }
  }

  function setPlaylistTag() {
    if (playlistTag && activePlaylist) {
      playlistTag.textContent = activePlaylist.name;
      playlistTag.dataset.playlist = uriToUrl(activePlaylist.id);
    }
  }

  function showLibrary() {
    localStorage.removeItem(SAVE_KEY);
    activePlaylist = null;
    preloadTrack = null;
    if (state) stopPlayback();
    stopTimer();
    showLibraryView();
    loadCurrentFolder();
  }

  function fetchPlaylistTrack() {
    return sendMessage({
      type: activePlaylist?.custom ?? "getPlaylistTracks",
      item: activePlaylist,
      playedTracks,
      stats: true,
      totalTracks: 1,
      random: true,
    });
  }

  async function selectPlaylist(item) {
    if (!item?.custom) {
      setURL(item.id);
    }

    activePlaylist = {
      id: item.id,
      daily: false,
      name: item.name,
      count: item.count ?? null,
    };
    restartRound();
  }
  window.selectPlaylist = selectPlaylist;

  gameBackBtn.addEventListener("click", showLibrary);
  playlistTag.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    window.open(playlistTag.dataset.playlist, "_blank");
  });
  // --- paste-a-URL loading ---

  function addArtists(artistDico, div) {
    div.innerHTML = "";
    const artistNames = artistDico.artists;
    const artistUrls = artistDico.artistUris;
    if (artistNames.length !== artistUrls.length) {
      throw new Error("Artist names and URLs must have the same length.");
    }

    artistNames.forEach((name, index) => {
      const link = document.createElement("a");

      link.textContent = name;
      link.href = uriToUrl(artistUrls[index]);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.classList.add("artist-link");

      div.appendChild(link);

      if (index < artistNames.length - 1) {
        div.appendChild(document.createTextNode(", "));
      }
    });
  }

  /* ------------------------------------------------------------
     ROUND SETUP
  ------------------------------------------------------------ */
  function restoreGame(save) {
    activePlaylist = save.activePlaylist || null;
    state = {
      ...freshState(),
      ...save.state,
    };
    playedTracks = save.playedTracks || [];
    runWins = save.runWins || 0;
    runPlayed = save.runPlayed || 0;
    runScoreTotal = save.runScoreTotal || 0;
    currentStreak = save.currentStreak || 0;

    if (state) {
      if (typeof state.startScore !== "number") {
        state.startScore = XP_CONFIG.difficulty[settings.difficulty].start;
      }
      if (!Array.isArray(state.guessedArtists)) {
        state.guessedArtists = state.artistGuessed
          ? [...state.track.artists]
          : [];
      }
      if (typeof state.timerTotal === "undefined") state.timerTotal = null;
      if (typeof state.timerRemaining === "undefined")
        state.timerRemaining = null;
      if (typeof state.roundStartedAt !== "number")
        state.roundStartedAt = Date.now();
      if (typeof state.timedOut === "undefined") state.timedOut = false;
      if (typeof state.lastPlayStartPos !== "number")
        state.lastPlayStartPos = 0;
    }

    setPlaylistTag();

    if (!activePlaylist || !state) {
      showLibrary();
      return;
    }

    showGameView();
    applyGuessModeVisibility();
    renderState();
    iniGame({
      snippet: save.audioSrc,
      trackInput: save.trackInput,
      artistInput: save.artistInput,
    });
  }

  /* ------------------------------------------------------------
     RENDER
  ------------------------------------------------------------ */
  function renderScore() {
    scoreValue.textContent = currentScore();
  }
  function renderClipLength() {
    clipTime.textContent = `${SNIPPET_LEVELS[state.snippetLevelIdx]}s`;
  }

  function renderAlbum() {
    albumImg.src = state.track.album.image || "";
    albumImg.className =
      state.coverStage === 2
        ? "album-img blur-none"
        : state.coverStage === 1
          ? "album-img blur-mid"
          : "album-img";
  }

  function renderGuesses() {
    answerLog.innerHTML = "";
    state.wrongGuesses.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "wrong-chip";
      chip.textContent = text;
      answerLog.appendChild(chip);
    });
    state.guessedArtists.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "right-chip";
      chip.textContent = text;
      answerLog.appendChild(chip);
    });
  }

  function renderInputs() {
    const locked = state.ended;
    const done = isArtistDone();
    const target = artistTarget();

    trackInput.hidden = state.trackGuessed;
    trackReveal.hidden = !state.trackGuessed;
    if (state.trackGuessed) trackReveal.textContent = state.track.name;

    artistInput.hidden = done;
    artistReveal.hidden = !done;
    if (done) addArtists(state.track, artistReveal);

    trackInput.disabled = state.trackGuessed || locked;
    artistInput.disabled = done || locked;
    el("trackSubmit").disabled = state.trackGuessed || locked;
    el("artistSubmit").disabled = done || locked;

    if (state.trackGuessed) {
      trackStatus.textContent = "✓ correct";
      trackStatus.className = "guess-status correct";
    }

    if (done) {
      artistStatus.textContent = "✓ correct";
      artistStatus.className = "guess-status correct";
    } else if (target > 1 && state.guessedArtists.length > 0) {
      artistStatus.textContent = `${state.guessedArtists.length}/${target} found`;
      artistStatus.className = "guess-status correct";
    }
    renderGuesses();
  }

  function renderPlayback() {
    disc.classList.remove("spinning");
    tonearm.classList.remove("playing");
    playIcon.style.display = "";
    pauseIcon.style.display = "none";
    progressFill.style.strokeDashoffset = CIRC;
  }

  function renderResult() {
    if (!state.ended || state.died) return;
    const trackId = state.track.id.split(":").pop();
    const trackUrl = `https://open.spotify.com/track/${trackId}`;

    const t = state.track;
    const win = isRoundWon();
    resultImg.src = t.album.image || "";
    resultTag.textContent = win
      ? "solved"
      : state.timedOut
        ? "time's up"
        : "revealed";
    resultTag.className = win ? "result-tag" : "result-tag lost";
    resultTrack.textContent = t.name;
    resultTrack.onclick = () => window.open(trackUrl, "_blank");
    addArtists(t, resultArtists);
    resultScore.textContent = win ? currentScore() : 0;
    showResultView();
  }

  function renderState() {
    renderScore();
    renderClipLength();
    renderAlbum();
    renderHints();
    renderInputs();
    renderPlayback();
    renderTimerReadout();
    if (state.ended && !state.died) renderResult();
    else if (!state.ended) showGameView();
  }

  function iniGame(obj) {
    if (preloading && !activePlaylist.daily) {
      preloadTrack = fetchPlaylistTrack();
    }
    audio.pause();
    audio.src = obj.snippet;
    audio.currentTime = 0;
    trackInput.value = obj?.trackInput || "";
    artistInput.value = obj?.artistInput || "";
    playSnippet();
    skipBtn.hidden = settings.deathMode;
    startTimer();
  }

  async function dailyRound(item) {
    localStorage.removeItem(SAVE_KEY);
    activePlaylist = {
      id: item.id,
      name: item.name,
      daily: true,
      count: 1,
    };
    setPlaylistTag();
    runScoreTotal = 0;

    state = freshState(item.track);
    trackStatus.textContent = "";
    trackStatus.className = "guess-status";
    artistStatus.textContent = "";
    artistStatus.className = "guess-status";
    applyGuessModeVisibility();
    playedTracks = [0];
    renderState();
    iniGame({ snippet: state.track.snippet, item });
    saveGame();
  }

  async function startRound(item) {
    if (activePlaylist.daily) {
      return await dailyRound(item);
    }
    localStorage.removeItem(SAVE_KEY);
    await showLoadingOverlay();
    let track = null;
    try {
      if (preloadTrack) {
        track = await preloadTrack;
      } else {
        track = await fetchPlaylistTrack();
      }
    } catch (err) {
      console.error("failed to fetch track:", err);
    } finally {
      hideLoadingOverlay();
    }

    if (!track || track.error || (track.finished && runPlayed < 1)) {
      console.log("no track returned for", item, track);
      showToast("No playable tracks found for this playlist");
      showLibrary();
      return;
    } else {
      state.track = {
        ...(state?.track ?? {}),
        ...(track ?? {}),
      };
      activePlaylist.count = state.track.count;
    }

    console.log("state track:", track, state.track, runPlayed);
    if (!item.name || !activePlaylist.name) {
      activePlaylist.name =
        state.track.type === "playlist"
          ? state.track.playlist.name
          : state.track.album.name;
      setPlaylistTag();
    }
    if (track?.finished && runPlayed > 0) {
      await gameEnded();
      return;
    }
    state = freshState(track);
    trackStatus.textContent = "";
    trackStatus.className = "guess-status";
    artistStatus.textContent = "";
    artistStatus.className = "guess-status";
    applyGuessModeVisibility();
    playedTracks = state.track.position;
    renderState();
    iniGame({ snippet: state.track.snippet, item });
    saveGame();
  }

  /* ------------------------------------------------------------
     PLAYBACK
  ------------------------------------------------------------ */
  function currentSnippetLimit() {
    return SNIPPET_LEVELS[state.snippetLevelIdx];
  }

  function stopPlayback() {
    if (state?.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
    if (state?.isPlaying) {
      const listened = Math.max(
        0,
        audio.currentTime - (state.lastPlayStartPos || 0),
      );
      if (Number.isFinite(listened) && listened > 0) {
        stats.snippetListenSeconds += listened;
        saveStats();
      }
    }
    audio.pause();
    audio.currentTime = 0;
    if (state) state.isPlaying = false;
    disc.classList.remove("spinning");
    tonearm.classList.remove("playing");
    playIcon.style.display = "";
    pauseIcon.style.display = "none";
    progressFill.style.strokeDashoffset = CIRC;
  }

  function tickProgress() {
    const limit = currentSnippetLimit();
    const frac = Math.min(audio.currentTime / limit, 1);
    progressFill.style.strokeDashoffset = CIRC * (1 - frac);

    state.raf = requestAnimationFrame(tickProgress);
  }

  function playSnippet(startTime = 0) {
    if (state.ended) return;
    state.lastPlayStartPos = startTime;
    audio.currentTime = startTime;
    audio
      .play()
      .then(() => {
        state.isPlaying = true;
        disc.classList.add("spinning");
        tonearm.classList.add("playing");
        playIcon.style.display = "none";
        pauseIcon.style.display = "";
        state.raf = requestAnimationFrame(tickProgress);
        trackStatus.textContent = "";
      })
      .catch((e) => {
        console.log(e);
        trackStatus.textContent =
          "couldn't start playback — check the audio source";
        trackStatus.className = "guess-status wrong";
      });
    focusInput();
  }

  playBtn.addEventListener("click", () => {
    state.isPlaying ? stopPlayback() : playSnippet();
  });
  audio.addEventListener("ended", stopPlayback);
  audio.addEventListener("timeupdate", () => {
    if (!state.ended && audio.currentTime >= currentSnippetLimit()) {
      stopPlayback();
    }
  });

  /* ------------------------------------------------------------
     TIMER MODE
  ------------------------------------------------------------ */
  let timerIntervalId = null;

  function renderTimerReadout() {
    if (!timerReadout) return;
    if (!state || state.timerTotal == null) {
      timerReadout.hidden = true;
      return;
    }
    timerReadout.hidden = false;
    timerValue.textContent = fmtSecondsShort(state.timerRemaining);
    timerReadout.classList.toggle("timer-danger", state.timerRemaining <= 10);
  }

  function stopTimer() {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (!state || state.timerTotal == null || state.ended) {
      renderTimerReadout();
      return;
    }
    renderTimerReadout();
    timerIntervalId = setInterval(() => {
      if (!state || state.ended) {
        stopTimer();
        return;
      }
      state.timerRemaining -= 1;
      renderTimerReadout();
      if (state.timerRemaining <= 0) {
        stopTimer();
        handleTimerExpired();
      }
    }, 1000);
  }

  function handleTimerExpired() {
    if (!state || state.ended) return;
    deathReason.textContent = "Timer ran out on ";
    finalizeRound({ died: settings.deathMode, timedOut: true });
  }

  /* ------------------------------------------------------------
     HINTS
     ------------------------------------------------------------
     To add a new hint:
       1. Add a button to the HTML hint grid:
            <button class="hint-chip" data-kind="myHint">
              <span class="hint-name">My hint</span>
              <span class="hint-sub"></span>
            </button>
       2. Add one entry below to HINT_DEFS, keyed by that same "kind"
          string. Use makeSingleRevealHint() for anything that's just
          "pay once, reveal a fact forever" (like date/duration/first
          letter). Write a custom { nextCost, isMaxed, isUsed, apply,
          renderSub } object for anything with side effects or multiple
          stages (like snippet/cover).
     That's it — cost checks, the "unaffordable" styling, click wiring,
     per-round cost tracking, and the stats panel's hint-usage list all
     pick up new hints automatically. Nothing else needs to change.
  ------------------------------------------------------------ */
  function makeSingleRevealHint({
    label,
    flagKey,
    cost,
    formatValue,
    showFunc = null,
  }) {
    return {
      label,
      show(state) {
        if (!showFunc) return true;
        return showFunc(state);
      },
      nextCost(state) {
        return state[flagKey] ? null : cost;
      },
      isMaxed(state) {
        return !!state[flagKey];
      },
      isUsed(state) {
        return !!state[flagKey];
      },
      apply(state) {
        state[flagKey] = true;
        state.hintsCost += cost;
      },
      renderSub(state) {
        return state[flagKey] ? formatValue(state) : `−${cost}`;
      },
    };
  }

  const SNIPPET_LEVELS = [1, 3, 5, 10, 15, 30];
  const SNIPPET_COST = { 3: 8, 5: 8, 10: 10, 15: 15, 30: 20 };
  const COVER_COST = { blurry: 10, clear: 12 };
  const HINT_DEFS = {
    snippet: {
      label: "longer snippet",

      show(state) {
        return true;
      },

      nextCost(state) {
        if (state.snippetLevelIdx >= SNIPPET_LEVELS.length - 1) return null;
        return SNIPPET_COST[SNIPPET_LEVELS[state.snippetLevelIdx + 1]];
      },
      isMaxed(state) {
        return state.snippetLevelIdx >= SNIPPET_LEVELS.length - 1;
      },
      isUsed(state) {
        return state.snippetLevelIdx > 0;
      },
      apply(state) {
        stopPlayback();
        const prevLevelSeconds = SNIPPET_LEVELS[state.snippetLevelIdx];
        state.snippetLevelIdx += 1;
        const cost = SNIPPET_COST[SNIPPET_LEVELS[state.snippetLevelIdx]];
        state.hintsCost += cost;
        playSnippet(prevLevelSeconds);
      },
      renderSub(state) {
        if (state.snippetLevelIdx >= SNIPPET_LEVELS.length - 1)
          return "maxed out";
        const next = SNIPPET_LEVELS[state.snippetLevelIdx + 1];
        return `${next}s · −${SNIPPET_COST[next]}`;
      },
    },

    cover: {
      label: "album cover",
      show(state) {
        return true;
      },
      nextCost(state) {
        if (state.coverStage >= 2) return null;
        return state.coverStage === 0 ? COVER_COST.blurry : COVER_COST.clear;
      },
      isMaxed(state) {
        return state.coverStage >= 2;
      },
      isUsed(state) {
        return state.coverStage > 0;
      },
      apply(state) {
        const cost =
          state.coverStage === 0 ? COVER_COST.blurry : COVER_COST.clear;
        state.coverStage += 1;
        state.hintsCost += cost;
      },
      renderSub(state) {
        if (state.coverStage === 0) return `blurry · −${COVER_COST.blurry}`;
        if (state.coverStage === 1) return `clear · −${COVER_COST.clear}`;
        return "revealed";
      },
    },

    date: makeSingleRevealHint({
      label: "release date",
      flagKey: "dateRevealed",
      cost: 4,
      formatValue: (state) => fmtReleaseDate(state.track.release_date),
    }),

    duration: makeSingleRevealHint({
      label: "duration",
      flagKey: "durationRevealed",
      cost: 4,
      formatValue: (state) => fmtDuration(state.track.duration),
    }),

    followers: makeSingleRevealHint({
      label: "followers",
      flagKey: "followersRevealed",
      cost: 4,
      formatValue: (state) =>
        fmtNumber(state.track.artistsInfo.stats.followers),
    }),
    listeners: makeSingleRevealHint({
      label: "listeners",
      flagKey: "listenersRevealed",
      cost: 4,
      formatValue: (state) =>
        fmtNumber(state.track.artistsInfo.stats.monthlyListeners),
    }),

    topCity: makeSingleRevealHint({
      label: "topCity",
      flagKey: "topCityRevealed",
      cost: 4,
      formatValue: (state) => {
        const city = state.track.artistsInfo.stats.topCities.items[0];

        return `${city.city} (${city.country}) - ${fmtNumber(city.numberOfListeners)}`;
      },
    }),
    random: {
      label: "random hint",
      show(state) {
        return true;
      },
      nextCost(state) {
        return state?.randomHintUsed ? null : 3;
      },

      isMaxed(state) {
        return state?.randomHintUsed;
      },

      isUsed(state) {
        return state?.randomHintUsed;
      },

      apply(state) {
        state.randomHintUsed = true;
        const availableHints = Object.keys(HINT_DEFS).filter((kind) => {
          if (kind === "random") return false;

          const def = HINT_DEFS[kind];

          return !def.isMaxed(state);
        });

        if (availableHints.length === 0) {
          showToast("No available hint to be unlocked");
          return;
        }

        const randomKind =
          availableHints[Math.floor(Math.random() * availableHints.length)];

        const randomDef = HINT_DEFS[randomKind];

        const costBefore = state.hintsCost;

        randomDef.apply(state);

        state.hintsCost = costBefore + 3;

        stats.hintsUsed[randomKind] = (stats.hintsUsed[randomKind] || 0) + 1;
      },

      renderSub(state) {
        return state.randomHintUsed ? "used" : "−3";
      },
    },
    genres: makeSingleRevealHint({
      label: "genres",
      flagKey: "genresRevealed",
      cost: 4,
      formatValue: (state) => {
        const genres = state.track.artistsInfo.genres;

        return genres.join(", ");
      },
      showFunc: (state) => {
        return state.track.artistsInfo.genres.length > 0;
      },
    }),
  };

  // Wires every `.hint-chip[data-kind]` found in the DOM to useHint(),
  // and caches them for renderHints(). A button with no matching
  // HINT_DEFS entry (or vice versa) is simply ignored, not an error.
  const hintButtons = new Map();
  document.querySelectorAll(".hint-chip[data-kind]").forEach((btn) => {
    hintButtons.set(btn.dataset.kind, btn);
    btn.addEventListener("click", () => useHint(btn.dataset.kind));
  });

  function renderHints() {
    const score = currentScore();
    hintButtons.forEach((btn, kind) => {
      const def = HINT_DEFS[kind];
      if (!def) return;
      btn.hidden = !def.show(state);
      const sub = btn.querySelector(".hint-sub");
      btn.classList.toggle("used", def.isUsed(state));
      btn.classList.toggle("maxed", def.isMaxed(state));
      if (sub) sub.textContent = def.renderSub(state);
      const cost = def.nextCost(state);
      btn.classList.toggle("unaffordable", cost != null && score < cost);
    });
  }

  function useHint(kind) {
    if (state.ended) return;
    const def = HINT_DEFS[kind];
    if (!def) return;
    const cost = def.nextCost(state);
    if (cost == null) return; // already maxed out
    if (currentScore() < cost) {
      showToast("Not enough score to unlock this hint");
      return;
    }
    def.apply(state);
    // Centralized here so every hint — including ones you add later —
    // gets usage tracking without the hint definition needing to know
    // `stats` exists at all.
    stats.hintsUsed[kind] = (stats.hintsUsed[kind] || 0) + 1;
    saveStats();
    if (maybeDeath()) return;
    renderState();
    saveGame();
    focusInput();
  }

  /* ------------------------------------------------------------
     ACHIEVEMENTS
     ------------------------------------------------------------
     To add a new achievement: add one entry to ACHIEVEMENTS. `check(ctx)`
     gets a snapshot of stats/state/settings from the round that just
     ended (see buildAchievementContext) and returns true/false. Once
     true, it's unlocked forever and never checked again, so `check` can
     just test the current cumulative numbers — no need to detect "did
     this JUST happen" yourself.
  ------------------------------------------------------------ */
  const ACHIEVEMENTS_KEY = "spotifydle-achievements";

  function loadAchievements() {
    try {
      const raw = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY));
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }
  function saveAchievements() {
    localStorage.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify(unlockedAchievements),
    );
  }
  let unlockedAchievements = loadAchievements(); // { [id]: isoTimestamp }

  const ACHIEVEMENTS = [
    // --- streaks ---
    {
      id: "streak_3",
      icon: "🔥",
      name: "On a Roll",
      desc: "Win 3 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 3,
    },
    {
      id: "streak_5",
      icon: "🔥",
      name: "On Fire",
      desc: "Win 5 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 5,
    },
    {
      id: "streak_10",
      icon: "🔥",
      name: "Perfect Ten",
      desc: "Win 10 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 10,
    },
    {
      id: "streak_20",
      icon: "🔥",
      name: "Streak Legend",
      desc: "Win 20 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 20,
    },
    {
      id: "streak_30",
      icon: "🔥",
      name: "Unstoppable",
      desc: "Win 30 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 30,
    },
    {
      id: "streak_50",
      icon: "🔥",
      name: "Untouchable",
      desc: "Win 50 rounds in a row.",
      check: (ctx) => ctx.win && ctx.currentStreak >= 50,
    },

    // --- speed ---
    {
      id: "speed_10",
      icon: "⚡",
      name: "Quick Ear",
      desc: "Win a round in under 10 seconds.",
      check: (ctx) =>
        ctx.win && ctx.elapsedSeconds != null && ctx.elapsedSeconds < 10,
    },
    {
      id: "speed_5",
      icon: "⚡",
      name: "Fast Recognition",
      desc: "Win a round in under 5 seconds.",
      check: (ctx) =>
        ctx.win && ctx.elapsedSeconds != null && ctx.elapsedSeconds < 5,
    },
    {
      id: "speed_3",
      icon: "⚡",
      name: "Lightning Reflexes",
      desc: "Win a round in under 3 seconds.",
      check: (ctx) =>
        ctx.win && ctx.elapsedSeconds != null && ctx.elapsedSeconds < 3,
    },
    {
      id: "speed_2",
      icon: "⚡",
      name: "Instant Recall",
      desc: "Win a round in under 2 seconds.",
      check: (ctx) =>
        ctx.win && ctx.elapsedSeconds != null && ctx.elapsedSeconds < 2,
    },
    {
      id: "speed_1",
      icon: "⚡",
      name: "Blink and You Missed It",
      desc: "Win a round in under 1 second.",
      check: (ctx) =>
        ctx.win && ctx.elapsedSeconds != null && ctx.elapsedSeconds < 1,
    },

    // --- hint-free / precision ---
    {
      id: "hintfree_1",
      icon: "🎯",
      name: "No Help Needed",
      desc: "Win a round without using any hints.",
      check: (ctx) => ctx.stats.hintFreeWins >= 1,
    },
    {
      id: "hintfree_10",
      icon: "🎯",
      name: "Independent Ears",
      desc: "Win 10 rounds without hints.",
      check: (ctx) => ctx.stats.hintFreeWins >= 10,
    },
    {
      id: "hintfree_50",
      icon: "🎯",
      name: "Never Need a Hint",
      desc: "Win 50 rounds without hints.",
      check: (ctx) => ctx.stats.hintFreeWins >= 50,
    },
    {
      id: "hintfree_100",
      icon: "🎯",
      name: "Pure Instinct",
      desc: "Win 100 rounds without using hints.",
      check: (ctx) => ctx.stats.hintFreeWins >= 100,
    },
    {
      id: "flawless_guess",
      icon: "💎",
      name: "Flawless",
      desc: "Win a round with zero wrong guesses.",
      check: (ctx) => ctx.win && ctx.state?.wrongGuesses?.length === 0,
    },

    // --- death mode ---
    {
      id: "death_1",
      icon: "💀",
      name: "Game Over",
      desc: "Die for the first time in death mode.",
      check: (ctx) => ctx.stats.deaths >= 1,
    },
    {
      id: "death_9",
      icon: "💀",
      name: "Nine Lives",
      desc: "Die 9 times in death mode.",
      check: (ctx) => ctx.stats.deaths >= 9,
    },
    {
      id: "death_25",
      icon: "💀",
      name: "Regular Mortality",
      desc: "Die 25 times in death mode.",
      check: (ctx) => ctx.stats.deaths >= 25,
    },
    {
      id: "death_50",
      icon: "💀",
      name: "Frequent Flyer",
      desc: "Die 50 times in death mode.",
      check: (ctx) => ctx.stats.deaths >= 50,
    },
    {
      id: "deathstreak_10",
      icon: "☠️",
      name: "Death Defier",
      desc: "Reach a 10-track streak in death mode.",
      check: (ctx) => ctx.stats.highestDeathStreak >= 10,
    },
    {
      id: "deathstreak_25",
      icon: "☠️",
      name: "Immortal",
      desc: "Reach a 25-track streak in death mode.",
      check: (ctx) => ctx.stats.highestDeathStreak >= 25,
    },
    {
      id: "deathstreak_50",
      icon: "☠️",
      name: "Deathless",
      desc: "Reach a 50-track streak in death mode.",
      check: (ctx) => ctx.stats.highestDeathStreak >= 50,
    },

    // --- timer mode ---
    {
      id: "timer_buzzer",
      icon: "⏱️",
      name: "Buzzer Beater",
      desc: "Win a timer-mode round with 5 seconds or less remaining.",
      check: (ctx) =>
        ctx.win &&
        ctx.settings.timerMode &&
        ctx.state?.timerTotal &&
        ctx.state.timerRemaining <= 5,
    },
    {
      id: "timer_calm",
      icon: "⏱️",
      name: "Time to Spare",
      desc: "Win a timer-mode round with over 90% of the time left.",
      check: (ctx) => {
        if (!ctx.win || !ctx.settings.timerMode || !ctx.state?.timerTotal)
          return false;
        return ctx.state.timerRemaining / ctx.state.timerTotal >= 0.9;
      },
    },
    {
      id: "timer_half",
      icon: "⏱️",
      name: "Half a Minute",
      desc: "Win a timer-mode round with at least half the time remaining.",
      check: (ctx) => {
        if (!ctx.win || !ctx.settings.timerMode || !ctx.state?.timerTotal)
          return false;
        return ctx.state.timerRemaining / ctx.state.timerTotal >= 0.5;
      },
    },
    {
      id: "timeout_1",
      icon: "⏰",
      name: "Out of Time",
      desc: "Let the clock run out on a round.",
      check: (ctx) => ctx.stats.timeouts >= 1,
    },
    {
      id: "timeout_10",
      icon: "⏰",
      name: "Time Is a Construct",
      desc: "Let the clock run out 10 times.",
      check: (ctx) => ctx.stats.timeouts >= 10,
    },

    // --- playlist completion ---
    {
      id: "complete_1",
      icon: "✅",
      name: "Completionist",
      desc: "Flawlessly finish an entire playlist.",
      check: (ctx) => ctx.stats.playlistsCompleted >= 1,
    },
    {
      id: "complete_5",
      icon: "✅",
      name: "Playlist Master",
      desc: "Flawlessly finish 5 playlists.",
      check: (ctx) => ctx.stats.playlistsCompleted >= 5,
    },
    {
      id: "complete_10",
      icon: "✅",
      name: "Serial Completer",
      desc: "Flawlessly finish 10 playlists.",
      check: (ctx) => ctx.stats.playlistsCompleted >= 10,
    },
    {
      id: "complete_25",
      icon: "✅",
      name: "Library Conqueror",
      desc: "Flawlessly finish 25 playlists.",
      check: (ctx) => ctx.stats.playlistsCompleted >= 25,
    },

    // --- volume ---
    {
      id: "rounds_10",
      icon: "📈",
      name: "Getting Started",
      desc: "Play 10 rounds.",
      check: (ctx) => ctx.stats.roundsPlayed - ctx.stats.tracksSkipped >= 10,
    },
    {
      id: "rounds_100",
      icon: "📈",
      name: "Dedicated Listener",
      desc: "Play 100 rounds.",
      check: (ctx) => ctx.stats.roundsPlayed - ctx.stats.tracksSkipped >= 100,
    },
    {
      id: "rounds_500",
      icon: "📈",
      name: "Music Marathon",
      desc: "Play 500 rounds.",
      check: (ctx) => ctx.stats.roundsPlayed - ctx.stats.tracksSkipped >= 500,
    },
    {
      id: "rounds_1000",
      icon: "📈",
      name: "Music Addict",
      desc: "Play 1,000 rounds.",
      check: (ctx) => ctx.stats.roundsPlayed - ctx.stats.tracksSkipped >= 1000,
    },

    // --- wins ---
    {
      id: "wins_50",
      icon: "🏅",
      name: "Half Century",
      desc: "Win 50 rounds total.",
      check: (ctx) => ctx.stats.wins >= 50,
    },
    {
      id: "wins_100",
      icon: "🏅",
      name: "Century Club",
      desc: "Win 100 rounds total.",
      check: (ctx) => ctx.stats.wins >= 100,
    },
    {
      id: "wins_250",
      icon: "🏅",
      name: "Quarter Thousand",
      desc: "Win 250 rounds total.",
      check: (ctx) => ctx.stats.wins >= 250,
    },
    {
      id: "wins_500",
      icon: "🏅",
      name: "Five Hundred",
      desc: "Win 500 rounds total.",
      check: (ctx) => ctx.stats.wins >= 500,
    },

    // --- artists ---
    {
      id: "artist_fan",
      icon: "🎤",
      name: "Super Fan",
      desc: "Correctly guess the same artist 10 times.",
      check: (ctx) => {
        const counts = Object.values(ctx.stats.artistGuessCounts || {});
        return counts.some((c) => c >= 10);
      },
    },
    {
      id: "artist_fan_25",
      icon: "🎤",
      name: "Devoted Fan",
      desc: "Correctly guess the same artist 25 times.",
      check: (ctx) => {
        const counts = Object.values(ctx.stats.artistGuessCounts || {});
        return counts.some((c) => c >= 25);
      },
    },
    {
      id: "artist_fan_50",
      icon: "🎤",
      name: "Ultimate Fan",
      desc: "Correctly guess the same artist 50 times.",
      check: (ctx) => {
        const counts = Object.values(ctx.stats.artistGuessCounts || {});
        return counts.some((c) => c >= 50);
      },
    },
    {
      id: "artist_encyclopedia",
      icon: "🎤",
      name: "Artist Encyclopedia",
      desc: "Correctly guess 25 different artists.",
      check: (ctx) =>
        Object.keys(ctx.stats.artistGuessCounts || {}).length >= 25,
    },
    {
      id: "artist_encyclopedia_50",
      icon: "🎤",
      name: "Walking Encyclopedia",
      desc: "Correctly guess 50 different artists.",
      check: (ctx) =>
        Object.keys(ctx.stats.artistGuessCounts || {}).length >= 50,
    },

    // --- skips ---
    {
      id: "skip_1",
      icon: "⏭️",
      name: "It Happens",
      desc: "Skip a track for the first time.",
      check: (ctx) => ctx.stats.tracksSkipped >= 1,
    },
    {
      id: "skip_25",
      icon: "⏭️",
      name: "Serial Skipper",
      desc: "Skip 25 tracks.",
      check: (ctx) => ctx.stats.tracksSkipped >= 25,
    },
    {
      id: "skip_100",
      icon: "⏭️",
      name: "Skip Button Enthusiast",
      desc: "Skip 100 tracks.",
      check: (ctx) => ctx.stats.tracksSkipped >= 100,
    },

    // --- listening time ---
    {
      id: "listen_300",
      icon: "🎧",
      name: "Ear Training",
      desc: "Spend 5 total minutes listening to snippets.",
      check: (ctx) => ctx.stats.snippetListenSeconds >= 300,
    },
    {
      id: "listen_3600",
      icon: "🎧",
      name: "Golden Ears",
      desc: "Spend 1 total hour listening to snippets.",
      check: (ctx) => ctx.stats.snippetListenSeconds >= 3600,
    },
    {
      id: "listen_18000",
      icon: "🎧",
      name: "Deep Listener",
      desc: "Spend 5 total hours listening to snippets.",
      check: (ctx) => ctx.stats.snippetListenSeconds >= 18000,
    },

    // --- difficulty ---
    {
      id: "hard_win",
      icon: "😈",
      name: "Fearless",
      desc: "Win a round on hard difficulty or above.",
      check: (ctx) =>
        ctx.win &&
        (ctx.settings.difficulty === "hard" ||
          ctx.settings.difficulty === "extreme"),
    },
    {
      id: "extreme_win",
      icon: "😈",
      name: "Masochist",
      desc: "Win a round on extreme difficulty.",
      check: (ctx) => ctx.win && ctx.settings.difficulty === "extreme",
    },
    {
      id: "extreme_blind",
      icon: "🧊",
      name: "Nerves of Steel",
      desc: "Win on extreme difficulty with 15 seconds or less on the clock.",
      check: (ctx) =>
        ctx.win &&
        ctx.settings.timerMode &&
        ctx.settings.difficulty === "extreme" &&
        ctx.state.timerTotal <= 15,
    },
    {
      id: "extreme_fast",
      icon: "🧊",
      name: "Against the Odds",
      desc: "Win on extreme difficulty in under 5 seconds.",
      check: (ctx) =>
        ctx.win &&
        ctx.settings.difficulty === "extreme" &&
        ctx.elapsedSeconds != null &&
        ctx.elapsedSeconds < 5,
    },

    // --- score / XP ---
    {
      id: "score_1000",
      icon: "💰",
      name: "Point Collector",
      desc: "Earn 1,000 total points.",
      check: (ctx) => ctx.stats.totalScore >= 1000,
    },
    {
      id: "score_10000",
      icon: "💰",
      name: "High Scorer",
      desc: "Earn 10,000 total points.",
      check: (ctx) => ctx.stats.totalScore >= 10000,
    },
    {
      id: "score_50000",
      icon: "💰",
      name: "Score Machine",
      desc: "Earn 50,000 total points.",
      check: (ctx) => ctx.stats.totalScore >= 50000,
    },
    {
      id: "xp_10000",
      icon: "✨",
      name: "XP Hunter",
      desc: "Earn 10,000 total XP.",
      check: (ctx) => ctx.stats.xp >= 10000,
    },

    // --- level ---
    {
      id: "level_10",
      icon: "⭐",
      name: "Leveling Up",
      desc: "Reach level 10.",
      check: (ctx) => ctx.level >= 10,
    },
    {
      id: "level_25",
      icon: "⭐",
      name: "Legendary Status",
      desc: "Reach level 25.",
      check: (ctx) => ctx.level >= 25,
    },
    {
      id: "level_50",
      icon: "⭐",
      name: "Living Legend",
      desc: "Reach level 50.",
      check: (ctx) => ctx.level >= 50,
    },

    // --- daily ---
    {
      id: "daily_first",
      icon: "📅",
      name: "First of the Day",
      desc: "Solve your first daily track.",
      check: (ctx) => ctx.stats.dailiesCompleted >= 1,
    },
    {
      id: "daily_10",
      icon: "📅",
      name: "Daily Regular",
      desc: "Solve 10 daily tracks.",
      check: (ctx) => ctx.stats.dailiesCompleted >= 10,
    },
    {
      id: "daily_50",
      icon: "📅",
      name: "Daily Devotee",
      desc: "Solve 50 daily tracks.",
      check: (ctx) => ctx.stats.dailiesCompleted >= 50,
    },
    {
      id: "daily_100",
      icon: "📅",
      name: "Daily Institution",
      desc: "Solve 100 daily tracks.",
      check: (ctx) => ctx.stats.dailiesCompleted >= 100,
    },

    // --- daily playlist streaks ---
    {
      id: "daily_streak_5",
      icon: "🔥",
      name: "Five Day Forecast",
      desc: "Maintain a 5-day streak on a daily playlist.",
      check: (ctx) =>
        Object.values(ctx.stats.dailyStreak || {}).some((d) => d.streak >= 5),
    },
    {
      id: "daily_streak_10",
      icon: "🔥",
      name: "Ten in a Row",
      desc: "Maintain a 10-day streak on a daily playlist.",
      check: (ctx) =>
        Object.values(ctx.stats.dailyStreak || {}).some((d) => d.streak >= 10),
    },
    {
      id: "daily_streak_30",
      icon: "🏆",
      name: "Unbroken Month",
      desc: "Maintain a 30-day streak on a daily playlist.",
      check: (ctx) =>
        Object.values(ctx.stats.dailyStreak || {}).some((d) => d.streak >= 30),
    },
    {
      id: "daily_streak_100",
      icon: "🏆",
      name: "Century Streak",
      desc: "Maintain a 100-day streak on a daily playlist.",
      check: (ctx) =>
        Object.values(ctx.stats.dailyStreak || {}).some((d) => d.streak >= 100),
    },
  ];

  function buildAchievementContext(win) {
    const elapsedSeconds =
      state?.roundStartedAt != null
        ? (Date.now() - state.roundStartedAt) / 1000
        : null;
    return {
      win,
      state,
      stats,
      settings,
      activePlaylist,
      runWins,
      runPlayed,
      currentStreak,
      elapsedSeconds,
      level: 1 + Math.floor(stats.xp / LEVEL_XP),
    };
  }

  function checkAchievements(ctx) {
    let unlockedAny = false;
    ACHIEVEMENTS.forEach((ach) => {
      if (unlockedAchievements[ach.id]) return; // already unlocked
      let earned = false;
      try {
        earned = !!ach.check(ctx);
      } catch (err) {
        console.error(`achievement check failed for "${ach.id}":`, err);
      }
      if (earned) {
        unlockedAchievements[ach.id] = new Date().toISOString();
        unlockedAny = true;
        showToast(`${ach.icon} ${ach.name} unlocked!`, "#1ed760");
      }
    });
    if (unlockedAny) saveAchievements();
  }

  /* ------------------------------------------------------------
     GUESSING
  ------------------------------------------------------------ */
  function logWrong(text) {
    state.wrongGuesses.push(text);
  }

  function isRoundWon() {
    if (settings.guessMode === "track") return state.trackGuessed;
    if (settings.guessMode === "artist") return isArtistDone();
    if (settings.guessMode === "either")
      return state.trackGuessed || isArtistDone();
    return state.trackGuessed && isArtistDone();
  }

  trackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.ended || state.trackGuessed) return;
    const guess = trackInput.value.trim();
    if (!guess) return;

    if (fuzzyMatch(guess, state.track.name)) {
      state.trackGuessed = true;
      checkWin();
    } else {
      trackStatus.textContent = "✗ not quite";
      trackStatus.className = "guess-status wrong";
      logWrong(guess);
      if (maybeDeath()) {
        trackInput.value = "";
        return;
      }
    }
    trackInput.value = "";
    renderInputs();
    updateScore();
    saveGame();
  });

  artistForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.ended || isArtistDone()) return;
    const guess = artistInput.value.trim();
    if (!guess) return;

    const matchedArtist = state.track.artists.find(
      (a) => !state.guessedArtists.includes(a) && fuzzyMatch(guess, a),
    );

    if (matchedArtist) {
      state.guessedArtists.push(matchedArtist);
      stats.artistGuessCounts[matchedArtist] =
        (stats.artistGuessCounts[matchedArtist] || 0) + 1;
      saveStats();
      if (isArtistDone()) checkWin();
    } else {
      artistStatus.textContent = "✗ not quite";
      artistStatus.className = "guess-status wrong";
      logWrong(guess);
      if (maybeDeath()) {
        artistInput.value = "";
        return;
      }
    }
    artistInput.value = "";
    renderInputs();
    updateScore();
    saveGame();
  });

  function focusInput() {
    if (settings.guessMode !== "artist" && !state.trackGuessed)
      trackInput.focus();
    else if (settings.guessMode !== "track" && !isArtistDone())
      artistInput.focus();
  }

  function checkWin() {
    if (isRoundWon()) endGame();
    else focusInput();
  }

  /* ------------------------------------------------------------
     ROUND FINALIZATION
  ------------------------------------------------------------ */
  function recordRoundStats(win) {
    stats.roundsPlayed += 1;
    runPlayed++;
    let artistBonus = 1;
    const requiredArtists = artistTarget();
    if (win && requiredArtists > 1 && isArtistDone()) {
      artistBonus = 1 + (requiredArtists - 1) * XP_CONFIG.artistBonusPerExtra;
    }

    if (win) {
      stats.wins += 1;
      runWins += 1;
      currentStreak += 1;
      stats.longestWinStreak = Math.max(stats.longestWinStreak, currentStreak);
      if (settings.deathMode) {
        stats.highestDeathStreak = Math.max(stats.highestDeathStreak, runWins);
      }
      if (state.hintsCost === 0) stats.hintFreeWins += 1;

      const elapsedSeconds = state.roundStartedAt
        ? (Date.now() - state.roundStartedAt) / 1000
        : null;
      if (
        elapsedSeconds != null &&
        (stats.fastestWinSeconds == null ||
          elapsedSeconds < stats.fastestWinSeconds)
      ) {
        stats.fastestWinSeconds = elapsedSeconds;
      }
    } else {
      stats.losses += 1;
      currentStreak = 0;
      if (state.died) stats.deaths += 1;
      if (state.timedOut) stats.timeouts += 1;
    }

    let timerMult = 1;
    if (win && settings.timerMode && state.timerTotal) {
      const remaining = Math.max(0, state.timerRemaining ?? 0);
      const frac = remaining / state.timerTotal;
      timerMult = 1 + (XP_CONFIG.timerBonusMaxMult - 1) * frac;
    }

    const finalScore = win ? currentScore() : 0;
    let scaled = Math.round(
      finalScore *
        XP_CONFIG.difficulty[settings.difficulty].mult *
        XP_CONFIG.guessModeMult[settings.guessMode] *
        artistBonus *
        timerMult,
    );
    if (activePlaylist.daily) {
      scaled += Math.round(
        XP_CONFIG.dailyBonus *
          XP_CONFIG.dailyBonusDifficultyMult[settings.difficulty] *
          XP_CONFIG.guessModeMult[settings.guessMode],
      );
    }
    if (!Number.isFinite(scaled)) scaled = 0;
    stats.totalScore += scaled;
    stats.xp += scaled;
    runScoreTotal += scaled;

    if (activePlaylist) {
      const existing = stats.playlists[activePlaylist.id] || {
        name: activePlaylist.name,
        plays: 0,
      };
      existing.plays += 1;
      existing.name = activePlaylist.name;
      stats.playlists[activePlaylist.id] = existing;
    }

    saveStats();
    renderProfileBadge();
  }

  function endGameLoop() {
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        state.isPlaying = true;
        disc.classList.add("spinning");
        tonearm.classList.add("playing");
        playIcon.style.display = "none";
        pauseIcon.style.display = "";

        audio.onended = () => {
          if (state.ended) endGameLoop();
        };
      })
      .catch(() => {
        trackStatus.textContent =
          "couldn't start playback — check the audio source";
        trackStatus.className = "guess-status wrong";
      });
  }

  function finalizeRound({ died, timedOut = false }) {
    state.ended = true;
    state.died = !!died;
    state.timedOut = !!timedOut;
    stopPlayback();
    stopTimer();
    const win = !died && isRoundWon();
    recordRoundStats(win);
    // Single choke point every round (win, loss, death, timeout, skip)
    // passes through — see the callers of finalizeRound() below.
    checkAchievements(buildAchievementContext(win));
    saveGame();

    endGameLoop();

    if (died) {
      deathPlaylistName.textContent = activePlaylist ? activePlaylist.name : "";
      deathGuessed.textContent = runWins;
      const pct = activePlaylist?.count
        ? Math.round((runPlayed / activePlaylist.count) * 100)
        : 0;
      deathPct.textContent = `${pct}%`;
      deathCover.src = state.track.album.image || "";
      deathTrack.textContent = state.track.name;
      addArtists(state.track, deathArtists);

      const trackId = state.track.id.split(":").pop();
      deathTrack.onclick = () =>
        window.open(`https://open.spotify.com/track/${trackId}`, "_blank");

      showDeathView();
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    if (playedTracks.length >= activePlaylist.count) {
      gameEnded();
      return;
    }

    renderState();
  }

  async function gameEnded() {
    endPlaylist();
    // "Flawless" = every track was actually guessed this run — not just
    // served. A skipped or timed-out track still counts toward
    // playedTracks (so `finished` still triggers), but never increments
    // runWins, so this comparison alone already enforces "nothing skipped".
    const flawless = state.tracksSkipped === 0 && runWins > 0;
    let bonus = 0;
    if (flawless) {
      const completionMult = settings.deathMode
        ? XP_CONFIG.deathModeCompleteMult
        : 1;
      bonus = Math.round(
        XP_CONFIG.completeBonus *
          completionMult *
          XP_CONFIG.guessModeMult[settings.guessMode],
      );
      if (!Number.isFinite(bonus)) bonus = 0;
      runScoreTotal += bonus;
      stats.xp += bonus;
      stats.totalScore += bonus;
      stats.playlistsCompleted += 1;
      saveStats();
      renderProfileBadge();
    }

    // A completion isn't "a round" in the strict sense, but it does
    // change stats (playlistsCompleted etc.), so it gets a check too.
    checkAchievements(buildAchievementContext(false));
    completePlaylistName.textContent = activePlaylist.name;
    completeBonus.textContent = bonus;
    if (completeNote) {
      completeNote.textContent = flawless
        ? "flawless run — every track guessed, nothing skipped."
        : "you made it through the playlist, but some tracks were skipped or missed, so no bonus this time.";
    }
    playedTracks = [];
    if (preloading) {
      preloadTrack = fetchPlaylistTrack();
    }
    showCompleteView();
  }
  function endGame() {
    if (runPlayed > 0) {
    }
    finalizeRound({ died: false });
  }

  function maybeDeath() {
    if (!settings.deathMode) return false;
    if (state.ended) return false;
    if (currentScore() > 0) return false;
    deathReason.textContent = "Score reached 0 on ";
    scoreValue.textContent = 0;
    finalizeRound({ died: true });
    return true;
  }

  skipBtn.addEventListener("click", () => {
    if (!state.ended) {
      state.tracksSkipped += 1;
      stats.tracksSkipped += 1;
      saveStats();
      endGame();
    }
  });

  function nextTrack() {
    if (loadingNext) return;
    if (!activePlaylist) {
      showLibrary();
      return;
    }
    loadingNext = true;
    startRound(activePlaylist).finally(() => {
      loadingNext = false;
    });
  }

  resultAnotherBtn.addEventListener("click", nextTrack);

  document.addEventListener("keydown", (e) => {
    if (currentView === "result" && e.key === "Enter") nextTrack();
  });

  resultLibraryBtn.addEventListener("click", showLibrary);

  deathRetryBtn.addEventListener("click", () => {
    if (!activePlaylist) {
      showLibrary();
      return;
    }
    restartRound();
  });
  deathLibraryBtn.addEventListener("click", showLibrary);

  completeReplayBtn.addEventListener("click", () => {
    if (!activePlaylist) {
      showLibrary();
      return;
    }
    restartRound();
  });
  completeLibraryBtn.addEventListener("click", showLibrary);

  window.addEventListener("beforeunload", (event) => {
    if (!state.finished) {
      saveGame();
    }
  });

  /* ------------------------------------------------------------
     BOOT
  ------------------------------------------------------------ */
  renderProfileBadge();
  applyGuessModeVisibility();
  renderFeaturedGrid();
  setInterval(updateDailyTimers, 1000);
  if (!handleSpotifyParameter()) {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      restoreGame(JSON.parse(saved));
    } else {
      showLibrary();
    }
  }
})();
