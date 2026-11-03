let accessToken;
let username = null;
let profileReadyResolve;
let generatedNumber;
let featuredLocal;
let playlistFull = { id: null, res: null };
const fetchLimit = 50;

const DB_NAME = "spotifyWassimExtensionDB";
const DBVersion = 1;
const RECENT_STORE_NAME = "recentDays";

const TRACK_STORE_NAME = "tracks";
const trackMap = new Map();
const ArtistMap = new Map();
let trackMapReady = null;
let pendingTrackWrites = new Map();
let trackWriteTimer = null;

const likedSongsUri = "spotify:playlist:37i9dQZF1F5p3rmiWPIYgZ";
const cancelPages = new Set();
const profileReady = new Promise((resolve) => {
  profileReadyResolve = resolve;
});
async function resetFeatured() {
  featuredLocal = null;
  await chrome.storage.local.remove("featured");
}
function getDay() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DBVersion);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(RECENT_STORE_NAME)) {
        db.createObjectStore(RECENT_STORE_NAME);
      }

      if (!db.objectStoreNames.contains(TRACK_STORE_NAME)) {
        db.createObjectStore(TRACK_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

const openTrackDB = () => {
  if (!trackMapReady) {
    trackMapReady = openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(TRACK_STORE_NAME, "readonly");

          const request = transaction
            .objectStore(TRACK_STORE_NAME)
            .openCursor();

          request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (!cursor) {
              resolve();
              return;
            }

            if (!pendingTrackWrites.has(cursor.key)) {
              trackMap.set(cursor.key, cursor.value);
            }

            cursor.continue();
          };

          request.onerror = () => {
            trackMapReady = null;
            reject(request.error);
          };

          transaction.onerror = () => {
            trackMapReady = null;
            reject(transaction.error);
          };

          transaction.onabort = () => {
            trackMapReady = null;
            reject(transaction.error);
          };
        });
      })
      .catch((error) => {
        trackMapReady = null;
        throw error;
      });
  }

  return trackMapReady;
};

const setTrack = (trackId, data) => {
  trackMap.set(trackId, data);
  pendingTrackWrites.set(trackId, data);

  if (trackWriteTimer !== null) {
    return;
  }

  trackWriteTimer = setTimeout(async () => {
    trackWriteTimer = null;

    const writes = pendingTrackWrites;
    pendingTrackWrites = new Map();

    try {
      const db = await openDB();

      const transaction = db.transaction(TRACK_STORE_NAME, "readwrite");

      const store = transaction.objectStore(TRACK_STORE_NAME);

      for (const [trackId, data] of writes) {
        store.put(data, trackId);
      }

      transaction.oncomplete = () => {
        console.log("[TrackDB] WRITE COMPLETE:", writes.size, "tracks");
      };

      transaction.onerror = () => {
        console.error("[TrackDB] WRITE ERROR:", transaction.error);

        for (const [trackId, data] of writes) {
          pendingTrackWrites.set(trackId, data);
        }
      };

      transaction.onabort = () => {
        console.error("[TrackDB] WRITE ABORTED:", transaction.error);

        for (const [trackId, data] of writes) {
          pendingTrackWrites.set(trackId, data);
        }
      };
    } catch (error) {
      console.error("[TrackDB] PERSIST FAILED:", error);

      for (const [trackId, data] of writes) {
        pendingTrackWrites.set(trackId, data);
      }
    }
  }, 25);
};

const getRecentDay = async (dayKey) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECENT_STORE_NAME, "readonly");
    const request = transaction.objectStore(RECENT_STORE_NAME).get(dayKey);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

const setRecentDay = async (dayKey, items) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECENT_STORE_NAME, "readwrite");

    transaction.objectStore(RECENT_STORE_NAME).put(items, dayKey);

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

