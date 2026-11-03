(() => {
  let playedTracks = [];
  let playModeValue = "in order";
  let gameRunning = false;
  let prefetchTrack;
  const quitBtn = el("quitCuratingBtn");
  const gameAudio = el("audio");
  const MAX_CONFIRMATION_CARDS = 8;
  let currentTrackData = null;
  let total;
  const asyncHandlers = [];

  const deletionSet = new Set();
  const likedSet = new Set();

  // Keep the complete track objects so the confirmation modal
  // can render covers, titles and artists.
  const deletionTracks = new Map();
  const likedTracks = new Map();

  scriptInfo.libraryAlbums = false;

  const cardDeck = () => el("cardDeck");

  const confirmModal = () => {
    let modal = el("confirmModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "confirmModal";
      modal.className = "modal-overlay";
      modal.hidden = true;
      document.body.appendChild(modal);
    }

    return modal;
  };

  function renderConfirmationTrack(track, index) {
    const card = document.createElement("div");
    card.className = "confirmation-track-card";
    card.style.setProperty("--deck-index", index);

    const img = document.createElement("img");
    img.className = "confirmation-track-cover";
    img.src = track.album?.image || "";
    img.alt = track.name || "";

    const details = document.createElement("div");
    details.className = "confirmation-track-details";

    const title = document.createElement("div");
    title.className = "confirmation-track-title";
    title.textContent = track.name || "";

    const artist = document.createElement("div");
    artist.className = "confirmation-track-artist";
    artist.textContent = track.artists?.join(", ") || "";

    details.appendChild(title);
    details.appendChild(artist);

    card.appendChild(img);
    card.appendChild(details);

    return card;
  }

  function renderConfirmationDeck(deckId, tracks) {
    const deck = el(deckId);
    if (!deck) return;

    deck.innerHTML = "";

    const visibleTracks = tracks.slice(0, 20);

    if (visibleTracks.length === 0) {
      deck.classList.add("empty");
      return;
    }

    deck.classList.remove("empty");

    visibleTracks.forEach((track, index) => {
      deck.appendChild(renderConfirmationTrack(track, index));
    });
  }

  function buildConfirmationModal() {
    const modal = confirmModal();

    modal.innerHTML = `
      <div class="modal-content confirmation-modal">
        <div class="confirmation-header">
          <h2>Confirm curation</h2>
          <p>Review the tracks you've selected before applying the changes.</p>
        </div>

        <div class="confirmation-sections">

          <section class="confirmation-section">
            <div class="confirmation-section-header">
              <div>
                <h3>Delete</h3>
                <span id="confirmationDeleteCount" class="confirmation-count"></span>
              </div>
            </div>

            <div id="confirmationDeleteDeck" class="confirmation-deck"></div>
          </section>

          <section class="confirmation-section">
            <div class="confirmation-section-header">
              <div>
                <h3>Like</h3>
                <span id="confirmationLikeCount" class="confirmation-count"></span>
              </div>
            </div>

            <div id="confirmationLikeDeck" class="confirmation-deck"></div>
          </section>

        </div>

        <div class="confirmation-actions">
          <button
            id="confirmDelete"
            class="modal-btn red-btn"
            type="button"
          >
            Confirm deletion
          </button>

          <button
            id="confirmLike"
            class="modal-btn primary-btn"
            type="button"
          >
            Confirm likes
          </button>

          <button
            id="confirmEverything"
            class="modal-btn green-btn"
            type="button"
          >
            Confirm everything
          </button>

          <button
            id="discardConfirmation"
            class="modal-btn gray-btn"
            type="button"
          >
            Discard
          </button>
        </div>
      </div>
    `;

    const deleteCount = el("confirmationDeleteCount");
    const likeCount = el("confirmationLikeCount");

    if (deleteCount) {
      deleteCount.textContent =
        deletionTracks.size === 1 ? "1 track" : `${deletionTracks.size} tracks`;
    }

    if (likeCount) {
      likeCount.textContent =
        likedTracks.size === 1 ? "1 track" : `${likedTracks.size} tracks`;
    }

    renderConfirmationDeck("confirmationDeleteDeck", [
      ...deletionTracks.values(),
    ]);

    renderConfirmationDeck("confirmationLikeDeck", [...likedTracks.values()]);

    const confirmDelete = el("confirmDelete");
    const confirmLike = el("confirmLike");
    const confirmEverything = el("confirmEverything");

    if (confirmDelete) {
      confirmDelete.disabled = deletionSet.size === 0;
    }

    if (confirmLike) {
      confirmLike.disabled = likedSet.size === 0;
    }

    if (confirmEverything) {
      confirmEverything.disabled =
        deletionSet.size === 0 && likedSet.size === 0;
    }
  }

  async function handleFinished({
    deleteTracks = true,
    likeTracks = true,
  } = {}) {
    if (deleteTracks && deletionSet.size > 0) {
      const tracks = [...deletionSet];

      asyncHandlers.push(
        sendMessage({
          type: "deleteTracks",
          uri: activePlaylist.id,
          uids: tracks,
        }),
      );

      deletionSet.clear();
      deletionTracks.clear();
    }

    if (likeTracks && likedSet.size > 0) {
      const tracks = [...likedSet];

      asyncHandlers.push(
        sendMessage({
          type: "likeTracks",
          tracks,
        }),
      );

      likedSet.clear();
      likedTracks.clear();
    }

    await Promise.all(asyncHandlers);
    asyncHandlers.length = 0;
  }

  async function getTrack() {
    const res = await sendMessage({
      type: "getPlaylistTracks",
      item: activePlaylist,
      playedTracks,
      stats: false,
      totalTracks: 1,
      total,
      returnTotal: true,
      random: playModeValue === "random",
    });

    if (res?.finished) {
      return res;
    }

    activePlaylist.count = res.count;
    playedTracks = res.position;
    total = res.total;

    return res;
  }

  async function selectPlaylist(item) {
    if (item.id.includes("album")) {
      showToast("Albums are not supported");
      return;
    }
    setURL(item.id);

    activePlaylist = {
      id: item.id,
      name: item.name,
      count: item.count ?? null,
    };

    await startMatching(activePlaylist);
  }

  window.selectPlaylist = selectPlaylist;

  function showLibrary() {
    activePlaylist = null;
    quitBtn.hidden = true;
    library.hidden = false;

    const g = el("gameSection");
    if (g) g.hidden = true;

    gameRunning = false;

    if (gameAudio) {
      gameAudio.pause();
      gameAudio.currentTime = 0;
    }

    loadCurrentFolder();
  }

  function setPlayMode(mode) {
    const index = playModeOptions.findIndex(
      (option) => option.dataset.mode === mode,
    );

    if (index === -1) return;

    playModeValue = mode;

    playModeOptions.forEach((option, optionIndex) => {
      const active = optionIndex === index;

      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });

    if (playModeSlider) {
      playModeSlider.style.transform = `translateX(${index * 100}%)`;
    }
  }

  playModeOptions.forEach((option) => {
    option.textContent = option.dataset.mode;
    option.addEventListener("click", () => {
      const mode = option.dataset.mode;
      option.textContent = mode;

      if (mode === playModeValue) {
        return;
      }

      setPlayMode(mode);

      if (activePlaylist && gameRunning) {
        startMatching(activePlaylist);
      }
    });
  });

  function resetGameState() {
    playedTracks = [];
    prefetchTrack = null;
    activePlaylist = null;
    currentTrackData = null;

    deletionSet.clear();
    likedSet.clear();
    deletionTracks.clear();
    likedTracks.clear();

    const cd = cardDeck();

    if (cd) {
      cd.innerHTML = "";
    }
  }

  function showGame() {
    library.hidden = true;
    quitBtn.hidden = false;

    const g = el("gameSection");

    if (g) {
      g.hidden = false;
    }

    gameRunning = true;
  }

  async function startMatching(playlist) {
    if (!playlist) return;

    resetGameState();

    activePlaylist = {
      id: playlist.id,
      name: playlist.name,
      count: playlist.count ?? null,
    };

    showGame();
    setPlayMode(playModeValue);

    await mainMatching();
  }

  function showConfirmation() {
    if (!gameRunning) return;

    if (gameAudio) {
      gameAudio.pause();
      gameAudio.currentTime = 0;
    }

    if (deletionSet.size === 0 && likedSet.size === 0) {
      showLibrary();
      return;
    }

    buildConfirmationModal();

    const modal = confirmModal();
    modal.hidden = false;
  }

  document.addEventListener("click", async (e) => {
    if (!e.target) return;

    if (e.target.id === "confirmDelete") {
      await handleFinished({
        deleteTracks: true,
        likeTracks: false,
      });

      const modal = confirmModal();
      modal.hidden = true;

      showLibrary();
      return;
    }

    if (e.target.id === "confirmLike") {
      await handleFinished({
        deleteTracks: false,
        likeTracks: true,
      });

      const modal = confirmModal();
      modal.hidden = true;

      showLibrary();
      return;
    }

    if (e.target.id === "confirmEverything") {
      await handleFinished({
        deleteTracks: true,
        likeTracks: true,
      });

      const modal = confirmModal();
      modal.hidden = true;

      showLibrary();
      return;
    }

    if (e.target.id === "discardConfirmation") {
      deletionSet.clear();
      likedSet.clear();

      deletionTracks.clear();
      likedTracks.clear();

      const modal = confirmModal();
      modal.hidden = true;

      showLibrary();
      return;
    }

    if (e.target.id === "btnRemove") {
      handleAction("remove");
      return;
    }

    if (e.target.id === "btnLike") {
      handleAction("like");
      return;
    }

    if (e.target.id === "btnKeep") {
      handleAction("keep");
    }
  });

  async function mainMatching() {
    if (!gameRunning) {
      return false;
    }

    await showLoadingOverlay();

    try {
      let track;

      if (prefetchTrack) {
        track = await prefetchTrack;
      } else {
        track = await getTrack();
      }

      await Promise.all(asyncHandlers);
      asyncHandlers.length = 0;

      if (track && track.finished === true) {
        hideLoadingOverlay();
        showConfirmation();
        return true;
      }

      showGame();

      currentTrackData = track;
      prefetchTrack = getTrack();

      renderCard(track);

      return true;
    } catch (error) {
      console.error("getTracks failed:", error);
      showToast(error?.message || "Couldn't load tracks — try again");
      showLibrary();
      return false;
    } finally {
      hideLoadingOverlay();
    }
  }

  function renderCard(track) {
    const cd = cardDeck();

    if (!cd) return;

    cd.innerHTML = "";

    if (track.snippet) {
      gameAudio.src = track.snippet;
      gameAudio.play().catch(() => {});
    }

    const card = document.createElement("div");
    card.className = "tinder-card";

    const swipeTint = document.createElement("div");
    swipeTint.className = "swipe-tint";
    card.appendChild(swipeTint);

    const imgContainer = document.createElement("div");
    imgContainer.className = "card-img-container";

    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = track.album?.image || "";

    imgContainer.appendChild(img);

    const openUrlBtn = document.createElement("button");
    openUrlBtn.className = "card-open-url";
    openUrlBtn.textContent = "open track";

    openUrlBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(uriToUrl(track.id), "_blank");
    });

    card.appendChild(imgContainer);

    const infoContainer = document.createElement("div");
    infoContainer.className = "card-info";

    infoContainer.appendChild(openUrlBtn);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = track.name;

    infoContainer.appendChild(title);

    const artists = document.createElement("div");
    artists.className = "card-artists";

    if (track.artists && track.artistUris) {
      track.artists.forEach((artistName, idx) => {
        const aSpan = document.createElement("span");

        aSpan.className = "card-link";
        aSpan.textContent = artistName;

        aSpan.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(uriToUrl(track.artistUris[idx]), "_blank");
        });

        artists.appendChild(aSpan);

        if (idx < track.artists.length - 1) {
          const comma = document.createElement("span");
          comma.textContent = ", ";
          artists.appendChild(comma);
        }
      });
    }

    infoContainer.appendChild(artists);

    const album = document.createElement("div");
    album.className = "card-album card-link";
    album.textContent = track.album?.name || "";

    album.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(uriToUrl(track.album?.id), "_blank");
    });

    infoContainer.appendChild(album);
    card.appendChild(infoContainer);

    initCardSwipe(card);

    cd.appendChild(card);
  }

  function initCardSwipe(card) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;

    const onPointerDown = (e) => {
      if (
        e.target.closest("button") ||
        e.target.classList.contains("card-link")
      ) {
        return;
      }

      isDragging = true;

      startX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;

      startY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

      card.style.transition = "none";

      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);

      window.addEventListener("touchmove", onPointerMove, { passive: true });

      window.addEventListener("touchend", onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;

      const clientX =
        e.clientX !== undefined ? e.clientX : e.touches[0].clientX;

      const clientY =
        e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

      currentX = clientX - startX;
      currentY = clientY - startY;

      const rotate = currentX * 0.08;

      card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
      const maxDistance = 100;

      const xStrength = Math.min(Math.abs(currentX) / maxDistance, 1);
      const yStrength = Math.min(Math.max(-currentY, 0) / maxDistance, 1);

      let color = "transparent";
      let opacity = 0;

      if (currentX < 0 && Math.abs(currentX) > Math.max(-currentY, 0)) {
        // LEFT = red
        color = "rgb(95, 2, 2)";
        opacity = xStrength * 0.65;
      } else if (currentX > 0 && currentX > Math.max(-currentY, 0)) {
        // RIGHT = green
        color = "rgba(30, 215, 96, 1)";
        opacity = xStrength * 0.25;
      } else if (currentY < 0) {
        // UP = pink
        color = "rgba(255, 70, 140, 1)";
        opacity = yStrength * 0.25;
      }

      card.style.setProperty("--swipe-tint-color", color);
      card.style.setProperty("--swipe-tint-opacity", opacity);
    };

    const onPointerUp = () => {
      if (!isDragging) return;

      isDragging = false;

      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      card.style.setProperty("--swipe-tint-color", "transparent");
      card.style.setProperty("--swipe-tint-opacity", "0");

      const thresholdX = 100;
      const thresholdY = -100;

      const finalX = currentX;
      const finalY = currentY;
      const finalRotation = finalX * 0.08;

      if (finalY < thresholdY && Math.abs(finalX) < Math.abs(finalY)) {
        handleAction("like", finalX, finalY, finalRotation);
      } else if (finalX < -thresholdX) {
        handleAction("remove", finalX, finalY, finalRotation);
      } else if (finalX > thresholdX) {
        handleAction("keep", finalX, finalY, finalRotation);
      } else {
        card.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";

        card.style.transform = "translate(0, 0) rotate(0deg)";
      }

      currentX = 0;
      currentY = 0;
    };

    card.addEventListener("mousedown", onPointerDown);

    card.addEventListener("touchstart", onPointerDown, { passive: true });
  }

  quitBtn.addEventListener("click", showConfirmation);

  function handleAction(action, x = 0, y = 0, rotation = 0) {
    const cd = cardDeck();

    if (!cd) return;

    const card = cd.querySelector(".tinder-card");

    if (!card || !currentTrackData) return;

    card.style.setProperty("--swipe-x", `${x}px`);

    card.style.setProperty("--swipe-y", `${y}px`);

    card.style.setProperty("--swipe-rotation", `${rotation}deg`);

    card.style.animation = "none";

    void card.offsetWidth;

    if (action === "remove") {
      const uid = currentTrackData.playlist.uid;

      deletionSet.add(uid);
      if (deletionSet.size < MAX_CONFIRMATION_CARDS) {
        deletionTracks.set(uid, currentTrackData);
      }

      card.classList.add("swipe-left-anim");
    } else if (action === "like") {
      const id = currentTrackData.id;

      likedSet.add(id);
      if (likedSet.size < MAX_CONFIRMATION_CARDS) {
        likedTracks.set(id, currentTrackData);
      }

      card.classList.add("like-anim");
    } else if (action === "keep") {
      card.classList.add("swipe-right-anim");
    }

    if (gameAudio) {
      gameAudio.pause();
      gameAudio.currentTime = 0;
    }

    setTimeout(() => {
      mainMatching();
    }, 550);
  }

  if (!handleSpotifyParameter()) {
    showLibrary();
  }
  setPlayMode(playModeValue);
})();
