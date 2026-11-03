(() => {
  const loadingState = el("loadingState");
  const playlistPreview = el("playlistPreview");
  const playlistPreviewCount = el("playlistPreviewCount");
  const playlistPreviewList = el("playlistPreviewList");
  const orderToggle = el("orderToggle");
  const playlistBackBtn = el("playlistBackBtn");
  const savePlaylist = el("confirm-playlist");
  const cancelPlaylist = el("cancel-playlist");
  const confirmPlaylist = el("confirmPlaylist");
  const confirmationOverlay = el("confirmationOverlay");
  const filterPlaylistBtn = el("filterPlaylistBtn");
  const playlistNameInput = el("playlist-name");
  const playlistDescriptionInput = el("playlist-description");
  const dangerousOption = el("dangerousOption");

  const allArtists = new BiMap();
  const allAlbums = new BiMap();
  const filterOverlay = el("filterOverlay");
  const cancelFilters = el("cancelFilters");
  const saveFilters = el("saveFilters");
  const artistFilter = el("artistFilter");
  const artistSuggestions = el("artistSuggestions");
  const albumFilter = el("albumFilter");
  const albumSuggestions = el("albumSuggestions");
  const releaseDateFrom = el("releaseDateFrom");
  const releaseDateTo = el("releaseDateTo");
  const clearReleaseDate = el("clearReleaseDate");
  const durationValue = el("durationValue");
  const durationRange = el("durationRange");
  const durationMin = el("durationMin");
  const durationMax = el("durationMax");
  const addedDateFrom = el("addedDateFrom");
  const addedDateTo = el("addedDateTo");
  const clearAddedDate = el("clearAddedDate");
  const removeUnplayable = el("removeUnplayable");
  const removeDuplicates = el("removeDuplicates");
  const artistSelected = el("artistSelected");
  const albumSelected = el("albumSelected");
  const artistIncludeMode = el("artistIncludeMode");
  const artistExcludeMode = el("artistExcludeMode");
  const albumIncludeMode = el("albumIncludeMode");
  const albumExcludeMode = el("albumExcludeMode");
  let filters = createEmptyFilters();
  let pendingFilters = createEmptyFilters();

  let playOrderValue = "desc";
  let playlistTracks = [];
  let allPlaylistTracks;
  let showValue = null;
  let activePlaylist = null;
  let dangerousMoment = false;
  let playModeValue = "playcount";
  scriptInfo.libraryAlbums = false;
  const playlistStep = 500;

  const ROW_HEIGHT = 64;
  const BUFFER = 8;

  let playlistRowsContainer;
  let playlistScrollHandler;
  let playlistRenderPending = false;

  function showLibrary() {
    library.hidden = false;
    bigReset();
    playlistPreview.hidden = true;
    loadCurrentFolder();
  }

  function bigReset() {
    resetFilters();
    allArtists.clear();
    allAlbums.clear();
    playlistTracks = [];
    activePlaylist = null;
    showValue = null;
    playOrderValue = "desc";
    loadingState.textContent = "";
  }
  function resetFilters() {
    filters = createEmptyFilters();

    pendingFilters = createEmptyFilters();

    artistFilter.value = "";
    albumFilter.value = "";

    artistSuggestions.innerHTML = "";
    albumSuggestions.innerHTML = "";

    artistSuggestions.hidden = true;
    albumSuggestions.hidden = true;

    artistSelected.innerHTML = "";
    albumSelected.innerHTML = "";

    artistSelected.hidden = true;
    albumSelected.hidden = true;

    releaseDateFrom.value = "";
    releaseDateTo.value = "";

    releaseDateFrom.max = "";
    releaseDateTo.min = "";

    addedDateFrom.value = "";
    addedDateTo.value = "";

    addedDateFrom.max = "";
    addedDateTo.min = "";

    durationMin.value = 0;
    durationMax.value = 2400;

    durationRange.style.left = "0%";
    durationRange.style.right = "0%";

    durationValue.textContent = "Any duration";

    removeUnplayable.checked = false;
    removeDuplicates.checked = false;

    updateArtistModeToggle();
    updateAlbumModeToggle();
  }
  function createEmptyFilters() {
    return {
      artists: new Set(),
      artistMode: true, // true = include, false = exclude

      albums: new Set(),
      albumMode: true, // true = include, false = exclude

      release_date: {
        start: null,
        end: null,
      },

      addedAt: {
        start: null,
        end: null,
      },

      duration: null,

      unplayable: false,
      duplicate: false,
    };
  }

  function cloneFilters(source) {
    if (source === null || typeof source !== "object") {
      return source;
    }

    if (source instanceof Set) {
      return new Set([...source].map(cloneFilters));
    }

    if (Array.isArray(source)) {
      return source.map(cloneFilters);
    }

    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, cloneFilters(value)]),
    );
  }
  function showPreview() {
    playlistPreview.hidden = false;
    loadingState.textContent = "";
    library.hidden = true;

    sortPlaylist();
  }

  async function getTracks(uri, offset, limit) {
    return await sendMessage({ type: "getPlaylist", uri, offset, limit });
  }

  async function createPlaylist(name, description) {
    return await sendMessage({ type: "createPlaylist", name, description });
  }

  async function addToPlaylist(uri, tracks) {
    return await sendMessage({
      type: "addToPlaylist",
      uri,
      tracks,
    });
  }
  async function deleteTracks(uri, tracks) {
    return await sendMessage({
      type: "deleteTracks",
      uri,
      uris: tracks,
    });
  }

  function handleTracks(position, items) {
    const data = fmtData(items, false);
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const artists = item.artists.join(", ");
      for (let j = 0; j < item.artists.length; j++) {
        allArtists.set(item.artists[j], item.artistUris[j]);
      }
      allAlbums.set(item.album.name, item.album.id);
      playlistTracks.push({
        name: item.name,
        cover: item.album.image,
        artists:
          artists === "" &&
          item.artistUris[0] === "spotify:artist:0LyfQWJT6nXafLPZqxe9Of"
            ? "Various Artists"
            : artists,
        album: item.album.name,
        artistUris: item.artistUris,
        duration: item.duration,
        albumUri: item.album.id,
        addedAt: item.addedAt,
        original_pos: position + i,
        playcount: item.playcount,
        release_date: item.release_date,
        id: item.id,
        uid: item.uid,
        playable: item.playable,
      });
    }
  }

  function keyingTrack(track) {
    const normalizedName = track.name
      .replace(/\s*\(.*$/, "")
      .replace(/\s+-\s+.*$/, "")
      .trim()
      .toLowerCase();
    return `${normalizedName}|${track.artistUris.join(",")}`;
  }

  async function sortPlaylist() {
    if (!activePlaylist) return;

    await showLoadingOverlay();
    await sleep(1);

    updateOrderToggle();
    const trackDuplicate = new Set();
    const isDuplicate = (track) => {
      const key = keyingTrack(track);

      if (trackDuplicate.has(key)) {
        return true;
      }

      trackDuplicate.add(key);
      return false;
    };
    // Always start from the original, unfiltered playlist.
    playlistTracks = allPlaylistTracks.filter((track) => {
      /*
       * =========================================================
       * ARTISTS
       * =========================================================
       *
       * artistMode === true  -> include selected artists
       * artistMode === false -> exclude selected artists
       */

      if (filters.artists.size > 0) {
        const hasSelectedArtist = track.artistUris.some((uri) =>
          filters.artists.has(uri),
        );

        if (filters.artistMode) {
          // Include only tracks containing at least one
          // selected artist.
          if (!hasSelectedArtist) {
            return false;
          }
        } else {
          // Exclude tracks containing any selected artist.
          if (hasSelectedArtist) {
            return false;
          }
        }
      }

      /*
       * =========================================================
       * ALBUMS
       * =========================================================
       *
       * albumMode === true  -> include selected albums
       * albumMode === false -> exclude selected albums
       */

      if (filters.albums.size > 0) {
        const isSelectedAlbum = filters.albums.has(track.albumUri);

        if (filters.albumMode) {
          // Include only selected albums.
          if (!isSelectedAlbum) {
            return false;
          }
        } else {
          // Exclude selected albums.
          if (isSelectedAlbum) {
            return false;
          }
        }
      }

      /*
       * =========================================================
       * RELEASE DATE
       * =========================================================
       */

      if (
        filters.release_date.start &&
        (!track.release_date || track.release_date < filters.release_date.start)
      ) {
        return false;
      }

      if (
        filters.release_date.end &&
        (!track.release_date || track.release_date > filters.release_date.end)
      ) {
        return false;
      }

      /*
       * =========================================================
       * ADDED DATE
       * =========================================================
       */

      if (filters.addedAt.start) {
        const addedDate = track.addedAt ? track.addedAt.slice(0, 10) : null;

        if (!addedDate || addedDate < filters.addedAt.start) {
          return false;
        }
      }

      if (filters.addedAt.end) {
        const addedDate = track.addedAt ? track.addedAt.slice(0, 10) : null;

        if (!addedDate || addedDate > filters.addedAt.end) {
          return false;
        }
      }

      /*
       * =========================================================
       * DURATION
       * =========================================================
       */

      if (filters.duration) {
        const duration = durationMs(track.duration);

        if (
          duration < filters.duration.min ||
          duration > filters.duration.max
        ) {
          return false;
        }
      }

      /*
       * =========================================================
       * UNPLAYABLE
       * =========================================================
       */

      if (filters.unplayable && !track.playable) {
        return false;
      }

      if (filters.duplicate && isDuplicate(track)) {
        return false;
      }
      return true;
    });

    /*
     * =========================================================
     * SORT
     * =========================================================
     */

    if (playModeValue === "randomize") {
      showValue = null;

      for (let i = playlistTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [playlistTracks[i], playlistTracks[j]] = [
          playlistTracks[j],
          playlistTracks[i],
        ];
      }
    } else if (playModeValue === "playcount") {
      showValue = "playcount";

      playlistTracks.sort((a, b) => {
        const aPlaycount = Number(a.playcount) || 0;
        const bPlaycount = Number(b.playcount) || 0;

        return playOrderValue === "asc"
          ? aPlaycount - bPlaycount
          : bPlaycount - aPlaycount;
      });
    } else if (playModeValue === "releasedate") {
      showValue = "release_date";

      playlistTracks.sort((a, b) => {
        const aDate = a.release_date
          ? new Date(a.release_date).getTime()
          : null;

        const bDate = b.release_date
          ? new Date(b.release_date).getTime()
          : null;

        if (aDate === null && bDate === null) {
          return 0;
        }

        if (aDate === null) {
          return 1;
        }

        if (bDate === null) {
          return -1;
        }

        return playOrderValue === "asc" ? aDate - bDate : bDate - aDate;
      });
    } else if (playModeValue === "duration") {
      showValue = "duration";

      playlistTracks.sort((a, b) => {
        const aDuration = Number(a.duration) || 0;
        const bDuration = Number(b.duration) || 0;

        return playOrderValue === "asc"
          ? aDuration - bDuration
          : bDuration - aDuration;
      });
    } else if (playModeValue === "lastadded") {
      showValue = "addedAt";

      playlistTracks.sort((a, b) => {
        const aDate = a.addedAt ? new Date(a.addedAt).getTime() : null;

        const bDate = b.addedAt ? new Date(b.addedAt).getTime() : null;

        if (aDate === null && bDate === null) {
          return 0;
        }

        if (aDate === null) {
          return 1;
        }

        if (bDate === null) {
          return -1;
        }

        return playOrderValue === "asc" ? aDate - bDate : bDate - aDate;
      });
    } else if (playModeValue === "originalposition") {
      showValue = null;

      playlistTracks.sort((a, b) => {
        const aPosition = Number(a.original_pos) || 0;
        const bPosition = Number(b.original_pos) || 0;

        return playOrderValue === "desc"
          ? aPosition - bPosition
          : bPosition - aPosition;
      });
    } else if (playModeValue === "artist") {
      showValue = null;

      // Count how many tracks each artist appears on.
      const artistCounts = new Map();

      for (const track of playlistTracks) {
        for (const artistUri of track.artistUris) {
          artistCounts.set(artistUri, (artistCounts.get(artistUri) || 0) + 1);
        }
      }

      // Assign every track to exactly one artist:
      // the artist on that track with the most tracks in the playlist.
      const trackArtist = new Map();

      for (const track of playlistTracks) {
        let bestArtistUri = null;
        let bestArtistCount = -1;

        for (const artistUri of track.artistUris) {
          const count = artistCounts.get(artistUri) || 0;

          if (count > bestArtistCount) {
            bestArtistUri = artistUri;
            bestArtistCount = count;
          }
        }

        trackArtist.set(track, bestArtistUri);
      }

      // Build actual artist groups.
      const artistGroups = new Map();

      for (const track of playlistTracks) {
        const artistUri = trackArtist.get(track);

        if (!artistGroups.has(artistUri)) {
          artistGroups.set(artistUri, []);
        }

        artistGroups.get(artistUri).push(track);
      }

      // Sort the groups by the number of tracks assigned to them.
      const sortedGroups = [...artistGroups.entries()].sort(
        ([artistA, tracksA], [artistB, tracksB]) => {
          if (tracksA.length !== tracksB.length) {
            return playOrderValue === "desc"
              ? tracksB.length - tracksA.length
              : tracksA.length - tracksB.length;
          }

          // Same number of tracks:
          // use the first original playlist position as the tie-breaker.
          const firstA = Math.min(
            ...tracksA.map((track) => track.original_pos),
          );

          const firstB = Math.min(
            ...tracksB.map((track) => track.original_pos),
          );

          return firstA - firstB;
        },
      );

      // Flatten the groups.
      // This guarantees that an artist's tracks are never interrupted
      // by tracks belonging to another artist.
      playlistTracks = sortedGroups.flatMap(([, tracks]) => {
        return tracks.sort((a, b) => a.original_pos - b.original_pos);
      });
    } else if (playModeValue === "album") {
      showValue = null;

      // Count tracks per album in the filtered playlist.
      const albumCounts = new Map();

      for (const track of playlistTracks) {
        albumCounts.set(
          track.albumUri,
          (albumCounts.get(track.albumUri) || 0) + 1,
        );
      }

      playlistTracks.sort((a, b) => {
        const aCount = albumCounts.get(a.albumUri) || 0;
        const bCount = albumCounts.get(b.albumUri) || 0;

        if (aCount !== bCount) {
          return playOrderValue === "desc" ? bCount - aCount : aCount - bCount;
        }

        // Stable-ish fallback: original playlist position.
        return a.original_pos - b.original_pos;
      });
    }

    renderPlaylistPreview();
    hideLoadingOverlay();
  }

  function renderPlaylistPreview() {
    playlistPreviewCount.textContent = `${playlistTracks.length} tracks`;

    playlistPreviewList.replaceChildren();

    playlistPreviewList.style.height = `${playlistTracks.length * ROW_HEIGHT}px`;

    playlistRowsContainer = document.createElement("div");

    playlistRowsContainer.style.position = "absolute";
    playlistRowsContainer.style.top = "0";
    playlistRowsContainer.style.left = "0";
    playlistRowsContainer.style.right = "0";

    playlistPreviewList.appendChild(playlistRowsContainer);

    const render = () => {
      playlistRenderPending = false;

      const rect = playlistPreviewList.getBoundingClientRect();

      // How far we've scrolled into the playlist.
      const scrollTop = Math.max(0, -rect.top);

      const firstVisible = Math.floor(scrollTop / ROW_HEIGHT);

      const visibleCount = Math.ceil(window.innerHeight / ROW_HEIGHT);

      const start = Math.max(0, firstVisible - BUFFER);

      const end = Math.min(
        playlistTracks.length,
        firstVisible + visibleCount + BUFFER,
      );

      playlistRowsContainer.style.transform = `translateY(${start * ROW_HEIGHT}px)`;

      const fragment = document.createDocumentFragment();

      for (let index = start; index < end; index++) {
        const track = playlistTracks[index];

        const row = document.createElement("div");
        row.className = "playlist-preview-track";
        row.dataset.index = index;

        const number = document.createElement("span");
        number.className = "playlist-preview-number";
        number.textContent = index + 1;

        const image = document.createElement("img");
        image.className = "playlist-preview-cover";
        image.src = track.cover || "";
        image.alt = "";

        if (!track.playable) {
          row.classList.add("unplayable");
        }

        const info = document.createElement("div");
        info.className = "playlist-preview-info";

        const name = document.createElement("div");
        name.className = "playlist-preview-name";
        name.textContent = track.name;

        const artists = document.createElement("div");
        artists.className = "playlist-preview-artists";
        artists.textContent = track.artists;

        info.append(name, artists);

        const extraInfo = document.createElement("div");
        extraInfo.className = "playlist-preview-extra";

        const album = document.createElement("div");
        album.className = "playlist-preview-album";
        album.textContent = track.album;

        extraInfo.appendChild(album);

        if (showValue) {
          const extraValue = document.createElement("div");
          extraValue.className = "playlist-preview-extravalue";

          if (showValue === "release_date" || showValue === "addedAt") {
            extraValue.textContent = formatDate(track[showValue]);
          } else if (showValue === "duration") {
            extraValue.textContent = fmtDuration(track[showValue]);
          } else {
            extraValue.textContent = fmtNumber(track[showValue]);
          }

          extraInfo.appendChild(extraValue);
        }

        row.append(number, image, info, extraInfo);

        fragment.appendChild(row);
      }

      playlistRowsContainer.replaceChildren(fragment);
    };

    playlistScrollHandler = () => {
      if (playlistRenderPending) return;

      playlistRenderPending = true;
      requestAnimationFrame(render);
    };

    window.addEventListener("scroll", playlistScrollHandler, { passive: true });

    window.addEventListener("resize", render);

    render();
  }
  playlistPreviewList.addEventListener("click", (event) => {
    const row = event.target.closest(".playlist-preview-track");

    if (!row) return;

    const track = playlistTracks[Number(row.dataset.index)];

    if (track?.playable) {
      window.open(uriToUrl(track.id), "_blank");
    }
  });
  async function selectPlaylist(item) {
    const uri = item.id;
    bigReset();
    setURL(uri);

    activePlaylist = uri;
    const preloaded = [];

    playlistTracks = [];

    await showLoadingOverlay();

    const firstFetch = await getTracks(uri, 0, playlistStep);
    const totalCount = firstFetch.data.playlistV2.content.totalCount;
    if (totalCount < 1) {
      showToast("No tracks found in the playlist");
      showLibrary();
      hideLoadingOverlay();
      return;
    }

    loadingState.textContent = `Tracks fetched: ${Math.min(
      playlistStep,
      totalCount,
    )}/${totalCount}`;
    handleTracks(0, firstFetch);

    if (!firstFetch.data?.playlistV2?.currentUserCapabilities?.canEditItems) {
      dangerousOption.classList.add("is-disabled");
    } else {
      dangerousOption.classList.remove("is-disabled");
    }
    playlistNameInput.value = firstFetch?.data?.playlistV2?.name ?? "";
    playlistDescriptionInput.value =
      firstFetch?.data?.playlistV2?.description ?? "";

    // Preload the remaining pages.
    for (let i = playlistStep; i < totalCount; i += playlistStep) {
      preloaded.push(
        getTracks(uri, i, playlistStep).then(async (newFetch) => {
          loadingState.textContent = `Tracks fetched: ${
            playlistTracks.length
          }/${totalCount}`;

          handleTracks(i, newFetch);

          return newFetch;
        }),
      );
    }

    if (preloaded.length > 0) {
      await Promise.all(preloaded);
    }
    allPlaylistTracks = [...playlistTracks];

    hideLoadingOverlay();

    showPreview();
  }

  window.selectPlaylist = selectPlaylist;

  playModeOptions.forEach((option) => {
    const mode = option.dataset.mode.replace(/\s+/g, "").toLowerCase();
    option.textContent = option.dataset.mode;

    option.addEventListener("click", () => {
      if (mode === playModeValue) {
        return;
      }

      playModeValue = mode;
      setPlayMode(option.dataset.mode);
      updateOrderToggle();

      if (activePlaylist) {
        sortPlaylist();
      }
    });
  });

  function updateOrderToggle() {
    if (playModeValue === "playcount") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "most played first" : "least played first";
    } else if (playModeValue === "releasedate") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "most recent first" : "oldest first";
    } else if (playModeValue === "duration") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "longest first" : "shortest first";
    } else if (playModeValue === "lastadded") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "last added first" : "first added first";
    } else if (playModeValue === "originalposition") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "original" : "reversed";
    } else if (playModeValue === "album") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "most tracks" : "least tracks";
    } else if (playModeValue === "artist") {
      orderToggle.hidden = false;
      orderToggle.textContent =
        playOrderValue === "desc" ? "most tracks" : "least tracks";
    } else {
      orderToggle.hidden = true;
    }
    orderToggle.dataset.order = playOrderValue;
  }
  function setupPopupBackdropClose(overlay, onCancel) {
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) {
        return;
      }

      onCancel();
    });
  }
  confirmPlaylist.addEventListener("click", () => {
    confirmationOverlay.hidden = false;
  });
  cancelPlaylist.addEventListener("click", () => {
    confirmationOverlay.hidden = true;
  });
  setupPopupBackdropClose(confirmationOverlay, () => {
    confirmationOverlay.hidden = true;
  });
  savePlaylist.addEventListener("click", async () => {
    if (playlistNameInput.value.trim() === "") {
      playlistNameInput.setCustomValidity("Playlist name cannot be empty.");
      playlistNameInput.reportValidity();
      return;
    }
    playlistNameInput.setCustomValidity("");
    confirmationOverlay.hidden = true;
    const action = confirmationOverlay.querySelector(
      'input[name="playlist-action"]:checked',
    ).value;
    await showLoadingOverlay();
    const tracks = playlistTracks.map((track) => track.id);
    if (action === "new") {
      loadingState.textContent = "Creating playlist...";
      const playlist = await createPlaylist(
        playlistNameInput.value,
        playlistDescriptionInput.value,
      );
      if (playlist?.uri) {
        loadingState.textContent = "Adding the tracks to the playlist...";
        await addToPlaylist(playlist.uri, tracks);
      } else {
        showToast("Something went wrong with the creation of the playlist");
      }
      showToast("Playlist successfully created!!", "#22c55e");
    } else if (action === "replace") {
      dangerousMoment = true;
      loadingState.textContent =
        "Removing the tracks from your current playlist...";
      const allTracks = allPlaylistTracks.map((track) => track.id);
      await deleteTracks(activePlaylist, allTracks);
      loadingState.textContent = "Rearranging the tracks...";
      await addToPlaylist(activePlaylist, tracks);
      dangerousMoment = false;
      showToast("Playlist successfully rearranged!!", "#22c55e");
    }
    loadingState.textContent = "";
    hideLoadingOverlay();
  });
  window.addEventListener("beforeunload", (event) => {
    if (dangerousMoment) {
      event.preventDefault();
    }
  });
  orderToggle.addEventListener("click", () => {
    playOrderValue = playOrderValue === "desc" ? "asc" : "desc";

    updateOrderToggle();

    if (activePlaylist) {
      sortPlaylist();
    }
  });
  function setupFilterModeToggle(
    includeButton,
    excludeButton,
    getMode,
    setMode,
  ) {
    function update() {
      const include = getMode();

      includeButton.classList.toggle("active", include);
      excludeButton.classList.toggle("active", !include);

      includeButton.setAttribute("aria-pressed", String(include));
      excludeButton.setAttribute("aria-pressed", String(!include));
    }

    includeButton.addEventListener("click", () => {
      setMode(true);
      update();
    });

    excludeButton.addEventListener("click", () => {
      setMode(false);
      update();
    });

    update();

    return update;
  }
  function setupAutocomplete(
    input,
    suggestions,
    selectedContainer,
    bimap,
    getTargetSet,
  ) {
    function renderSelected() {
      selectedContainer.innerHTML = "";

      const selected = getTargetSet();

      for (const uri of selected) {
        const name = bimap.getByValue(uri);

        if (!name) continue;

        const chip = document.createElement("button");

        chip.type = "button";
        chip.className = "autocomplete-chip";
        chip.title = `Remove ${name}`;

        const label = document.createElement("span");
        label.className = "autocomplete-chip-label";
        label.textContent = name;

        const remove = document.createElement("span");
        remove.className = "autocomplete-chip-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-hidden", "true");

        chip.appendChild(label);
        chip.appendChild(remove);

        chip.addEventListener("click", () => {
          selected.delete(uri);
          renderSelected();

          // Refresh suggestions if the input currently has text.
          if (input.value.trim()) {
            input.dispatchEvent(new Event("input"));
          }
        });

        selectedContainer.appendChild(chip);
      }

      selectedContainer.hidden = selected.size === 0;
    }

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();

      suggestions.innerHTML = "";

      if (!query) {
        suggestions.hidden = true;
        return;
      }

      const selected = getTargetSet();

      const matches = [...bimap.forward.keys()]
        .filter((name) => {
          if (!name.toLowerCase().includes(query)) {
            return false;
          }

          const uri = bimap.getByKey(name);

          // Don't suggest something already selected.
          return !selected.has(uri);
        })
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 10);

      if (!matches.length) {
        suggestions.hidden = true;
        return;
      }

      for (const name of matches) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "autocomplete-suggestion";
        button.textContent = name;
        button.setAttribute("role", "option");

        button.addEventListener("mousedown", (event) => {
          // Prevent the input's blur event from hiding the menu
          // before we process the selection.
          event.preventDefault();

          const uri = bimap.getByKey(name);

          if (!uri) return;

          getTargetSet().add(uri);

          input.value = "";

          suggestions.innerHTML = "";
          suggestions.hidden = true;

          renderSelected();

          input.focus();
        });

        suggestions.appendChild(button);
      }

      suggestions.hidden = false;
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        suggestions.hidden = true;
      }, 100);
    });

    renderSelected();
  }
  const updateArtistModeToggle = setupFilterModeToggle(
    artistIncludeMode,
    artistExcludeMode,
    () => pendingFilters.artistMode,
    (mode) => {
      pendingFilters.artistMode = mode;
    },
  );

  const updateAlbumModeToggle = setupFilterModeToggle(
    albumIncludeMode,
    albumExcludeMode,
    () => pendingFilters.albumMode,
    (mode) => {
      pendingFilters.albumMode = mode;
    },
  );
  setupAutocomplete(
    artistFilter,
    artistSuggestions,
    artistSelected,
    allArtists,
    () => pendingFilters.artists,
  );

  setupAutocomplete(
    albumFilter,
    albumSuggestions,
    albumSelected,
    allAlbums,
    () => pendingFilters.albums,
  );
  filterPlaylistBtn.addEventListener("click", () => {
    pendingFilters = cloneFilters(filters);

    artistFilter.value = "";
    albumFilter.value = "";

    releaseDateFrom.value = pendingFilters.release_date.start ?? "";
    releaseDateTo.value = pendingFilters.release_date.end ?? "";

    addedDateFrom.value = pendingFilters.addedAt.start ?? "";
    addedDateTo.value = pendingFilters.addedAt.end ?? "";

    durationMin.value = pendingFilters.duration?.min ?? 0;
    durationMax.value = pendingFilters.duration?.max ?? 2400;

    removeUnplayable.checked = pendingFilters.unplayable;
    removeDuplicates.checked = pendingFilters.duplicate;

    releaseDateTo.min = pendingFilters.release_date.start ?? "";
    releaseDateFrom.max = pendingFilters.release_date.end ?? "";

    addedDateTo.min = pendingFilters.addedAt.start ?? "";
    addedDateFrom.max = pendingFilters.addedAt.end ?? "";

    updateArtistModeToggle();
    updateAlbumModeToggle();

    const min = Number(durationMin.value);
    const max = Number(durationMax.value);

    durationRange.style.left = `${(min / 2400) * 100}%`;
    durationRange.style.right = `${100 - (max / 2400) * 100}%`;

    durationValue.textContent =
      min === 0 && max === 2400
        ? "Any duration"
        : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} – ${Math.floor(max / 60)}:${String(max % 60).padStart(2, "0")}`;

    filterOverlay.hidden = false;
  });
  releaseDateFrom.addEventListener("change", () => {
    pendingFilters.release_date.start = releaseDateFrom.value || null;

    releaseDateTo.min = releaseDateFrom.value || "";
  });

  releaseDateTo.addEventListener("change", () => {
    pendingFilters.release_date.end = releaseDateTo.value || null;

    releaseDateFrom.max = releaseDateTo.value || "";
  });

  clearReleaseDate.addEventListener("click", () => {
    releaseDateFrom.value = "";
    releaseDateTo.value = "";

    releaseDateFrom.max = "";
    releaseDateTo.min = "";

    pendingFilters.release_date.start = null;
    pendingFilters.release_date.end = null;
  });

  addedDateFrom.addEventListener("change", () => {
    pendingFilters.addedAt.start = addedDateFrom.value || null;

    addedDateTo.min = addedDateFrom.value || "";
  });

  addedDateTo.addEventListener("change", () => {
    pendingFilters.addedAt.end = addedDateTo.value || null;

    addedDateFrom.max = addedDateTo.value || "";
  });

  clearAddedDate.addEventListener("click", () => {
    addedDateFrom.value = "";
    addedDateTo.value = "";

    addedDateFrom.max = "";
    addedDateTo.min = "";

    pendingFilters.addedAt.start = null;
    pendingFilters.addedAt.end = null;
  });
  durationMin.addEventListener("input", () => {
    let min = Number(durationMin.value);
    const max = Number(durationMax.value);

    if (min > max) {
      min = max;
      durationMin.value = min;
    }

    durationRange.style.left = `${(min / 2400) * 100}%`;

    durationValue.textContent =
      min === 0 && max === 2400
        ? "Any duration"
        : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} – ${Math.floor(max / 60)}:${String(max % 60).padStart(2, "0")}`;

    pendingFilters.duration = min === 0 && max === 2400 ? null : { min, max };
  });

  durationMax.addEventListener("input", () => {
    const min = Number(durationMin.value);
    let max = Number(durationMax.value);

    if (max < min) {
      max = min;
      durationMax.value = max;
    }

    durationRange.style.right = `${100 - (max / 2400) * 100}%`;

    durationValue.textContent =
      min === 0 && max === 2400
        ? "Any duration"
        : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} – ${Math.floor(max / 60)}:${String(max % 60).padStart(2, "0")}`;

    pendingFilters.duration = min === 0 && max === 2400 ? null : { min, max };
  });
  removeUnplayable.addEventListener("change", () => {
    pendingFilters.unplayable = removeUnplayable.checked;
  });
  removeDuplicates.addEventListener("change", () => {
    pendingFilters.duplicate = removeDuplicates.checked;
  });
  cancelFilters.addEventListener("click", () => {
    pendingFilters = null;
    filterOverlay.hidden = true;
  });
  setupPopupBackdropClose(filterOverlay, () => {
    pendingFilters = null;
    filterOverlay.hidden = true;
  });
  saveFilters.addEventListener("click", () => {
    filters.artists = new Set(pendingFilters.artists);
    filters.albums = new Set(pendingFilters.albums);
    filters.artistMode = pendingFilters.artistMode;
    filters.albumMode = pendingFilters.albumMode;

    filters.release_date = {
      ...pendingFilters.release_date,
    };

    filters.addedAt = {
      ...pendingFilters.addedAt,
    };

    filters.duration = pendingFilters.duration
      ? { ...pendingFilters.duration }
      : null;

    filters.unplayable = pendingFilters.unplayable;
    filters.duplicate = pendingFilters.duplicate;

    pendingFilters = null;
    filterOverlay.hidden = true;

    sortPlaylist();
  });

  playlistBackBtn.addEventListener("click", showLibrary);
  if (!handleSpotifyParameter()) {
    showLibrary();
  }
})();