const resetDBStore = async (storeName) => {
  const db = await openDB();

  if (!db.objectStoreNames.contains(storeName)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");

    transaction.objectStore(storeName).clear();

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

async function fullReset() {
  await chrome.storage.local.clear();

  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = resolve;

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn(`[DB] Delete blocked: ${DB_NAME}`);
    };
  });

  trackMapReady = null;
  trackMap.clear();
  pendingTrackWrites.clear();
  trackWriteTimer = null;
}
const getStoreSize = async (storeName) => {
  const db = await openDB();

  if (!db.objectStoreNames.contains(storeName)) {
    return {
      bytes: 0,
      kb: 0,
      mb: 0,
      records: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();

    let bytes = 0;
    let records = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (!cursor) {
        resolve({
          bytes,
          kb: bytes / 1024,
          mb: bytes / (1024 * 1024),
          records,
        });
        return;
      }

      bytes += new Blob([
        JSON.stringify(cursor.key),
        JSON.stringify(cursor.value),
      ]).size;

      records++;
      cursor.continue();
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    transaction.onabort = () => {
      reject(transaction.error);
    };
  });
};
async function getSpotifySecret(expectedVer = null) {
  const url = "https://open.spotify.com/";

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/120.0 Safari/537.36",
  };

  const html = await (await fetchWithRetry(url, { headers })).text();

  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (x) => x[1],
  );

  const webPlayerJs = scripts.find(
    (src) =>
      src.includes("/web-player/") &&
      !src.includes("vendor") &&
      !src.includes("encore"),
  );

  if (!webPlayerJs) {
    console.log(scripts);
    throw new Error("No web player JS found");
  }

  const js = await (await fetchWithRetry(webPlayerJs, { headers })).text();

  const match = js.match(/secret:'([^']+)',version:([^}\s]+)/);

  if (!match) {
    throw new Error("No match found");
  }

  const spotiSecret = match[1];
  const version = Number(match[2]);
  if (expectedVer && version == expectedVer) {
    return;
  }
  const decoded = [...spotiSecret].map(
    (ch, i) => ch.charCodeAt(0) ^ ((i % 33) + 9),
  );

  const decimalString = decoded.join("");

  const finalSecret = [...new TextEncoder().encode(decimalString)];
  await chrome.storage.local.set({
    totpVer: version,
    secret: finalSecret,
  });
  console.log(`Regenerated secret ${finalSecret}\n${version}`);

  return {
    totpVer: version,
    secret: finalSecret,
  };
}
async function removeEntriesOlderThan(storeName, days = 90) {
  const db = await openDB(storeName);
  if (!db.objectStoreNames.contains(storeName)) {
    db.close();
    throw new Error(`Object store "${storeName}" does not exist`);
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);

  const cutoffKey =
    `${cutoff.getFullYear()}-` +
    `${String(cutoff.getMonth() + 1).padStart(2, "0")}-` +
    `${String(cutoff.getDate()).padStart(2, "0")}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();

    let deleted = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (!cursor) {
        return;
      }

      const key = cursor.key;

      if (typeof key === "string" && key < cutoffKey) {
        cursor.delete();
        deleted++;
      }

      cursor.continue();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };

    transaction.oncomplete = () => {
      db.close();
      resolve(deleted);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
async function loadSecret() {
  const stored = await chrome.storage.local.get(["totpVer", "secret"]);
  if (stored.totpVer && stored.secret) {
    getSpotifySecret(stored.totpVer);
    return {
      totpVer: stored.totpVer,
      secret: stored.secret,
    };
  }

  return await getSpotifySecret();
}

async function generateTOTP({
  secret,
  algorithm = "SHA-1",
  digits = 6,
  timing = null,
  period = 30_000,
}) {
  if (timing === null) {
    timing = Date.now();
  }
  const counter = Math.floor(timing / period);

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret),
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"],
  );

  const hmac = await crypto.subtle.sign("HMAC", key, buffer);
  const hmacBytes = new Uint8Array(hmac);

  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;

  const truncated =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const code = String(truncated % 10 ** digits).padStart(digits, "0");
  return code;
}

async function fetchWithRetry(url, options = {}, retries = 5, delay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 504 || attempt === retries) {
      return response;
    }

    console.log(`Gateway timeout. Retrying... (${attempt + 1}/${retries})`);

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function getAccessToken(retry = 3) {
  console.log("getting access token");
  const { secret, totpVer } = await loadSecret();
  const headers = {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.178 Safari/537.36",
  };
  const timing = await fetchWithRetry(
    "https://open.spotify.com/api/server-time",
  )
    .then((res) => res.json())
    .then((data) => data.serverTime);
  const totp = await generateTOTP({ secret });
  const totpServer = await generateTOTP({ secret, timing, period: 30 });

  const fetchLink = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${totp}&totpServer=${totpServer}&totpVer=${totpVer}`;

  try {
    const response = await fetchWithRetry(fetchLink, {
      method: "GET",
      headers: headers,
    });
    if (response.status !== 200) {
      if (retry > 0) {
        const responseText = await response.text();
        console.log("retrying", responseText);
        await sleep(5000);
        return await getAccessToken(retry - 1);
      } else {
        console.error("Max retries reached");
        return null;
      }
    } else {
      const responseJson = await response.json();
      console.log(responseJson);

      accessToken = responseJson.accessToken;
      console.log("Access Token:", accessToken);
      if (!accessToken) {
        console.error("no access token found");
      }
      return accessToken;
    }
  } catch (error) {
    console.error("Error fetching access token:", error);
  }
}

async function spotifuckFetch(
  meth,
  url,
  data = null,
  headers = null,
  errorCodes = new Set([]),
  retry = 5,
) {
  console.log("_____________________________");
  console.log(meth, url, data);

  if (!accessToken) {
    await getAccessToken();
  }
  const defaultHeaders = {
    Authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.178 Safari/537.36",
    "Content-Type": "application/json",
  };
  try {
    const fetchRes = await fetchWithRetry(url, {
      method: meth,
      headers: headers ? { ...defaultHeaders, ...headers } : defaultHeaders,
      ...(data && { body: JSON.stringify(data) }),
    });

    if (fetchRes.status > 300 && !errorCodes.has(fetchRes.status)) {
      console.log(await fetchRes.clone().text());
      if (retry > 0) {
        await getAccessToken();
        await sleep(200);
        return await spotifuckFetch(
          meth,
          url,
          data,
          headers,
          errorCodes,
          retry - 1,
        );
      } else {
        console.error(
          `Something went wrong with spotifuckFetch ${url}\n${
            fetchRes.status
          }\n${await fetchRes.text()}`,
        );
        return null;
      }
    } else if (errorCodes.has(fetchRes.status)) {
      console.error(
        `Request blocked by errorCodes: ${fetchRes.status}\n${url}\n${await fetchRes.text()}`,
      );
      return null;
    }
    const responseText = await fetchRes.text();
    const responseJSON = isJSON(responseText);
    if (responseJSON) {
      return responseJSON;
    } else {
      return null;
    }
  } catch (error) {
    console.log(error);
    if (retry > 0) {
      return await spotifuckFetch(
        meth,
        url,
        data,
        headers,
        errorCodes,
        retry - 1,
      );
    }
    return null;
  }
}

async function spotiQuery(payload) {
  return await spotifuckFetch(
    "POST",
    "https://api-partner.spotify.com/pathfinder/v2/query",
    payload,
  );
}

async function getProfile() {
  const res = await spotiQuery({
    variables: {},
    operationName: "profileAttributes",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0",
      },
    },
  });
  if (res.data.me) {
    username = res.data.me.profile.username;
  }
  return username;
}

async function audiofeatures(ids, batchSize = null, diconly = true) {
  const featuresSet = new Set([
    "acousticness",
    "danceability",
    "energy",
    "instrumentalness",
    "key",
    "liveness",
    "loudness",
    "mode",
    "speechiness",
    "tempo",
    "time_signature",
    "valence",
  ]);
  const res = diconly ? {} : [];
  if (typeof ids === "string") {
    ids = [ids];
  } else if (diconly) {
    const unfiltered_ids = [...new Set(ids)];
    ids = [];
    for (const id of unfiltered_ids) {
      const track = trackMap.get(id);
      if (track?.audioFeatures) {
        res[id] = track.audioFeatures;
      } else {
        ids.push(id);
      }
    }
  }
  if (!batchSize) {
    batchSize = 400;
  }

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const link = `https://spclient.wg.spotify.com/audio-attributes/v1/audio-features?ids=${batch.join(",")}`;
    const data = await spotifuckFetch("GET", link);
    const audio_features = data.audio_features;
    if (diconly) {
      for (const item of audio_features) {
        if (!item) continue;
        const id = item["id"];
        const track = trackMap.get(id) ?? {};
        track.audioFeatures = {};
        for (const feature of featuresSet) {
          track.audioFeatures[feature] = item[feature];
        }
        res[id] = track.audioFeatures;
        setTrack(id, track);
      }
    } else {
      res.push(...audio_features);
    }
  }

  return res;
}

