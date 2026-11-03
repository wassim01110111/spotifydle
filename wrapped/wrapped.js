(() => {
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const audio = el("audio");
  const state = {
    period: "monthly",
    data: null,
    slide: 0,
    slideCount: 6,
    navigationInitialized: false,
  };
  const slider = el("rangeSlider");
  const rangeValue = el("rangeValue");
  const rangeFill = el("rangeFill");
  const rangeGlow = el("rangeGlow");
  const customCard = el("customCard");
  const loadingState = el("loadingState");
  const valueDisplay = el("rangeSliderValue");
  const coversToResolve = {};
  let fetchingWrapped = false;

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("is-active");
    });

    if (id) {
      const screen = document.getElementById(id);

      if (!screen) {
        console.error(`Screen not found: ${id}`);
        return;
      }

      screen.classList.add("is-active");
    }
  }

  function buildLoadingArtTile(element, uri) {
    element.classList.add("art-tile--loading");
    element.style.backgroundImage = "";
    element.textContent = "";
    element.dataset.toload = uri;

    element.innerHTML = `
    <span class="art-tile__spinner" aria-hidden="true"></span>
  `;
  }

  function buildDailyCounts(dayMap, period) {
    const days = Number(period);
    const result = [];

    const dates = [...dayMap.values()];

    if (!dates.length) {
      return result;
    }

    let end = dates[0];

    for (const date of dates) {
      if (
        date.year > end.year ||
        (date.year === end.year && date.month > end.month) ||
        (date.year === end.year &&
          date.month === end.month &&
          date.day > end.day)
      ) {
        end = date;
      }
    }

    function previousDay(date) {
      const result = {
        year: date.year,
        month: date.month,
        day: date.day,
      };

      if (result.day > 1) {
        result.day--;
        return result;
      }

      if (result.month > 1) {
        result.month--;
      } else {
        result.month = 12;
        result.year--;
      }

      const daysInMonth = new Date(result.year, result.month, 0).getDate();

      result.day = daysInMonth;

      return result;
    }

    const datesInRange = [];

    let current = {
      year: end.year,
      month: end.month,
      day: end.day,
    };

    for (let i = 0; i < days; i++) {
      datesInRange.push(current);
      current = previousDay(current);
    }

    datesInRange.reverse();

    for (const date of datesInRange) {
      const key = `${date.year}-${date.month}-${date.day}`;

      const existing = dayMap.get(key);

      result.push({
        year: date.year,
        month: date.month,
        day: date.day,
        count: existing ? existing.count : 0,
      });
    }

    return result;
  }

  function aggregate(items, period) {
    const albumMap = new Map();
    const artistMap = new Map();
    const dayMap = new Map();
    const trackMap = new Map();

    let totalSeconds = 0;
    let totalPlays = 0;

    for (const item of items || []) {
      const uri = item.uri;
      const name = item.name || "Unknown";
      const durationSec = item.duration;

      totalPlays += 1;
      totalSeconds += durationSec;

      if (!trackMap.has(uri)) {
        trackMap.set(uri, {
          uri,
          name,
          cover: item.cover,
          artists: item.artists.map((artist) => artist.name).join(", "),
          count: 1,
          duration: durationSec,
        });
      } else {
        trackMap.get(uri).count += 1;
      }

      for (const contributor of item.artists || []) {
        if (!contributor?.uri) {
          continue;
        }

        if (!artistMap.has(contributor.uri)) {
          artistMap.set(contributor.uri, {
            uri: contributor.uri,
            name: contributor.name,
            count: 1,
            cover: null,
            duration: durationSec,
          });
        } else {
          artistMap.get(contributor.uri).count += 1;
          artistMap.get(contributor.uri).duration += durationSec;
        }
      }

      if (item.album?.uri) {
        if (!albumMap.has(item.album.uri)) {
          albumMap.set(item.album.uri, {
            uri: item.album.uri,
            name: item.album.name,
            count: 1,
            cover: null,
            duration: durationSec,
          });
        } else {
          albumMap.get(item.album.uri).count += 1;
          albumMap.get(item.album.uri).duration += durationSec;
        }
      }

      const date = item.date;

      if (date && date.year && date.month && date.day) {
        const key = `${date.year}-${date.month}-${date.day}`;

        if (!dayMap.has(key)) {
          dayMap.set(key, {
            ...date,
            count: 1,
            duration: durationSec,
          });
        } else {
          dayMap.get(key).count += 1;
          dayMap.get(key).duration += durationSec;
        }
      }
    }

    const top = (map, n = 5) =>
      [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);

    const topTracks = top(trackMap);
    const topArtists = top(artistMap);
    const topAlbums = top(albumMap);

    topArtists.forEach(({ uri }) => {
      coversToResolve[uri] ??= null;
    });

    topAlbums.forEach(({ uri }) => {
      coversToResolve[uri] ??= null;
    });

    let peakDay = null;

    for (const day of dayMap.values()) {
      if (!peakDay || day.count > peakDay.count) {
        peakDay = day;
      }
    }

    return {
      period,
      totalPlays,
      totalSeconds,
      totalArtists: artistMap.size,
      totalAlbums: albumMap.size,
      UniqueTracks: trackMap.size,
      topTracks,
      topArtists,
      topAlbums,
      peakDay,
      dailyCounts: buildDailyCounts(dayMap, period),
    };
  }

  async function getCovers() {
    const query = [];

    for (const [key, value] of Object.entries(coversToResolve)) {
      if (!value) {
        query.push(key);
      }
    }

    if (query.length > 0) {
      const covers = await sendMessage({
        type: "getCovers",
        items: query,
      });

      for (const [key, value] of Object.entries(covers)) {
        if (key in coversToResolve) {
          coversToResolve[key] = value;
        }
      }
    }
  }

  function resolveCover(uri, image = null) {
    const elements = document.querySelectorAll(
      `[data-toload="${CSS.escape(uri)}"]`,
    );

    for (const element of elements) {
      element.classList.remove("art-tile--loading");

      const elName = element.textContent;

      element.innerHTML = "";

      if (image) {
        element.style.backgroundImage = `url("${image}")`;
      } else {
        element.textContent = initials(elName);
      }
    }
  }

  async function getWrapped(period) {
    return await sendMessage({
      type: "getRecent",
      limit: parseInt(period),
      currentDay: false,
    });
  }

  function initials(name) {
    return (name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  function buildArtTile(element, cover, name) {
    element.classList.remove("art-tile--loading");
    element.innerHTML = "";

    if (cover) {
      element.style.backgroundImage = `url("${cover}")`;
      element.textContent = "";
    } else {
      element.style.backgroundImage = "";
      element.textContent = initials(name);
    }
  }
  function formatPercentage(value) {
    if (value < 0.1) {
      return "<0.1%";
    }

    return `${value.toFixed(1)}%`;
  }
  function renderRankList(target, entries, totalSeconds) {
    const container = el(`list-${target}s`);
    const topElement = entries[0];
    if (topElement) {
      const topElementDuration =
        target === "track"
          ? topElement.duration * topElement.count
          : topElement.duration;

      const percentage = (topElementDuration / totalSeconds) * 100;
      el(`stat-top-${target}`).textContent =
        `${topElement.name} took the top spot with ${topElement.count} plays — ${formatPercentage(percentage)} of your listening time`;
    } else {
      el(`stat-top-${target}`).textContent = "";
    }
    container.innerHTML = "";

    entries.forEach((entry, index) => {
      const url = uriToUrl(entry.uri);

      const li = document.createElement("li");
      li.className = "rank-row";

      const link = document.createElement("a");

      link.className = "rank-row__link";

      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.href = "#";
      }

      link.innerHTML = `
      <span class="rank-row__index">
        ${index + 1}
      </span>

      <span class="rank-row__art"></span>

      <span class="rank-row__body">
        <span class="rank-row__name"></span>
        <span class="rank-row__sub"></span>
      </span>

      <span class="rank-row__count"></span>

      <span class="rank-row__arrow">↗</span>
    `;

      link.querySelector(".rank-row__name").textContent = entry.name;

      link.querySelector(".rank-row__sub").textContent = entry.artists || "";

      link.querySelector(".rank-row__count").textContent =
        `${entry.count} play${entry.count === 1 ? "" : "s"}`;

      const artElement = link.querySelector(".rank-row__art");

      li.appendChild(link);
      container.appendChild(li);

      if (entry.cover) {
        buildArtTile(artElement, entry.cover, entry.name);
      } else {
        buildLoadingArtTile(artElement, entry.uri);
      }
    });
  }

  function formatPeakDate(date) {
    if (!date) {
      return {
        full: "No standout day",
        short: "—",
      };
    }

    const monthName = MONTH_NAMES[(date.month - 1 + 12) % 12] || "";

    return {
      full: `${monthName} ${date.day}, ${date.year}`,
      short: `${monthName.slice(0, 3)} ${date.day}`,
    };
  }

  function buildBarcode(svg, seedString) {
    svg.innerHTML = "";

    let seed = 0;

    for (let i = 0; i < seedString.length; i++) {
      seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
    }

    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;

      return seed / 4294967295;
    };

    let x = 0;

    const width = 240;
    const height = 40;

    while (x < width) {
      const barWidth = 1 + Math.floor(rand() * 3);

      if (rand() > 0.42) {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );

        rect.setAttribute("x", x);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", barWidth);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", "#F5F5F0");

        svg.appendChild(rect);
      }

      x += barWidth + 1;
    }
  }

  function renderPeakChart(dailyCounts, peakDay) {
    const container = el("peak-chart");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!dailyCounts?.length) {
      return;
    }

    const maxCount = Math.max(1, ...dailyCounts.map((day) => day.count));

    dailyCounts.forEach((day) => {
      const height =
        day.count === 0 ? 2 : Math.max(6, (day.count / maxCount) * 100);

      const isPeak =
        peakDay &&
        day.year === peakDay.year &&
        day.month === peakDay.month &&
        day.day === peakDay.day;

      const bar = document.createElement("div");

      bar.className = "peak-bar";

      if (isPeak) {
        bar.classList.add("is-peak");
      }

      bar.style.setProperty("--bar-height", `${height}%`);

      bar.innerHTML = `
      <div class="peak-bar__value">${day.count}</div>

      <div class="peak-bar__track">
        <div class="peak-bar__fill"></div>
      </div>

      <div class="peak-bar__label">
        ${day.day}
      </div>
    `;

      container.appendChild(bar);
    });
  }

  function renderStory(agg) {
    const rangeLabels = {
      7: "WEEKLY RECAP",
      30: "MONTHLY RECAP",
      60: "BIMONTHLY RECAP",
      90: "QUARTERLY RECAP",
    };

    const rangeLabel = rangeLabels[agg.period] || `${agg.period}-DAY RECAP`;
    const totalMinutes = Math.round(agg.totalSeconds / 60);
    el("slide-hero-range").textContent = rangeLabel;

    animateNumber(el("stat-total-plays"), agg.totalPlays);

    animateNumber(el("stat-total-minutes"), totalMinutes);

    animateNumber(el("stat-total-artists"), agg.totalArtists);

    animateNumber(el("stat-total-albums"), agg.totalAlbums);

    animateNumber(el("stat-total-average-minute"), totalMinutes / agg.period);

    animateNumber(el("stat-total-average-track"), agg.totalPlays / agg.period);

    animateNumber(
      el("stat-total-unique-tracks"),
      (agg.UniqueTracks / agg.totalPlays) * 100,
    );

    renderRankList("track", agg.topTracks, agg.totalSeconds);

    renderRankList("artist", agg.topArtists, agg.totalSeconds);

    renderRankList("album", agg.topAlbums, agg.totalSeconds);

    const peak = formatPeakDate(agg.peakDay);

    el("stat-peak-date").textContent = peak.full;

    el("stat-peak-count").textContent = agg.peakDay ? agg.peakDay.count : 0;
    el("stat-top-day").textContent =
      `${fmtTime(agg.peakDay.duration)} - ${formatPercentage((agg.peakDay.duration / agg.totalSeconds) * 100)} of your listening time`;

    renderPeakChart(agg.dailyCounts, agg.peakDay);

    const ticketLabels = {
      7: "WEEKLY",
      30: "MONTHLY",
      60: "BIMONTHLY",
      90: "QUARTERLY",
    };

    el("ticket-range").textContent = ticketLabels[agg.period] || "MONTHLY";

    el("ticket-minutes").textContent = fmtNumber(totalMinutes);

    el("average-minutes").textContent = fmtNumber(totalMinutes / agg.period);

    el("ticket-peak-day").textContent = peak.short;

    renderTicketEntities(agg);

    getCovers().then(() => {
      for (const [key, value] of Object.entries(coversToResolve)) {
        resolveCover(key, value);
      }
    });

    buildBarcode(
      el("ticket-barcode"),
      (agg.topTracks[0]?.uri || "wrapped") + agg.totalPlays,
    );
  }

  function animateNumber(element, target) {
    const duration = 700;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);

      const eased = 1 - Math.pow(1 - progress, 3);

      element.textContent = Math.round(eased * target).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function buildNavDots() {
    const nav = el("story-nav");

    nav.innerHTML = "";

    for (let i = 0; i < state.slideCount; i++) {
      const dot = document.createElement("div");

      dot.className = "story-nav__dot";

      nav.appendChild(dot);
    }
  }

  function updateStoryControls() {
    document.querySelectorAll(".story-nav__dot").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === state.slide);
    });

    el("btn-prev").disabled = state.slide === 0;

    el("btn-next").disabled = state.slide === state.slideCount - 1;
  }

  function goToSlide(index, behavior = "smooth") {
    const track = el("story-track");

    if (!track) {
      return;
    }

    const slides = track.querySelectorAll(".slide");

    if (!slides.length) {
      return;
    }

    state.slide = Math.max(0, Math.min(slides.length - 1, index));

    const targetSlide = slides[state.slide];

    const left = targetSlide.offsetLeft;

    if (behavior === "auto") {
      track.scrollLeft = left;
    } else {
      track.scrollTo({
        left,
        behavior: "smooth",
      });
    }

    updateStoryControls();
  }

  function resetStoryPosition() {
    const track = el("story-track");

    if (!track) {
      return;
    }

    state.slide = 0;

    track.scrollLeft = 0;

    updateStoryControls();
  }

  function initStoryNav() {
    if (state.navigationInitialized) {
      return;
    }

    const track = el("story-track");
    const nextBtn = el("btn-next");
    const prevBtn = el("btn-prev");

    buildNavDots();

    nextBtn.addEventListener("click", () => {
      goToSlide(state.slide + 1, "smooth");
    });

    prevBtn.addEventListener("click", () => {
      goToSlide(state.slide - 1, "smooth");
    });

    document.addEventListener("keydown", (event) => {
      if (!el("screen-story").classList.contains("is-active")) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();

        goToSlide(state.slide + 1, "smooth");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();

        goToSlide(state.slide - 1, "smooth");
      }
    });

    let scrollTimer = null;

    track.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimer);

        scrollTimer = setTimeout(() => {
          const slideWidth = track.clientWidth;

          if (!slideWidth) {
            return;
          }

          const index = Math.round(track.scrollLeft / slideWidth);

          const clampedIndex = Math.max(
            0,
            Math.min(state.slideCount - 1, index),
          );

          if (clampedIndex !== state.slide) {
            state.slide = clampedIndex;

            updateStoryControls();
          }
        }, 50);
      },
      {
        passive: true,
      },
    );

    resetStoryPosition();

    state.navigationInitialized = true;
  }

  function setShareStatus(message) {
    const shareElement = el("share-status");

    shareElement.textContent = message;

    if (message) {
      setTimeout(() => {
        if (shareElement.textContent === message) {
          shareElement.textContent = "";
        }
      }, 3200);
    }
  }

  async function captureTicket() {
    const ticket = el("ticket-card");

    return html2canvas(ticket, {
      backgroundColor: "#0B0B0C",
      scale: Math.min(3, window.devicePixelRatio * 2 || 2),
      useCORS: true,
    });
  }

  async function handleSave() {
    try {
      setShareStatus("Rendering image…");

      const canvas = await captureTicket();

      const link = document.createElement("a");

      link.download = `wrapped-${state.period}.png`;

      link.href = canvas.toDataURL("image/png");

      link.click();

      setShareStatus("Saved ✓");
    } catch (error) {
      console.error(error);

      setShareStatus("Couldn't save the image.");
    }
  }

  async function handleCopy() {
    try {
      setShareStatus("Rendering image…");

      const canvas = await captureTicket();

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setShareStatus("Couldn't copy the image.");
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);

          setShareStatus("Copied to clipboard ✓");
        } catch (error) {
          console.error(error);

          setShareStatus("Clipboard access blocked by the browser.");
        }
      }, "image/png");
    } catch (error) {
      console.error(error);

      setShareStatus("Couldn't copy the image.");
    }
  }

  function createEntityLink(entry, index, type) {
    const url = uriToUrl(entry.uri);

    const link = document.createElement("a");

    link.className = `ticket__entity ticket__entity--${type}`;

    if (url) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.href = "#";
    }

    link.innerHTML = `
    <span class="ticket__entity-rank">
      ${index + 1}
    </span>

    <span class="ticket__entity-art"></span>

    <span class="ticket__entity-info">
      <span class="ticket__entity-name"></span>

      ${type === "track" ? `<span class="ticket__entity-sub"></span>` : ""}
    </span>

    <span class="ticket__entity-count"></span>

    <span class="ticket__entity-arrow">
      ↗
    </span>
  `;

    link.querySelector(".ticket__entity-name").textContent = entry.name;

    if (type === "track") {
      link.querySelector(".ticket__entity-sub").textContent =
        entry.artists || "";
    }

    link.querySelector(".ticket__entity-count").textContent = `${entry.count}×`;

    const artElement = link.querySelector(".ticket__entity-art");

    if (entry.cover) {
      buildArtTile(artElement, entry.cover, entry.name);
    } else {
      buildLoadingArtTile(artElement, entry.uri);
    }

    return link;
  }

  function renderTicketEntities(agg) {
    const tracksContainer = el("ticket-top-tracks");

    const artistsContainer = el("ticket-top-artists");

    const albumsContainer = el("ticket-top-albums");

    tracksContainer.innerHTML = "";
    artistsContainer.innerHTML = "";
    albumsContainer.innerHTML = "";

    agg.topTracks.slice(0, 5).forEach((track, index) => {
      tracksContainer.appendChild(createEntityLink(track, index, "track"));
    });

    sendMessage({
      type: "getSnippet",
      uri: agg.topTracks[
        Math.floor(Math.random() * Math.min(agg.topTracks.length, 20))
      ].uri,
    }).then((url) => {
      audio.src = url;
      audio.loop = true;
      audio.currentTime = 0;
      audio.play();
    });

    agg.topArtists.slice(0, 5).forEach((artist, index) => {
      artistsContainer.appendChild(createEntityLink(artist, index, "artist"));
    });

    agg.topAlbums.slice(0, 5).forEach((album, index) => {
      albumsContainer.appendChild(createEntityLink(album, index, "album"));
    });
  }

  async function runWrapped(period) {
    state.period = period;

    showScreen(null);
    await showLoadingOverlay();
    try {
      fetchingWrapped = true;
      const raw = await getWrapped(period);
      fetchingWrapped = false;
      loadingState.textContent = "";

      const items = Array.isArray(raw) ? raw : [];

      hideLoadingOverlay();

      if (items.length === 0) {
        const periodLabels = {
          7: "last 7 days",
          30: "last 30 days",
          60: "last 60 days",
          90: "last 90 days",
        };

        el("empty-detail").textContent = `No plays found for the ${
          periodLabels[period] || `last ${period} days`
        }.`;

        showScreen("screen-empty");

        return;
      }

      const agg = aggregate(items, period);

      state.data = agg;

      renderStory(agg);

      resetStoryPosition();

      if (!state.navigationInitialized) {
        initStoryNav();
      }

      showScreen("screen-story");

      requestAnimationFrame(() => {
        resetStoryPosition();
      });
    } catch (error) {
      fetchingWrapped = false;
      console.error("getWrapped failed", error);

      el("empty-detail").textContent =
        "Something went wrong while loading your data.";

      showScreen("screen-empty");
    }
  }
  function updateRange(value, animate = true) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const current = Number(value);

    const percentage = ((current - min) / (max - min)) * 100;

    rangeValue.textContent = current;
    rangeFill.style.width = `${percentage}%`;
    rangeGlow.style.width = `${percentage}%`;
    customCard.dataset.range = current;
    customCard.querySelector(".range-card__num").textContent = current;
    if (animate) {
      valueDisplay.classList.remove("is-changing");

      void valueDisplay.offsetWidth;

      valueDisplay.classList.add("is-changing");
    }
  }
  updateRange(slider.value);
  slider.addEventListener("input", () => {
    updateRange(slider.value);
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "wrappedProgress") {
      return;
    }

    loadingState.textContent = message.message;
  });
  window.addEventListener("pagehide", (event) => {
    if (fetchingWrapped) {
      chrome.runtime.sendMessage({ type: "cancel" });
    }
  });
  document.querySelectorAll(".range-card").forEach((button) => {
    button.addEventListener("click", () => {
      runWrapped(button.dataset.range);
    });
  });

  el("btn-back-from-empty").addEventListener("click", () => {
    showScreen("screen-picker");
  });

  el("btn-restart").addEventListener("click", () => {
    resetStoryPosition();

    state.data = null;

    showScreen("screen-picker");
  });

  el("btn-save").addEventListener("click", handleSave);

  el("btn-copy").addEventListener("click", handleCopy);
})();
