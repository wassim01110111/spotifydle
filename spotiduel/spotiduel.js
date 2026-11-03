(() => {
  const gameView = el("game");
  const resultScreen = el("resultScreen");

  const gameBack = el("gameBack");
  const gameModeLabel = el("gameModeLabel");
  const gamePlaylistName = el("gamePlaylistName");
  const gameStatus = el("gameStatus");
  const gameInfo = el("gameInfo");
  const roundStatus = el("roundStatus");

  const duel = el("duel");
  const playcountReveal = el("playcountReveal");

  const trackCardA = el("trackCardA");
  const trackCardB = el("trackCardB");

  const trackUrlA = el("trackUrlA");
  const trackUrlB = el("trackUrlB");

  const gameAudioA = el("gameAudioA");
  const gameAudioB = el("gameAudioB");

  const resultEyebrow = el("resultEyebrow");
  const resultTitle = el("resultTitle");
  const resultSubtitle = el("resultSubtitle");
  const resultTrack = el("resultTrack");

  const resultPlayAgain = el("resultPlayAgain");
  const resultLibrary = el("resultLibrary");

  const playModeSlider = el("playModeSlider");
  const playModeOptions = [...document.querySelectorAll(".play-mode-option")];
  const resultRounds = el("resultRounds");
  const resultHistory = el("resultHistory");

  let playModeValue = "most-played";

  let playedTracks = [];
  let winTracks = [];
  let gameTracks = [];

  let duelHistory = [];
  let currentPair = [];
  scriptInfo.libraryArtists = false;
  let canFetchTracks = true;
  let gameRunning = false;
  let selectingTrack = false;
  let isFinalDuel = false;
  let prefetchTracks;
  let roundCount = 0;
  let totalRounds = null;

  playModeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const mode = option.dataset.mode;

      if (mode === playModeValue || selectingTrack) {
        return;
      }
      playModeValue = mode;

      setPlayMode(mode);
      gameModeLabel.textContent =
        mode === "most-played" ? "MOST PLAYED" : "PREFERRED";

      gameStatus.textContent =
        mode === "most-played"
          ? "Which track has the higher playcount?"
          : "Which track do you prefer?";
      if (activePlaylist && gameRunning) {
        startPlaylistGame(activePlaylist);
      }
    });
  });

  async function getTracks() {
    return await sendMessage({
      type: "getPlaylistTracks",
      item: activePlaylist,
      playedTracks,
      stats: false,
      totalTracks: 2,
      random: true,
    });
  }

  function showLibrary() {
    prefetchTracks = null;
    activePlaylist = null;

    gameView.hidden = true;
    resultScreen.hidden = true;
    library.hidden = false;

    gameRunning = false;
    selectingTrack = false;
    isFinalDuel = false;

    stopPreview();
    clearPlaycountReveal();

    document.body.classList.remove("game-active", "result-active");

    clearAmbientBackground();
    loadCurrentFolder();
  }

  function showGame() {
    library.hidden = true;
    resultScreen.hidden = true;
    gameView.hidden = false;

    document.body.classList.add("game-active");
    document.body.classList.remove("result-active");
  }

  function showResult() {
    library.hidden = true;
    gameView.hidden = true;
    resultScreen.hidden = false;

    document.body.classList.add("result-active");
    document.body.classList.remove("game-active");
  }

  function resetGameState() {
    playedTracks = [];
    winTracks = [];
    gameTracks = [];
    duelHistory = [];

    currentPair = [];

    roundStatus.textContent = "";
    totalRounds = 0;
    roundCount = 1;

    canFetchTracks = true;
    gameRunning = true;
    selectingTrack = false;
    isFinalDuel = false;
    prefetchTracks = null;

    stopPreview();
    clearPlaycountReveal();
    clearAmbientBackground();
  }

  function isFinished(track) {
    return track?.finished === true;
  }

  function escapeAttribute(value) {
    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function createExternalLink(url, label, className = "result-link") {
    if (!url) {
      return "";
    }

    return `
      <a
        class="${escapeAttribute(className)}"
        href="${escapeAttribute(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(label)}
      </a>
    `;
  }

  function renderTrackCard(card, track) {
    const suffix = card === trackCardA ? "A" : "B";
    const audio = suffix === "A" ? gameAudioA : gameAudioB;

    const previousTrackId = card.dataset.trackId;
    const newTrackId = track?.id || "";

    if (previousTrackId !== newTrackId) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    const cover = el(`trackCover${suffix}`);
    const placeholder = el(`trackPlaceholder${suffix}`);
    const name = el(`trackName${suffix}`);
    const artists = el(`trackArtists${suffix}`);
    const album = el(`trackAlbum${suffix}`);
    const trackUrl = el(`trackUrl${suffix}`);
    const snippetIndicator = el(`snippetIndicator${suffix}`);

    const image = track?.album?.image;

    if (image) {
      cover.src = image;
      cover.alt = `${track?.name || "Track"} cover`;
      cover.hidden = false;
      placeholder.hidden = true;
    } else {
      cover.removeAttribute("src");
      cover.alt = "";
      cover.hidden = true;
      placeholder.hidden = false;
    }

    name.textContent = track?.name || "Unknown track";

    artists.textContent = Array.isArray(track?.artists)
      ? track.artists.join(", ")
      : "";

    album.textContent = track?.album?.name || "";

    const url = uriToUrl(track?.id);

    if (url) {
      trackUrl.href = url;
      trackUrl.hidden = false;
    } else {
      trackUrl.removeAttribute("href");
      trackUrl.hidden = true;
    }

    if (snippetIndicator) {
      snippetIndicator.hidden = !track?.snippet;
    }

    card.dataset.trackId = track?.id || "";

    card.disabled = false;
    card.setAttribute("aria-disabled", "false");
  }

  function renderPair(pair, options = {}) {
    if (!pair || pair.length < 2) {
      return false;
    }

    currentPair = [pair[0], pair[1]];

    isFinalDuel = options.finalDuel === true;

    renderTrackCard(trackCardA, currentPair[0]);
    renderTrackCard(trackCardB, currentPair[1]);

    trackCardA.classList.remove("selected", "lost", "winner");

    trackCardB.classList.remove("selected", "lost", "winner");

    trackCardA.disabled = false;
    trackCardB.disabled = false;

    trackCardA.setAttribute("aria-disabled", "false");
    trackCardB.setAttribute("aria-disabled", "false");

    duel.classList.remove("duel-loading");

    startPreview(currentPair[0]);

    gameInfo.classList.toggle("final-round", isFinalDuel);

    gameStatus.textContent = isFinalDuel
      ? playModeValue === "most-played"
        ? "FINAL 1V1 — Which track has the higher playcount?"
        : "FINAL 1V1 — Which track do you prefer?"
      : playModeValue === "most-played"
        ? "Which track has the higher playcount?"
        : "Which track do you prefer?";

    updateAmbientBackground(currentPair);

    gameView.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    return true;
  }

  function popRandomGameTrack() {
    if (!gameTracks.length) {
      return null;
    }

    const index = Math.floor(Math.random() * gameTracks.length);

    return gameTracks.splice(index, 1)[0];
  }

  /**
   * At the end of fetching, Spotify can return `finished`
   * entries instead of real tracks.
   *
   * Those missing entries are replaced with winners that
   * were accumulated in gameTracks during fetching.
   */
  function getFinalFetchedPair(tracks) {
    const pair = [];

    for (const track of tracks.slice(0, 2)) {
      if (!isFinished(track)) {
        pair.push(track);
        continue;
      }

      const replacement = popRandomGameTrack();

      if (replacement) {
        pair.push(replacement);
      }
    }

    return pair;
  }

  /**
   * Moves the completed tournament generation into
   * the next generation.
   *
   * gameTracks = current generation opponents
   * winTracks  = winners from the current generation
   */
  function promoteWinners() {
    if (winTracks.length === 0) {
      finishTournament();
      return;
    }

    if (winTracks.length === 1) {
      currentPair = [winTracks[0]];
      finishTournament();
      return;
    }

    gameTracks = [...winTracks];
    winTracks = [];

    startTournamentDuel();
  }

  /**
   * Starts the next duel in the current tournament generation.
   *
   * Two tracks are removed from gameTracks and shown.
   *
   * If there is an odd number of tracks, the last track gets
   * a bye and is automatically moved into winTracks.
   */
  function startTournamentDuel() {
    if (!gameRunning || canFetchTracks) {
      return;
    }

    while (gameTracks.length === 1) {
      const byeTrack = gameTracks.pop();

      if (byeTrack) {
        winTracks.push(byeTrack);
      }
    }

    if (gameTracks.length === 0) {
      promoteWinners();
      return;
    }

    const trackA = popRandomGameTrack();
    const trackB = popRandomGameTrack();

    if (!trackA || !trackB) {
      if (trackA) {
        winTracks.push(trackA);
      }

      if (trackB) {
        winTracks.push(trackB);
      }

      promoteWinners();
      return;
    }

    const finalDuel = gameTracks.length === 0 && winTracks.length === 0;

    renderPair([trackA, trackB], {
      finalDuel,
    });
  }

  async function loadNextFetchedPair() {
    if (!canFetchTracks || !gameRunning || selectingTrack) {
      return false;
    }

    duel.classList.add("duel-loading");

    trackCardA.disabled = true;
    trackCardB.disabled = true;

    trackCardA.setAttribute("aria-disabled", "true");
    trackCardB.setAttribute("aria-disabled", "true");

    await showLoadingOverlay();

    try {
      let tracks;

      if (prefetchTracks) {
        tracks = await prefetchTracks;
        prefetchTracks = null;
      } else {
        tracks = await getTracks();
      }

      showGame();

      if (!Array.isArray(tracks) || tracks.length < 2) {
        throw new Error("getTracks() must return at least two tracks");
      }

      if (!activePlaylist.name) {
        const firstTrack = tracks[0];

        activePlaylist.name =
          firstTrack?.type === "playlist"
            ? firstTrack?.playlist?.name
            : firstTrack?.album?.name;

        gamePlaylistName.textContent = activePlaylist.name;
      }
      const hasFinished = tracks.slice(0, 2).some(isFinished);

      /**
       * Fetching has finished.
       *
       * From this point onward:
       *
       *   winners -> winTracks
       *
       * Any finished cards are replaced using the winners
       * already accumulated in gameTracks.
       */
      if (hasFinished) {
        canFetchTracks = false;

        const finalPair = getFinalFetchedPair(tracks);

        if (finalPair.length < 2) {
          throw new Error("Not enough playable tracks");
        }

        renderPair(finalPair, {
          finalDuel: gameTracks.length === 0 && winTracks.length === 0,
        });

        return true;
      } else {
        const positionA = tracks[0]?.position;
        const positionB = tracks[1]?.position;

        if (!totalRounds) {
          totalRounds = tracks[0].count - 1;
          roundStatus.textContent = `Round: ${roundCount}/${totalRounds}`;
        }

        if (positionA.length > positionB.length) {
          playedTracks = positionA;
          if (roundCount * 2 < positionA.length) {
            totalRounds -= positionA.length - roundCount * 2;
          }
        } else {
          playedTracks = positionB;
          if (roundCount * 2 < positionA.length) {
            totalRounds -= positionA.length - roundCount * 2;
          }
        }
      }

      /**
       * Still fetching.
       *
       * The selected winner will be stored in gameTracks.
       */
      renderPair(tracks.slice(0, 2));

      prefetchTracks = getTracks();

      return true;
    } catch (error) {
      console.error("getTracks failed:", error);

      showToast(error?.message || "Couldn't load tracks — try again");

      duel.classList.remove("duel-loading");

      if (!selectingTrack) {
        trackCardA.disabled = false;
        trackCardB.disabled = false;

        trackCardA.setAttribute("aria-disabled", "false");

        trackCardB.setAttribute("aria-disabled", "false");
      }

      showLibrary();

      return false;
    } finally {
      hideLoadingOverlay();
    }
  }

  function getMostPlayedWinner(a, b) {
    return a.playcount >= b.playcount
      ? {
          winner: a,
          loser: b,
        }
      : {
          winner: b,
          loser: a,
        };
  }

  function markSelected(selectedTrack, winner, loser) {
    const selectedCard = trackCardFor(selectedTrack);

    const winnerCard = trackCardFor(winner);

    const loserCard = trackCardFor(loser);

    if (selectedCard) {
      selectedCard.classList.add("selected");
    }

    if (winnerCard) {
      winnerCard.classList.add("winner");
    }

    if (loserCard) {
      loserCard.classList.add("lost");
    }

    trackCardA.disabled = true;
    trackCardB.disabled = true;

    trackCardA.setAttribute("aria-disabled", "true");

    trackCardB.setAttribute("aria-disabled", "true");
  }

  function formatPlaycount(value) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return new Intl.NumberFormat().format(number);
  }

  function clearPlaycountReveal() {
    if (!playcountReveal) {
      return;
    }

    playcountReveal.classList.remove("is-active", "is-done");

    playcountReveal.innerHTML = "";

    playcountReveal.setAttribute("aria-hidden", "true");
  }

  function playcountRevealAnimation(winner, loser) {
    if (!playcountReveal) {
      return Promise.resolve();
    }

    const winnerCard = trackCardFor(winner);

    const loserCard = trackCardFor(loser);

    if (!winnerCard || !loserCard) {
      return Promise.resolve();
    }

    const leftTrack = currentPair[0];
    const rightTrack = currentPair[1];

    const leftIsWinner = leftTrack === winner;

    const rightIsWinner = rightTrack === winner;

    const leftImage = leftTrack?.album?.image || "";

    const rightImage = rightTrack?.album?.image || "";

    const leftCount = Number(leftTrack?.playcount ?? 0);

    const rightCount = Number(rightTrack?.playcount ?? 0);

    const renderTrack = (track, image, count, isWinner, position) => `
      <div
        class="reveal-track ${isWinner ? "reveal-winner" : "reveal-loser"}"
        data-position="${position}"
      >
        <div class="reveal-cover-wrap">
          ${
            image
              ? `
                <img
                  class="reveal-cover"
                  src="${escapeAttribute(image)}"
                  alt=""
                />
              `
              : `
                <div class="reveal-cover reveal-cover-placeholder">
                  ♪
                </div>
              `
          }

          <div class="reveal-cover-shine"></div>
        </div>

        <div class="reveal-track-meta">
          <div
            class="reveal-track-label ${isWinner ? "reveal-winner-label" : ""}"
          >
            ${isWinner ? "WINNER" : "TRACK"}
          </div>

          <div class="reveal-track-name">
            ${escapeHtml(track?.name || "Unknown track")}
          </div>

          <div class="reveal-count">
            <span class="reveal-count-label">
              PLAYCOUNT
            </span>

            <strong data-count="${count}">
              0
            </strong>
          </div>
        </div>
      </div>
    `;

    playcountReveal.innerHTML = `
      <div class="playcount-reveal-backdrop"></div>

      <div class="reveal-soundwave reveal-soundwave-a"></div>
      <div class="reveal-soundwave reveal-soundwave-b"></div>

      <div class="playcount-reveal-stage">
        ${renderTrack(leftTrack, leftImage, leftCount, leftIsWinner, "left")}

        <div class="reveal-center">
          <div class="reveal-center-ring reveal-ring-one"></div>
          <div class="reveal-center-ring reveal-ring-two"></div>

          <div class="reveal-equalizer">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </div>

          <div class="reveal-center-label">
            <span>HIGHER</span>
            <strong>PLAYCOUNT</strong>
          </div>
        </div>

        ${renderTrack(
          rightTrack,
          rightImage,
          rightCount,
          rightIsWinner,
          "right",
        )}
      </div>
    `;

    playcountReveal.classList.remove("is-active", "is-done");

    playcountReveal.setAttribute("aria-hidden", "false");

    void playcountReveal.offsetWidth;

    playcountReveal.classList.add("is-active");

    const countElements = [...playcountReveal.querySelectorAll("[data-count]")];

    const countDuration = 1450;
    const countDelay = 250;
    const countStart = performance.now() + countDelay;

    function animateCounts(now) {
      if (now < countStart) {
        requestAnimationFrame(animateCounts);

        return;
      }

      const progress = Math.min((now - countStart) / countDuration, 1);

      const eased = 1 - Math.pow(1 - progress, 4);

      countElements.forEach((element) => {
        const target = Number(element.dataset.count || 0);

        element.textContent = formatPlaycount(Math.round(target * eased));
      });

      if (progress < 1) {
        requestAnimationFrame(animateCounts);
      }
    }

    requestAnimationFrame(animateCounts);

    return new Promise((resolve) => {
      window.setTimeout(() => {
        playcountReveal.classList.add("is-done");

        window.setTimeout(() => {
          clearPlaycountReveal();
          resolve();
        }, 650);
      }, 2750);
    });
  }

  async function handleTrackSelection(track) {
    if (!gameRunning || selectingTrack || !track || currentPair.length < 2) {
      return;
    }
    const [a, b] = currentPair;

    if (track !== a && track !== b) {
      return;
    }

    selectingTrack = true;

    trackCardA.disabled = true;
    trackCardB.disabled = true;

    trackCardA.setAttribute("aria-disabled", "true");

    trackCardB.setAttribute("aria-disabled", "true");

    let winner;
    let loser;

    if (playModeValue === "preferred") {
      winner = track;
      loser = winner === a ? b : a;
      duelHistory.push({
        round: roundCount,
        tracks: [a, b],
        selected: track,
        winner,
        loser,
      });
      markSelected(winner, winner, loser);

      await sleep(350);
    } else {
      const result = getMostPlayedWinner(a, b);

      winner = result.winner;
      loser = result.loser;
      duelHistory.push({
        round: roundCount,
        tracks: [a, b],
        selected: track,
        winner,
        loser,
      });
      markSelected(track, winner, loser);
      if (roundCount < totalRounds) {
        roundCount++;
      }
      roundStatus.textContent = `Round: ${roundCount}/${totalRounds}`;
      await playcountRevealAnimation(winner, loser);

      if (!gameRunning) {
        selectingTrack = false;
        return;
      }

      /**
       * In most-played mode, selecting
       * the lower-playcount track is an
       * immediate game loss.
       */
      if (track !== winner) {
        finishLossGame(track, winner);

        selectingTrack = false;

        return;
      }
    }

    if (!gameRunning) {
      selectingTrack = false;
      return;
    }

    /**
     * FETCH PHASE
     *
     * Winners accumulate in gameTracks.
     */
    if (canFetchTracks) {
      gameTracks.push(winner);

      selectingTrack = false;

      await loadNextFetchedPair();

      return;
    }

    /**
     * TOURNAMENT PHASE
     *
     * Winners accumulate in winTracks.
     */
    winTracks.push(winner);

    selectingTrack = false;

    /**
     * Keep processing the current
     * generation until gameTracks is
     * completely empty.
     */
    if (gameTracks.length > 0) {
      startTournamentDuel();
      return;
    }

    /**
     * Current generation is finished.
     *
     * All winners now become the
     * next gameTracks generation.
     */
    promoteWinners();
  }

  function trackCardFor(track) {
    if (currentPair[0] === track) {
      return trackCardA;
    }

    if (currentPair[1] === track) {
      return trackCardB;
    }

    return null;
  }

  function renderDuelHistory() {
    if (!resultHistory) {
      return;
    }

    if (!duelHistory.length) {
      resultHistory.innerHTML = "";
      return;
    }

    resultHistory.innerHTML = `
    <div class="duel-history">
      <div class="duel-history-header">
        <span>ROUND HISTORY</span>
        <span>${duelHistory.length} ${duelHistory.length === 1 ? "ROUND" : "ROUNDS"}</span>
      </div>

      <div class="duel-history-list">
        ${duelHistory
          .map((duel, index) => {
            const tracks = duel.tracks || [];

            return `
              <section class="duel-history-round">
                <div class="duel-history-round-label">
                  ROUND ${duel.round || index + 1}
                </div>

                <div class="duel-history-cards">
                  ${tracks
                    .map((track) => {
                      const isSelected = track?.id === duel.selected?.id;

                      const isWinner = track?.id === duel.winner?.id;

                      const image = track?.album?.image;

                      const artists = Array.isArray(track?.artists)
                        ? track.artists.join(", ")
                        : "";

                      return `
                        <article
                          class="
                            duel-history-card
                            ${isSelected ? "is-selected" : ""}
                            ${isWinner ? "is-winner" : ""}
                          "
                        >
                          <div class="duel-history-cover-wrap">
                            ${
                              image
                                ? `
                                  <img
                                    class="duel-history-cover"
                                    src="${escapeAttribute(image)}"
                                    alt=""
                                  />
                                `
                                : `
                                  <div class="duel-history-cover-placeholder">
                                    ♪
                                  </div>
                                `
                            }

                            ${
                              isSelected
                                ? `
                                  <span class="duel-history-picked">
                                    YOUR PICK
                                  </span>
                                `
                                : ""
                            }
                          </div>

                          <div class="duel-history-info">
                            <div class="duel-history-name">
                              ${escapeHtml(track?.name || "Unknown track")}
                            </div>

                            ${
                              artists
                                ? `
                                  <div class="duel-history-artists">
                                    ${escapeHtml(artists)}
                                  </div>
                                `
                                : ""
                            }

                            ${
                              playModeValue === "most-played"
                                ? `
                                  <div class="duel-history-playcount">
                                    <span>PLAYCOUNT</span>
                                    <strong>
                                      ${escapeHtml(
                                        fmtNumber(track?.playcount ?? 0),
                                      )}
                                    </strong>
                                  </div>
                                `
                                : ""
                            }
                          </div>
                        </article>
                      `;
                    })
                    .join("")}
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  }

  function finishTournament() {
    let winningTrack = null;

    if (currentPair.length === 1) {
      winningTrack = currentPair[0];
    } else if (winTracks.length === 1) {
      winningTrack = winTracks[0];
    } else if (gameTracks.length === 1) {
      winningTrack = gameTracks[0];
    }

    if (!winningTrack) {
      console.error("Tournament finished without a winning track", {
        gameTracks,
        winTracks,
        currentPair,
      });

      showToast("The tournament could not determine a winner.");

      showLibrary();
      return;
    }

    gameRunning = false;
    selectingTrack = false;

    clearPlaycountReveal();

    if (resultRounds) {
      resultRounds.textContent = `${roundCount - 1} ${
        roundCount === 2 ? "round" : "rounds"
      } played`;
    }

    if (playModeValue === "preferred") {
      resultEyebrow.textContent = "YOUR PREFERENCE";

      resultTitle.textContent = "Your preferred track is";

      resultSubtitle.textContent = "This was your final choice.";
    } else {
      resultEyebrow.textContent = "FINAL 1V1";

      resultTitle.textContent = "You won.";

      resultSubtitle.textContent = "You found the most-played track.";
    }

    resultTrack.innerHTML = createResultTrack(winningTrack, {
      showCount: playModeValue === "most-played",
    });
    renderDuelHistory();
    showResult();

    updateResultAmbientBackground(winningTrack);

    startPreview(winningTrack);
  }

  function finishLossGame(selectedTrack, winningTrack) {
    gameRunning = false;
    selectingTrack = false;

    clearPlaycountReveal();

    resultEyebrow.textContent = "GAME OVER";

    resultTitle.textContent = "Wrong pick.";

    resultSubtitle.textContent = `${
      winningTrack.name || "The other track"
    } had the higher playcount.`;

    if (resultRounds) {
      resultRounds.textContent = `${roundCount} ${
        roundCount === 1 ? "round" : "rounds"
      } played`;
    }

    resultTrack.innerHTML = createResultTrack(winningTrack, {
      showCount: true,
      secondaryTrack: selectedTrack,
    });
    renderDuelHistory();
    showResult();

    updateResultAmbientBackground(winningTrack);

    startPreview(winningTrack);
  }

  function createResultTrack(track, { showCount = false } = {}) {
    const trackUrl = uriToUrl(track?.id);

    const albumUrl = uriToUrl(track?.album?.id);

    const artists = Array.isArray(track?.artists) ? track.artists : [];

    const artistUris = Array.isArray(track?.artistUris) ? track.artistUris : [];

    const artistHtml = artists
      .map((artist, index) => {
        const url = uriToUrl(artistUris[index]);

        return url
          ? createExternalLink(url, artist, "result-artist-link")
          : `<span>${escapeHtml(artist)}</span>`;
      })
      .join(", ");

    const albumHtml = track?.album?.name
      ? albumUrl
        ? createExternalLink(albumUrl, track.album.name, "result-album-link")
        : `<span>${escapeHtml(track.album.name)}</span>`
      : "";

    const trackNameHtml = trackUrl
      ? createExternalLink(
          trackUrl,
          track?.name || "Unknown track",
          "result-track-link",
        )
      : escapeHtml(track?.name || "Unknown track");

    return `
      <article class="result-track-card">
        <div class="result-cover-wrap">
          ${
            track?.album?.image
              ? `
                <img
                  class="result-cover"
                  src="${escapeAttribute(track.album.image)}"
                  alt="${escapeAttribute(track?.name || "Track")}"
                />
              `
              : `
                <div class="result-cover result-cover-placeholder">
                  ♪
                </div>
              `
          }
        </div>

        <div class="result-track-info">
          <h2 class="result-track-name">
            ${trackNameHtml}
          </h2>

          ${
            artistHtml
              ? `
                <div class="result-track-artists">
                  ${artistHtml}
                </div>
              `
              : ""
          }

          ${
            albumHtml
              ? `
                <div class="result-track-album">
                  ${albumHtml}
                </div>
              `
              : ""
          }

          ${
            track?.release_date
              ? `
                <div class="result-track-release">
                  ${escapeHtml(String(track.release_date).slice(0, 10))}
                </div>
              `
              : ""
          }

          ${
            showCount
              ? `
                <div class="result-stat">
                  <span class="result-stat-label">
                    PLAYCOUNT
                  </span>

                  <span class="result-stat-value">
                    ${escapeHtml(fmtNumber(track?.playcount ?? 0))}
                  </span>
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }
  function setPlayingCard(track) {
    trackCardA.classList.toggle("is-playing", currentPair[0] === track);

    trackCardB.classList.toggle("is-playing", currentPair[1] === track);
  }
  function getCardAudio(card) {
    return card === trackCardA ? gameAudioA : gameAudioB;
  }

  function startPreview(track) {
    const card = trackCardFor(track);

    if (!card || !track?.snippet) {
      return;
    }

    const audio = getCardAudio(card);

    const otherAudio = card === trackCardA ? gameAudioB : gameAudioA;

    const snippet = new URL(track.snippet, window.location.href).href;

    otherAudio.pause();

    setPlayingCard(track);

    if (audio.src === snippet) {
      if (audio.paused) {
        const promise = audio.play();

        if (promise?.catch) {
          promise.catch((error) => {
            console.debug("Preview could not be played:", error);
          });
        }
      }

      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = snippet;

    const promise = audio.play();

    if (promise?.catch) {
      promise.catch((error) => {
        console.debug("Preview could not be played:", error);
      });
    }
  }

  function stopPreview() {
    gameAudioA.pause();
    gameAudioA.currentTime = 0;
    gameAudioA.removeAttribute("src");
    gameAudioA.load();

    gameAudioB.pause();
    gameAudioB.currentTime = 0;
    gameAudioB.removeAttribute("src");
    gameAudioB.load();

    trackCardA.classList.remove("is-playing");

    trackCardB.classList.remove("is-playing");
  }

  function addPreviewHandlers(card, getTrack) {
    let holdTimer = null;
    let holdTriggered = false;

    const HOLD_DELAY = 1000;

    function clearHold() {
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && gameRunning && !selectingTrack) {
        startPreview(getTrack());
      }
    });

    card.addEventListener("pointerdown", () => {
      if (!gameRunning || selectingTrack) {
        return;
      }

      holdTriggered = false;
      clearHold();

      holdTimer = window.setTimeout(() => {
        holdTimer = null;

        if (!gameRunning || selectingTrack) {
          return;
        }

        holdTriggered = true;

        startPreview(getTrack());
      }, HOLD_DELAY);
    });

    card.addEventListener("pointerup", () => {
      clearHold();

      if (!gameRunning || selectingTrack) {
        holdTriggered = false;
        return;
      }

      if (holdTriggered) {
        holdTriggered = false;
        return;
      }

      handleTrackSelection(getTrack());
    });

    card.addEventListener("pointercancel", () => {
      clearHold();
      holdTriggered = false;
    });

    card.addEventListener("focus", () => {
      if (!gameRunning || selectingTrack) {
        return;
      }

      startPreview(getTrack());
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();

      if (card.disabled || card.getAttribute("aria-disabled") === "true") {
        return;
      }

      handleTrackSelection(getTrack());
    });
  }

  trackUrlA.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  trackUrlB.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  addPreviewHandlers(trackCardA, () => currentPair[0]);

  addPreviewHandlers(trackCardB, () => currentPair[1]);

  async function startPlaylistGame(playlist) {
    if (!playlist) {
      return;
    }

    activePlaylist = {
      id: playlist.id,
      name: playlist.name,
      count: playlist.count ?? null,
    };

    resetGameState();

    gamePlaylistName.textContent = activePlaylist.name || "Playlist";

    showGame();

    await loadNextFetchedPair();
  }

  async function selectPlaylist(item) {
    if (!item || selectingTrack) {
      return;
    }
    setURL(item.id);

    activePlaylist = {
      id: item.id,
      name: item.name,
      count: item.count ?? null,
    };
    await startPlaylistGame(activePlaylist);
  }

  window.selectPlaylist = selectPlaylist;

  gameBack.addEventListener("click", () => {
    if (selectingTrack) {
      return;
    }

    stopPreview();
    clearPlaycountReveal();

    showLibrary();
  });

  resultLibrary.addEventListener("click", () => {
    stopPreview();
    clearPlaycountReveal();

    showLibrary();
  });

  resultPlayAgain.addEventListener("click", async () => {
    if (selectingTrack) {
      return;
    }

    if (!activePlaylist) {
      showLibrary();
      return;
    }

    await startPlaylistGame(activePlaylist);
  });

  document.addEventListener("keydown", (event) => {
    if (!gameRunning || selectingTrack) {
      return;
    }

    if (event.key === "1") {
      handleTrackSelection(currentPair[0]);
    }

    if (event.key === "2") {
      handleTrackSelection(currentPair[1]);
    }

    if (event.key === "Escape") {
      stopPreview();
      clearPlaycountReveal();

      showLibrary();
    }
  });

  function updateAmbientBackground(pair) {
    const root = document.documentElement;

    const imageA = pair?.[0]?.album?.image;

    const imageB = pair?.[1]?.album?.image;

    root.style.setProperty(
      "--game-cover-a",
      imageA ? `url("${escapeCssUrl(imageA)}")` : "none",
    );

    root.style.setProperty(
      "--game-cover-b",
      imageB
        ? `url("${escapeCssUrl(imageB)}")`
        : imageA
          ? `url("${escapeCssUrl(imageA)}")`
          : "none",
    );
  }

  function updateResultAmbientBackground(track) {
    const root = document.documentElement;

    const image = track?.album?.image;

    if (!image) {
      clearAmbientBackground();
      return;
    }

    const safeImage = escapeCssUrl(image);

    root.style.setProperty("--game-cover-a", `url("${safeImage}")`);

    root.style.setProperty("--game-cover-b", `url("${safeImage}")`);
  }

  function clearAmbientBackground() {
    const root = document.documentElement;

    root.style.setProperty("--game-cover-a", "none");

    root.style.setProperty("--game-cover-b", "none");
  }

  function escapeCssUrl(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "")
      .replaceAll("\r", "");
  }

  if (!handleSpotifyParameter()) {
    showLibrary();
  }
})();