async function fetchSnippet(uri) {
  const trackId = uri.slice(uri.lastIndexOf(":") + 1);
  const track = trackMap.get(trackId) ?? {};

  if (track?.audioPreviewUrl) {
    return track.audioPreviewUrl;
  }

  const snippetFetch = await fetchWithRetry(
    `https://open.spotify.com/embed/track/${trackId}?utm_source=discord&utm_medium=desktop`,
  );

  const html = await snippetFetch.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/,
  );

  if (!match) {
    return undefined;
  }

  const nextData = JSON.parse(match[1]);
  const audioPreviewUrl =
    nextData.props.pageProps.state.data.entity.audioPreview?.url;
  if (audioPreviewUrl) {
    track.audioPreviewUrl = audioPreviewUrl;
    setTrack(trackId, track);
  }

  return audioPreviewUrl;
}
function uriToId(uri) {
  return uri.slice(uri.lastIndexOf(":") + 1);
}
async function fmtData(
  total,
  type,
  count,
  placement = 0,
  artistInfo = true,
  returnTotal = false,
  needSnippet = true,
) {
  let track;
  let playlistInfo = false;
  let albumData = false;

  if (type === "album") {
    albumData = total?.data?.albumUnion;
    track = albumData?.tracksV2?.items?.[placement]?.track;
  } else {
    playlistInfo = total?.data?.playlistV2;
    track = playlistInfo?.content?.items?.[placement]?.itemV2?.data;
  }
  if (!track?.uri) {
    console.log("no track", track, placement, total);
    return null;
  }

  let audioPreviewUrl;
  let preloadArtistStat;
  let preloadArtistGenre;
  if (artistInfo) {
    preloadArtistStat = getArtistStats(track.artists.items[0].uri);
    preloadArtistGenre = getArtistGenre(track.artists.items[0].uri);
  }
  if (needSnippet) {
    audioPreviewUrl = await fetchSnippet(track.uri);

    if (!audioPreviewUrl) {
      return false;
    }
  }

  const album =
    type === "album"
      ? {
          id: albumData.uri,
          artists:
            albumData?.artists?.items?.map((artist) => artist.profile.name) ??
            [],

          artistUris:
            albumData?.artists?.items?.map((artist) => artist.uri) ?? [],
          name: albumData?.name ?? null,

          image: getBestImage(albumData?.coverArt?.sources),
        }
      : {
          artists:
            track.albumOfTrack?.artists?.items?.map(
              (artist) => artist.profile.name,
            ) ?? [],
          artistUris:
            track.albumOfTrack?.artists?.items?.map((artist) => artist.uri) ??
            [],
          name: track.albumOfTrack?.name ?? null,
          id: track.albumOfTrack?.uri ?? null,

          image: getBestImage(track.albumOfTrack?.coverArt?.sources),
        };
  return {
    type: type,
    snippet: audioPreviewUrl,
    total: returnTotal ? total : null,
    album,
    daily: false,
    id: track.uri,
    playcount: parseInt(track.playcount),
    name: track.name ?? null,
    artistsInfo: artistInfo
      ? {
          stats: await preloadArtistStat,
          genres: await preloadArtistGenre,
        }
      : {},
    artists: track.artists?.items?.map((artist) => artist.profile.name) ?? [],
    artistUris: track.artists?.items?.map((artist) => artist.uri) ?? [],
    finished: false,
    release_date:
      type === "album"
        ? (albumData?.date?.isoString ?? null)
        : (track.albumOfTrack?.date?.isoString ?? null),

    duration:
      type === "album"
        ? (track.duration?.totalMilliseconds ?? null)
        : (track.trackDuration?.totalMilliseconds ?? null),

    count,
    playlist:
      type === "album"
        ? false
        : {
            id: playlistInfo.uri,
            count,
            name: playlistInfo.name,
            owner: playlistInfo.ownerV2.data.name,
            description: playlistInfo.description,
            uid: playlistInfo?.content?.items?.[placement]?.uid,
            capabilities: playlistInfo.currentUserCapabilities,
          },
  };
}

function fmtLibraryItem(a) {
  const item = {
    id: a.item._uri,
    type: a.item.__typename,
    name: a.item.data?.name ?? a.item.data?.profile?.name,

    count:
      a.item.data.count ??
      a.item.data.playlistCount ??
      a.item.data.tracksV2?.totalCount ??
      null,

    cover:
      getBestImage(a.item.data.image?.sources) ??
      getBestImage(a.item.data.images?.items?.[0]?.sources) ??
      getBestImage(a.item.data.coverArt?.sources) ??
      getBestImage(a.item.data.visuals?.avatarImage?.sources) ??
      null,
  };

  if (item.type === "LibraryPseudoPlaylistResponseWrapper") {
    item.id = likedSongsUri;
  }
  return item;
}
function randomNumber() {
  if (!generatedNumber) {
    const day = getDay();

    let hash = 0;
    for (let i = 0; i < day.length; i++) {
      hash = (hash << 5) - hash + day.charCodeAt(i);
      hash |= 0;
    }

    let x = Math.sin(hash) * 10000;
    x = x - Math.floor(x);

    generatedNumber = +x.toFixed(5);
  }
  return generatedNumber;
}

