function doGet(e) {
  const params = (e && e.parameter) || {};
  const mode = String(params.mode || "schedule").toLowerCase();

  if (mode === "tvm") {
    return doGetTvmFeed_(params);
  }

  return doGetSchedule();
}

function doGetSchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scheduleSheet = ss.getSheetByName("Full 2025 Schedule");
  const waitlistSheet = ss.getSheetByName("Waitlist Responses");

  if (!scheduleSheet || !waitlistSheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Missing required sheets" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const scheduleData = scheduleSheet.getDataRange().getDisplayValues();
  if (!scheduleData || scheduleData.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = scheduleData[0].map(h => String(h).trim());
  const scheduleRows = scheduleData.slice(1);
  const waitlistAliasToId = {};
  const gamesById = {};

  const enriched = scheduleRows
    .map(row => {
      const game = {};
      headers.forEach((h, i) => (game[h] = row[i]));

      const id = String(game["ID"] || "").trim();
      if (!id) return null;

      game.approved = [];
      game.waitlist = [];
      gamesById[id] = game;
      waitlistAliasToId[id] = id;

      // Backward compatibility for pre-migration synthetic IDs.
      const legacyRaw = String(game["Legacy IDs"] || "").trim();
      if (legacyRaw) {
        legacyRaw
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(legacyId => {
            waitlistAliasToId[legacyId] = id;
          });
      }

      return game;
    })
    .filter(Boolean);

  const waitlistData = waitlistSheet.getDataRange().getValues();
  const waitlistHeaders = (waitlistData.shift() || []).map(h => String(h).trim());

  waitlistData.forEach(row => {
    const rowObj = {};
    waitlistHeaders.forEach((h, i) => {
      rowObj[h] = typeof row[i] === "string" ? row[i].trim() : row[i];
    });

    const rawGameId = String(rowObj["Game ID"] || "").trim();
    const canonicalGameId = waitlistAliasToId[rawGameId] || rawGameId;
    const game = gamesById[canonicalGameId];
    const name = String(rowObj["Name"] || "").trim();
    const isApproved = String(rowObj["Approved"] || "").toLowerCase() === "yes";

    if (!game || !name) return;

    if (isApproved) game.approved.push(name);
    else game.waitlist.push(name);
  });

  return ContentService
    .createTextOutput(JSON.stringify(enriched))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGetTvmFeed_(params) {
  const format = String(params.format || "json").toLowerCase();
  const feed = getTvmFeedConfig_();

  if (format === "m3u" || format === "m3u8") {
    return ContentService
      .createTextOutput(buildM3uFromFeed_(feed))
      .setMimeType(ContentService.MimeType.TEXT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(feed))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTvmFeedConfig_() {
  const props = PropertiesService.getScriptProperties();
  const fallbackStreamUrl =
    "https://adultswim-vodlive.cdn.turner.com/live/rick-and-morty/stream.m3u8";
  const fallbackPoster =
    "https://upload.wikimedia.org/wikipedia/en/a/a6/Rick_and_Morty_season_8.jpg";

  const streamUrl =
    String(props.getProperty("TVM_STREAM_URL") || "").trim() || fallbackStreamUrl;
  const title =
    String(props.getProperty("TVM_TITLE") || "").trim() || "Watch The Wolves Live";
  const id = String(props.getProperty("TVM_ID") || "").trim() || "wtw-live-1";
  const poster =
    String(props.getProperty("TVM_POSTER") || "").trim() || fallbackPoster;

  return {
    provider: "Watch The Wolves",
    updatedAt: new Date().toISOString(),
    items: [
      {
        id,
        title,
        streamUrl,
        poster,
        type: "live",
      },
    ],
  };
}

function buildM3uFromFeed_(feed) {
  const items = (feed && feed.items) || [];
  const lines = ["#EXTM3U"];

  items.forEach(item => {
    const id = String(item.id || "").trim();
    const title = String(item.title || "Live Stream").trim();
    const logo = String(item.poster || "").trim();
    const streamUrl = String(item.streamUrl || "").trim();
    if (!streamUrl) return;

    lines.push(
      `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" tvg-logo="${logo}" group-title="Watch The Wolves",${title}`
    );
    lines.push(streamUrl);
  });

  return lines.join("\n");
}

function setTvmFeedConfig_(config) {
  const input = config || {};
  const props = PropertiesService.getScriptProperties();

  if (input.streamUrl != null) {
    props.setProperty("TVM_STREAM_URL", String(input.streamUrl).trim());
  }
  if (input.title != null) {
    props.setProperty("TVM_TITLE", String(input.title).trim());
  }
  if (input.id != null) {
    props.setProperty("TVM_ID", String(input.id).trim());
  }
  if (input.poster != null) {
    props.setProperty("TVM_POSTER", String(input.poster).trim());
  }
}

const WTW_IMPORT_STATE_KEY = "WTW_IMPORT_FULL_SCHEDULE_STATE_V5";
const WTW_IMPORT_RESUME_HANDLER = "resumeImportFullNBASchedule2025";
const WTW_IMPORT_DIAG_KEY = "WTW_IMPORT_FULL_2025_LAST_DIAG";
const WTW_IMPORT_BATCH_SIZE = 100;
const WTW_WOLVES_TEAM_ID = 1610612750;
const WTW_NBA_TEAM_SCHEDULE_API_URL = "https://www.nba.com/timberwolves/api/schedule";
const WTW_NBA_JERSEY_CACHE_KEY = "WTW_NBA_SCHEDULE_JERSEY_MAP_V1";
const WTW_JINA_PROXY_PREFIX = "https://r.jina.ai/http://";

function getRelevantEspnSeasonYears_() {
  const now = new Date();
  const calendarYear = now.getFullYear();
  const currentSeasonEndYear = now.getMonth() >= 6 ? calendarYear + 1 : calendarYear;
  return [currentSeasonEndYear - 1, currentSeasonEndYear];
}

function getRelevantNbaSeasonLabels_() {
  return getRelevantEspnSeasonYears_().map(year =>
    `${year - 1}-${String(year).slice(-2)}`
  );
}

function formatEspnDate_(date) {
  return Utilities.formatDate(date, "UTC", "yyyyMMdd");
}

function buildEspnScoreboardSegments_() {
  const segments = [];
  getRelevantEspnSeasonYears_().forEach(seasonYear => {
    // NBA seasons run from preseason in the prior September through June.
    for (let offset = 0; offset < 10; offset++) {
      const monthStart = new Date(Date.UTC(seasonYear - 1, 8 + offset, 1));
      const monthEnd = new Date(Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth() + 1,
        0
      ));
      const start = formatEspnDate_(monthStart);
      const end = formatEspnDate_(monthEnd);
      segments.push({
        url: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${start}-${end}&limit=1000`,
        seasonYear,
        label: `${seasonYear - 1}-${String(seasonYear).slice(-2)} ${Utilities.formatDate(monthStart, "UTC", "MMM")}`,
      });
    }
  });
  return segments;
}

function getEspnSeasonTypeLabel_(event) {
  const type = Number(event?.season?.type || 0);
  if (type === 1) return "Preseason";
  if (type === 2) return "Regular Season";
  if (type === 3) return "Postseason";
  if (type === 4) return "All-Star";
  return event?.season?.slug || "Unknown";
}

function getEspnScoreValue_(competitor) {
  const raw = competitor?.score;
  if (raw && typeof raw === "object" && raw.value != null) return Number(raw.value);
  if (raw !== "" && raw != null && isFinite(Number(raw))) return Number(raw);
  return "";
}

function writeImportDiag_(payload) {
  try {
    const raw = JSON.stringify(payload || {});
    PropertiesService.getScriptProperties().setProperty(
      WTW_IMPORT_DIAG_KEY,
      raw.length > 8500 ? raw.slice(0, 8500) : raw
    );
  } catch (e) {
    Logger.log(`Import diag write error: ${e}`);
  }
}

function importCheckpoint_(runId, startedMs, stage, extra) {
  const payload = {
    runId,
    stage,
    elapsedMs: Date.now() - startedMs,
    at: new Date().toISOString(),
    ...(extra || {}),
  };
  Logger.log(`[WTW_IMPORT] ${JSON.stringify(payload)}`);
  writeImportDiag_(payload);
}

function normalizeOpponentForJoin_(rawOpponent) {
  const cleaned = String(rawOpponent || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const alias = {
    "los angeles clippers": "la clippers",
    "la clippers": "la clippers",
    "los angeles lakers": "los angeles lakers",
    "la lakers": "los angeles lakers",
  };

  return alias[cleaned] || cleaned;
}

function makeCanonicalJoinKey_(dateText, opponent, homeAway) {
  return `${String(dateText || "").trim()}|${normalizeOpponentForJoin_(opponent)}|${String(homeAway || "").trim().toLowerCase()}`;
}

function getNbaScheduleJerseyMapFromCache_() {
  const raw = CacheService.getScriptCache().get(WTW_NBA_JERSEY_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function putNbaScheduleJerseyMapInCache_(map) {
  const raw = JSON.stringify(map || {});
  if (raw.length > 95000) {
    Logger.log(`NBA schedule jersey cache payload too large for CacheService (${raw.length} chars)`);
    return;
  }
  CacheService.getScriptCache().put(WTW_NBA_JERSEY_CACHE_KEY, raw, 21600);
}

function fetchNbaScheduleJerseyMapFromApi_() {
  const map = {};
  let wolvesGamesSeen = 0;
  let wolvesGamesWithJersey = 0;
  const seasonStats = {};

  getRelevantNbaSeasonLabels_().forEach(seasonLabel => {
    let root;
    try {
      root = fetchTeamScheduleSeasonJsonViaProxy_(seasonLabel);
    } catch (e) {
      Logger.log(`WARN jersey schedule unavailable for ${seasonLabel}: ${e}`);
      seasonStats[seasonLabel] = {
        wolvesGamesSeen: 0,
        wolvesGamesWithJersey: 0,
        error: String(e),
      };
      return;
    }
    const schedule = root?.scheduleData?.schedule || [];
    let seasonSeen = 0;
    let seasonWithJersey = 0;

    schedule.forEach(item => {
      const homeTeam = item?.homeTeam;
      const awayTeam = item?.awayTeam;
      if (!homeTeam || !awayTeam) return;

      const homeTeamId = Number(homeTeam?.teamId || homeTeam?.id || 0);
      const awayTeamId = Number(awayTeam?.teamId || awayTeam?.id || 0);
      const wolvesHome = homeTeamId === WTW_WOLVES_TEAM_ID;
      const wolvesAway = awayTeamId === WTW_WOLVES_TEAM_ID;
      if (!wolvesHome && !wolvesAway) return;
      wolvesGamesSeen++;
      seasonSeen++;

      const jerseyRaw = wolvesHome
        ? homeTeam?.uniforms?.name
        : awayTeam?.uniforms?.name;
      const jersey = String(jerseyRaw || "").trim();
      if (!jersey) return;

      const oppTeam = wolvesHome ? awayTeam : homeTeam;
      const opponent = `${String(oppTeam?.teamCity || "").trim()} ${String(oppTeam?.teamName || "").trim()}`.trim()
        || String(oppTeam?.teamName || "").trim();
      if (!opponent) return;

      const gameDateRaw = String(item?.gameDateEst || item?.gameDateUTC || item?.gameTimeUTC || "").trim();
      const gameDate = new Date(gameDateRaw);
      if (isNaN(gameDate.getTime())) return;

      const formattedDate = Utilities.formatDate(gameDate, Session.getScriptTimeZone(), "MMM dd, yyyy");
      const homeAway = wolvesHome ? "Home" : "Away";
      const joinKey = makeCanonicalJoinKey_(formattedDate, opponent, homeAway);
      if (!joinKey) return;

      map[joinKey] = jersey;
      wolvesGamesWithJersey++;
      seasonWithJersey++;
    });

    seasonStats[seasonLabel] = {
      wolvesGamesSeen: seasonSeen,
      wolvesGamesWithJersey: seasonWithJersey,
    };
  });

  return {
    map,
    wolvesGamesSeen,
    wolvesGamesWithJersey,
    seasonStats,
  };
}

function getOrRefreshNbaScheduleJerseyMap_(forceRefresh) {
  if (!forceRefresh) {
    const cached = getNbaScheduleJerseyMapFromCache_();
    const size = Object.keys(cached).length;
    if (size) {
      return { map: cached, cacheHit: true, mapSize: size, wolvesGamesSeen: null, wolvesGamesWithJersey: null };
    }
  }

  const fresh = fetchNbaScheduleJerseyMapFromApi_();
  putNbaScheduleJerseyMapInCache_(fresh.map);
  return {
    map: fresh.map,
    cacheHit: false,
    mapSize: Object.keys(fresh.map).length,
    wolvesGamesSeen: fresh.wolvesGamesSeen,
    wolvesGamesWithJersey: fresh.wolvesGamesWithJersey,
    seasonStats: fresh.seasonStats,
  };
}

function fetchTeamScheduleSeasonJsonViaProxy_(seasonLabel) {
  const directUrl = `${WTW_NBA_TEAM_SCHEDULE_API_URL}?season=${encodeURIComponent(seasonLabel)}`;
  const proxyUrl = `${WTW_JINA_PROXY_PREFIX}${directUrl.replace(/^https?:\/\//i, "")}`;
  const res = UrlFetchApp.fetch(proxyUrl, {
    muteHttpExceptions: true,
    headers: {
      Accept: "text/plain",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const code = Number(res.getResponseCode() || 0);
  if (code < 200 || code >= 300) {
    throw new Error(`jina proxy schedule fetch failed for ${seasonLabel}: HTTP ${code}`);
  }

  const text = String(res.getContentText() || "");
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`jina proxy response did not contain JSON for ${seasonLabel}`);
  }

  const parsed = JSON.parse(text.slice(jsonStart));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid parsed payload for ${seasonLabel}`);
  }
  return parsed;
}

function readImportState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(WTW_IMPORT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearResumeImportTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === WTW_IMPORT_RESUME_HANDLER)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function scheduleResumeImportTrigger_() {
  clearResumeImportTriggers_();
  ScriptApp.newTrigger(WTW_IMPORT_RESUME_HANDLER).timeBased().after(5 * 1000).create();
}

function resumeImportFullNBASchedule2025() {
  importFullNBASchedule2025();
}

function resetImportFullNBASchedule2025State() {
  PropertiesService.getScriptProperties().deleteProperty(WTW_IMPORT_STATE_KEY);
  clearResumeImportTriggers_();
  Logger.log("Cleared schedule import state and resume triggers.");
}

function getImportFullNBASchedule2025State() {
  const state = readImportState_();
  Logger.log(`Current import state: ${JSON.stringify(state)}`);
  return state;
}

function getImportFullNBASchedule2025Diagnostics() {
  const diag = PropertiesService.getScriptProperties().getProperty(WTW_IMPORT_DIAG_KEY);
  Logger.log(`Last import diagnostics: ${diag || "{}"}`);
  return diag || "{}";
}

/**
 * Optional jersey cache warm-up from nba.com team schedule API.
 */
function refreshNBAScheduleJerseyCacheFromHtml() {
  const result = getOrRefreshNbaScheduleJerseyMap_(true);
  Logger.log(
    `NBA schedule jersey cache refreshed: mapSize=${result.mapSize}, ` +
    `wolvesGamesSeen=${result.wolvesGamesSeen}, wolvesGamesWithJersey=${result.wolvesGamesWithJersey}, ` +
    `sourceSeasons=${JSON.stringify(result.seasonStats || {})}`
  );
  return result;
}

function refreshNBAScheduleJerseyCache() {
  return refreshNBAScheduleJerseyCacheFromHtml();
}

/**
 * Backward-compatible wrapper (kept so existing menu/buttons still work).
 * `seasonYear` is ignored because nba.com page already exposes current schedule window.
 */
function refreshLockerVisionCacheForSeasonYear(seasonYear) {
  const result = refreshNBAScheduleJerseyCacheFromHtml();
  Logger.log(
    `refreshLockerVisionCacheForSeasonYear(${seasonYear}) now uses nba.com schedule API; mapSize=${result.mapSize}`
  );
  return result.mapSize;
}

/**
 * Backward-compatible wrapper for prior manual workflow.
 */
function refreshLockerVisionCache2025And2026() {
  const result = refreshNBAScheduleJerseyCacheFromHtml();
  Logger.log(
    `refreshLockerVisionCache2025And2026 now uses nba.com schedule API; mapSize=${result.mapSize}`
  );
  return { 2025: result.mapSize, 2026: result.mapSize };
}

/**
 * Imports and normalizes Wolves schedule.
 * - Uses ESPN event ID as canonical game ID (stable across schedule inserts).
 * - Preserves legacy synthetic IDs in "Legacy IDs" for waitlist migration.
 * - Preserves Jersey values from existing rows.
 * - Auto-populates Wolves jersey from nba.com Wolves schedule API data.
 * - Unifies FanDuel aliases (FDSNNO, FDSNNOX, etc.)
 * - Prefers Local -> Away fallback local -> National -> First TV -> Streaming -> League Pass
 */
function importFullNBASchedule2025() {
  const runId = Utilities.getUuid().split("-")[0];
  const startedMs = Date.now();
  const props = PropertiesService.getScriptProperties();
  const nowIso = new Date().toISOString();
  let state = readImportState_();
  const maxStateAgeMs = 6 * 60 * 60 * 1000;
  if (state?.updatedAt) {
    const ageMs = Date.now() - new Date(state.updatedAt).getTime();
    if (!isFinite(ageMs) || ageMs > maxStateAgeMs) state = null;
  }

  if (!state || !Number.isInteger(state.cursor) || state.cursor < 0 || !Number.isInteger(state.eventCursor) || state.eventCursor < 0) {
    state = { cursor: 0, eventCursor: 0, startedAt: nowIso, updatedAt: nowIso };
  }
  importCheckpoint_(runId, startedMs, "start", {
    cursor: state.cursor,
    eventCursor: state.eventCursor,
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Full 2025 Schedule");
  if (!sheet) sheet = ss.insertSheet("Full 2025 Schedule");

  // Read existing rows BEFORE rewriting headers so we can detect old schema correctly.
  const existing = sheet.getDataRange().getValues();
  const existingHeaders = (existing[0] || []).map(h => String(h).trim());
  const existingHasLegacyCol = existingHeaders.includes("Legacy IDs");

  const headers = [
    "ID",
    "Legacy IDs",
    "Date",
    "Time",
    "Opponent",
    "Opponent Logo URL",
    "Home/Away",
    "Result",
    "Wolves Score",
    "Opponent Score",
    "TV Broadcast",
    "National Broadcast?",
    "Game Status",
    "Jersey",
    "Season Type",
  ];

  const makeGameKey = (dateText, opponent, homeAway) =>
    `${String(dateText || "").trim()}|${String(opponent || "").trim().toLowerCase()}|${String(homeAway || "").trim().toLowerCase()}`;

  const TV_ALIAS_MAP = [
    { match: /fanduel\s*(sports)?\s*network.*north|fdsn[-\s]?north|fanduel\s*sn\s*north/gi, label: "FanDuel Sports Network - North" },
    { match: /fanduel\s*sn\s*north\s*extra|extra\s*channel/gi, label: "FanDuel Sports Network - North Extra" },
    { match: /bally\s*sports(\s*north)?/gi, label: "FanDuel Sports Network - North" },
    { match: /\bKARE\b|\bKARE\s*11\b|\bKARE11\b/gi, label: "KARE 11" },
    { match: /\bWUCW\b|\bCW\s*Twin\s*Cities\b/gi, label: "CW Twin Cities (WUCW)" },
    { match: /\bpeacock\b/gi, label: "Peacock" },
    { match: /\bNBC\b(?!\s*Sports\s*North)/gi, label: "NBC" },
    { match: /\bESPN\b/gi, label: "ESPN" },
    { match: /\bABC\b/gi, label: "ABC" },
    { match: /\bTNT\b/gi, label: "TNT" },
    { match: /\bNBA\s*TV\b/gi, label: "NBA TV" },
    { match: /\bFDSN[\s-]*NOX?\b/i, label: "FanDuel Sports Network - North" },
  ];

  const OPPONENT_RSN_REGEXPS = [
    /\bTSN(?:[1-5]|4K)?\b/i,
    /\bSportsnet\b/i,
    /\bSN(?:\s?(One|Ontario|West|East))?\b/i,
    /\bArizona(?:'s)?\s*Family\b/i,
    /\bAltitude\s*Sports\b/i,
    /\bNBC\s*Sports\b/i,
    /\bROOT\s*Sports\b/i,
    /\bSpectrum\s*SportsNet\b/i,
    /\bYES\s*Network\b/i,
    /\bMSG\b/i,
  ];

  const normalize = raw => {
    if (!raw) return null;
    const s = String(raw).trim();
    for (const { match, label } of TV_ALIAS_MAP) {
      if (s.match(match)) return label;
    }
    return null;
  };

  const isNational = n => /\b(ESPN|ABC|TNT|NBA\s*TV|Peacock|NBC)\b/i.test(n || "");

  // Preserve jerseys and legacy ID mappings from existing sheet data.
  const idx = {};
  existingHeaders.forEach((h, i) => {
    idx[h] = i;
  });

  const jerseyByEventId = {};
  const jerseyByGameKey = {};
  const legacyIdsByEventId = {};
  const legacyIdByGameKey = {};
  const rowNumberByEventId = {};

  const readCell = (row, key) => {
    const i = idx[key];
    return i === undefined ? "" : row[i];
  };

  const parseLegacyIds = raw =>
    String(raw || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

  for (let i = 1; i < existing.length; i++) {
    const row = existing[i];
    const rowNumber = i + 1;
    const id = String(readCell(row, "ID") || "").trim();
    const legacyRaw = existingHasLegacyCol
      ? String(readCell(row, "Legacy IDs") || "").trim()
      : "";
    const dateText = existingHasLegacyCol
      ? String(readCell(row, "Date") || "").trim()
      : String(readCell(row, "Date") || row[1] || "").trim();
    const oppName = existingHasLegacyCol
      ? String(readCell(row, "Opponent") || "").trim()
      : String(readCell(row, "Opponent") || row[3] || "").trim();
    const homeAway = existingHasLegacyCol
      ? String(readCell(row, "Home/Away") || "").trim()
      : String(readCell(row, "Home/Away") || row[5] || "").trim();
    const jersey = existingHasLegacyCol
      ? String(readCell(row, "Jersey") || "").trim()
      : String(readCell(row, "Jersey") || row[12] || "").trim();
    const key = makeGameKey(dateText, oppName, homeAway);
    if (id) rowNumberByEventId[id] = rowNumber;

    const isEventId = /^\d+$/.test(id);

    if (isEventId) {
      if (jersey) jerseyByEventId[id] = jersey;
      const legacyList = parseLegacyIds(legacyRaw);
      if (legacyList.length) legacyIdsByEventId[id] = legacyList;
      continue;
    }

    if (id) legacyIdByGameKey[key] = id;
    if (jersey) jerseyByGameKey[key] = jersey;
  }
  importCheckpoint_(runId, startedMs, "sheet_loaded", {
    sheetRows: existing.length,
    knownEventIds: Object.keys(rowNumberByEventId).length,
  });

  // Write canonical header after old-schema extraction is complete.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ESPN's team schedule endpoint began returning 403 in 2026. The scoreboard
  // endpoint remains available, so fetch it in monthly slices and keep Wolves games.
  const urls = buildEspnScoreboardSegments_();

  if (state.cursor >= urls.length) {
    props.deleteProperty(WTW_IMPORT_STATE_KEY);
    clearResumeImportTriggers_();
    Logger.log("Schedule import already complete.");
    importCheckpoint_(runId, startedMs, "already_complete");
    return;
  }

  const season = urls[state.cursor];
  const nbaScheduleJerseyMapResult = getOrRefreshNbaScheduleJerseyMap_(false);
  const nbaScheduleJerseyByJoinKey = nbaScheduleJerseyMapResult.map || {};
  importCheckpoint_(runId, startedMs, "nba_schedule_jersey_map", {
    cachedJerseys: Object.keys(nbaScheduleJerseyByJoinKey).length,
    cacheHit: !!nbaScheduleJerseyMapResult.cacheHit,
    wolvesGamesSeen: nbaScheduleJerseyMapResult.wolvesGamesSeen,
    wolvesGamesWithJersey: nbaScheduleJerseyMapResult.wolvesGamesWithJersey,
    sourceSeasons: nbaScheduleJerseyMapResult.seasonStats || null,
    sourceTransport: "jina-proxy",
  });

  const rows = [];
  let seasonEventCount = 0;
  let batchStart = 0;
  let batchEndExclusive = 0;
  try {
    const response = UrlFetchApp.fetch(season.url, {
      muteHttpExceptions: true,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    const code = Number(response?.getResponseCode?.() || 0);
    if (code < 200 || code >= 300) {
      throw new Error(`ESPN scoreboard request failed for ${season.label} (${code})`);
    }

    const data = JSON.parse(response.getContentText());
    const events = (data.events || []).filter(event => {
      if (Number(event?.season?.year || 0) !== season.seasonYear) return false;
      const competitors = event?.competitions?.[0]?.competitors || [];
      return competitors.some(c => String(c?.team?.id || "") === "16");
    });
    seasonEventCount = events.length;
    batchStart = Math.min(Math.max(0, Number(state.eventCursor) || 0), seasonEventCount);
    batchEndExclusive = Math.min(seasonEventCount, batchStart + WTW_IMPORT_BATCH_SIZE);
    importCheckpoint_(runId, startedMs, "espn_loaded", {
      segment: season.label,
      seasonYear: season.seasonYear,
      seasonIndex: state.cursor,
      eventCount: seasonEventCount,
      batchStart,
      batchEndExclusive,
    });

    for (let eventIdx = batchStart; eventIdx < batchEndExclusive; eventIdx++) {
      const event = events[eventIdx];
      const comp = event?.competitions?.[0];
      if (!comp) continue;

      const teams = comp.competitors || [];
      const wolves = teams.find(c => c.team.id === "16");
      const opp = teams.find(c => c.team.id !== "16");
      if (!wolves || !opp) continue;

      const isHome = wolves.homeAway === "home";
      const d = new Date(event.date);
      const formattedDate = Utilities.formatDate(d, Session.getScriptTimeZone(), "MMM dd, yyyy");
      const time = Utilities.formatDate(d, Session.getScriptTimeZone(), "h:mm a");

      const statusState = String(event?.status?.type?.state || "").toLowerCase();
      const completed = event?.status?.type?.completed === true;
      const rawWolvesScore = getEspnScoreValue_(wolves);
      const rawOpponentScore = getEspnScoreValue_(opp);
      const ws = statusState === "pre" ? "" : rawWolvesScore;
      const os = statusState === "pre" ? "" : rawOpponentScore;
      let result = "TBD";
      if (completed && ws !== "" && os !== "") {
        result = ws > os ? "W" : ws < os ? "L" : "T";
      }

      let status = "Scheduled";
      if (completed) status = "Final";
      else if (event?.status?.type?.shortDetail) status = event.status.type.shortDetail.trim();
      else if (event?.status?.type?.description) status = event.status.type.description.trim();

      const eventId = String(event?.id || "").trim();
      const fallbackId = String(comp?.id || "").trim();
      const gid = eventId || fallbackId;
      if (!gid) continue;

      const homeAway = isHome ? "Home" : "Away";
      const gameKey = makeGameKey(formattedDate, opp.team.displayName, homeAway);
      const canonicalJoinKey = makeCanonicalJoinKey_(formattedDate, opp.team.displayName, homeAway);

      const legacySet = new Set();
      (legacyIdsByEventId[gid] || []).forEach(v => legacySet.add(v));
      if (legacyIdByGameKey[gameKey]) legacySet.add(legacyIdByGameKey[gameKey]);
      const legacyIds = Array.from(legacySet).join(", ");

      let jersey = jerseyByEventId[gid] || jerseyByGameKey[gameKey] || "";
      if (!jersey) jersey = nbaScheduleJerseyByJoinKey[canonicalJoinKey] || "";
      if (!jersey && Array.isArray(comp.notes)) {
        const n = comp.notes.find(note => String(note?.headline || "").toLowerCase().includes("jersey"));
        if (n) jersey = n.headline;
      }

      const logo = opp.team.logos?.[0]?.href || opp.team.logo || "";

      let tv = "";
      let nat = "";
      let lp = "";
      let natFlag = "No";
      let firstTv = "";
      let firstStream = "";
      let sawOppRSN = false;

      if (Array.isArray(comp.broadcasts)) {
        comp.broadcasts.forEach(b => {
          const type = b?.type?.shortName;
          const raw = b?.media?.shortName || b?.media?.name || "";
          const mType = b?.market?.type;
          const norm = normalize(raw) || raw;

          if (!firstTv && type === "TV") firstTv = norm;
          if (!firstStream && (type === "Streaming" || type === "Subscription Package")) firstStream = norm;
          if (OPPONENT_RSN_REGEXPS.some(rx => rx.test(norm))) sawOppRSN = true;

          const isLocal = /FanDuel Sports Network - North|FanDuel Sports Network - North Extra|KARE 11|CW Twin Cities \(WUCW\)/.test(norm);
          if (!tv && isLocal && (!type || type === "TV")) tv = norm;

          if (!nat) {
            const looksNat = isNational(norm) || mType === "National";
            if (looksNat && (!type || type === "TV" || type === "Streaming")) nat = normalize(norm) || norm;
          }

          if (!lp && (type === "Subscription Package" || type === "Streaming") && /league\s*pass/i.test(raw)) {
            lp = "NBA League Pass";
          }
        });

        if (!tv && !isHome && sawOppRSN) tv = "FanDuel Sports Network - North";
        if (!tv && nat) tv = nat;
        if (!tv && firstTv) tv = firstTv;
        else if (!tv && firstStream) tv = firstStream;
        else if (!tv && lp) tv = lp;

        if (nat) natFlag = "Yes";
      }

      rows.push([
        gid,
        legacyIds,
        formattedDate,
        time,
        opp.team.displayName,
        logo,
        homeAway,
        result,
        ws,
        os,
        tv,
        natFlag,
        status,
        jersey,
        getEspnSeasonTypeLabel_(event),
      ]);
    }
  } catch (e) {
    // A future month may not be published yet. Log it and advance so one
    // unavailable segment cannot block all subsequent schedule refreshes.
    Logger.log(`WARN ${season.label}: ${e}`);
    importCheckpoint_(runId, startedMs, "espn_segment_skipped", {
      segment: season.label,
      seasonYear: season.seasonYear,
      error: String(e),
    });
  }

  if (rows.length) {
    const updates = [];
    const appends = [];
    const pendingAppendIds = {};
    const nextRowBase = sheet.getLastRow() + 1;

    rows.forEach(row => {
      const id = String(row[0] || "").trim();
      if (!id) return;

      const existingRowNum = rowNumberByEventId[id];
      if (existingRowNum) {
        updates.push({ rowNum: existingRowNum, values: row });
        return;
      }

      if (pendingAppendIds[id]) {
        pendingAppendIds[id].values = row;
        return;
      }

      const pending = { rowNum: nextRowBase + appends.length, values: row };
      pendingAppendIds[id] = pending;
      appends.push(pending);
    });

    updates.forEach(u => {
      sheet.getRange(u.rowNum, 1, 1, headers.length).setValues([u.values]);
    });

    if (appends.length) {
      const appendRows = appends.map(a => a.values);
      sheet.getRange(nextRowBase, 1, appendRows.length, headers.length).setValues(appendRows);
    }

    importCheckpoint_(runId, startedMs, "writes_complete", {
      updatedRows: updates.length,
      appendedRows: appends.length,
      processedRows: rows.length,
    });
  } else {
    importCheckpoint_(runId, startedMs, "writes_skipped", {
      processedRows: 0,
    });
  }

  const finishedSeason = batchEndExclusive >= seasonEventCount;
  if (finishedSeason) {
    state.cursor += 1;
    state.eventCursor = 0;
  } else {
    state.eventCursor = batchEndExclusive;
  }
  state.updatedAt = nowIso;

  if (state.cursor < urls.length) {
    props.setProperty(WTW_IMPORT_STATE_KEY, JSON.stringify(state));
    scheduleResumeImportTrigger_();
    Logger.log(
      `Imported ${season.label} events ${batchStart}-${Math.max(batchStart, batchEndExclusive) - 1} of ${seasonEventCount}. ` +
      `Continuing at season index ${state.cursor}, event index ${state.eventCursor}.`
    );
    importCheckpoint_(runId, startedMs, "state_saved", {
      nextCursor: state.cursor,
      nextEventCursor: state.eventCursor,
      segment: season.label,
      seasonYear: season.seasonYear,
      processedInRun: rows.length,
      seasonEventCount,
      finishedSeason,
    });
    return;
  }

  props.deleteProperty(WTW_IMPORT_STATE_KEY);
  clearResumeImportTriggers_();
  Logger.log("Full schedule import completed.");
  importCheckpoint_(runId, startedMs, "complete", {
    totalProcessedInRun: rows.length,
  });
}

/** Optional cleaner to unify existing values */
function normalizeExistingTVNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Full 2025 Schedule");
  if (!sh) return;

  const d = sh.getDataRange().getValues();
  if (d.length <= 1) return;

  const h = d[0].map(x => String(x).trim());
  const tvIdx = h.indexOf("TV Broadcast");
  const natIdx = h.indexOf("National Broadcast?");
  if (tvIdx < 0 || natIdx < 0) return;

  const MAP = [{ match: /\bFDSN[\s-]*NOX?\b/i, label: "FanDuel Sports Network - North" }];
  const norm = r => {
    let s = String(r || "").trim();
    for (const { match, label } of MAP) if (s.match(match)) return label;
    return s;
  };

  for (let i = 1; i < d.length; i++) {
    d[i][tvIdx] = norm(d[i][tvIdx]);
    if (/\b(ESPN|ABC|TNT|NBA\s*TV|Peacock|NBC)\b/i.test(d[i][tvIdx] || "")) d[i][natIdx] = "Yes";
  }

  sh.getRange(2, 1, d.length - 1, d[0].length).setValues(d.slice(1));
}

/**
 * One-time maintenance helper:
 * Keeps only one row per game ID (latest row wins) to shrink oversized sheets.
 */
function compactFull2025ScheduleById() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Full 2025 Schedule");
  if (!sh) throw new Error("Missing Full 2025 Schedule sheet");

  const data = sh.getDataRange().getValues();
  if (data.length <= 2) return;

  const headers = data[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("ID");
  if (idIdx < 0) throw new Error("ID column not found");

  const seenOrder = [];
  const latestById = {};
  let duplicateRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = String(row[idIdx] || "").trim();
    if (!id) continue;
    if (!latestById[id]) seenOrder.push(id);
    else duplicateRows++;
    latestById[id] = row;
  }

  const compactRows = seenOrder.map(id => latestById[id]);
  if (!compactRows.length) return;

  const existingRowCount = sh.getLastRow();
  if (existingRowCount > 1) {
    sh.getRange(2, 1, existingRowCount - 1, sh.getLastColumn()).clearContent();
  }

  sh.getRange(2, 1, compactRows.length, headers.length).setValues(compactRows);
  Logger.log(
    `compactFull2025ScheduleById kept ${compactRows.length} rows, removed ${duplicateRows} duplicates (from ${data.length - 1} data rows).`
  );
}

/**
 * One-time recovery helper:
 * Copies legacy synthetic IDs from a backup schedule sheet into "Legacy IDs"
 * by matching Date + Opponent + Home/Away.
 *
 * Usage:
 *   backfillLegacyIdsFromSheet("Full 2025 Schedule Backup");
 */
function backfillLegacyIdsFromSheet(sourceSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = ss.getSheetByName("Full 2025 Schedule");
  const source = ss.getSheetByName(sourceSheetName);

  if (!target || !source) {
    throw new Error("Missing source or target sheet");
  }

  const keyOf = (dateText, opp, homeAway) =>
    `${String(dateText || "").trim()}|${String(opp || "").trim().toLowerCase()}|${String(homeAway || "").trim().toLowerCase()}`;

  const src = source.getDataRange().getDisplayValues();
  const tgt = target.getDataRange().getDisplayValues();
  if (src.length < 2 || tgt.length < 2) return;

  const srcH = src[0].map(x => String(x).trim());
  const tgtH = tgt[0].map(x => String(x).trim());

  const srcId = srcH.indexOf("ID");
  const srcDate = srcH.indexOf("Date");
  const srcOpp = srcH.indexOf("Opponent");
  const srcHA = srcH.indexOf("Home/Away");
  const tgtLegacy = tgtH.indexOf("Legacy IDs");
  const tgtDate = tgtH.indexOf("Date");
  const tgtOpp = tgtH.indexOf("Opponent");
  const tgtHA = tgtH.indexOf("Home/Away");

  if (
    srcId < 0 || srcDate < 0 || srcOpp < 0 || srcHA < 0 ||
    tgtLegacy < 0 || tgtDate < 0 || tgtOpp < 0 || tgtHA < 0
  ) {
    throw new Error("Required columns not found");
  }

  const legacyByKey = {};
  for (let i = 1; i < src.length; i++) {
    const legacyId = String(src[i][srcId] || "").trim();
    if (!legacyId) continue;
    const key = keyOf(src[i][srcDate], src[i][srcOpp], src[i][srcHA]);
    legacyByKey[key] = legacyId;
  }

  let updated = 0;
  for (let i = 1; i < tgt.length; i++) {
    const key = keyOf(tgt[i][tgtDate], tgt[i][tgtOpp], tgt[i][tgtHA]);
    const legacyId = legacyByKey[key];
    if (!legacyId) continue;

    const cell = target.getRange(i + 1, tgtLegacy + 1);
    const existingLegacy = String(cell.getValue() || "").trim();
    if (!existingLegacy) {
      cell.setValue(legacyId);
      updated++;
    } else if (!existingLegacy.split(",").map(s => s.trim()).includes(legacyId)) {
      cell.setValue(`${existingLegacy}, ${legacyId}`);
      updated++;
    }
  }

  Logger.log(`backfillLegacyIdsFromSheet updated ${updated} rows`);
}