async function getFeatured(force = false) {
  const date = getDay();
  const res = {};
  const dailyNum = randomNumber();
  if (!force) {
    if (featuredLocal) return featuredLocal.res;
    const stored = await chrome.storage.local.get(["featured"]);

    if (stored.featured && stored.featured.day === date) {
      featuredLocal = stored.featured;
      return featuredLocal.res;
    }
  }
  async function dailyUse(tracks) {
    const count = tracks.data.playlistV2.content.totalCount;

    const track = await fmtData(
      tracks,
      "playlist",
      count,
      Math.floor(dailyNum * count),
    );
    const id = tracks.data.playlistV2.uri;
    return {
      daily: true,
      id,
      custom: false,
      track,
      count: 1,
      cover: tracks.data.playlistV2.images.items[0].sources[0].url,
      finished: false,
    };
  }
  async function normalUse(uri) {
    const playlist = await fetchPlaylist(uri);
    const playlistInfo = playlist.data.playlistV2;
    const item = {
      name: playlistInfo.name,
      id: uri,
      type: "PlaylistResponseWrapper",
      count: playlistInfo.content.totalCount,
      cover: getBestImage(playlistInfo?.images?.items?.[0]?.sources),
    };
    res[item.name] = item;
  }
  featuredLocal = { day: date };
  const dailySectionPayload = {
    variables: {
      pagination: { offset: 0, limit: 20 },
      uri: "spotify:section:0JQ5DACFo5h0jxzOyHOsIo",
      browseEndUserIntegration: "INTEGRATION_WEB_PLAYER",
      includeEpisodeContentRatingsV2: true,
    },
    operationName: "browseSection",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "b13c1cccbfcb6947753c2613411b3566485c21fd5f36d80a80bb64be61ba2d51",
      },
    },
  };
  const globalTop = fetchPlaylist(
    "spotify:playlist:37i9dQZEVXbMDoHDwVN2tF",
    0,
    50,
  ).then(async (res1) => {
    const res2 = await dailyUse(res1);
    res2.cover =
      "https://cdn.discordapp.com/attachments/1425159994881478718/1542703097296588871/image.png?ex=6a9231b8&is=6a90e038&hm=aeb9b6ffa8b29fbb1d9b07b020a3957a2ff8317b6f04fd4bc47d27a04e0fc1ed&";

    res["Daily Challenge"] = res2;
  });
  const dailySection = spotiQuery(dailySectionPayload).then(async (res1) => {
    if (res1.data.browseSection.sectionItems.items.length > 0) {
      return await fetchPlaylist(
        res1.data.browseSection.sectionItems.items[0].uri,
        0,
        50,
      ).then(async (res2) => {
        const res3 = await dailyUse(res2);
        if (res3) {
          res["Your daily song"] = res3;
        }
      });
    }
  });
  const normallists = [
    "5ABHKGoOzxkaa28ttQV9sE",
    "37i9dQZEVXbMDoHDwVN2tF",
    "37i9dQZF1DXcBWIGoYBM5M",
  ];
  const normalPromises = normallists.map((playlistId) =>
    normalUse("spotify:playlist:" + playlistId),
  );
  await dailySection;
  await globalTop;
  await Promise.all(normalPromises);
  featuredLocal.res = res;
  chrome.storage.local.set({
    featured: featuredLocal,
  });
  return res;
}

async function finishedDaily(name) {
  if (!featuredLocal?.res?.[name]) {
    await getFeatured(true);
  }
  featuredLocal.res[name].finished = true;
  chrome.storage.local.set({
    featured: featuredLocal,
  });
}
const libraryDico = {
  LibraryPseudoPlaylistResponseWrapper: "",
  PlaylistResponseWrapper: "",
  LibraryFolderResponseWrapper: "",
  AlbumResponseWrapper: "",
  ArtistResponseWrapper: "",
};
function getBestImage(sources) {
  if (!sources?.length) return null;

  const first = sources[0];
  const last = sources[sources.length - 1];

  return (last.height > first.height ? last : first).url;
}

async function getLibrary(id, albums = true, artists = false) {
  const results = [];
  const isRoot = id == null;

  const filters = ["Playlists"];
  if (isRoot) {
    if (albums) {
      filters.push("Albums");
    }
    if (artists) {
      filters.push("Artists");
    }
  }

  for (const filter of filters) {
    const payload = {
      variables: {
        filters: [filter],
        order: null,
        textFilter: "",
        features: [
          "LIKED_SONGS",
          "YOUR_EPISODES_V2",
          "PRERELEASES",
          "PRERELEASES_V2",
          "CLIPS",
          "EVENTS",
        ],
        limit: 5000,
        offset: 0,
        flatten: false,
        expandedFolders: [],
        folderUri: id,
        includeFoldersWhenFlattening: true,
      },
      operationName: "libraryV3",
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455",
        },
      },
    };

    const res = await spotiQuery(payload);

    if (!res || res.data?.me?.libraryV3?.__typename === "NotFound") {
      console.log(id, filter, "not found or request failed");
      continue;
    }

    for (const a of res.data.me.libraryV3.items) {
      // Skip deleted/not found items
      if (
        !(a.item.__typename in libraryDico) ||
        a.item.data.__typename === "NotFound"
      ) {
        continue;
      }

      const item = fmtLibraryItem(a);

      results.push(item);
    }
  }

  return results;
}
async function getRelatedArtist(artistUri) {
  const artistId = uriToId(artistUri);
  const artistRelated = ArtistMap.get(artistId) || {};
  if (artistRelated?.relatedArtists) {
    return artistRelated.relatedArtists;
  }

  const res = await getArtist(artistUri);
  const relatedArtists =
    res.data.artistUnion.relatedContent.relatedArtists.items.map(
      (item) => item.id,
    );
  artistRelated["relatedArtists"] = relatedArtists;
  ArtistMap.set(artistId, artistRelated);
  return relatedArtists;
}

async function getArtistGenre(artistUri) {
  const artistId = uriToId(artistUri);
  const artistGenres = ArtistMap.get(artistId) || {};
  if (artistGenres?.genres) {
    return artistGenres.genres;
  }
  const relatedArtGenres = getRelatedArtist(artistUri).then(
    async (relatedArtists) => {
      const genres = new Set();

      const relatedGenres = await fetchWithRetry(
        `https://everynoise.com/api/${relatedArtists.join(",")}`,
      ).then((res) => res.json());
      for (const [key, value] of Object.entries(relatedGenres)) {
        value.forEach((item) => {
          genres.add(item);
        });
      }
      artistGenres.genres = [...genres];
      ArtistMap.set(artistId, artistGenres);
      return artistGenres.genres;
    },
  );
  const mainGenres = await fetchWithRetry(
    `https://everynoise.com/api/${artistId}`,
  ).then((res) => res.json());
  if (
    Array.isArray(mainGenres?.[artistId]) &&
    mainGenres[artistId].length > 0
  ) {
    artistGenres.genres = mainGenres[artistId];
    ArtistMap.set(artistId, artistGenres);
    return artistGenres.genres;
  }
  return await relatedArtGenres;
}

async function getArtist(artistUri) {
  const payload = {
    variables: {
      uri: artistUri,
      locale: "",
      preReleaseV2: true,
    },
    operationName: "queryArtistOverview",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "ae0e2958a4ab645b35ca19ac04d0495ae12d9c5d7b7286217674801a9aab281a",
      },
    },
  };
  return await spotiQuery(payload);
}
async function getArtistStats(artistUri) {
  const artistId = uriToId(artistUri);
  const artistStat = ArtistMap.get(artistId) || {};
  if (artistStat?.stats) {
    return artistStat.stats;
  }
  const res = await getArtist(artistUri);
  const stats = res.data.artistUnion.stats;
  artistStat["stats"] = stats;
  ArtistMap.set(artistId, artistStat);
  return stats;
}
async function fetchPlaylist(uri, position = 0, limit = 50) {
  const payload = {
    variables: {
      uri: uri,
      offset: position,
      limit: limit,
      enableWatchFeedEntrypoint: true,
      includeEpisodeContentRatingsV2: true,
    },
    operationName: "fetchPlaylist",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "e4b2953f160e58e38ac025d79b5a9b3aceee5c4c716598e9830bfceb69faff5f",
      },
    },
  };
  return await spotiQuery(payload);
}
async function fetchAlbum(uri, position = 0, limit = 50) {
  const payload = {
    variables: { uri: uri, locale: "", offset: position, limit: limit },
    operationName: "getAlbum",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10",
      },
    },
  };
  return await spotiQuery(payload);
}

async function fetchRandom(
  item,
  playedTracks,
  stats = true,
  totalTracks = 1,
  total = null,
  random = true,
  returnTotal = false,
) {
  const type = item.id.split(":")[1];
  const allTracks = [];
  if (item.id === playlistFull.id) {
    total = playlistFull.res;
  }
  // Fetch total count only when unknown
  if (item.count == null || !total) {
    if (type === "album") {
      total = await fetchAlbum(item.id, 0, fetchLimit);
      item.count = total?.data?.albumUnion?.tracksV2?.totalCount ?? 0;
    } else {
      total = await fetchPlaylist(item.id, 0, fetchLimit);
      item.count = total?.data?.playlistV2?.content?.totalCount ?? 0;
    }
    total.resOffset = 0;
    total.resCount = 50;
    playlistFull = { id: item.id, res: total };
    if (item.count < totalTracks) return null;
  }
  if (playedTracks.length >= item.count)
    return totalTracks === 1
      ? { finished: true }
      : Array.from({ length: totalTracks }, () => ({
          finished: true,
        }));

  const playedSet = new Set(playedTracks);
  let randomIndex = null;
  let placement = 0;
  if (random) {
    do {
      randomIndex = Math.floor(Math.random() * item.count);
    } while (playedSet.has(randomIndex));
  } else {
    if (playedTracks.length > 0) {
      randomIndex = playedTracks.at(-1) + 1;
    } else {
      randomIndex = 0;
    }
  }

  if (
    randomIndex > total.resOffset + total.resCount ||
    randomIndex < total.resOffset
  ) {
    const tempResCount = random ? 1 : fetchLimit;

    total =
      type === "album"
        ? await fetchAlbum(item.id, randomIndex, tempResCount)
        : await fetchPlaylist(item.id, randomIndex, tempResCount);

    item.count =
      type === "album"
        ? (total?.data?.albumUnion?.tracksV2?.totalCount ?? 0)
        : (total?.data?.playlistV2?.content?.totalCount ?? 0);
    total.resOffset = randomIndex;
    total.resCount = tempResCount;
    if (item.count < totalTracks) return null;
  } else {
    placement = randomIndex;
  }
  if (placement > item.count) return null;
  playedTracks.push(randomIndex);
  const res = await fmtData(
    total,
    type,
    item.count,
    placement,
    stats,
    returnTotal,
  );
  if (!res) {
    const fetchingRandom = await fetchRandom(
      item,
      playedTracks,
      stats,
      1,
      total,
      random,
    );
    allTracks.push(fetchingRandom);
    playedTracks = fetchingRandom.position;
  } else {
    res.position = playedTracks;
    allTracks.push(res);
  }
  if (totalTracks === 1) {
    return allTracks[0];
  }
  while (allTracks.length < totalTracks) {
    const fetchingRandom = await fetchRandom(
      item,
      playedTracks,
      stats,
      1,
      total,
      random,
    );
    allTracks.push(fetchingRandom);
    playedTracks = fetchingRandom.position;
  }

  return allTracks;
}

// async function fetchRecentRandom(
//   item,
//   playedTracks,
//   totalTracks = 1,
//   total = null,
//   random = true,
//   returnTotal = false,
// ) {
//   const allTracks = [];

//   // Fetch total count only when unknown
//   if (item.count == null || !total) {
//     total = await fetchRecentPage(0, fetchLimit);
//     item.count = total.totalCount;
//     total.resOffset = 0;
//     total.resCount = 50;
//     if (item.count < totalTracks) return null;
//   }
//   if (playedTracks.length >= item.count)
//     return totalTracks === 1
//       ? { finished: true }
//       : Array.from({ length: totalTracks }, () => ({
//           finished: true,
//         }));

//   const playedSet = new Set(playedTracks);
//   let randomIndex = null;
//   let placement = 0;
//   if (random) {
//     do {
//       randomIndex = Math.floor(Math.random() * item.count);
//     } while (playedSet.has(randomIndex));
//   } else {
//     if (playedTracks.length > 0) {
//       randomIndex = playedTracks.at(-1) + 1;
//     } else {
//       randomIndex = 0;
//     }
//   }

//   if (
//     randomIndex > total.resOffset + total.resCount ||
//     randomIndex < total.resOffset
//   ) {
//     total = await fetchRecentPage(randomIndex, fetchLimit);

//     item.count = total.totalCount;
//     total.resOffset = randomIndex;
//     total.resCount = tempResCount;
//     if (item.count < totalTracks) return null;
//   } else {
//     placement = randomIndex;
//   }
//   if (placement > item.count) return null;
//   playedTracks.push(randomIndex);
//   const res = await fmtData(
//     total,
//     type,
//     item.count,
//     placement,
//     stats,
//     returnTotal,
//   );
//   if (!res) {
//     const fetchingRandom = await fetchRandom(
//       item,
//       playedTracks,
//       stats,
//       1,
//       total,
//       random,
//     );
//     allTracks.push(fetchingRandom);
//     playedTracks = fetchingRandom.position;
//   } else {
//     res.position = playedTracks;
//     allTracks.push(res);
//   }
//   if (totalTracks === 1) {
//     return allTracks[0];
//   }
//   while (allTracks.length < totalTracks) {
//     const fetchingRandom = await fetchRandom(
//       item,
//       playedTracks,
//       stats,
//       1,
//       total,
//       random,
//     );
//     allTracks.push(fetchingRandom);
//     playedTracks = fetchingRandom.position;
//   }

//   return allTracks;
// }

const fetchRecentPage = async (pageOffset = 0, fetchLimit = 50, retry = 5) => {
  const payload = {
    variables: {
      uris: ["spotify:list:recents:page"],
      offset: pageOffset,
      limit: fetchLimit,
    },
    operationName: "recents",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "698be5892a3cc95331deebeff463d05dfdd5febf5254bea30b895b5a93dfb584",
      },
    },
  };

  for (let attempt = 0; attempt < retry; attempt++) {
    try {
      const recent = await spotiQuery(payload);
      const list = recent?.data?.lists?.[0];

      if (!list || list.__typename === "GenericError") {
        continue;
      }

      return {
        list,
        totalCount: list.items?.totalCount ?? null,
      };
    } catch (error) {
      console.log("error with recent fetching", error);
    }
  }

  return null;
};

async function fetchCovers(items) {
  const getBiggest = (images) => {
    if (!Array.isArray(images) || images.length === 0) {
      return null;
    }

    const biggest = images.reduce(
      (a, b) => (b?.maxWidth > a?.maxWidth ? b : a),
      images[0],
    );

    return biggest?.url ?? null;
  };

  const payload = {
    variables: {
      uris: items,
    },
    operationName: "lookupChildEntities",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "91ce02e32b19123de231dc8de91fe4b9ab84eca087d4c015549308d77fbb6d10",
      },
    },
  };

  const query = await spotiQuery(payload);

  const res = {};

  for (const item of query?.data?.lookupEntities ?? []) {
    const itemUri = item?.uri;

    if (!itemUri) {
      console.log("couldn't get URI for", item);
      continue;
    }

    res[itemUri] = getBiggest(
      item?.visualIdentityTrait?.squareCoverImage?.image?.data?.sources,
    );
  }

  return res;
}

async function fetchRecent(
  limit,
  currentDay = false,
  retry = 10,
  tabId = null,
) {
  const fetchStep = 500;

  // Number of pages to keep downloading ahead of the current page.
  // 0 = no prefetching
  // 1 = one page ahead
  // 3 = three pages ahead
  // 5 = five pages ahead
  const PREFETCH_PAGES = 10;

  const MS_PER_DAY = 86400000;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError("limit must be a positive integer");
  }

  if (!Number.isInteger(retry) || retry < 1) {
    throw new TypeError("retry must be a positive integer");
  }

  if (!Number.isInteger(PREFETCH_PAGES) || PREFETCH_PAGES < 0) {
    throw new TypeError("PREFETCH_PAGES must be a non-negative integer");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);

  if (!currentDay) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() - (limit - 1));

  const dateToDayNumber = (date) =>
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  const getItemDayNumber = (item) => {
    const addedAt = item?.addedAt || item?.date;

    if (
      !addedAt ||
      typeof addedAt.year !== "number" ||
      typeof addedAt.month !== "number" ||
      typeof addedAt.day !== "number"
    ) {
      return null;
    }

    const { year, month, day } = addedAt;

    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return year * 10000 + month * 100 + day;
  };

  const getDayKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const isTrack = (item) =>
    item?.entity?.data?.entityTypeTrait?.type === "ENTITY_TYPE_TRACK";

  const pickImageUrl = (sources) => {
    if (!Array.isArray(sources) || sources.length === 0) {
      return null;
    }

    let bestUnder640 = null;
    let smallest = null;

    for (const source of sources) {
      if (
        !source ||
        typeof source.url !== "string" ||
        source.url.length === 0
      ) {
        continue;
      }

      if (
        smallest === null ||
        (typeof source.maxWidth === "number" &&
          (typeof smallest.maxWidth !== "number" ||
            source.maxWidth < smallest.maxWidth))
      ) {
        smallest = source;
      }

      if (
        typeof source.maxWidth === "number" &&
        source.maxWidth <= 640 &&
        (bestUnder640 === null || source.maxWidth > bestUnder640.maxWidth)
      ) {
        bestUnder640 = source;
      }
    }

    return bestUnder640?.url || smallest?.url || null;
  };

  const formatItem = (item) => {
    const entity = item?.entity?.data;
    const identity = entity?.identityTrait;

    if (!entity || !identity) {
      return null;
    }

    const album = identity.contentHierarchyParent;

    return {
      name: identity.name,
      uri: item?.entity?.uri || item?.entity?._uri,
      duration: entity.consumptionExperienceTrait?.duration?.seconds ?? 0,
      cover: pickImageUrl(
        entity.visualIdentityTrait?.squareCoverImage?.image?.data?.sources,
      ),
      artists: identity.contributors?.items || [],
      album: {
        uri: album?.uri,
        name: album?.identityTrait?.name || "Unknown Album",
      },
      date: item.addedAt,
    };
  };

  /*
   * Fetch a single page.
   *
   * Returns both the list and totalCount.
   */

  const res = [];

  let targetDate = new Date(startDate);

  /*
   * This is the actual Spotify offset for the next page
   * we need to process.
   */
  let offset = 0;

  /*
   * Cached items occupy positions in Spotify's history.
   */
  let toAddToOffset = 0;

  let dayRes = [];

  let totalCount = null;

  /*
   * Prefetched pages:
   *
   * Map<offset, Promise<{list, totalCount}>>
   */
  let prefetchQueue = new Map();

  const endDayNumber = dateToDayNumber(endDate);
  const todayTime = today.getTime();

  const isCurrentTargetDay = () =>
    currentDay && targetDate.getTime() === todayTime;

  /*
   * Read one cached day.
   */
  const getCachedDay = async (date) => {
    if (currentDay && date.getTime() === todayTime) {
      return null;
    }

    const cached = await getRecentDay(getDayKey(date));

    if (Array.isArray(cached)) {
      toAddToOffset += cached.length;
      return cached;
    }

    return null;
  };

  /*
   * Consume cached days.
   *
   * Returns true if at least one cached day was consumed.
   */
  const consumeCachedDays = async () => {
    let consumed = false;

    while (targetDate >= endDate) {
      if (isCurrentTargetDay()) {
        return consumed;
      }

      const cached = await getCachedDay(targetDate);

      if (!Array.isArray(cached)) {
        return consumed;
      }

      res.push(...cached);

      targetDate.setDate(targetDate.getDate() - 1);

      consumed = true;
    }

    return consumed;
  };

  const finishFetchedDay = () => {
    const key = getDayKey(targetDate);

    if (!isCurrentTargetDay()) {
      setRecentDay(key, dayRes);
    }

    res.push(...dayRes);
    dayRes = [];

    targetDate.setDate(targetDate.getDate() - 1);
  };

  /*
   * Discard prefetched promises.
   *
   * We cannot cancel spotiQuery unless it supports AbortController,
   * but removing them from the queue ensures we never consume a page
   * that was fetched using an obsolete offset.
   */
  const clearPrefetchQueue = () => {
    prefetchQueue.clear();
  };

  /*
   * Add pages to the prefetch queue.
   *
   * IMPORTANT:
   *
   * We only use 500-step offsets here. Spotify's recents endpoint
   * returns up to fetchStep items per page, so these offsets are
   * valid for all normal full pages.
   *
   * totalCount prevents us from requesting offsets beyond the list.
   */
  const fillPrefetchQueue = (baseOffset) => {
    if (totalCount == null || PREFETCH_PAGES <= 0) {
      return;
    }

    for (let page = 1; page <= PREFETCH_PAGES; page++) {
      const pageOffset = baseOffset + fetchStep * page;

      if (pageOffset >= totalCount) {
        break;
      }

      if (prefetchQueue.has(pageOffset)) {
        continue;
      }

      prefetchQueue.set(
        pageOffset,
        fetchRecentPage(pageOffset, fetchStep, retry),
      );
    }
  };

  /*
   * Get the page at the exact offset we need.
   *
   * If it has already been prefetched, this simply awaits the
   * existing request instead of making another request.
   */
  const getPage = async (pageOffset) => {
    let promise = prefetchQueue.get(pageOffset);

    if (!promise) {
      promise = fetchRecentPage(pageOffset, fetchStep, retry);
    }

    prefetchQueue.delete(pageOffset);

    return promise;
  };

  /*
   * Initial cache pass.
   */
  await consumeCachedDays();

  while (targetDate >= endDate) {
    if (cancelPages.has(tabId)) {
      cancelPages.delete(tabId);
      clearPrefetchQueue();
      return null;
    }

    /*
     * Consume cache before deciding the next network offset.
     */
    const consumedCached = await consumeCachedDays();

    if (targetDate < endDate) {
      break;
    }

    /*
     * Cached entries change Spotify's global offset.
     *
     * If that happened, any pages prefetched using the old offset
     * are potentially wrong, so discard them.
     */
    if (consumedCached) {
      clearPrefetchQueue();
    }

    if (cancelPages.has(tabId)) {
      cancelPages.delete(tabId);
      clearPrefetchQueue();
      return null;
    }

    /*
     * Apply cached items to the Spotify offset.
     */
    if (toAddToOffset > 0) {
      offset += toAddToOffset;
      toAddToOffset = 0;
    }

    /*
     * Don't ever request an offset greater than totalCount.
     */
    if (totalCount != null && offset > totalCount) {
      break;
    }

    if (tabId != null) {
      const remainingDays = Math.ceil((targetDate - endDate) / MS_PER_DAY);

      chrome.tabs.sendMessage(tabId, {
        type: "wrappedProgress",
        message: `Reading your listening history · ${
          limit - Math.max(0, remainingDays)
        } of ${limit} days`,
      });
    }

    /*
     * If we already have this page downloading, use that promise.
     * Otherwise start it now.
     */
    const pageResult = await getPage(offset);

    if (!pageResult) {
      break;
    }

    const { list } = pageResult;

    /*
     * Get totalCount from every successful response.
     * This is useful if Spotify changes it during the operation.
     */
    if (pageResult.totalCount != null) {
      totalCount = pageResult.totalCount;
    }

    const items = list.items?.items || [];

    if (items.length === 0) {
      break;
    }

    /*
     * Determine the next actual offset.
     *
     * For a normal page this is offset + 500.
     */
    const nextOffset = offset + items.length;

    /*
     * We can now prefetch the following pages.
     *
     * This happens BEFORE processing the current page.
     */
    fillPrefetchQueue(offset);

    let reachedEndDate = false;
    let cacheChangedOffset = false;

    /*
     * Process the current page.
     */
    for (const item of items) {
      if (!isTrack(item)) {
        continue;
      }

      const itemDay = getItemDayNumber(item);

      if (itemDay === null) {
        continue;
      }

      const targetDay = dateToDayNumber(targetDate);

      /*
       * Item is newer than the day we're currently collecting.
       */
      if (itemDay > targetDay) {
        continue;
      }

      /*
       * We've passed the requested date range.
       */
      if (itemDay < endDayNumber) {
        reachedEndDate = true;
        break;
      }

      /*
       * We've reached an older day.
       */
      if (itemDay < targetDay) {
        finishFetchedDay();

        /*
         * Fill missing days.
         */
        while (targetDate >= endDate && dateToDayNumber(targetDate) > itemDay) {
          setRecentDay(getDayKey(targetDate), []);

          targetDate.setDate(targetDate.getDate() - 1);
        }

        /*
         * A newly exposed day might already be cached.
         *
         * If it is, the correct global Spotify offset changes.
         */
        const cachedChanged = await consumeCachedDays();

        if (cachedChanged) {
          cacheChangedOffset = true;

          /*
           * Any prefetched pages were calculated from an offset
           * that is now potentially wrong.
           */
          clearPrefetchQueue();
        }

        continue;
      }

      /*
       * Item belongs to targetDate.
       */
      const formatted = formatItem(item);

      if (formatted) {
        dayRes.push(formatted);
      }
    }

    /*
     * If processing the page caused cached days to change the
     * required offset, don't advance using the old prefetched
     * sequence. Recalculate from the corrected offset.
     */
    if (cacheChangedOffset) {
      offset = nextOffset + toAddToOffset;
      toAddToOffset = 0;
    } else {
      offset = nextOffset;
    }

    /*
     * We've gone past the requested end date.
     */
    if (reachedEndDate) {
      if (dayRes.length > 0 || targetDate >= endDate) {
        finishFetchedDay();
      }

      clearPrefetchQueue();
      break;
    }

    /*
     * If there are cached days available now, consume them before
     * building the next prefetch window.
     */
    const cachedAfterPage = await consumeCachedDays();

    if (cachedAfterPage) {
      /*
       * Cached data changes the global offset, so discard pages
       * prefetched using the previous offset.
       */
      clearPrefetchQueue();

      offset += toAddToOffset;
      toAddToOffset = 0;
    }

    /*
     * Refill the prefetch window from the now-correct offset.
     */
    fillPrefetchQueue(offset);
  }

  return res;
}

async function deleteTracks(playlist, uris = null, uids = null) {
  if (playlist === likedSongsUri) {
    return await disLikeTracks(uris);
  }
  let payload;
  if (uids && uids.length > 0) {
    payload = {
      variables: {
        playlistUri: playlist,
        uids,
      },
      operationName: "removeFromPlaylist",
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "47b2a1234b17748d332dd0431534f22450e9ecbb3d5ddcdacbd83368636a0990",
        },
      },
    };
  } else if (uris && uris.length > 0) {
    payload = {
      variables: {
        input: {
          curations: [
            {
              contextUri: playlist,
              curationType: "UNCURATE",
            },
          ],
          itemUris: uris,
        },
      },
      operationName: "applyCurations",
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "05b739a3a73091c213385233b9d3ed8a857c2ca29d2eebadb3d04ed12e288697",
        },
      },
    };
  } else {
    return;
  }
  return await spotiQuery(payload);
}

async function createPlaylist(name, description = "") {
  const payload = {
    ops: [
      {
        kind: "UPDATE_LIST_ATTRIBUTES",
        updateListAttributes: {
          newAttributes: {
            values: {
              name,
              description,
              formatAttributes: [],
              pictureSize: [],
            },
            noValue: [],
          },
        },
      },
    ],
  };
  const playlist = await spotifuckFetch(
    "POST",
    "https://spclient.wg.spotify.com/playlist/v2/playlist",
    payload,
  );
  const payload2 = {
    deltas: [
      {
        ops: [
          {
            kind: "ADD",
            add: {
              items: [
                {
                  uri: playlist.uri,
                  attributes: { timestamp: Math.floor(Date.now() / 1000) },
                },
              ],
              addFirst: true,
            },
          },
        ],
        info: { source: { client: "WEBPLAYER" } },
      },
    ],
  };
  await spotifuckFetch(
    "POST",
    `https://spclient.wg.spotify.com/playlist/v2/user/${username}/rootlist/changes`,
    payload2,
  );
  return playlist;
}
async function addToPlaylist(uri, tracks, moveType = null, fromUid = null) {
  if (!tracks || tracks.length < 1) return;
  if (uri === likedSongsUri) {
    return await likeTracks(tracks);
  }

  if (!moveType) {
    moveType = "TOP_OF_PLAYLIST";
  }

  const payload = {
    variables: {
      playlistItemUris: tracks,
      playlistUri: uri,
      newPosition: { moveType, fromUid },
    },
    operationName: "addToPlaylist",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "47b2a1234b17748d332dd0431534f22450e9ecbb3d5ddcdacbd83368636a0990",
      },
    },
  };
  return await spotiQuery(payload);
}
async function modifyPlaylist(uri, tracks, moveType = null, fromUid = null) {
  if (!moveType) {
    moveType = "BOTTOM_OF_PLAYLIST";
  }

  const payload = {
    variables: {
      uids: tracks,
      playlistUri: uri,
      newPosition: { moveType, fromUid },
    },
    operationName: "moveItemsInPlaylist",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "47b2a1234b17748d332dd0431534f22450e9ecbb3d5ddcdacbd83368636a0990",
      },
    },
  };
  return await spotiQuery(payload);
}
async function likeTracks(tracks) {
  const payload = {
    variables: { libraryItemUris: tracks },
    operationName: "addToLibrary",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "1ad0d40b3c09660d818b9e770eb1e84745dfbe941df159a64f8772b6fa2bfc3a",
      },
    },
  };
  return await spotiQuery(payload);
}
async function disLikeTracks(tracks) {
  if (!tracks || tracks.length < 1) {
    return;
  }
  const payload = {
    variables: { libraryItemUris: tracks },
    operationName: "removeFromLibrary",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "1ad0d40b3c09660d818b9e770eb1e84745dfbe941df159a64f8772b6fa2bfc3a",
      },
    },
  };
  return await spotiQuery(payload);
}

getAccessToken().then(() => {
  getProfile().then(async (res) => {
    const cachedUsername = await chrome.storage.local.get(["username"]);
    if (cachedUsername?.username) {
      if (cachedUsername.username !== res) {
        fullReset();
      }
    } else {
      await chrome.storage.local.set({
        username: res,
      });
    }
    profileReadyResolve();
  });
});
async function startup() {
  console.log("Chrome started — initializing extension");
  await openTrackDB();
  console.log(await getStoreSize(TRACK_STORE_NAME));
  console.log(trackMap);
  removeEntriesOlderThan(RECENT_STORE_NAME, 90);
  console.log(await getStoreSize(RECENT_STORE_NAME));
  await profileReady;
  console.log("profile is ready");
}

chrome.runtime.onStartup.addListener(async () => {
  await startup();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await startup();
  createPage();
});
function createPage() {
  if (username === null) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("notconnected/notconnected.html"),
    });
  } else {
    chrome.tabs.create({
      url: chrome.runtime.getURL("index.html"),
    });
  }
}

chrome.action.onClicked.addListener(createPage);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  console.log("Background received:", message, "FROM:", tabId);
  (async () => {
    await profileReady;
    if (username === null) {
      sendResponse({ notConnected: true });
    } else if (message.type === "getLibrary") {
      getLibrary(message.id, message.albums, message.artists)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getPlaylistTracks") {
      fetchRandom(
        message.item,
        message.playedTracks,
        message.stats,
        message.totalTracks,
        message?.total,
        message.random,
        message?.returnTotal,
      )
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "checkUsername") {
      getProfile()
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getFeatured") {
      getFeatured()
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "reset") {
      resetFeatured()
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "finishedDaily") {
      finishedDaily(message.name)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getRecent") {
      fetchRecent(message.limit, message?.currentDay, 10, tabId)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getCovers") {
      fetchCovers(message.items)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getSnippet") {
      fetchSnippet(message.uri)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "likeTracks") {
      likeTracks(message.tracks)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "deleteTracks") {
      deleteTracks(message.uri, message?.uris, message?.uids)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "getPlaylist") {
      fetchPlaylist(message.uri, message.offset, message.limit)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "createPlaylist") {
      createPlaylist(message.name, message?.description ?? "")
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "addToPlaylist") {
      addToPlaylist(
        message.uri,
        message.tracks,
        message?.moveType,
        message?.fromUid,
      )
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "modifyPlaylist") {
      modifyPlaylist(
        message.uri,
        message.tracks,
        message?.moveType,
        message?.fromUid,
      )
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else if (message.type === "cancel") {
      console.log(`Adding ${tabId} to the cancelation set`);
      cancelPages.add(tabId);
    } else if (message.type === "audioFeatures") {
      audiofeatures(message.ids, message?.batchSize, message?.diconly)
        .then(sendResponse)
        .catch((err) => {
          console.log(err);
          sendResponse({ error: err.message });
        });
    } else {
      console.log("Message type not recognized");
    }
  })();

  return true;
});
