
function buildColMap(header) {
  let col = {};
  if (!header || !Array.isArray(header)) return col;
  
  header.forEach((h, i) => { 
    if (h !== null && h !== undefined) {
      let clean = h.toString().toLowerCase().replace(/[\s\-_#]/g, "");
      col[clean] = i; 
    }
  });

  col.first      = getColIdx(col, ["First Name", "First"]);
  col.last       = getColIdx(col, ["Last Name", "Last"]);
  col.name       = getColIdx(col, ["Name", "Player Name", "Player"]);
  col.phone      = getColIdx(col, ["Phone", "Cell", "Mobile"]);
  col.email      = getColIdx(col, ["Email", "E-mail"]);
  col.group      = getColIdx(col, ["Ladder Name", "Ladder", "Group"]);
  col.status     = getColIdx(col, ["Status", "Active"]);
  col.total      = getColIdx(col, ["Tot", "Total"]);
  col.winPct     = getColIdx(col, ["Pct", "Win %"]);
  col.pts        = getColIdx(col, ["Pts", "Points"]);
  col.rnum       = getColIdx(col, ["RNum", "Rank"]);
  col.rawRankCol = getColIdx(col, ["Raw Rank"]);

  // Intermediate diagnostic columns
  col.lastr      = getColIdx(col, ["LASTR", "LastR", "Last R", "Previous Rank"]);
  col.sortval    = getColIdx(col, ["SortVal", "Sort Val", "Unconstrained Rank"]);
  col.newleft    = getColIdx(col, ["NewLeft", "New Left", "Constrained Rank"]);

  for (let r = 0; r <= 10; r++) {
    col["r" + r] = getColIdx(col, ["R" + r, "r" + r, "Rank " + r, "Rank" + r]);
  }
  for (let w = 1; w <= 10; w++) {
    col["w" + w] = getColIdx(col, ["W" + w, "w" + w, "Week " + w, "Week" + w]);
  }
  return col;
}


function getColIdx(colMap, candidates) {
  for (let c of candidates) {
    let clean = c.toLowerCase().replace(/[\s\-_#]/g, "");
    if (colMap[clean] !== undefined) return colMap[clean];
  }
  return undefined;
}


function getCourtsForGroup(groupName) {
  return GROUP_COURT_MAP[groupName] || GROUP_COURT_MAP["Default"];
}

function getConstantsConfig() {
  logDebug("getConstantsConfig", "Serving raw code constants");
  return {
    groups: GROUPS,
    scheduleTabs: SCHEDULE_TABS,
    scoreTabs: SCORE_TABS,
    maxMovementPct: (typeof MAX_MOVEMENT_PCT !== "undefined") ? MAX_MOVEMENT_PCT : 15,
    maxMovement: MAX_MOVEMENT,
    maxPointsPerWeek: MAX_POINTS_PER_WEEK,
    alwaysByeBottom: ALWAYS_BYE_BOTTOM
  };
}

function getAppVersion() {
  logDebug("getAppVersion", "Retrieving app version");
  return "0.9.9"; 
}

function getValidScoreTabs() { return SCORE_TABS; }
function getSchedTabNames() { return SCHEDULE_TABS; }
function getAvailableGroups() { return GROUPS; }





// In-Memory Global Memoization Cache for single-execution reuse
var _ROSTER_LOOKUP_CACHE = null;

/**
 * Evaluates whether a check-in cell value indicates a checked-in state.
 * Returns true for truthy booleans, Date objects, timestamps, or non-blank text.
 */
function isCheckInTrue(val) {
  if (val === null || val === undefined || val === false) return false;
  if (val instanceof Date) return true;
  
  let str = String(val).trim().toLowerCase();
  if (str === "" || str === "false" || str === "0" || str === "no") return false;
  
  return true;
}














function getAdminPlayersByGroup(groupName) {
  if (!groupName) return { players: [] };
  const ss = getDb();
  let cleanGroup = groupName.replace(/^(Score|Sched)\s*/i, "").trim();
  let sheet = ss.getSheetByName("Score " + cleanGroup);
  if (!sheet) return { players: [] };

  let data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return { players: [] };

  let col = buildColMap(data[0]);
  let players = [];

  for (let r = 1; r < data.length; r++) {
    let first = col.first !== undefined ? data[r][col.first] : "";
    let last = col.last !== undefined ? data[r][col.last] : "";
    let name = col.name !== undefined ? data[r][col.name] : `${first} ${last}`.trim();
    let phone = col.phone !== undefined ? data[r][col.phone] : "";
    let email = col.email !== undefined ? data[r][col.email] : "";
    let status = col.status !== undefined ? data[r][col.status] : "ACTIVE";

    if (name || first || last) {
      players.push({
        first: first || name.split(" ")[0],
        last: last || name.split(" ").slice(1).join(" "),
        name: name,
        phone: phone,
        email: email,
        status: status || "ACTIVE"
      });
    }
  }
  return { players: players };
}

function webExportSchedulePdf(groupName) {
  logDebug("webExportSchedulePdf", "Generating PDF export link", groupName);
  const ss = getDb();
  let cleanGroup = groupName ? String(groupName).replace(/^(Score|Sched)\s*/i, "").trim() : "Womens";
  let schedSheet = ss.getSheetByName("Sched " + cleanGroup) || ss.getActiveSheet();
  let gid = schedSheet ? schedSheet.getSheetId() : 0;

  let baseUrl = ss.getUrl().replace(/\/edit.*$/, '');
  let pdfUrl = `${baseUrl}/export?exportFormat=pdf&format=pdf&size=letter&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&fzr=false&gid=${gid}`;

  return { success: true, pdfUrl: pdfUrl };
}

function getInitialAppData(phone) {
  var defaultGroup = GROUPS[0] || "Womens";
  var rosterRes = getAdminPlayersByGroup(defaultGroup);

  return {
    version: getAppVersion(),
    groups: GROUPS,
    sheets: SCHEDULE_TABS,
    checkInPlayers: (rosterRes && Array.isArray(rosterRes.players)) ? rosterRes.players : []
  };
}


function startNewSeason() {
  const ss = getDb();
  const groups = typeof getActiveGroups === "function" ? getActiveGroups() : GROUPS.filter(g => g !== "TG");
  const seasonTimestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");

  if (typeof apiexecuteDriveBackup === "function") {
    apiexecuteDriveBackup("Pre-NewSeason-" + seasonTimestamp);
  }

  groups.forEach(group => {
    const cleanGroup = cleanGroupName(group);
    const scoreSheet = ss.getSheetByName("Score " + cleanGroup);

    if (scoreSheet && scoreSheet.getLastRow() >= 2) {
      const data = scoreSheet.getDataRange().getValues();
      const col = buildColMap(data[0]);
      const numRows = data.length - 1;
      const colsToClear = [
        col.pts, col.total, col.winPct, col.rnum, col.rawRankCol,
        col.lastr, col.sortval, col.newleft, col.r0
      ];
      for (let w = 1; w <= 10; w++) colsToClear.push(col["w" + w], col["r" + w]);

      colsToClear.forEach(idx => {
        if (idx !== undefined) scoreSheet.getRange(2, idx + 1, numRows, 1).clearContent();
      });
    }

    if (typeof resetCheckInsAndSchedData === "function") {
      resetCheckInsAndSchedData(cleanGroup);
    }

    const schedSheet = ss.getSheetByName("Sched " + cleanGroup);
    if (schedSheet && typeof setWeekNumber === "function") {
      setWeekNumber(schedSheet, 1, seasonTimestamp);
    }

    const rankSheet = ss.getSheetByName("Rankings " + cleanGroup);
    if (rankSheet && rankSheet.getLastRow() >= 2) {
      rankSheet.getRange(2, 1, rankSheet.getLastRow() - 1, rankSheet.getLastColumn()).clearContent();
    }

    if (typeof clearUnifiedCache === "function") clearUnifiedCache(cleanGroup);
  });

  PropertiesService.getScriptProperties().setProperty("SEASON_START_DATE", seasonTimestamp);
  return `✅ New season initialized (${seasonTimestamp}) for: ${groups.join(", ")}.`;
}



// Helper function to format phone numbers to XXX-XXX-XXXX
function formatPhoneNumber(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  
  return String(phone).trim(); // Fallback if non-standard length
}


function addNewUser(info) {
  return executeWithLock(function () {
    Logger.log("=== DEBUG addNewUser START ===");
    Logger.log("Received info: " + JSON.stringify(info));

    if (!info || !info.first || !info.last || !info.phone || !info.group) {
      return "Error: First, Last, Phone, and Group are required.";
    }
    
    const targetSheet = getScoreSheetByGroup(info.group);
    if (!targetSheet) return `Error: Target score tab for group '${info.group}' not found.`;
    
    const data = targetSheet.getDataRange().getDisplayValues();
    if (!data || data.length === 0) return "Error: Target score sheet is empty.";

    let headerRowIdx = -1;
    let phoneColIdx = -1;
    let firstColIdx = -1;
    let lastColIdx = -1;
    let nameColIdx = -1;
    let emailColIdx = -1;
    let commentColIdx = -1;
    let statusColIdx = -1;

    for (let r = 0; r < Math.min(data.length, 5); r++) {
      const row = data[r].map(c => String(c || "").toLowerCase().trim());
      
      const pIdx = row.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
      const fIdx = row.findIndex(h => /first/i.test(h));
      const lIdx = row.findIndex(h => /last/i.test(h));
      const nIdx = row.findIndex(h => /name|player/i.test(h));

      if (pIdx !== -1 || fIdx !== -1 || nIdx !== -1) {
        headerRowIdx = r;
        phoneColIdx = pIdx;
        firstColIdx = fIdx;
        lastColIdx = lIdx;
        nameColIdx = nIdx;
        emailColIdx = row.findIndex(h => /email/i.test(h));
        commentColIdx = row.findIndex(h => /comment|notes/i.test(h));
        statusColIdx = row.findIndex(h => /status/i.test(h));
        break;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const inputFirst = String(info.first).trim();
    const inputLast = String(info.last).trim();
    const fullName = `${inputFirst} ${inputLast}`.trim();
    const inputNormName = typeof normalizeName === "function" ? normalizeName(fullName) : fullName.toLowerCase();
    
    const inputPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(info.phone) : String(info.phone);
    const inputPhoneDigits = String(info.phone).replace(/\D/g, "");
    const inputTail = inputPhoneDigits.length >= 7 ? inputPhoneDigits.slice(-7) : "";
    
    const inputEmail = String(info.email || "").trim();
    const inputGroup = String(info.group).trim();
    const cleanGroup = inputGroup.replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    const inputComment = String(info.comment || "").trim();

    function invalidateGroupCaches() {
      if (typeof CacheService !== "undefined") {
        try {
          const cache = CacheService.getScriptCache();
          const keysToClear = [
            "UNIFIED_ROSTER_CACHE_" + cleanGroup.toUpperCase(),
            "SCHEDULE_" + cleanGroup,
            "APP_INIT_DATA"
          ];
          if (typeof getCheckInCacheKey === "function") {
            keysToClear.push(getCheckInCacheKey("Sched " + cleanGroup));
          }
          cache.removeAll(keysToClear);
        } catch (e) {}
      }
    }
      


    // 1. ENFORCE UNIQUE PHONE NUMBER (MATCH LAST 7 DIGITS)
    if (phoneColIdx !== -1 && inputTail) {
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const rawCellVal = String(data[r][phoneColIdx] || "");
        const existingPhoneDigits = rawCellVal.replace(/\D/g, "");

        if (existingPhoneDigits.length >= 7 && existingPhoneDigits.slice(-7) === inputTail) {
          const existingFirst = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
          const existingLast = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";
          let registeredName = `${existingFirst} ${existingLast}`.trim();
          
          if (!registeredName && nameColIdx !== -1) {
            registeredName = String(data[r][nameColIdx] || "").trim();
          }
          if (!registeredName) registeredName = "an existing player";

          return `⚠️ Notice: Phone number ${inputPhone} is already registered to '${registeredName}' in group '${inputGroup}'. If you need to update your name or information, please contact your group captain.`;
        }
      }
    }

    // 2. CHECK FOR EXISTING PLAYER BY NORMALIZED NAME (PREVENTS DUPLICATE ROWS)
    let matchedRowNumber = -1;
    let updatedMissingFields = false;

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const existingFirst = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
      const existingLast = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";
      const existingCombined = `${existingFirst} ${existingLast}`.trim() || (nameColIdx !== -1 ? String(data[r][nameColIdx] || "").trim() : "");
      const existingNorm = typeof normalizeName === "function" ? normalizeName(existingCombined) : existingCombined.toLowerCase();

      if (inputNormName && existingNorm === inputNormName) {
        matchedRowNumber = r + 1;

        if (phoneColIdx !== -1 && !String(data[r][phoneColIdx] || "").trim() && inputPhone) {
          targetSheet.getRange(matchedRowNumber, phoneColIdx + 1).setValue(inputPhone);
          updatedMissingFields = true;
        }
        if (emailColIdx !== -1 && !String(data[r][emailColIdx] || "").trim() && inputEmail) {
          targetSheet.getRange(matchedRowNumber, emailColIdx + 1).setValue(inputEmail);
          updatedMissingFields = true;
        }
        break;
      }
    }

    if (matchedRowNumber > -1) {
      ensurePlayerOnSchedSheet(cleanGroup, fullName);
      ensurePlayerOnRankingsSheet(cleanGroup, fullName);
      invalidateGroupCaches();
      if (updatedMissingFields) {
        return `⚠️ Notice: User '${fullName}' was already on '${targetSheet.getName()}' (Row ${matchedRowNumber}); updated missing contact details without creating a duplicate.`;
      }
      return `⚠️ Notice: User '${fullName}' is already registered in '${targetSheet.getName()}' (Row ${matchedRowNumber}).`;
    }

    // 3. INSERT NEW PLAYER (CLEAR STALE DATA IF REUSING A BLANK ROW, ELSE APPEND)
    let targetRowNumber = -1;
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const firstVal = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
      const lastVal = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";
      const nameVal = nameColIdx !== -1 ? String(data[r][nameColIdx] || "").trim() : "";
      if (firstVal === "" && lastVal === "" && nameVal === "") {
        targetRowNumber = r + 1;
        break;
      }
    }

    const numCols = data[headerRowIdx].length;

    if (targetRowNumber > -1) {
      const reuseRange = targetSheet.getRange(targetRowNumber, 1, 1, numCols);
      reuseRange.clearContent();

      if (firstColIdx !== -1) targetSheet.getRange(targetRowNumber, firstColIdx + 1).setValue(inputFirst);
      if (lastColIdx !== -1) targetSheet.getRange(targetRowNumber, lastColIdx + 1).setValue(inputLast);
      if (nameColIdx !== -1 && firstColIdx === -1 && lastColIdx === -1) targetSheet.getRange(targetRowNumber, nameColIdx + 1).setValue(fullName);
      if (phoneColIdx !== -1) targetSheet.getRange(targetRowNumber, phoneColIdx + 1).setValue(inputPhone);
      if (emailColIdx !== -1 && inputEmail) targetSheet.getRange(targetRowNumber, emailColIdx + 1).setValue(inputEmail);
      if (statusColIdx !== -1) targetSheet.getRange(targetRowNumber, statusColIdx + 1).setValue("Inactive");
      if (commentColIdx !== -1 && inputComment) targetSheet.getRange(targetRowNumber, commentColIdx + 1).setValue(inputComment);

      reuseRange.setBackground("#ffff00");
    } else {
      let newRow = new Array(numCols).fill("");
      if (firstColIdx !== -1) newRow[firstColIdx] = inputFirst;
      if (lastColIdx !== -1) newRow[lastColIdx] = inputLast;
      if (nameColIdx !== -1 && firstColIdx === -1 && lastColIdx === -1) newRow[nameColIdx] = fullName;
      if (phoneColIdx !== -1) newRow[phoneColIdx] = inputPhone;
      if (emailColIdx !== -1) newRow[emailColIdx] = inputEmail;
      if (statusColIdx !== -1) newRow[statusColIdx] = "Inactive";
      if (commentColIdx !== -1) newRow[commentColIdx] = inputComment;

      targetSheet.appendRow(newRow);
      const lastRow = targetSheet.getLastRow();
      targetSheet.getRange(lastRow, 1, 1, numCols).setBackground("#ffff00");
    }

    ensurePlayerOnSchedSheet(cleanGroup, fullName);
    ensurePlayerOnRankingsSheet(cleanGroup, fullName);
    invalidateGroupCaches();

    return `✅ Success: Added ${fullName} (Inactive) to tab '${targetSheet.getName()}'.`;
  });
}







function parseRankVal(val) {
  if (val === null || val === undefined || val === "") return { rank: Infinity, numPeople: 0, isRestricted: false };
  let str = val.toString().trim();
  let isRestricted = /-R$/i.test(str);
  let cleanStr = str.replace(/-R$/i, "").trim();

  if (cleanStr.includes("/")) {
    let parts = cleanStr.split("/");
    let r = parseFloat(parts[0]);
    let n = parseFloat(parts[1]);
    return { 
      rank: isNaN(r) ? Infinity : r, 
      numPeople: isNaN(n) ? 0 : n,
      isRestricted: isRestricted
    };
  }
  let r = parseFloat(cleanStr);
  return { rank: isNaN(r) ? Infinity : r, numPeople: 0, isRestricted: isRestricted };
}

function parseAndSortCourts(cStr) {
  if (!cStr) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (Array.isArray(cStr)) return cStr;
  let courts = cStr.toString().split(',').map(s => s.trim()).filter(s => s.length > 0);
  return courts.length > 0 ? courts : [1, 2, 3, 4, 5, 6, 7, 8];
}

function getMostRecentRank(row, col, maxWeekNum = 10) {
  for (let w = maxWeekNum; w >= 0; w--) {
    let rIdx = col["r" + w];
    if (rIdx !== undefined && row[rIdx] !== "" && row[rIdx] !== null && row[rIdx] !== undefined) {
      let parsed = parseRankVal(row[rIdx]);
      if (parsed.rank !== Infinity) {
        return { rank: parsed.rank, numPeople: parsed.numPeople, weekNum: w, rawStr: row[rIdx].toString().trim() };
      }
    }
  }
  return { rank: Infinity, numPeople: 0, weekNum: -1, rawStr: "" };
}





/**
 * Helper to identify temporary Unknown court-filler placeholders.
 */
function isUnknownPlayerName(name) {
  if (name === null || name === undefined) return false;
  return /^unknown(\s*\d+|\s+player(\s*\d+)?)?$/i.test(String(name).trim());
}


/**
 * Fetches the list of players for a given schedule tab or group.
 * Reads player names from Column A of the Schedule tab.
 * 
 * @param {string} targetName - e.g., "Sched Womens" or "Womens"
 * @return {Array<Object>} Array of player objects [{ name: "Jane Doe", checkedIn: false }, ...]
 */
function fetchPlayersFromSheet(targetName) {
  const ss = getDb();
  let sheetName = targetName.startsWith("Sched ") ? targetName : "Sched " + targetName;
  let sheet = ss.getSheetByName(sheetName);
  let players = [];
  let playerSet = new Set();

  const normKeyOf = (n) => typeof normalizeName === "function" ? normalizeName(n) : String(n || "").toLowerCase().trim();

  // 1. Read players from the current Schedule sheet (Column A)
  if (sheet) {
    let data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      let name = data[i][0] ? String(data[i][0]).trim() : "";
      let key = normKeyOf(name);
      if (name && name !== "Player Name" && !name.startsWith("---") && !isUnknownPlayerName(name) && key && !playerSet.has(key)) {
        playerSet.add(key);
        players.push({
          name: name,
          checkedIn: false
        });
      }
    }
  }

  // 2. Fallback: If Schedule tab is empty, fetch from master "Players" or "Roster" tab
  if (players.length === 0) {
    let groupName = sheetName.replace(/^Sched\s*/i, "").trim();
    let rosterSheet = ss.getSheetByName("Players") || 
                        ss.getSheetByName("Roster") || 
                        ss.getSheetByName("Roster " + groupName);

    if (rosterSheet) {
      let rosterData = rosterSheet.getDataRange().getValues();
      let headers = rosterData[0].map(h => String(h).trim().toLowerCase());
      
      let nameCol = headers.indexOf("player name") !== -1 ? headers.indexOf("player name") : 0;
      let groupCol = headers.indexOf("group");

      for (let i = 1; i < rosterData.length; i++) {
        let name = rosterData[i][nameCol] ? String(rosterData[i][nameCol]).trim() : "";
        let group = groupCol !== -1 && rosterData[i][groupCol] ? String(rosterData[i][groupCol]).trim() : "";
        let key = normKeyOf(name);

        if (name && !isUnknownPlayerName(name) && (!group || group.toLowerCase() === groupName.toLowerCase()) && key && !playerSet.has(key)) {
          playerSet.add(key);
          players.push({
            name: name,
            checkedIn: false
          });
        }
      }
    }
  }

  return players;
}



function calculateStats(row, col) {
  let total = 0;
  let played = 0;
  for (let w = 1; w <= 10; w++) {
    if (col["w"+w] !== undefined && row[col["w"+w]] !== "") {
      total += parseFloat(row[col["w"+w]]) || 0;
      played++;
    }
  }
  return { total: total, winPct: played > 0 ? total / (played * MAX_POINTS_PER_WEEK) : 0 };
}

/**
 * Normalizes player names to ensure accurate lookup across sheets.
 * - Flips "Last, First" to "First Last"
 * - Converts to lowercase & removes accents/diacritics
 * - Removes punctuation (hyphens, apostrophes, periods)
 * - Collapses multiple spaces into a single space
 */
function normalizeName(rawName) {
  if (rawName === null || rawName === undefined) return "";
  let s = String(rawName).trim().toLowerCase();
  if (!s) return "";

  if (s.includes(",")) {
    let parts = s.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      s = parts.slice(1).join(" ") + " " + parts[0];
    }
  }

  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^a-z0-9\s]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes phone numbers to digits only.
 */
function cleanPhoneDigits(phoneVal) {
  if (phoneVal === null || phoneVal === undefined) return "";
  let digits = String(phoneVal).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}


/**
 * Harvests scores and court assignments from Schedule sheets into Score sheets.
 * Evaluates Game 1 through Game 6 and calculates the scaled 3-game average total.
 * Ignores Unknown court-filler placeholders.
 */
function harvestScoresFromSchedules(ss, data, col, targetWeekIdx, schedSheet, weekNum) {
  let warnings = [];
  if (!schedSheet || data.length <= 1) return warnings;

  let schedData = schedSheet.getDataRange().getValues();
  if (schedData.length <= 1) return warnings;

  let schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
  
  let nameIdx = schedHeaders.findIndex(h => /name|player/i.test(h));
  if (nameIdx === -1) nameIdx = 0;

  let phoneIdx = schedHeaders.findIndex(h => /phone|cell|mobile/i.test(h));
  if (phoneIdx === -1 && schedHeaders.length >= 13) phoneIdx = 12;

  let firstIdx = schedHeaders.findIndex(h => /\bfirst\b|fname/i.test(h));
  let lastIdx = schedHeaders.findIndex(h => /\blast\b|lname/i.test(h));

  let scoreIdx = schedHeaders.findIndex(h => /^(pts|points|score|total|tot)$/i.test(h));
  if (scoreIdx === -1) scoreIdx = schedHeaders.findIndex(h => /pts|points|score|total/i.test(h));
  if (scoreIdx === -1 && schedHeaders.length >= 10) scoreIdx = 9;

  let schedCourtIdx = schedHeaders.findIndex(h => /court|crt/i.test(h));
  if (schedCourtIdx === -1 && schedHeaders.length >= 2) schedCourtIdx = 1;

  // Fixed mapping to support "G1", "Game 1", "g 1", up to game 6
  const gIdxs = [1, 2, 3, 4, 5, 6].map(num => 
    schedHeaders.findIndex(h => new RegExp(`^(game\\s*${num}|g${num})$`, 'i').test(h))
  );

  if (scoreIdx === -1) return warnings;

  let schedPhoneCounts = {};
  let schedMapByPhoneKey = {};
  let schedMapByFirstLastKey = {};
  let schedMapByNameKey = {};
  let hasAnySchedData = false;
  let schedModified = false;

  for (let r = 1; r < schedData.length; r++) {
    let rawSchedName = schedData[r][nameIdx];
    if (!rawSchedName || String(rawSchedName).startsWith("---") || String(rawSchedName).toLowerCase().startsWith("time:") || isUnknownPlayerName(rawSchedName)) continue;

    let normName = normalizeName(rawSchedName);
    let schedFirst = firstIdx !== -1 ? normalizeName(schedData[r][firstIdx]) : "";
    let schedLast  = lastIdx !== -1 ? normalizeName(schedData[r][lastIdx]) : "";
    let phoneDigits = (phoneIdx !== -1 && schedData[r][phoneIdx]) ? cleanPhoneDigits(schedData[r][phoneIdx]) : "";
    let rawCourt = (schedCourtIdx !== -1 && schedData[r][schedCourtIdx] !== undefined) ? String(schedData[r][schedCourtIdx]).trim() : "";

    let recordedTotalStr = schedData[r][scoreIdx];
    let recordedTotal = (recordedTotalStr !== "" && recordedTotalStr !== null) ? parseFloat(recordedTotalStr) : NaN;

    let computedSum = 0;
    let playedCount = 0;

    for (let g = 0; g < 6; g++) {
      const idx = gIdxs[g];
      if (idx !== -1 && schedData[r][idx] !== "" && schedData[r][idx] !== null) {
        const val = parseFloat(schedData[r][idx]);
        if (!isNaN(val)) {
          computedSum += val;
          playedCount++;
        }
      }
    }

    let finalValToUse = null;

    if (playedCount > 0) {
      finalValToUse = (playedCount === 3) ? computedSum : Math.round((computedSum / playedCount) * 3);

      if (isNaN(recordedTotal) || Math.abs(finalValToUse - recordedTotal) > 0.001) {
        let oldVal = isNaN(recordedTotal) ? "(blank)" : recordedTotal;
        warnings.push(`Sched Mismatch [${rawSchedName}]: Sum of games is ${computedSum} (${playedCount} games played), but Total was ${oldVal}. Corrected to 3-game scaled score of ${finalValToUse}.`);
        schedData[r][scoreIdx] = finalValToUse;
        schedModified = true;
      }
    } else if (!isNaN(recordedTotal)) {
      finalValToUse = recordedTotal;
    }

    let schedInfo = { score: finalValToUse, court: rawCourt };

    if (normName) schedMapByNameKey[normName] = schedInfo;
    if (schedFirst && schedLast) schedMapByFirstLastKey[schedFirst + "_" + schedLast] = schedInfo;
    if (phoneDigits && phoneDigits.length >= 7) {
      let tail = phoneDigits.slice(-7);
      schedPhoneCounts[tail] = (schedPhoneCounts[tail] || 0) + 1;
      schedMapByPhoneKey[tail] = schedInfo;
    }
    hasAnySchedData = true;
  }

  if (schedModified) {
    let targetWidth = schedData[0].length;
    schedData.forEach(r => {
      while (r.length < targetWidth) r.push("");
      r.length = targetWidth;
    });
    schedSheet.getRange(1, 1, schedData.length, targetWidth).setValues(schedData);
  }

  if (!hasAnySchedData) return warnings;

  let ptsColIdx = col.pts !== undefined ? col.pts : col.points;
  let scoreCourtIdx = col.court !== undefined ? col.court : data[0].map(h => String(h || '').trim().toLowerCase()).findIndex(h => /court|crt/i.test(h));
  if (scoreCourtIdx === -1) scoreCourtIdx = 3;

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let firstName = col.first !== undefined ? String(row[col.first] || "").trim() : "";
    let lastName = col.last !== undefined ? String(row[col.last] || "").trim() : "";
    let rawScoreName = (firstName || lastName) ? (firstName + " " + lastName).trim() : (col.name !== undefined ? String(row[col.name] || "").trim() : "");

    let normName = normalizeName(rawScoreName);
    let normFirst = normalizeName(firstName);
    let normLast  = normalizeName(lastName);

    let phoneColIdx = col.phone !== undefined ? col.phone : col.mobile;
    let scorePhoneDigits = phoneColIdx !== undefined ? cleanPhoneDigits(row[phoneColIdx]) : "";

    let schedInfo = undefined;

    if (normName && schedMapByNameKey[normName] !== undefined) {
      schedInfo = schedMapByNameKey[normName];
    } else if (normFirst && normLast && schedMapByFirstLastKey[normFirst + "_" + normLast] !== undefined) {
      schedInfo = schedMapByFirstLastKey[normFirst + "_" + normLast];
    } else if (scorePhoneDigits && scorePhoneDigits.length >= 7) {
      let tail = scorePhoneDigits.slice(-7);
      if (schedPhoneCounts[tail] === 1) {
        schedInfo = schedMapByPhoneKey[tail];
      }
    }
      
    if (schedInfo !== undefined) {
      if (scoreCourtIdx !== -1 && schedInfo.court !== undefined) row[scoreCourtIdx] = schedInfo.court;
      if (ptsColIdx !== undefined && schedInfo.score !== null && schedInfo.score !== undefined) {
        let currentPts = row[ptsColIdx];
        let parsedPts = (currentPts !== "" && currentPts !== null) ? parseFloat(currentPts) : NaN;

        if (isNaN(parsedPts) || Math.abs(parsedPts - schedInfo.score) > 0.001) {
          row[ptsColIdx] = schedInfo.score;
          let oldScoreVal = isNaN(parsedPts) ? "(blank)" : parsedPts;
          warnings.push(`Score Mismatch [${rawScoreName}]: Pts was ${oldScoreVal}. Auto-updated to match schedule (${schedInfo.score}).`);
        }
      }
    }
  }

  return warnings;
}







/**
 * Case-insensitive column finder helper
 */
function findColIndex(colMap, headerRow, candidateNames) {
  for (let name of candidateNames) {
    let lower = name.toLowerCase();
    if (colMap[lower] !== undefined) return colMap[lower];
    if (colMap[name] !== undefined) return colMap[name];
    let idx = headerRow.findIndex(h => String(h).trim().toLowerCase() === lower);
    if (idx !== -1) return idx;
  }
  return undefined;
}

/**
 * Parse previous-rank values.
 *
 * Supported formats include:
 *   23R49
 *   23/49
 *   23/49-R
 *   23/49-r
 *   17.6%
 *   17.6%-R
 *   17.6%-r
 *   17.6%-I
 *   17.6%-i 
 *
 * @param {*} val
 * @param {number} defaultPrevRank
 * @param {number} [currentPopulation=0]
 *        Current active-player count. Required to convert a percentage
 *        into an equivalent rank.
 *
 * @return {{
 *   rank: number,
 *   numPeople: number,
 *   percentage: number|null,
 *   restriction: string,
 *   isRestricted: boolean,
 *   isInactive: boolean,
 *   isPercentage: boolean,
 *   rawStr: string
 * }}
 */


/* =========================================================================
 *  RANK ENGINE — corrected
 *  Primary  (default)  : percentile-scaled bounds  -> Week N column (e.g. R1)
 *  Method 2 (default)  : absolute bounds           -> LASTR column
 *  Pass invertPrimaryToAbsolute = true to swap them.
 * ========================================================================= */

const TREAT_UNRANKED_AS_UNCONSTRAINED = true;
const RANK_DEBUG_LOG = true;

/* ---------- column resolution ---------------------------------------- */

function resolveCol(col, headerRow, names) {
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (col && col[n] !== undefined) return col[n];
    if (col && col[String(n).toLowerCase()] !== undefined) {
      return col[String(n).toLowerCase()];
    }
  }
  const want = names.map(n => String(n).trim().toLowerCase());
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || "").trim().toLowerCase();
    if (want.indexOf(h) !== -1) return c;
  }
  return undefined;
}



/**
 * Renders a non-playing or inactive player's carried-forward standing.
 * - Active roster status but did not play -> suffix "-i" (lowercase)
 * - Inactive roster status                -> suffix "-I" (uppercase)
 * 
 * asPercent true  -> "44.9%-i" / "44.9%-I"   (percentile method)
 * asPercent false -> "22/49-i"  / "22/49-I"   (absolute method)
 */
function formatInactiveStanding(player, asPercent) {
  if (!player.hasPrior) return "";

  let pct = player.priorPercent;
  if ((pct === null || pct === undefined) && player.priorNumPeople > 0) {
    pct = (player.priorRank / player.priorNumPeople) * 100;
  }

  // Determine suffix based on roster status
  const isRosterInactive = String(player.status || "").toUpperCase().trim() === "INACTIVE";
  const suffix = isRosterInactive ? "-I" : "-i";

  if (asPercent) {
    return (pct === null || pct === undefined)
      ? (player.priorRank + suffix)
      : (pct.toFixed(1) + "%" + suffix);
  }

  return (player.priorNumPeople > 0)
    ? (player.priorRank + "/" + player.priorNumPeople + suffix)
    : (player.priorRank + suffix);
}

/* Ranking code goals
Inputs per row. Identity (First/Last, or a Name column), current-week points (Pts), weekly scores (W1…W10), and the prior standing string in R(N-1). The prior string carries three facts at once: position, the field size it came from, and whether movement was capped. Pos, Pct, RNum are derived and rewritten each run.

Outputs per row. R(N) holds the primary standing string. LASTR holds the Method 2 standing for comparison. SortVal holds the merit-only rank, NewLeft the final primary rank — both integers in [1,𝑁]. Rows are physically ordered by final rank, active first, inactive after.

The requirements the code has to satisfy simultaneously.

Merit order comes from cumulative win percentage across weeks actually played, cumPct =cumScore/(45 ⋅weeksPlayed). Continuity caps weekly movement at ±MAX_MOVEMENT from the prior standing. Population normalization converts the prior standing to a percentile before applying the cap, so a rank of 23 out of 49 means the 47th percentile rather than position 23 in a 28-player field. The result must be a permutation of 1…𝑁 with no duplicates, no gaps, and no placement outside a player's window. Inactive players keep their prior string with -I and are excluded from the permutation. Transparency requires -R when upward movement was capped, -r when a drop was limited, and the diagnostic columns to be reproducible from the raw data. Safety requires a backup, a restore on failure, and an explicit error rather than a silent illegal placement.

New players, having no history, anchor near the bottom. They may finish modestly above the weakest returning players but may not enter the upper field on one week's result. This overrides the ±4 windows of returning players when the two conflict.
*/


/* ---------- feasibility (earliest-deadline-first, exact) -------------- */

function rankingIsFeasible(items, usedSlots) {
  const used = {};
  for (const s in usedSlots) if (usedSlots[s]) used[s] = true;

  const sorted = items.slice().sort(function (a, b) {
    if (a.maxAllowed !== b.maxAllowed) return a.maxAllowed - b.maxAllowed;
    return a.minAllowed - b.minAllowed;
  });

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    let placed = false;
    for (let s = it.minAllowed; s <= it.maxAllowed; s++) {
      if (!used[s]) { used[s] = true; placed = true; break; }
    }
    if (!placed) return false;
  }
  return true;
}

/* =========================================================================
 *  NEW-PLAYER POLICY
 *
 *  "BOTTOM_BAND"   : newcomers are confined to the bottom of the field.
 *                    Their band is hard; returning players' windows widen
 *                    around it if the two conflict.
 *  "UNCONSTRAINED" : newcomers may land anywhere (previous behaviour).
 * ========================================================================= */
const NEW_PLAYER_POLICY = "BOTTOM_BAND";

/* 0 = newcomers occupy the last K places and sit below every returner.
 * 4 = the best newcomer may reach 4 places above that block. */
const NEW_PLAYER_SLACK = 0;

/* Scale prior standings against the number of RETURNING players rather
 * than the whole field. Without this, every player whose prior rank
 * exceeds the field size collapses onto the last slot and the movement
 * cap has to be abandoned to find any legal arrangement. */
const SCALE_AGAINST_RETURNER_POOL = true;

const MARK_NEW_PLAYERS = false;

/* ---------- window construction --------------------------------------- */

function applyWindows(items, window, numSlots) {
  /* The newcomer band depends only on how many newcomers (with <= 4 weeks)
   * there are, so it is identical on every iteration of the feasibility search. */
  let newCount = 0;
  items.forEach(function (p) { if (p.isNew && !p.isPctRanked) newCount++; });

  const bandStart = (NEW_PLAYER_POLICY === "BOTTOM_BAND" && newCount > 0)
    ? Math.max(1, numSlots - newCount - NEW_PLAYER_SLACK + 1)
    : 1;

  items.forEach(function (p) {
    if (p.isPctRanked) {
      /* Players with > 4 weeks (> 180 possible points) are ranked purely by
       * cumulative percentage (scores / possible) without mobility caps. */
      p.minAllowed = 1;
      p.maxAllowed = numSlots;
    } else if (p.isNew && NEW_PLAYER_POLICY === "BOTTOM_BAND") {
      /* Hard band. Deliberately NOT widened by findSmallestFeasibleWindow:
       * newcomer placement takes precedence over returning players' caps. */
      p.minAllowed = bandStart;
      p.maxAllowed = numSlots;
    } else if (p.isNew) {
      p.minAllowed = 1;
      p.maxAllowed = numSlots;
    } else {
      p.minAllowed = Math.max(1, p.effectivePrevRank - window);
      p.maxAllowed = Math.min(numSlots, p.effectivePrevRank + window);
    }

    if (p.minAllowed > p.maxAllowed) {
      p.minAllowed = 1;
      p.maxAllowed = numSlots;
    }

    p.clampedTarget = Math.max(
      p.minAllowed,
      Math.min(p.sortVal, p.maxAllowed)
    );
  });

  return bandStart;
}


function findSmallestFeasibleWindow(items, baseWindow, numSlots) {
  /* Only returning players' windows grow. The newcomer band is fixed,
   * which is what makes the bottom anchor override the +/- cap. */
  for (let w = baseWindow; w <= numSlots; w++) {
    applyWindows(items, w, numSlots);
    if (rankingIsFeasible(items, {})) return w;
  }
  applyWindows(items, numSlots, numSlots);
  return numSlots;
}





/* ---------- merit-greedy assignment with feasibility guard ------------ */

function assignRanksWithinWindows(items, numSlots) {
  let remaining = items.slice();
  const used = {};

  for (let r = 1; r <= numSlots; r++) {
    const eligible = remaining
      .filter(function (p) { return p.minAllowed <= r && r <= p.maxAllowed; })
      .sort(function (a, b) { return a.sortVal - b.sortVal; });

    let chosen = null;

    for (let i = 0; i < eligible.length; i++) {
      const cand = eligible[i];
      const rest = remaining.filter(function (p) { return p !== cand; });

      /* Ranks 1..r are no longer available to anyone else. */
      const trialUsed = {};
      for (const k in used) trialUsed[k] = true;
      for (let s = 1; s <= r; s++) trialUsed[s] = true;

      if (rankingIsFeasible(rest, trialUsed)) { chosen = cand; break; }
    }

    if (!chosen) {
      throw new Error(
        "Rank assignment failed at slot " + r +
        ". Eligible candidates: " + eligible.length +
        ", remaining players: " + remaining.length + "."
      );
    }

    chosen.finalRank = r;
    used[r] = true;
    remaining = remaining.filter(function (p) { return p !== chosen; });
  }

  return items;
}

/* =========================================================================
 *  MAIN WEEKLY SCORE HARVEST & MIXED RANKING PROCESSOR (OPTIMIZED)
 * ========================================================================= */




function computeMixedRankings(activePlayers) {
  if (!activePlayers || activePlayers.length === 0) return [];

  const N = activePlayers.length;
  const maxPtsPerWeek = (typeof MAX_POINTS_PER_WEEK !== "undefined") ? MAX_POINTS_PER_WEEK : 45;
  const step = Math.ceil(0.15 * N);

  const established = []; // > 4 weeks: pure Pt %
  const provisional = []; // <= 4 weeks: bounded movement

  activePlayers.forEach(p => {
    const weeks = Number(p.weeksPlayed ?? p.weeks) || 0;
    const total = Number(p.cumScore ?? p.total) || 0;
    const maxPts = weeks * maxPtsPerWeek;
    let pct = maxPts > 0 ? (total / maxPts) * 100 : (Number(p.pct) || 0);
    if (pct > 0 && pct <= 1 && total > 0) pct = pct * 100;

    p.weeks = weeks;
    p.weeksPlayed = weeks;
    p.total = total;
    p.cumScore = total;
    p.maxPts = maxPts;
    p.maxPtsForPlayedWeeks = maxPts;
    p.pct = pct;
    p.cumPct = pct / 100;

    if (weeks > 4) {
      p.isPctRanked = true;
      p.restrictionSuffix = p.playedThisWeek === false ? "-i" : "";
      established.push(p);
    } else {
      p.isPctRanked = false;
      provisional.push(p);
    }
  });

  // 1. Evaluate bounded movement for <= 4 week players
  const evaluatedProv    = computeBoundedRanks(provisional, activePlayers, step);
  const unrestrictedProv = evaluatedProv.filter(p => !p.isBounded);
  const upwardBounded    = evaluatedProv.filter(p => p.isBounded && p.restrictionSuffix === "-R");
  const downwardBounded  = evaluatedProv.filter(p => p.isBounded && p.restrictionSuffix === "-r");

  // 2. Sort (> 4 weeks) + (unrestricted <= 4 weeks) strictly by cumulative Pt % descending
  const baseSorted = established.concat(unrestrictedProv).sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    if (b.total !== a.total) return b.total - a.total;
    return b.weeks - a.weeks;
  });

  const slots = new Array(N).fill(null);
  const placeAtTarget = (player) => {
    let idx = Math.max(0, Math.min(N - 1, player.targetRank - 1));
    while (idx < N && slots[idx] !== null) idx++;
    if (idx >= N) {
      idx = Math.max(0, Math.min(N - 1, player.targetRank - 1));
      while (idx >= 0 && slots[idx] !== null) idx--;
    }
    if (idx >= 0 && idx < N) slots[idx] = player;
  };

  // 3a. Anchor upward-capped (-R) players at their ceiling slot first
  upwardBounded.sort((a, b) => {
    if (a.targetRank !== b.targetRank) return a.targetRank - b.targetRank;
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    return b.total - a.total;
  });
  upwardBounded.forEach(placeAtTarget);

  // 3b. Fill higher-merit players into slots up to each downward-capped (-r) player's floor
  downwardBounded.sort((a, b) => {
    if (a.targetRank !== b.targetRank) return a.targetRank - b.targetRank;
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    return b.total - a.total;
  });

  let baseIdx = 0;
  downwardBounded.forEach(p => {
    const targetIdx = Math.max(0, Math.min(N - 1, p.targetRank - 1));
    for (let i = 0; i <= targetIdx && baseIdx < baseSorted.length; i++) {
      if (slots[i] === null) {
        slots[i] = baseSorted[baseIdx++];
      }
    }
    placeAtTarget(p);
  });

  // 3c. Fill all remaining open slots with remaining merit-ordered players
  for (let i = 0; i < N; i++) {
    if (slots[i] === null && baseIdx < baseSorted.length) {
      slots[i] = baseSorted[baseIdx++];
    }
  }

  const result = [];
  for (let i = 0; i < N; i++) {
    const p = slots[i];
    if (!p) continue;
    p.rank = i + 1;
    p.sortVal = p.rawRank || (i + 1);
    result.push(p);
  }
  return result;
}

function sortActivePlayersForSheet(sheet) {
  const ss = (typeof getDb === "function") ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  if (typeof sheet === "string") {
    const clean = sheet.replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    sheet = ss.getSheetByName("Score " + clean) || ss.getSheetByName(sheet);
  }
  if (!sheet) return "⚠️ Error: Target Score sheet not found.";

  if (typeof logDebug === "function") {
    logDebug("sortActivePlayersForSheet", "Sorting active players via bounded rankings (ignoring current week play status)", sheet.getName());
  }

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

  const displayData = dataRange.getDisplayValues();
  const formulas = dataRange.getFormulas();
  const backgrounds = dataRange.getBackgrounds();

  const cleanGroup = sheet.getName().replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  const headerRow = data[0];
  let scoreWidth = headerRow.length;

  const col = typeof buildColMap === "function" ? buildColMap(headerRow) : {};
  if (!hasCol(col.first)) col.first = headerRow.findIndex(h => /first/i.test(h));
  if (!hasCol(col.last))  col.last  = headerRow.findIndex(h => /last/i.test(h));

  const maxPtsPerWeek = (typeof MAX_POINTS_PER_WEEK !== "undefined") ? MAX_POINTS_PER_WEEK : 45;

  const weekColIndices = [];
  for (let w = 1; w <= 10; w++) {
    const wCol = resolveCol(col, headerRow, ["w" + w, "W" + w, "Week " + w]);
    if (hasCol(wCol)) weekColIndices.push({ week: w, idx: wCol });
  }

  // Find the latest week that has any scores entered, so prior standing strictly comes from weeks BEFORE it
  let latestScoredWeek = 0;
  for (let k = weekColIndices.length - 1; k >= 0; k--) {
    const wObj = weekColIndices[k];
    const hasScores = data.slice(1).some(r => r[wObj.idx] !== "" && r[wObj.idx] !== null && !isNaN(parseFloat(r[wObj.idx])));
    if (hasScores) {
      latestScoredWeek = wObj.week;
      break;
    }
  }
  const refWeek = latestScoredWeek > 0 ? latestScoredWeek : 1;

  // Prior R columns strictly BEFORE refWeek (e.g., for Week 10: r9, r8, r7, ..., r0)
  const priorRCols = [];
  for (let w = refWeek - 1; w >= 0; w--) {
    const rIdx = resolveCol(col, headerRow, ["r" + w, "R" + w]);
    if (hasCol(rIdx)) priorRCols.push(rIdx);
  }

  const adjustRowFormula = (formulaStr, oldRow, newRow) => {
    if (!formulaStr || !String(formulaStr).startsWith("=") || oldRow === newRow) return formulaStr;
    return String(formulaStr).replace(/(\$?[A-Z]{1,3})(\$?)(\d+)\b/g, (match, colPart, rowDollar, rowDigits, offset, fullStr) => {
      if (rowDollar === "$") return match;
      const prevChar = offset > 0 ? fullStr[offset - 1] : "";
      if (/[A-Za-z0-9_]/.test(prevChar)) return match;
      if (parseInt(rowDigits, 10) === oldRow) {
        return colPart + String(newRow);
      }
      return match;
    });
  };

  let activeEntries = [];
  let inactiveEntries = [];
  let seenNames = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dispRow = displayData[i];

    const first = hasCol(col.first) ? String(row[col.first] || "").trim() : "";
    const last  = hasCol(col.last)  ? String(row[col.last]  || "").trim() : "";
    const fullName = (hasCol(col.name) && row[col.name])
      ? String(row[col.name]).trim()
      : `${first} ${last}`.trim();

    if (!fullName || (typeof isUnknownPlayerName === "function" && isUnknownPlayerName(fullName))) continue;

    const normKey = typeof normalizeName === "function" ? normalizeName(fullName) : fullName.toLowerCase();
    if (normKey && seenNames.has(normKey)) continue;
    if (normKey) seenNames.add(normKey);

    const rawStatus = (hasCol(col.status) && row[col.status] !== "" && row[col.status] !== null && row[col.status] !== undefined)
      ? String(row[col.status]).toUpperCase().trim()
      : "ACTIVE";
    const isActive = (rawStatus !== "INACTIVE" && rawStatus !== "FALSE" && rawStatus !== "NO" && rawStatus !== "QUIT" && rawStatus !== "DROPPED");

    let cumScore = 0;
    let weeksPlayed = 0;
    for (let k = 0; k < weekColIndices.length; k++) {
      const wVal = row[weekColIndices[k].idx];
      if (wVal !== "" && wVal !== null && wVal !== undefined) {
        const num = parseFloat(wVal);
        if (!isNaN(num)) {
          cumScore += num;
          weeksPlayed++;
        }
      }
    }

    const entry = {
      name: fullName,
      firstName: first,
      lastName: last,
      status: isActive ? "ACTIVE" : rawStatus,
      isActive: isActive,
      playedThisWeek: true, // Ignore whether they played this week
      cumScore: cumScore,
      total: cumScore,
      weeksPlayed: weeksPlayed,
      weeks: weeksPlayed,
      row: row.slice(),
      dispRow: dispRow.slice(),
      formulas: formulas[i] ? formulas[i].slice() : [],
      backgrounds: backgrounds[i] ? backgrounds[i].slice() : [],
      origIdx: i
    };

    if (isActive) activeEntries.push(entry);
    else inactiveEntries.push(entry);
  }

  // Resolve prior standing strictly from r(refWeek - 1) .. r0 (never current Rankings or R(refWeek))
  const numActive = activeEntries.length;
  activeEntries.forEach(p => {
    const maxPts = maxPtsPerWeek * p.weeksPlayed;
    const cumPct = maxPts > 0 ? (p.cumScore / maxPts) : 0;

    let priorCell = "";
    for (let c = 0; c < priorRCols.length; c++) {
      const candidate = String(p.dispRow[priorRCols[c]] || "").trim();
      if (candidate !== "") {
        priorCell = candidate;
        break;
      }
    }

    const prev = safeParseRankVal(priorCell, null, Math.max(1, numActive));
    p.maxPts = maxPts;
    p.maxPtsForPlayedWeeks = maxPts;
    p.pct = cumPct * 100;
    p.cumPct = cumPct;
    p.hasPrior = prev.hasPrior;
    p.prevRank = prev.hasPrior ? prev.rank : 0;
    p.priorRank = prev.hasPrior ? prev.rank : 0;
    p.priorNumPeople = prev.numPeople;
    p.priorPercent = prev.percent;
    p.priorRawStr = prev.rawStr;
  });

  // Compute bounded rankings across all active players
  const rankedActive = computeMixedRankings(activeEntries);
  rankedActive.sort((a, b) => a.rank - b.rank);

  // Sort inactive players below active players by cumulative Pt % descending
  inactiveEntries.forEach(p => {
    const maxPts = maxPtsPerWeek * p.weeksPlayed;
    p.maxPts = maxPts;
    p.pct = maxPts > 0 ? (p.cumScore / maxPts) * 100 : 0;
    p.cumPct = maxPts > 0 ? (p.cumScore / maxPts) : 0;
  });
  inactiveEntries.sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    if (b.cumScore !== a.cumScore) return b.cumScore - a.cumScore;
    return a.origIdx - b.origIdx;
  });

  const orderedEntries = [...rankedActive, ...inactiveEntries];
  orderedEntries.forEach(e => {
    if (e.row.length > scoreWidth) scoreWidth = e.row.length;
  });

  const padRow = (arr, fillVal) => {
    const copy = arr.slice();
    while (copy.length < scoreWidth) copy.push(fillVal);
    copy.length = scoreWidth;
    return copy;
  };

  const headerCells = padRow(headerRow, "");
  for (let c = 0; c < scoreWidth; c++) {
    if (formulas[0] && formulas[0][c] && String(formulas[0][c]).startsWith("=")) {
      headerCells[c] = formulas[0][c];
    }
  }

  const finalValues = [headerCells];
  const finalBackgrounds = [padRow(backgrounds[0] || [], "#ffffff")];

  orderedEntries.forEach((entry, idx) => {
    const oldSheetRow = entry.origIdx + 1;
    const newSheetRow = idx + 2;
    const mergedRow = padRow(entry.row, "");

    for (let c = 0; c < scoreWidth; c++) {
      const f = entry.formulas[c];
      if (f && String(f).startsWith("=")) {
        mergedRow[c] = adjustRowFormula(f, oldSheetRow, newSheetRow);
      }
    }

    finalValues.push(mergedRow);
    finalBackgrounds.push(padRow(entry.backgrounds, "#ffffff"));
  });

  sheet.clearContents();

  const textCols = [col.lastr, col.phone];
  for (let w = 0; w <= 10; w++) textCols.push(col["r" + w]);
  textCols.forEach(cIdx => {
    if (typeof cIdx === "number" && cIdx >= 0 && cIdx < scoreWidth) {
      sheet.getRange(1, cIdx + 1, finalValues.length, 1).setNumberFormat("@");
    }
  });

  const writeRange = sheet.getRange(1, 1, finalValues.length, scoreWidth);
  writeRange.setValues(finalValues);
  writeRange.setBackgrounds(finalBackgrounds);

  if (typeof CacheService !== "undefined") {
    try {
      CacheService.getScriptCache().remove("UNIFIED_ROSTER_CACHE_" + cleanGroup.toUpperCase());
    } catch (e) {}
  }

  return `✅ Sorted '${sheet.getName()}' using bounded rankings: ${rankedActive.length} active, ${inactiveEntries.length} inactive.`;
}




/**
 * Helper to update a long-term timestamp column on the master "Score <Group>" sheet.
 */
function updateScoreSheetTimestamp(groupName, targetPlayer, colHeaderName, timestamp) {
  const ss = getDb();
  let cleanGroup = String(groupName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  const scoreSheet = ss.getSheetByName("Score " + cleanGroup);
  if (!scoreSheet) return false;

  const data = scoreSheet.getDataRange().getValues();
  if (data.length < 2) return false;

  const cleanStr = str => String(str || "").replace(/[\u00A0\s]+/g, " ").trim().toLowerCase();
  const targetNorm = cleanStr(targetPlayer);
  const targetPhone = String(targetPlayer).replace(/\D/g, "");

  const headers = data[0].map(cleanStr);
  
  // Robust Header Column Resolution
  const firstIdx = headers.findIndex(h => /\bfirst\b/i.test(h));
  const lastIdx = headers.findIndex(h => /\blast\b/i.test(h));
  const fullNameIdx = headers.findIndex(h => /(full\s*name|^name$|player\s*name)/i.test(h) && !/first|last/i.test(h));
  const phoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));

  // Get or create timestamp column on the Score sheet
  const timeColIdx = getOrAddHeaderColumn(scoreSheet, 0, data[0], colHeaderName);
  const updateTime = timestamp || new Date();

  for (let r = 1; r < data.length; r++) {
    let fName = firstIdx !== -1 ? cleanStr(data[r][firstIdx]) : "";
    let lName = lastIdx !== -1 ? cleanStr(data[r][lastIdx]) : "";
    let pName = (fName || lName) ? `${fName} ${lName}`.trim() : (fullNameIdx !== -1 ? cleanStr(data[r][fullNameIdx]) : "");
    if (!pName) {
      const anyNameIdx = headers.findIndex(h => /name|player/i.test(h));
      if (anyNameIdx !== -1) pName = cleanStr(data[r][anyNameIdx]);
    }

    let pPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";

    const isNameMatch = targetNorm && pName && (
      pName === targetNorm || 
      pName.includes(targetNorm) || 
      targetNorm.includes(pName)
    );
    const isPhoneMatch = targetPhone.length >= 7 && pPhone.length >= 7 && pPhone.endsWith(targetPhone.slice(-7));

    if (isNameMatch || isPhoneMatch) {
      scoreSheet.getRange(r + 1, timeColIdx + 1).setValue(updateTime);
      return true;
    }
  }
  return false;
}

// --- 1. CHECK-IN FUNCTIONS ---

/**
 * Gatekeeper for individual check-in status toggles.
 * Handles payload unpacking, sheet updates, and cache synchronization.
 */
function toggleSingleCheckIn(sheetNameOrData, playerName, isCheckedIn) {
  let sheetName, targetPlayer, checkedState;
  
  if (typeof sheetNameOrData === 'object' && sheetNameOrData !== null) {
    sheetName = sheetNameOrData.sheet || sheetNameOrData.schedSheetName || sheetNameOrData.groupName || sheetNameOrData.group || sheetNameOrData.tab || "";
    targetPlayer = sheetNameOrData.targetPlayer || sheetNameOrData.playerName || sheetNameOrData.player || sheetNameOrData.name || sheetNameOrData;
    
    checkedState = sheetNameOrData.isCheckedIn !== undefined 
      ? sheetNameOrData.isCheckedIn 
      : (sheetNameOrData.checkedIn !== undefined ? sheetNameOrData.checkedIn : (sheetNameOrData.status !== undefined ? sheetNameOrData.status : true));
  } else {
    sheetName = sheetNameOrData;
    targetPlayer = playerName;
    checkedState = isCheckedIn !== undefined ? isCheckedIn : true;
  }

  const isCheckedInBool = (checkedState === true || checkedState === 'true' || checkedState === 1);
  const now = new Date();
  
  const result = updatePlayerCheckInInSheet(sheetName, targetPlayer, isCheckedInBool, now);

  if (result && result.success) {
    const cache = CacheService.getScriptCache();
    let cleanGroup = String(sheetName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim().toUpperCase();

    // 1. Invalidate Unified Roster Cache (Critical Fix)
    try {
      cache.remove("UNIFIED_ROSTER_CACHE_" + cleanGroup);
    } catch (e) {}

    // 2. Update Legacy CheckIn Cache if still in use
    if (typeof getCheckInCacheKey === 'function') {
      const cacheKey = getCheckInCacheKey(sheetName);
      try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
          let players = JSON.parse(cachedData);
          const cleanStr = str => String(str || "").replace(/[\u00A0\s]+/g, " ").trim().toLowerCase();
          const getDigits = val => String(val || "").replace(/\D/g, "");

          let targetName = "";
          let targetPhone = "";
          if (typeof targetPlayer === 'object' && targetPlayer !== null) {
            targetName = targetPlayer.name || `${targetPlayer.first || ''} ${targetPlayer.last || ''}`.trim();
            targetPhone = targetPlayer.phone || targetPlayer.cell || targetPlayer.mobile || "";
          } else {
            targetName = String(targetPlayer || "");
            targetPhone = targetName;
          }

          const targetNorm = cleanStr(targetName);
          const targetDigits = getDigits(targetPhone);

          players = players.map(p => {
            const pName = cleanStr(p.name || `${p.first || ''} ${p.last || ''}`);
            const pPhoneDigits = getDigits(p.phone);

            const nameMatch = targetNorm && pName === targetNorm;
            const phoneMatch = targetDigits.length >= 7 && pPhoneDigits.length >= 7 && pPhoneDigits.endsWith(targetDigits.slice(-7));

            if (nameMatch || phoneMatch) {
              p.checkedIn = isCheckedInBool;
              p.checked = isCheckedInBool;
              p.lastCheckIn = isCheckedInBool ? now.toISOString() : p.lastCheckIn;
            }
            return p;
          });
          cache.put(cacheKey, JSON.stringify(players), 600);
        }
      } catch (err) {
        cache.remove(cacheKey); 
      }
    }
  }

  return result;
}






function toggleUnifiedActiveStatus(payload) {
  return executeWithLock(function() {
    try {
      const group = payload.groupName || payload.group || "";
      const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim();
      const targetPhone = String(payload.phone || "").replace(/\D/g, "");
      const targetTail = targetPhone.length >= 7 ? targetPhone.slice(-7) : "";
      const rawTargetName = String(payload.playerName || payload.name || "").trim();
      const normOf = (s) => typeof normalizeName === "function" ? normalizeName(s) : String(s || "").trim().toLowerCase();
      const targetNorm = normOf(rawTargetName);

      const ss = getDb();
      const scoreSheet = ss.getSheetByName("Score " + cleanGroup);
      if (!scoreSheet) return { success: false, error: "Score sheet 'Score " + cleanGroup + "' not found." };

      const data = scoreSheet.getDataRange().getValues();
      if (data.length < 2) return { success: false, error: "Sheet has no player rows." };

      const headers = data[0].map(h => h.toString().toLowerCase().trim());
      let activeIdx = headers.findIndex(h => h === "status" || h === "active" || h.includes("active"));
      let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("cell"));
      let firstIdx = headers.findIndex(h => /\bfirst\b/i.test(h));
      let lastIdx = headers.findIndex(h => /\blast\b/i.test(h));
      let nameIdx = headers.findIndex(h => /(full\s*name|^name$|player\s*name|^player$)/i.test(h) && !/first|last/i.test(h));

      if (activeIdx === -1) return { success: false, error: "Status/Active column header not found." };

      const lastAvailabilityIdx = getOrAddHeaderColumn(scoreSheet, 0, data[0], "Last Availability Change");

      let matchedRow = -1;
      let phoneCandidateRows = [];

      for (let r = 1; r < data.length; r++) {
        let fName = firstIdx !== -1 ? String(data[r][firstIdx] || "").trim() : "";
        let lName = lastIdx !== -1 ? String(data[r][lastIdx] || "").trim() : "";
        let combinedName = (fName || lName) ? `${fName} ${lName}`.trim() : (nameIdx !== -1 ? String(data[r][nameIdx] || "").trim() : "");
        let rowNorm = normOf(combinedName);
        let rowPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";

        if (targetNorm && rowNorm && rowNorm === targetNorm) {
          matchedRow = r + 1;
          break;
        }
        if (targetTail && rowPhone.length >= 7 && rowPhone.endsWith(targetTail)) {
          phoneCandidateRows.push(r + 1);
        }
      }

      if (matchedRow === -1 && phoneCandidateRows.length === 1) {
        matchedRow = phoneCandidateRows[0];
      }

      if (matchedRow !== -1) {
        const cell = scoreSheet.getRange(matchedRow, activeIdx + 1);
        const currentStatus = String(cell.getValue() || "").trim().toUpperCase();
        const newStatus = (currentStatus === "ACTIVE") ? "INACTIVE" : "ACTIVE";

        cell.setValue(newStatus);
        cell.setBackground(newStatus === "ACTIVE" ? "#d4FF8a" : "#fff366");

        const now = new Date();
        scoreSheet.getRange(matchedRow, lastAvailabilityIdx + 1).setValue(now);

        SpreadsheetApp.flush();

        try {
          const cacheKeyRoster = "UNIFIED_ROSTER_CACHE_" + cleanGroup.toUpperCase();
          CacheService.getScriptCache().remove(cacheKeyRoster);

          if (typeof getCheckInCacheKey === 'function') {
            const cacheKeyCheckIn = getCheckInCacheKey("Sched " + cleanGroup);
            CacheService.getScriptCache().remove(cacheKeyCheckIn);
          }
        } catch (cacheErr) {
          Logger.log("Cache clear warning: " + cacheErr.message);
        }

        return {
          success: true,
          newStatus: newStatus,
          lastChange: now.toISOString()
        };
      }

      return { success: false, error: "Player not found by name (" + rawTargetName + ") or unique phone (" + targetPhone + ")." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}






/**
 * Searches across all groups using getUnifiedRoster() to benefit from CacheService.
 */
function findPlayerAcrossGroups(payload) {
  try {
    const rawPhone = typeof payload === 'object' ? (payload.phone || payload.targetPlayer) : payload;
    const cleanPhone = String(rawPhone || "").replace(/\D/g, "");
    
    if (!cleanPhone || cleanPhone.length < 7) {
      return { found: false, message: "Invalid phone number." };
    }

    const groupNames = getAllGroupNames();

    for (let i = 0; i < groupNames.length; i++) {
      const g = groupNames[i];
      
      // Pass forceRefresh: false to use cache, or true if debugging
      const rosterRes = getUnifiedRoster({ group: g, forceRefresh: false });

      if (rosterRes && rosterRes.success && Array.isArray(rosterRes.players)) {
        const matchedPlayer = rosterRes.players.find(p => {
          const pPhone = String(p.phone || "").replace(/\D/g, "");
          return pPhone && pPhone.length >= 7 && pPhone.endsWith(cleanPhone.slice(-7));
        });

        if (matchedPlayer) {
          const fullName = matchedPlayer.name || "";
          const nameParts = fullName.trim().split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          return {
            found: true,
            player: {
              firstName: firstName,
              lastName: lastName,
              fullName: fullName,
              phone: cleanPhone,
              email: matchedPlayer.email || "",
              foundInGroup: g
            }
          };
        }
      }
    }

    return { found: false };
  } catch (err) {
    return { found: false, error: err.toString() };
  }
}







/**
 * Searches the schedule sheet by Exact Full Name (First + Last) OR Phone,
 * and records check-in status with a timestamp (or clears it to "").
 */
/**
 * Searches the schedule sheet by Exact Full Name (First + Last) first,
 * falling back to unique 7-digit phone tail, and records check-in status
 * with a timestamp (or clears it to "").
 */
function updatePlayerCheckInInSheet(sheetName, targetPlayer, checkedState, timestamp) {
  logDebug("updatePlayerCheckInInSheet", "Updating check-in", { sheetName, targetPlayer, checkedState });
  if (!sheetName || !targetPlayer) return { success: false, message: "Missing parameter" };

  const ss = getDb();
  let cleanGroupName = String(sheetName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  let schedSheet = ss.getSheetByName("Sched " + cleanGroupName) || ss.getSheetByName(sheetName);

  if (!schedSheet) return { success: false, message: "Sheet not found: " + sheetName };

  const data = schedSheet.getDataRange().getValues();
  if (!data || data.length <= 1) return { success: false, message: "No data in sheet" };

  const cleanStr = str => String(str || "").replace(/[\u00A0\s]+/g, " ").trim().toLowerCase();
  const normOf = str => typeof normalizeName === "function" ? normalizeName(str) : cleanStr(str);

  const getDigits = val => {
    if (val === null || val === undefined) return "";
    if (typeof val === "number") return val.toFixed(0);
    return String(val).replace(/\D/g, "");
  };

  let headerRowIdx = 0;
  let nameIdx = -1;
  let phoneIdx = -1;
  let checkInIdx = -1;

  for (let r = 0; r < Math.min(data.length, 5); r++) {
    const rowHeaders = data[r].map(h => cleanStr(h).replace(/[\s\-_]/g, ""));
    const tempNameIdx = rowHeaders.findIndex(h => h.includes("player") || h.includes("name"));

    if (tempNameIdx !== -1) {
      headerRowIdx = r;
      nameIdx = tempNameIdx;
      phoneIdx = rowHeaders.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("cell"));
      checkInIdx = rowHeaders.findIndex(h => h.includes("checkin") || h.includes("status") || h === "x");
      break;
    }
  }

  if (nameIdx === -1) nameIdx = 0;
  if (checkInIdx === -1) checkInIdx = 2; // Default Col C
  if (phoneIdx === -1) phoneIdx = 12;   // Default Col M (index 12)

  let targetFullName = "";
  let targetPhone = "";

  if (typeof targetPlayer === "object" && targetPlayer !== null) {
    targetFullName = targetPlayer.name || `${targetPlayer.first || ""} ${targetPlayer.last || ""}`.trim();
    targetPhone = targetPlayer.phone || targetPlayer.cell || targetPlayer.mobile || "";
  } else {
    targetFullName = String(targetPlayer || "");
    targetPhone = targetFullName;
  }

  const targetNorm = normOf(targetFullName);
  const targetDigits = getDigits(targetPhone);
  const targetTail = targetDigits.length >= 7 ? targetDigits.slice(-7) : "";

  const updateTime = timestamp || new Date();
  let matchedRow = -1;
  let phoneCandidateRows = [];

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    let pName = normOf(data[r][nameIdx]);
    let pPhone = phoneIdx !== -1 && data[r][phoneIdx] ? getDigits(data[r][phoneIdx]) : "";

    if (!pName && !pPhone) continue;

    if (targetNorm && pName === targetNorm) {
      matchedRow = r + 1;
      break;
    }
    if (targetTail && pPhone.length >= 7 && pPhone.endsWith(targetTail)) {
      phoneCandidateRows.push(r + 1);
    }
  }

  if (matchedRow === -1 && phoneCandidateRows.length === 1) {
    matchedRow = phoneCandidateRows[0];
  }

  if (matchedRow === -1) {
    return { success: false, message: `Player '${targetFullName || targetPlayer}' not found on sheet` };
  }

  const checkInValue = checkedState ? updateTime : "";
  schedSheet.getRange(matchedRow, checkInIdx + 1).setValue(checkInValue);

  if (checkedState && typeof updateScoreSheetTimestamp === "function") {
    try {
      updateScoreSheetTimestamp(cleanGroupName, targetFullName || targetPlayer, "Last Check-In", updateTime);
    } catch (e) {
      logDebug("updatePlayerCheckInInSheet", "Warning: Failed to update Score Sheet timestamp", e.toString());
    }
  }

  return { success: true, message: "Updated check-in" };
}








/**
 * Unified function to get roster data with score sync and auto-register missing players.
 * Keeps Unknown court-filler placeholders in finalRoster for court lookups without adding them to Score sheets.
 */
function getUnifiedRoster(payload) {
  try {
    const payloadObj = payload || {};
    const group = payloadObj.group || payloadObj.groupName || payloadObj.sheet || "";
    const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim().toUpperCase();

    if (!cleanGroup) {
      return { success: false, registered: false, message: "No group specified.", players: [] };
    }

    const schedSheetName = "Sched " + cleanGroup;
    const scoreSheetName = "Score " + cleanGroup;

    const cacheKey = "UNIFIED_ROSTER_CACHE_" + cleanGroup;
    const cache = CacheService.getScriptCache();

    function cleanStr(val) {
      return String(val || '')
        .replace(/[\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function cleanScore(val) {
      if (val === "" || val === null || val === undefined) return "";
      const strVal = String(val).trim();
      if (strVal === "") return "";
      const num = Number(strVal);
      return isNaN(num) ? strVal : num;
    }

    function splitName(fullName) {
      const cleaned = cleanStr(fullName);
      if (cleaned.includes(",")) {
        const parts = cleaned.split(",");
        return { first: parts[1] ? parts[1].trim() : "", last: parts[0] ? parts[0].trim() : "" };
      }
      const parts = cleaned.split(/\s+/);
      if (parts.length === 1) return { first: parts[0], last: "" };
      const last = parts.pop();
      const first = parts.join(" ");
      return { first, last };
    }

    const getNormFull = (n) => typeof normalizeName === "function" ? normalizeName(n) : cleanStr(n).toLowerCase();

    if (!payloadObj.forceRefresh && !payloadObj.autoSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
            return Object.assign({}, parsed, { source: "cache" });
          }
        } catch (e) {}
      }
    }

    const ss = getDb();
    const schedSheet = ss.getSheetByName(schedSheetName);
    const scoreSheet = ss.getSheetByName(scoreSheetName);

    if (!schedSheet && !scoreSheet) {
      return {
        success: false,
        registered: false,
        message: "Neither " + scoreSheetName + " nor " + schedSheetName + " was found.",
        players: []
      };
    }

    const scorePlayers = [];
    const seenScoreNames = new Set();
    const scoreUpdates = []; 
    const schedUpdates = []; 

    let scoreHeaders = [];
    let scoreFirstIdx = -1;
    let scoreLastIdx = -1;
    let scoreFullNameIdx = -1;
    let scorePhoneIdx = -1;
    let scoreActiveIdx = -1;
    let scoreEmailIdx = -1;
    let scorePtsIdx = 4; 

    if (scoreSheet) {
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 0) {
        scoreHeaders = scoreData[0].map(h => cleanStr(h).toLowerCase());

        scoreFirstIdx = scoreHeaders.findIndex(h => /\bfirst\b/i.test(h));
        scoreLastIdx = scoreHeaders.findIndex(h => /\blast\b/i.test(h));
        scoreFullNameIdx = scoreHeaders.findIndex(h => /(full\s*name|^name$|^player$|player\s*name)/i.test(h) && !/first|last/i.test(h));
        scorePhoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        scoreActiveIdx = scoreHeaders.findIndex(h => /status|active/i.test(h));
        scoreEmailIdx = scoreHeaders.findIndex(h => /email|mail/i.test(h));

        const foundPtsIdx = scoreHeaders.findIndex(h => /^pts$|^points$|^total$/i.test(h));
        if (foundPtsIdx !== -1) scorePtsIdx = foundPtsIdx;

        for (let r = 1; r < scoreData.length; r++) {
          let fName = scoreFirstIdx !== -1 ? cleanStr(scoreData[r][scoreFirstIdx]) : "";
          let lName = scoreLastIdx !== -1 ? cleanStr(scoreData[r][scoreLastIdx]) : "";
          let pName = "";

          if (fName || lName) {
            pName = `${fName} ${lName}`.trim();
          }
          if (!pName && scoreFullNameIdx !== -1) {
            pName = cleanStr(scoreData[r][scoreFullNameIdx]);
          }
          if (!pName) {
            const anyNameIdx = scoreHeaders.findIndex(h => /name|player/i.test(h));
            if (anyNameIdx !== -1) pName = cleanStr(scoreData[r][anyNameIdx]);
          }

          if (!pName) continue;

          const normFull = getNormFull(pName);
          if (normFull && seenScoreNames.has(normFull)) {
            continue;
          }
          if (normFull) seenScoreNames.add(normFull);

          const cleanPhone = scorePhoneIdx !== -1 ? cleanStr(scoreData[r][scorePhoneIdx]).replace(/\D/g, "") : "";
          const cleanEmail = scoreEmailIdx !== -1 ? cleanStr(scoreData[r][scoreEmailIdx]) : "";

          let isActive = true;
          if (scoreActiveIdx !== -1) {
            const rawStatus = cleanStr(scoreData[r][scoreActiveIdx]).toUpperCase();
            isActive = (rawStatus !== "INACTIVE" && rawStatus !== "FALSE");
          }

          scorePlayers.push({
            rawName: pName,
            normFull: normFull,
            phone: cleanPhone,
            email: cleanEmail,
            active: isActive,
            score: cleanScore(scoreData[r][scorePtsIdx]),
            scoreRow: r + 1,
            used: false
          });
        }
      }
    }

    const finalRoster = [];
    const seenFinalNames = new Set();
    let syncedCount = 0;
    const newScoreRowsToAppend = [];
    const queuedNewNames = new Set();

    if (schedSheet) {
      const schedData = schedSheet.getDataRange().getValues();
      if (schedData.length > 1) {
        const headers = schedData[0].map(h => cleanStr(h).toLowerCase());

        const matchedNameIdx = headers.findIndex(h => /name|player/i.test(h));
        const nameIdx = matchedNameIdx !== -1 ? matchedNameIdx : (schedData[0].length > 1 ? 1 : 0);
        const schedPhoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        let checkIdx = headers.findIndex(h => /check|checked|x/i.test(h));
        const courtIdx = headers.findIndex(h => /court/i.test(h));

        let totalIdx = headers.findIndex(h => /^total$|^pts$|^score$/i.test(h));
        if (totalIdx === -1) totalIdx = 9;

        let hasAnyCourtAssigned = false;
        if (courtIdx !== -1) {
          for (let r = 1; r < schedData.length; r++) {
            const pName = cleanStr(schedData[r][nameIdx]);
            if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;
            if (cleanStr(schedData[r][courtIdx]) !== "") {
              hasAnyCourtAssigned = true;
              break;
            }
          }
        }

        const fallbackCourt = hasAnyCourtAssigned ? "BYE" : "NoSchedYet";

        for (let r = 1; r < schedData.length; r++) {
          const pName = cleanStr(schedData[r][nameIdx]);
          if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;

          const normFull = getNormFull(pName);
          const rawCourt = courtIdx !== -1 ? cleanStr(schedData[r][courtIdx]) : "";
          const courtVal = rawCourt || fallbackCourt;

          // Keep temporary Unknown players in finalRoster for court lookups, but never add to Score sheet
          if (isUnknownPlayerName(pName)) {
            if (normFull && seenFinalNames.has(normFull)) continue;
            if (normFull) seenFinalNames.add(normFull);
            finalRoster.push({
              name: pName,
              phone: "",
              email: "",
              active: false,
              isUnknown: true,
              checkedIn: false,
              timestamp: null,
              court: courtVal,
              score: ""
            });
            continue;
          }

          const schedRow = r + 1;
          const schedPhone = schedPhoneIdx !== -1 ? cleanStr(schedData[r][schedPhoneIdx]).replace(/\D/g, "") : "";
          const schedPhoneTail = schedPhone.length >= 7 ? schedPhone.slice(-7) : "";

          let rawCheck = checkIdx !== -1 ? schedData[r][checkIdx] : false;
          let isCheckedIn = (typeof isCheckInTrue === 'function')
            ? isCheckInTrue(rawCheck)
            : (rawCheck !== null && rawCheck !== undefined && String(rawCheck).trim() !== "");

          const schedScore = cleanScore(schedData[r][totalIdx]);

          // Match by normalized full name first; fall back to phone tail only if unique among unused Score players
          let match = scorePlayers.find(sp => sp.normFull === normFull);
          if (!match && schedPhoneTail) {
            const phoneMatches = scorePlayers.filter(sp => !sp.used && sp.phone && sp.phone.length >= 7 && sp.phone.endsWith(schedPhoneTail));
            if (phoneMatches.length === 1) match = phoneMatches[0];
          }

          if (match) {
            if (match.used) continue;
            match.used = true;
            let finalScore = "";

            if (schedScore !== "" && match.score === "") {
              finalScore = schedScore;
              if (scoreSheet) {
                scoreUpdates.push({ row: match.scoreRow, col: scorePtsIdx + 1, val: schedScore });
              }
            } else if (schedScore === "" && match.score !== "") {
              finalScore = match.score;
              schedUpdates.push({ row: schedRow, col: totalIdx + 1, val: match.score });
            } else if (schedScore !== "") {
              finalScore = schedScore;
            } else {
              finalScore = "";
            }

            if (normFull) seenFinalNames.add(normFull);
            finalRoster.push({
              name: pName,
              phone: schedPhone || match.phone,
              email: match.email,
              active: match.active,
              checkedIn: isCheckedIn,
              timestamp: isCheckedIn ? rawCheck : null,
              court: courtVal,
              score: finalScore
            });
          } else {
            if (normFull && seenFinalNames.has(normFull)) continue;
            if (normFull) seenFinalNames.add(normFull);

            finalRoster.push({
              name: pName,
              phone: schedPhone,
              email: "",
              active: true,
              checkedIn: isCheckedIn,
              timestamp: isCheckedIn ? rawCheck : null,
              court: courtVal,
              score: schedScore
            });

            const alreadyQueued = normFull && (seenScoreNames.has(normFull) || queuedNewNames.has(normFull));

            if (scoreSheet && !alreadyQueued) {
              if (normFull) queuedNewNames.add(normFull);

              const numCols = Math.max(scoreSheet.getLastColumn(), scoreHeaders.length, 5);
              const newRow = new Array(numCols).fill("");
              const nameParts = splitName(pName);

              if (scoreFirstIdx !== -1) newRow[scoreFirstIdx] = nameParts.first;
              if (scoreLastIdx !== -1) newRow[scoreLastIdx] = nameParts.last;
              if (scoreFullNameIdx !== -1) newRow[scoreFullNameIdx] = pName;
              if (scoreFirstIdx === -1 && scoreLastIdx === -1 && scoreFullNameIdx === -1) newRow[0] = pName;

              if (scorePhoneIdx !== -1) newRow[scorePhoneIdx] = schedPhone;
              if (scoreActiveIdx !== -1) newRow[scoreActiveIdx] = "ACTIVE";
              newRow[scorePtsIdx] = schedScore;

              newScoreRowsToAppend.push(newRow);
              syncedCount++;
            }
          }
        }
      }
    }

    if (scoreUpdates.length > 0 || schedUpdates.length > 0 || newScoreRowsToAppend.length > 0) {
      executeWithLock(function () {
        scoreUpdates.forEach(u => scoreSheet.getRange(u.row, u.col).setValue(u.val));
        schedUpdates.forEach(u => schedSheet.getRange(u.row, u.col).setValue(u.val));

        if (scoreSheet && newScoreRowsToAppend.length > 0) {
          const latestData = scoreSheet.getDataRange().getValues();
          const latestNames = new Set();
          for (let r = 1; r < latestData.length; r++) {
            const f = scoreFirstIdx !== -1 ? cleanStr(latestData[r][scoreFirstIdx]) : "";
            const l = scoreLastIdx !== -1 ? cleanStr(latestData[r][scoreLastIdx]) : "";
            const nm = (f || l) ? `${f} ${l}`.trim() : (scoreFullNameIdx !== -1 ? cleanStr(latestData[r][scoreFullNameIdx]) : "");
            if (nm) latestNames.add(getNormFull(nm));
          }

          const verifiedRows = newScoreRowsToAppend.filter(row => {
            const f = scoreFirstIdx !== -1 ? cleanStr(row[scoreFirstIdx]) : "";
            const l = scoreLastIdx !== -1 ? cleanStr(row[scoreLastIdx]) : "";
            const nm = (f || l) ? `${f} ${l}`.trim() : (scoreFullNameIdx !== -1 ? cleanStr(row[scoreFullNameIdx]) : cleanStr(row[0]));
            const norm = getNormFull(nm);
            if (norm && latestNames.has(norm)) return false;
            if (norm) latestNames.add(norm);
            return true;
          });

          if (verifiedRows.length > 0) {
            const startRow = scoreSheet.getLastRow() + 1;
            scoreSheet.getRange(startRow, 1, verifiedRows.length, verifiedRows[0].length).setValues(verifiedRows);
          }
        }
      });
    }

    const fallbackCourtForUnassigned = (schedSheet && finalRoster.some(p => p.court && p.court !== "BYE" && p.court !== "NoSchedYet")) 
      ? "BYE" 
      : "NoSchedYet";

    scorePlayers.forEach(sp => {
      if (!sp.used && !(sp.normFull && seenFinalNames.has(sp.normFull))) {
        if (sp.normFull) seenFinalNames.add(sp.normFull);
        finalRoster.push({
          name: sp.rawName,
          phone: sp.phone,
          email: sp.email,
          active: sp.active,
          checkedIn: false,
          timestamp: null,
          court: fallbackCourtForUnassigned,
          score: sp.score
        });
      }
    });

    const response = {
      success: true,
      registered: true,
      players: finalRoster,
      syncedCount: syncedCount,
      source: "live"
    };

    const payloadString = JSON.stringify(response);
    if (payloadString.length < 100000) {
      cache.put(cacheKey, payloadString, 21600);
    }

    return response;

  } catch (err) {
    return { success: false, error: err.toString(), players: [] };
  }
}



/**
 * Saves bulk check-ins on the Sched sheet.
 * Any non-blank cell value is treated as checked in.
 * Writes timestamp for checked-in players; clears to "" when unchecked.
 */
function saveCheckIns(schedSheetName, checkedPlayerNames) {
  logDebug("saveCheckIns", "Saving check-ins for sheet", { schedSheetName, checkedPlayerNames });
  if (!schedSheetName) return "⚠️ Error: No target sheet specified.";

  const ss = getDb();
  let cleanGroupName = String(schedSheetName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  let sheet = ss.getSheetByName("Sched " + cleanGroupName);
  if (!sheet) return `⚠️ Error: Sheet 'Sched ${cleanGroupName}' not found.`;

  const data = sheet.getDataRange().getValues();
  const namesArray = Array.isArray(checkedPlayerNames) 
    ? checkedPlayerNames 
    : JSON.parse(checkedPlayerNames || "[]");

  const cleanStr = str => String(str || "").replace(/[\u00A0\s]+/g, " ").trim().toLowerCase();
  const checkedSet = new Set(namesArray.map(n => cleanStr(n)));

  let headers = data[0].map(h => cleanStr(h));
  let checkInIdx = headers.findIndex(h => h.includes("check") || h === "x" || h.includes("status"));
  let targetCol = checkInIdx !== -1 ? checkInIdx + 1 : 3; // Default Col C

  const now = new Date();
  let updatedCount = 0;

  for (let i = 1; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (name && !name.startsWith("---") && !name.startsWith("Time:") && !name.startsWith("SCHEDULE_WEEK")) {
      let isChecked = checkedSet.has(cleanStr(name));
      let currentVal = data[i][checkInIdx];
      let isCurrentlyChecked = currentVal !== null && currentVal !== undefined && String(currentVal).trim() !== "";

      if (isChecked) {
        let checkInVal = isCurrentlyChecked ? currentVal : now;
        sheet.getRange(i + 1, targetCol).setValue(checkInVal);
        updatedCount++;
        
        if (typeof updateScoreSheetTimestamp === 'function') {
          updateScoreSheetTimestamp(cleanGroupName, name, "Last Check-In", now);
        }
      } else {
        sheet.getRange(i + 1, targetCol).setValue("");
      }
    }
  }


    if (typeof CacheService !== 'undefined') {
        try {
            const cache = CacheService.getScriptCache();
            const keysToClear = ["UNIFIED_ROSTER_CACHE_" + cleanGroupName.toUpperCase()];
            if (typeof getCheckInCacheKey === 'function') {
                keysToClear.push(getCheckInCacheKey(schedSheetName));
            }
            cache.removeAll(keysToClear);
        } catch (e) {}
    }
    

  return `✅ Check-ins saved successfully (${updatedCount} checked in)!`;
}

/**
 * Menu action to clear schedule data.
 * Displays a popup modal with dynamic group options to eliminate tab guessing.
 */
function manuallyResetCourtsAndCheckIns() {
  const ss = (typeof getDb === "function") ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Automatically discover available schedule groups in this spreadsheet
  let groups = [];
  if (typeof getActiveScheduleTabs === 'function') {
    groups = getActiveScheduleTabs().map(t => t.replace(/^Sched\s*/i, "").trim());
  } else {
    const schedSheets = ss.getSheets().filter(s => s.getName().startsWith("Sched "));
    groups = schedSheets.map(s => s.getName().replace(/^Sched\s*/i, "").trim());
  }

  if (groups.length === 0) {
    SpreadsheetApp.getUi().alert("⚠️ No schedule sheets found (e.g. 'Sched Women') in this spreadsheet.");
    return;
  }

  // 2. Build Modal Options HTML
  let optionsHtml = groups.map(g => `<option value="${g}">${g}</option>`).join("");

  let htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: Arial, sans-serif; padding: 15px; background: #ffffff; color: #333; margin: 0; }
          label { font-weight: bold; font-size: 13px; margin-bottom: 8px; display: block; color: #444; }
          select { width: 100%; padding: 8px 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 20px; box-sizing: border-box; }
          .btn-container { text-align: right; margin-top: 10px; }
          button { padding: 8px 16px; font-size: 13px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; }
          .btn-cancel { background: #e0e0e0; color: #333; margin-right: 8px; }
          .btn-clear { background: #d9534f; color: white; }
          .btn-clear:hover { background: #c9302c; }
          #status { font-size: 12px; color: #666; margin-top: 8px; text-align: center; display: none; }
        </style>
      </head>
      <body>
        <label for="groupSelect">Select Schedule Group to Clear:</label>
        <select id="groupSelect">
          ${optionsHtml}
          <option value="ALL">-- CLEAR ALL GROUPS --</option>
        </select>

        <div class="btn-container">
          <button class="btn-cancel" onclick="google.script.host.close()">Cancel</button>
          <button id="clearBtn" class="btn-clear" onclick="runClear()">Clear Schedule</button>
        </div>

        <div id="status">Clearing schedule data, please wait...</div>

        <script>
          function runClear() {
            const selected = document.getElementById('groupSelect').value;
            document.getElementById('clearBtn').disabled = true;
            document.getElementById('status').style.display = 'block';

            google.script.run
              .withSuccessHandler(function(res) {
                alert((res && res.message) ? res.message : "Schedule cleared successfully.");
                google.script.host.close();
              })
              .withFailureHandler(function(err) {
                alert("Error: " + err.message);
                document.getElementById('clearBtn').disabled = false;
                document.getElementById('status').style.display = 'none';
              })
              .runMenuClearSchedule(selected);
          }
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(360)
    .setHeight(180);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Clear Schedule Data");
}

/**
 * Backend target function called by the modal selection dialog.
 */
function runMenuClearSchedule(groupSelection) {
  if (groupSelection === "ALL") {
    // Pass boolean true to clear all schedule tabs
    return resetCheckInsAndSchedData(true);
  } else {
    // Pass explicit payload object for the selected group
    return resetCheckInsAndSchedData({
      group: groupSelection,
      sheet: groupSelection,
      schedSheetName: "Sched " + groupSelection
    });
  }
}




/**
 * Synchronizes 'Sched [Group]' against 'Score [Group]':
 * 1. PRUNES rows on Sched sheet for players who were DELETED or marked INACTIVE/QUIT on Score sheet (and temporary Unknown placeholders).
 * 2. SYNCS valid players from Score sheet who are missing from Sched sheet.
 */
function syncScoreSheetPlayersToSched(ss, cleanGroup, schedSheet) {
  try {
    if (!ss || !cleanGroup || !schedSheet) return { addedCount: 0, prunedCount: 0 };

    const scoreSheetName = "Score " + cleanGroup;
    const scoreSheet = ss.getSheetByName(scoreSheetName);
    if (!scoreSheet) return { addedCount: 0, prunedCount: 0 };

    const scoreData = scoreSheet.getDataRange().getValues();
    if (scoreData.length <= 1) return { addedCount: 0, prunedCount: 0 };

    const scoreHeaders = scoreData[0].map(h => String(h || '').trim().toLowerCase());

    let firstIdx = scoreHeaders.findIndex(h => /first|fname|f_name/i.test(h));
    let lastIdx = scoreHeaders.findIndex(h => /last|lname|l_name/i.test(h));
    let singleNameIdx = scoreHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
    let statusIdx = scoreHeaders.findIndex(h => /status|active|state/i.test(h));

    const isSeparateFirstLast = (firstIdx !== -1 && lastIdx !== -1);
    const normOf = (str) => typeof normalizeName === "function"
      ? normalizeName(str)
      : String(str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    const validScoreRosterSet = new Set();
    const validScoreRosterList = [];

    for (let r = 1; r < scoreData.length; r++) {
      const row = scoreData[r];
      const statusVal = statusIdx !== -1 ? String(row[statusIdx] || '').toUpperCase().trim() : "ACTIVE";

      if (/QUIT|DROPPED|REMOVED|INACTIVE/i.test(statusVal)) continue;

      let fullName = "";
      if (isSeparateFirstLast) {
        const first = String(row[firstIdx] || '').trim();
        const last = String(row[lastIdx] || '').trim();
        if (first || last) fullName = `${first} ${last}`.replace(/\s+/g, ' ').trim();
      } else if (singleNameIdx !== -1) {
        fullName = String(row[singleNameIdx] || '').replace(/\s+/g, ' ').trim();
      }

      if (!fullName || /^total|^summary|^average|^rank|^court/i.test(fullName)) continue;

      const normKey = normOf(fullName);
      if (normKey && !validScoreRosterSet.has(normKey)) {
        validScoreRosterSet.add(normKey);
        validScoreRosterList.push(fullName);
      }
    }

    const schedData = schedSheet.getDataRange().getValues();
    if (schedData.length <= 1) return { addedCount: 0, prunedCount: 0 };

    const schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
    let schedNameIdx = schedHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
    if (schedNameIdx === -1) schedNameIdx = 0;

    let checkInIdx = schedHeaders.findIndex(h => /check|x/i.test(h));
    let gameIndices = [];
    schedHeaders.forEach((h, idx) => {
      if (/^game\s*[1-6]$|^total$/i.test(h)) gameIndices.push(idx);
    });

    const existingSchedNames = new Set();
    let rowsToKeep = [schedData[0]];
    let prunedCount = 0;

      for (let r = 1; r < schedData.length; r++) {
          const row = schedData[r];
          const pName = String(row[schedNameIdx] || '').trim();
          const normKey = normOf(pName);
          
          if (!pName) continue;
          if (isUnknownPlayerName(pName)) {
              prunedCount++;
              continue;
          }
          
          const hasCheckIn = checkInIdx !== -1 && String(row[checkInIdx] || '').trim() !== "";
          const hasScores = gameIndices.some(idx => String(row[idx] || '').trim() !== "");
          const hasActivity = hasCheckIn || hasScores;

          if (!existingSchedNames.has(normKey) && (validScoreRosterSet.has(normKey) || hasActivity)) {
              existingSchedNames.add(normKey);
              rowsToKeep.push(row);
          } else {
              prunedCount++;
              Logger.log(`✂️ Pruned deleted/duplicate player '${pName}' from '${schedSheet.getName()}'.`);
          }
      }
      


    if (prunedCount > 0) {
      let targetWidth = rowsToKeep[0].length;
      rowsToKeep.forEach(r => {
        while (r.length < targetWidth) r.push("");
        r.length = targetWidth;
      });
      schedSheet.clearContents();
      schedSheet.getRange(1, 1, rowsToKeep.length, targetWidth).setValues(rowsToKeep);
    }

    const missingPlayers = [];
    validScoreRosterList.forEach(name => {
      const key = normOf(name);
      if (key && !existingSchedNames.has(key)) {
        existingSchedNames.add(key);
        missingPlayers.push(name);
      }
    });

    if (missingPlayers.length > 0) {
      const numCols = Math.max(schedSheet.getLastColumn(), 8);
      const newRows = missingPlayers.map(pName => {
        const row = new Array(numCols).fill("");
        row[schedNameIdx] = pName;
        return row;
      });

      const startRow = schedSheet.getLastRow() + 1;
      schedSheet.getRange(startRow, 1, newRows.length, numCols).setValues(newRows);
    }

    Logger.log(`✅ Sync Complete for '${cleanGroup}': ${missingPlayers.length} added, ${prunedCount} pruned.`);
    return { addedCount: missingPlayers.length, prunedCount: prunedCount };

  } catch (err) {
    Logger.log(`❌ Error in syncScoreSheetPlayersToSched: ${err.message}`);
    return { addedCount: 0, prunedCount: 0 };
  }
}



/**
 * Processes check-in strictly isolated to 'Score [cleanGroup]'.
 * Rejects check-in if player is not explicitly on Score [cleanGroup].
 */
function ensurePlayerCheckedIn(cleanGroup, playerTarget) {
  return executeWithLock(function () {
    try {
      const ss = getDb();
      const schedSheetName = "Sched " + cleanGroup;
      const scoreSheetName = "Score " + cleanGroup;

      const schedSheet = ss.getSheetByName(schedSheetName);
      if (!schedSheet) {
        return { status: "failed", success: false, message: `Schedule sheet '${schedSheetName}' not found.` };
      }

      const cleanTarget = String(playerTarget || "").trim();
      if (!cleanTarget) {
        return { status: "failed", success: false, message: "No player name or phone provided." };
      }

      const targetDigits = cleanTarget.replace(/\D/g, "");
      const normOf = (str) => typeof normalizeName === "function"
        ? normalizeName(str)
        : String(str || "").toLowerCase().replace(/\s+/g, " ").trim();
      const targetNormName = normOf(cleanTarget);

      function invalidateCheckInCaches() {
        if (typeof CacheService !== 'undefined') {
          try {
            const cache = CacheService.getScriptCache();
            const checkInKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(schedSheetName) : null;
            if (checkInKey) cache.remove(checkInKey);
            cache.remove("UNIFIED_ROSTER_CACHE_" + String(cleanGroup).toUpperCase());
          } catch (e) {}
        }
      }

      // 1. STRICT ROSTER VERIFICATION (Score [cleanGroup] ONLY)
      const scoreSheet = ss.getSheetByName(scoreSheetName);
      if (!scoreSheet) {
        return { status: "failed", success: false, message: `Score sheet '${scoreSheetName}' not found.` };
      }

      const scoreData = scoreSheet.getDataRange().getValues();
      let isRosterMember = false;
      let matchedOfficialName = "";
      let matchedOfficialPhone = "";

      if (scoreData.length > 1) {
        const scoreHeaders = scoreData[0].map(h => String(h || '').trim().toLowerCase());

        let firstIdx = scoreHeaders.findIndex(h => /first|fname|f_name/i.test(h));
        let lastIdx = scoreHeaders.findIndex(h => /last|lname|l_name/i.test(h));
        let singleNameIdx = scoreHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
        let phoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        let statusIdx = scoreHeaders.findIndex(h => /status|active|state/i.test(h));

        for (let r = 1; r < scoreData.length; r++) {
          const row = scoreData[r];
          const statusVal = statusIdx !== -1 ? String(row[statusIdx] || '').toUpperCase().trim() : "ACTIVE";

          if (/QUIT|DROPPED|REMOVED|INACTIVE/i.test(statusVal)) continue;

          let rowFirst = firstIdx !== -1 ? String(row[firstIdx] || '').trim() : '';
          let rowLast = lastIdx !== -1 ? String(row[lastIdx] || '').trim() : '';
          let rowFullName = (rowFirst || rowLast) ? `${rowFirst} ${rowLast}`.trim() : (singleNameIdx !== -1 ? String(row[singleNameIdx] || '').trim() : '');

          if (!rowFullName || /^total|^summary|^average|^rank/i.test(rowFullName)) continue;

          let rowPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').replace(/\D/g, '') : '';

          let isPhoneMatch = targetDigits.length >= 7 && rowPhone.length >= 7 && rowPhone.endsWith(targetDigits.slice(-7));
          let isNameMatch = targetNormName && normOf(rowFullName) === targetNormName;

          if (isNameMatch || isPhoneMatch) {
            isRosterMember = true;
            matchedOfficialName = rowFullName;
            matchedOfficialPhone = rowPhone;
            if (isNameMatch) break; // Prefer exact name match over shared-phone fallback
          }
        }
      }

      if (!isRosterMember) {
        Logger.log(`⛔ Check-in rejected for '${cleanTarget}': Not on '${scoreSheetName}'.`);
        return {
          status: "not_found",
          success: false,
          message: `⚠️ Player '${cleanTarget}' is not on the roster for '${cleanGroup}'. If you quit or switched ladders, please contact an administrator.`
        };
      }

      // 2. CHECK-IN ON SCHED SHEET (MATCH BY NORMALIZED NAME FIRST TO PROTECT SHARED PHONES)
      const timeStamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "America/Phoenix", "HH:mm:ss");
      const schedData = schedSheet.getDataRange().getValues();
      const officialNorm = normOf(matchedOfficialName);
      const officialPhoneTail = matchedOfficialPhone.length >= 7 ? matchedOfficialPhone.slice(-7) : "";

      if (schedData.length > 1) {
        const schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
        let nameIdx = schedHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
        if (nameIdx === -1) nameIdx = 0;

        let phoneIdx = schedHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        let checkInIdx = schedHeaders.findIndex(h => /check|x/i.test(h));
        if (checkInIdx === -1) checkInIdx = 2;

        let matchedSchedRow = -1;
        let phoneCandidateRows = [];

        for (let r = 1; r < schedData.length; r++) {
          const cellName = String(schedData[r][nameIdx] || '').trim();
          const cellPhone = phoneIdx !== -1 ? String(schedData[r][phoneIdx] || '').replace(/\D/g, '') : "";

          if (cellName && normOf(cellName) === officialNorm) {
            matchedSchedRow = r + 1;
            break;
          }
          if (officialPhoneTail && cellPhone.length >= 7 && cellPhone.endsWith(officialPhoneTail)) {
            phoneCandidateRows.push(r + 1);
          }
        }

        if (matchedSchedRow === -1 && phoneCandidateRows.length === 1) {
          matchedSchedRow = phoneCandidateRows[0];
        }

        if (matchedSchedRow !== -1) {
          schedSheet.getRange(matchedSchedRow, checkInIdx + 1).setValue(timeStamp);
          invalidateCheckInCaches();

          return {
            status: "success",
            success: true,
            message: `✅ ${matchedOfficialName} checked in successfully at ${timeStamp}.`
          };
        }
      }

      // 3. ROSTER MEMBER IS MISSING FROM SCHED -> APPEND ONCE & MARK CHECKED-IN
      const numCols = Math.max(schedSheet.getLastColumn(), 13);
      const newRow = new Array(numCols).fill("");

      newRow[0] = matchedOfficialName;
      newRow[1] = "";
      newRow[2] = timeStamp;
      if (matchedOfficialPhone) newRow[12] = matchedOfficialPhone;

      schedSheet.appendRow(newRow);
      invalidateCheckInCaches();

      return {
        status: "success",
        success: true,
        message: `✅ ${matchedOfficialName} added to schedule and checked in at ${timeStamp}.`
      };

    } catch (err) {
      Logger.log(`❌ Error in ensurePlayerCheckedIn: ${err.message}`);
      return { status: "error", success: false, message: "Check-in failed: " + err.message };
    }
  });
}











/**
 * Processes a player check-in request from the PWA.
 */
function handleCheckInPlayer(payload) {
  try {
    const groupName = payload.group || payload.sheet || payload.schedSheetName || "";
    const cleanGroup = String(groupName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    
    const ss = getDb();
    const schedSheet = ss.getSheetByName("Sched " + cleanGroup);

    if (!schedSheet) {
      return {
        status: "failed",
        success: false,
        message: "Schedule sheet not found for " + cleanGroup
      };
    }

    // 1. Check if schedule week is published
    let sheetWeekVal = (typeof getWeekNumber === "function") ? getWeekNumber(schedSheet) : schedSheet.getRange("N2").getValue();
    let sheetWeekNum = sheetWeekVal ? String(sheetWeekVal).replace(/\D/g, "") : "";

    let activeWeekVal = (typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : null;
    let activeWeekNum = activeWeekVal ? String(activeWeekVal).replace(/\D/g, "") : "";

    let isWeekFinalized = Boolean(sheetWeekNum) && Boolean(activeWeekNum) && (sheetWeekNum === activeWeekNum);

    if (!isWeekFinalized) {
      return {
        status: "not_finalized",
        success: false,
        message: "⏳ Schedule for this week is not yet finalized. Check-in will open once published."
      };
    }

    // 2. Validate player identifier parameter
    const playerTarget = payload.playerName || payload.name || payload.phone || payload.playerId || "";
    if (!playerTarget) {
      return {
        status: "failed",
        success: false,
        message: "Missing required parameter: player name or phone number."
      };
    }

    return ensurePlayerCheckedIn(cleanGroup, playerTarget);

  } catch (err) {
    return {
      status: "failed",
      success: false,
      message: err.toString()
    };
  }
}

/**
 * Reorders the Sched sheet to match new rankings while preserving scores,
 * courts, check-ins, and submitter info strictly coupled to each player.
 * Drops temporary Unknown court-filler placeholders.
 */
function rebuildSchedSheetOrder(ss, cleanGroupName, activePlayers, inactivePlayers, prevWeekNum) {
  let schedSheet = ss.getSheetByName("Sched " + cleanGroupName);
  if (!schedSheet) return;
  
  let schedData = schedSheet.getDataRange().getValues();
  if (schedData.length <= 1) return;
  
  const SCHED_COLS = 13; // Columns A through M
  let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered", "W", "Phone"];

  let nameIdx  = 0;
  let phoneIdx = 12; // Col M

  let schedRows = [];
  for (let r = 1; r < schedData.length; r++) {
    let row = schedData[r];
    let rawName = String(row[nameIdx] || "").trim();
    if (!rawName || rawName.startsWith("---") || rawName.toLowerCase().startsWith("time:") || rawName.startsWith("SCHEDULE_WEEK") || isUnknownPlayerName(rawName)) {
      continue;
    }

    let phoneDigits = typeof cleanPhoneDigits === 'function' ? cleanPhoneDigits(row[phoneIdx]) : String(row[phoneIdx] || "").replace(/\D/g, "");
    let normName = typeof normalizeName === 'function' ? normalizeName(rawName) : rawName.toLowerCase().trim();

    schedRows.push({
      rawRow: row.slice(0, SCHED_COLS),
      rawName: rawName,
      normName: normName,
      phoneDigits: phoneDigits,
      used: false
    });
  }
  const writtenNames = new Set();

  function findMatchingRow(p) {
    let pNorm = typeof normalizeName === 'function' ? normalizeName(p.name) : String(p.name || '').toLowerCase().trim();
    let pFirstNorm = typeof normalizeName === 'function' ? normalizeName(p.firstName) : String(p.firstName || '').toLowerCase().trim();
    let pLastNorm = typeof normalizeName === 'function' ? normalizeName(p.lastName) : String(p.lastName || '').toLowerCase().trim();
    let pPhone = typeof cleanPhoneDigits === 'function' ? cleanPhoneDigits(p.phone) : String(p.phone || "").replace(/\D/g, "");

    if (pNorm && writtenNames.has(pNorm)) return null;

    let match = null;
    if (pNorm) {
      match = schedRows.find(r => !r.used && r.normName === pNorm);
    }
    if (!match && pPhone && pPhone.length >= 7) {
      let pTail = pPhone.slice(-7);
      let phoneCandidates = schedRows.filter(r => !r.used && r.phoneDigits && r.phoneDigits.endsWith(pTail));
      if (phoneCandidates.length === 1) match = phoneCandidates[0];
    }

    // Mark exact-name duplicates as used so they aren't appended at the end
    schedRows.forEach(r => {
      if (pNorm && r.normName === pNorm) r.used = true;
    });
    if (match) match.used = true;

    let matchedRow = match ? match.rawRow : new Array(SCHED_COLS).fill("");
    while (matchedRow.length < SCHED_COLS) matchedRow.push("");
    matchedRow.length = SCHED_COLS;

    matchedRow[nameIdx] = p.name;
    if (pPhone) matchedRow[phoneIdx] = p.phone;

    if (pNorm) writtenNames.add(pNorm);
    return matchedRow;
  }

  let newRows = [headers];
  (activePlayers || []).forEach(p => {
    const r = findMatchingRow(p);
    if (r) newRows.push(r);
  });
  (inactivePlayers || []).forEach(p => {
    const r = findMatchingRow(p);
    if (r) newRows.push(r);
  });
  schedRows.forEach(r => {
    if (!r.used && !(r.normName && writtenNames.has(r.normName))) {
      r.used = true;
      if (r.normName) writtenNames.add(r.normName);
      newRows.push(r.rawRow);
    }
  });

  newRows.forEach(r => {
    while (r.length < SCHED_COLS) r.push("");
    r.length = SCHED_COLS;
  });

  schedSheet.clearContents();
  schedSheet.getRange(1, 2, newRows.length, 1).setNumberFormat("@");
  schedSheet.getRange(1, 13, newRows.length, 1).setNumberFormat("@");
  schedSheet.getRange(1, 1, newRows.length, SCHED_COLS).setValues(newRows);

  let maxColRows = Math.max(schedSheet.getLastRow(), 20);
  if (maxColRows > 0) {
    schedSheet.getRange(1, 14, maxColRows, 1).clearContent().clearFormat();
  }

  let nextWeek = prevWeekNum + 1;
  if (nextWeek <= 10) {
    try {
      let tz = ss.getSpreadsheetTimeZone() || "America/Phoenix";
      let todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

      schedSheet.getRange("N1:N4").setValues([
        ["SCHEDULE_WEEK"],
        [nextWeek],
        ["Week " + nextWeek],
        [todayStr]
      ]);
    } catch (e) {
      Logger.log("Non-fatal header stamp warning: " + e.message);
    }
  }
}












// Header array structure across schedule generators:
let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered", "W", "Phone"];

/**
 * Submits court scores for Game 1 through Game 6 and calculates normalized totals.
 */
function submitCourtScores(payload) {
  return executeWithLock(function() {
    try {
      if (!payload || (!payload.group && !payload.groupName) || !Array.isArray(payload.scores)) {
        return { success: false, message: "Invalid payload: Missing group or scores array." };
      }

      const ss = getDb();
      const cleanGroup = String(payload.group || payload.groupName).replace(/^(Score|Sched)\s*/i, "").trim();
      const schedSheet = ss.getSheetByName("Sched " + cleanGroup);

      if (!schedSheet) return { success: false, message: `Schedule sheet 'Sched ${cleanGroup}' not found.` };

      const dataRange = schedSheet.getDataRange();
      const data = dataRange.getValues();
      if (data.length <= 1) return { success: false, message: "Schedule sheet has no player rows." };

      const headers = data[0].map(h => h.toString().toLowerCase().trim());
      let nameIdx = headers.indexOf("player name") !== -1 ? headers.indexOf("player name") : headers.indexOf("name");
      if (nameIdx === -1) nameIdx = 0;

      // Locate Game 1 through Game 6
      const gIdxs = [
        headers.indexOf("game 1"),
        headers.indexOf("game 2"),
        headers.indexOf("game 3"),
        headers.indexOf("game 4"),
        headers.indexOf("game 5"),
        headers.indexOf("game 6")
      ];

      const totIdx = headers.findIndex(h => /total|tot|pts|score/i.test(h));
      let submitterIdx = headers.findIndex(h => /entered|submitted/i.test(h));
      if (submitterIdx === -1) submitterIdx = 10;

      let submitterName = payload.submittedByName || payload.userName || payload.enteredBy || payload.user || "";

      if (!submitterName) {
        const rawPhone = payload.submittedBy || payload.phone || payload.userPhone || "";
        const phoneDigits = String(rawPhone).replace(/\D/g, "");

        if (phoneDigits.length >= 7 && typeof findFoursomeByPhone === 'function') {
          try {
            const lookup = findFoursomeByPhone({ phone: phoneDigits, group: cleanGroup, sheet: "Sched " + cleanGroup });
            if (lookup && lookup.player && lookup.player.name) submitterName = lookup.player.name;
          } catch (e) {}
        }
        if (!submitterName && rawPhone) submitterName = String(rawPhone).trim();
      }

      const scoresMap = {};
      payload.scores.forEach(item => {
        if (item.name) scoresMap[String(item.name).trim().toLowerCase()] = item;
      });

      let dataModified = false;
      for (let r = 1; r < data.length; r++) {
        const rowName = String(data[r][nameIdx] || "").trim().toLowerCase();
        if (scoresMap[rowName]) {
          const pScore = scoresMap[rowName];

          // Write scores directly to G1 - G6 columns
          for (let g = 1; g <= 6; g++) {
            const gVal = pScore[`g${g}`];
            const colIdx = gIdxs[g - 1];
            if (colIdx !== -1 && gVal !== undefined && gVal !== null && gVal !== "") {
              data[r][colIdx] = gVal;
            }
          }

          // Compute total score normalized to 3-game equivalent
          if (totIdx !== -1) {
            let sum = 0;
            let playedCount = 0;
            for (let g = 0; g < 6; g++) {
              const colIdx = gIdxs[g];
              if (colIdx !== -1) {
                const num = parseInt(data[r][colIdx], 10);
                if (!isNaN(num)) {
                  sum += num;
                  playedCount++;
                }
              }
            }

            if (playedCount > 0) {
              // Scale average of games played to standard 3-game match score
              data[r][totIdx] = (playedCount === 3) ? sum : Math.round((sum / playedCount) * 3);
            }
          }

          if (submitterIdx !== -1 && submitterName) data[r][submitterIdx] = submitterName;
          dataModified = true;
        }
      }

      if (dataModified) dataRange.setValues(data);
      if (typeof CacheService !== 'undefined') {
        try {
          const keysToClear = [
            `UNIFIED_ROSTER_CACHE_${cleanGroup.toUpperCase()}`,
            `SCHEDULE_${cleanGroup}`,
            `APP_INIT_DATA`
          ];
          if (typeof getCheckInCacheKey === 'function') {
            keysToClear.push(getCheckInCacheKey("Sched " + cleanGroup));
          }
          CacheService.getScriptCache().removeAll(keysToClear);
        } catch (e) {}
      }

      return { success: true, message: `Successfully updated scores.` };
    } catch (err) {
      return { success: false, message: "Server Error submitting scores: " + err.message };
    }
  });
}



// ==========================================
// EXPLICIT API ENDPOINTS FOR WEB APP & MENUS
// ==========================================

/** Strict 4-player courts only (Extra players assigned BYE) */
function rescheduleFromCheckIns(payload, courts) {
  return rescheduleFromCheckInsCore(payload, courts, false);
}

/** 5- and 6-player court integration (Eliminates BYEs) */
function rescheduleFromCheckInsOptimized(payload, courts) {
  return rescheduleFromCheckInsCore(payload, courts, true);
}

/** Strict 4-player courts only for all active players */
function ScheduleAll(payload, courts) {
  return scheduleAllCore(payload, courts, false);
}

/** 5- and 6-player court integration for all active players */
function ScheduleAllOptimized(payload, courts) {
  return scheduleAllCore(payload, courts, true);
}




/**
 * Prioritizes courts 5 through 12 first (sorted numerically),
 * followed by all other remaining courts (1-4, 13+).
 * 
 * @param {Array<number|string>} courts - Array of court numbers.
 * @return {Array<number>} Prioritized array of court numbers.
 */
function prioritizeCourts(courts) {
  if (!Array.isArray(courts) || courts.length === 0) return [];

  const inRange = [];
  const outOfRange = [];

  courts.forEach(c => {
    const num = parseInt(c, 10);
    if (!isNaN(num)) {
      if (num >= 5 && num <= 12) {
        inRange.push(num);
      } else {
        outOfRange.push(num);
      }
    }
  });

  inRange.sort((a, b) => a - b);
  outOfRange.sort((a, b) => a - b);

  return [...inRange, ...outOfRange];
}


function rescheduleFromCheckInsCore(targetParam, courtsParam, forceIntegrateByes) {
  return executeWithLock(function() {
    let groupName = "";
    let courts = courtsParam;

    if (typeof targetParam === 'object' && targetParam !== null) {
      groupName = targetParam.group || targetParam.groupName || targetParam.reschedTarget || targetParam.target || targetParam.sheet || targetParam.tab || targetParam.arg || "";
      courts = targetParam.courts || courts;
    } else if (typeof targetParam === 'string') {
      groupName = targetParam;
    }

    groupName = String(groupName || "Womens").replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    let targetName = "Sched " + groupName;

    const ss = getDb();
    const cleanP = (p) => {
      if (p === null || p === undefined) return "";
      if (typeof p === 'number') p = p.toFixed(0);
      return String(p).replace(/\D/g, '');
    };
    const cleanCourtLabel = (c) => {
      if (!c) return ""; let str = String(c).trim();
      if (str.toUpperCase() === "BYE") return "BYE";
      let match = str.match(/\d+/); return match ? String(match[0]) : (str.replace(/^(court|crt|score)\s*#?\s*/i, "").trim() || str);
    };
    const normPlayerName = (s) => {
      if (!s) return ""; let str = String(s).trim();
      if (str.includes(",")) {
        let parts = str.split(",").map(p => p.trim()).filter(Boolean);
        if (parts.length === 2) str = parts[1] + " " + parts[0];
      }
      return typeof normalizeName === "function"
        ? normalizeName(str)
        : str.toLowerCase().replace(/\s+/g, " ");
    };

    let sheet = ss.getSheetByName(targetName);
    if (!sheet) return `⚠️ Error: Schedule tab '${targetName}' not found.`;

    const currentWeek = typeof calculateCurrentWeekNumber === 'function' ? calculateCurrentWeekNumber() : 1;

    let existingData = sheet.getDataRange().getValues();
    let existingMap = {};

    if (existingData.length > 1) {
      let exHead = existingData[0].map(h => String(h).toLowerCase().trim());
      let g1I = exHead.indexOf("game 1"); let g2I = exHead.indexOf("game 2"); 
      let g3I = exHead.indexOf("game 3"); let g4I = exHead.indexOf("game 4");
      let g5I = exHead.indexOf("game 5"); let g6I = exHead.indexOf("game 6");
      let totI = exHead.indexOf("total"); let entI = exHead.findIndex(h => h.includes("entered"));
      let phI = exHead.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
      if (phI === -1) phI = 12;
      
      for (let r = 1; r < existingData.length; r++) {
        let pName = existingData[r][0] ? String(existingData[r][0]).trim() : "";
        if (pName && !isUnknownPlayerName(pName)) {
          let normKey = normPlayerName(pName);
          if (!existingMap[normKey]) {
            let checkInVal = existingData[r][2] !== undefined ? existingData[r][2] : "";
            existingMap[normKey] = {
              checkIn: (checkInVal !== null && String(checkInVal).trim() !== "") ? checkInVal : "",
              g1: g1I !== -1 ? existingData[r][g1I] : "", g2: g2I !== -1 ? existingData[r][g2I] : "", 
              g3: g3I !== -1 ? existingData[r][g3I] : "", g4: g4I !== -1 ? existingData[r][g4I] : "",
              g5: g5I !== -1 ? existingData[r][g5I] : "", g6: g6I !== -1 ? existingData[r][g6I] : "",
              total: totI !== -1 ? existingData[r][totI] : "", 
              entered: entI !== -1 ? existingData[r][entI] : "", 
              phone: phI < existingData[r].length ? cleanP(existingData[r][phI]) : ""
            };
          }
        }
      }
    }

    let scoreSheetName = "Score " + groupName;
    let scoreSheet = ss.getSheetByName(scoreSheetName);
    const rankInfo = buildAuthoritativeRankLookup(ss, groupName, scoreSheet);
    const masterPhoneLookup = rankInfo.masterPhoneLookup;

    let rawPlayers = fetchPlayersFromSheet(targetName);
    let players = [];
    let seenNames = new Set();

    rawPlayers.forEach((p, idx) => {
      if (isUnknownPlayerName(p.name)) return;
      let normP = normPlayerName(p.name);
      if (normP && seenNames.has(normP)) return;
      if (normP) seenNames.add(normP);

      let prev = existingMap[normP] || { checkIn: "", g1: "", g2: "", g3: "", g4: "", g5: "", g6: "", total: "", entered: "", phone: "" };
      let phoneClean = cleanP(p.phone || p.cell || p.mobile || prev.phone || masterPhoneLookup[normP]);

      p.prev = prev;
      p.phone = phoneClean;
      p._sheetIdx = idx;
      players.push(p);
    });

    let checkedInPlayers = [];
    let uncheckedPlayers = [];

    players.forEach(p => {
      let isChecked = Boolean(p.checkedIn || p.checked || (p.prev.checkIn && String(p.prev.checkIn).trim() !== ""));
      p.isChecked = isChecked; 
      if (isChecked) checkedInPlayers.push(p); else uncheckedPlayers.push(p);
    });

    checkedInPlayers.sort((a, b) => {
      let rA = rankInfo.getRankForPlayer(a.name, a._sheetIdx);
      let rB = rankInfo.getRankForPlayer(b.name, b._sheetIdx);
      if (Math.abs(rA.rank - rB.rank) > 0.0001) return rA.rank - rB.rank;
      return rA.origIdx - rB.origIdx;
    });

    let rawCourts = courts ? (typeof parseAndSortCourts === 'function' ? parseAndSortCourts(courts) : courts) : (typeof getCourtsForGroup === 'function' ? getCourtsForGroup(groupName) : [5, 6, 7, 8, 9, 10, 11, 12, 3, 4, 13, 14, 15, 16]);
    let cleanedCourts = rawCourts.map(cleanCourtLabel).filter(c => c !== "BYE" && c !== "");
    let prioritizedNums = typeof prioritizeCourts === 'function' ? prioritizeCourts(cleanedCourts) : cleanedCourts;
    let availableCourts = prioritizedNums.map(String);
    
    let courtAssignments = {};
    availableCourts.forEach(c => courtAssignments[c] = []);
    let playersCopy = [...checkedInPlayers];
    let playersForBye = [];
    let unknownPlayers = [];
    let courtNumber = 0;

    if (forceIntegrateByes && playersCopy.length >= 4) {
      let chunkSizes = [];
      let len = playersCopy.length;

      if (len === 6) {
        chunkSizes = [6];
      } else if (len === 11) {
        chunkSizes = [5, 6];
      } else {
        let remainder = len % 4;
        if (remainder === 0) {
          for (let i = 0; i < len / 4; i++) chunkSizes.push(4);
        } else if (remainder === 1) {
          for (let i = 0; i < (len - 5) / 4; i++) chunkSizes.push(4);
          chunkSizes.push(5);
        } else if (remainder === 2) {
          for (let i = 0; i < (len - 10) / 4; i++) chunkSizes.push(4);
          chunkSizes.push(5, 5);
        } else if (remainder === 3) {
          if (len === 7) chunkSizes.push(4);
          else {
            for (let i = 0; i < (len - 15) / 4; i++) chunkSizes.push(4);
            chunkSizes.push(5, 5, 5);
          }
        }
      }

      for (let size of chunkSizes) {
         if (courtNumber < availableCourts.length && playersCopy.length >= size) {
            let chunk = playersCopy.splice(0, size);
            let cName = availableCourts[courtNumber++];
            chunk.forEach(p => { p.assignedCourt = cName; courtAssignments[cName].push(p); });
         } else break;
      }
      playersCopy.forEach(p => { p.assignedCourt = "BYE"; playersForBye.push(p); });

    } else {
      let fullCourtsCount = Math.floor(playersCopy.length / 4);
      let maxFullCourts = Math.min(fullCourtsCount, availableCourts.length);
      let totalPlayingAllowed = maxFullCourts * 4;
      let playersToAssign = playersCopy.slice(0, totalPlayingAllowed);
      let leftoverPlayers = playersCopy.slice(totalPlayingAllowed);

      playersToAssign.forEach((p, idx) => {
        let assignedCrt = availableCourts[Math.floor(idx / 4)];
        p.assignedCourt = assignedCrt;
        courtAssignments[assignedCrt].push(p);
      });

      // Only pair leftover players with Unknowns if at least 1 full court exists OR at least 2 real players are playing
      if (
        leftoverPlayers.length > 0 &&
        leftoverPlayers.length < 4 &&
        maxFullCourts < availableCourts.length &&
        (maxFullCourts > 0 || leftoverPlayers.length >= 2)
      ) {
        let extraCourt = availableCourts[maxFullCourts];
        leftoverPlayers.forEach(p => {
          p.assignedCourt = extraCourt;
          courtAssignments[extraCourt].push(p);
        });

        let unknownNeeded = 4 - leftoverPlayers.length;
        for (let u = 1; u <= unknownNeeded; u++) {
          let uPlayer = {
            name: "Unknown " + u,
            assignedCourt: extraCourt,
            isChecked: false,
            isUnknown: true,
            phone: "",
            prev: { checkIn: "", g1: "", g2: "", g3: "", g4: "", g5: "", g6: "", total: "", entered: "", phone: "" }
          };
          unknownPlayers.push(uPlayer);
          courtAssignments[extraCourt].push(uPlayer);
        }
      } else {
        playersForBye = leftoverPlayers;
      }
    }

    playersForBye.forEach(p => p.assignedCourt = "BYE");
    uncheckedPlayers.forEach(p => p.assignedCourt = "");

    let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered", "", "Phone"];
    let rows = [headers];
    let playerCourtByName = {};
    let phoneCourtCounts = {};
    let playerCourtByPhone = {};
    const now = new Date();

    const writeRow = (p) => {
      if (p.isUnknown || isUnknownPlayerName(p.name)) {
        rows.push([p.name, cleanCourtLabel(p.assignedCourt), "", "", "", "", "", "", "", "", "", "", ""]);
        return;
      }

      let finalCourt = cleanCourtLabel(p.assignedCourt || (p.isChecked ? "BYE" : ""));
      let checkInVal = p.isChecked ? (p.prev.checkIn || now) : "";
      let normName = normPlayerName(p.name);
      let pPhone = cleanP(p.phone || p.cell || p.mobile || p.prev.phone || masterPhoneLookup[normName]);

      if (normName) playerCourtByName[normName] = finalCourt;
      if (pPhone && pPhone.length >= 7) {
        let tail = pPhone.slice(-7);
        phoneCourtCounts[tail] = (phoneCourtCounts[tail] || 0) + 1;
        playerCourtByPhone[tail] = finalCourt;
      }

      rows.push([p.name, finalCourt, checkInVal, p.prev.g1, p.prev.g2, p.prev.g3, p.prev.g4, p.prev.g5, p.prev.g6, p.prev.total, p.prev.entered, "", pPhone]);
    };

    checkedInPlayers.forEach(writeRow);
    unknownPlayers.forEach(writeRow);
    uncheckedPlayers.forEach(writeRow);

    sheet.clearContents();
    sheet.getRange(1, 2, rows.length, 1).setNumberFormat("@");
    sheet.getRange(1, 13, rows.length, 1).setNumberFormat("@");      
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    sheet.getRange("N1").setValue("SCHEDULE_WEEK").setFontWeight("bold");
    sheet.getRange("N2").setValue(currentWeek).setHorizontalAlignment("center");
    sheet.getRange("N3").setValue("Week " + currentWeek).setHorizontalAlignment("center");
    sheet.getRange("N4").setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd")).setHorizontalAlignment("center");

    if (scoreSheet) {
      let scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 1) {
        const col = typeof buildColMap === 'function' ? buildColMap(scoreData[0]) : {};
        let courtIdx = col.court !== undefined ? col.court : scoreData[0].map(h => String(h || '').trim().toLowerCase()).findIndex(h => /court|crt/i.test(h));
        let ptsIdx = col.pts !== undefined ? col.pts : scoreData[0].map(h => String(h || '').trim().toLowerCase()).findIndex(h => /^pts$|^points$|^total$/i.test(h));
        let statusIdx = col.status !== undefined ? col.status : scoreData[0].map(h => String(h || '').trim().toLowerCase()).findIndex(h => /status/i.test(h));
        
        if (courtIdx === -1) courtIdx = 3;
        if (ptsIdx === -1) ptsIdx = 4;

        scoreSheet.getRange(2, ptsIdx + 1, scoreData.length - 1, 1).clearContent();

        let courtValues = [];
        for (let r = 1; r < scoreData.length; r++) {
          let row = scoreData[r];
          let rowName = col.name !== undefined ? row[col.name] : `${row[col.first] || ''} ${row[col.last] || ''}`.trim();
          let rowPhone = col.phone !== undefined ? cleanP(row[col.phone]) : "";
          let normRowName = normPlayerName(rowName);
          let assignedCourt = "";

          if (normRowName && playerCourtByName[normRowName] !== undefined) {
            assignedCourt = playerCourtByName[normRowName];
          } else if (rowPhone && rowPhone.length >= 7) {
            let tail = rowPhone.slice(-7);
            if (phoneCourtCounts[tail] === 1 && playerCourtByPhone[tail] !== undefined) {
              assignedCourt = playerCourtByPhone[tail];
            }
          }

          if (assignedCourt && statusIdx !== -1 && String(row[statusIdx]).toUpperCase().trim() !== "ACTIVE") {
            scoreSheet.getRange(r + 1, statusIdx + 1).setValue("Active");
          }
          courtValues.push([cleanCourtLabel(assignedCourt)]);
        }

        if (courtValues.length > 0) {
          scoreSheet.getRange(2, courtIdx + 1, courtValues.length, 1).setNumberFormat("@");
          scoreSheet.getRange(2, courtIdx + 1, courtValues.length, 1).setValues(courtValues);
        }
      }
    }

    if (typeof CacheService !== 'undefined') {
      try {
        CacheService.getScriptCache().remove(typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(targetName) : null);
        CacheService.getScriptCache().remove("UNIFIED_ROSTER_CACHE_" + groupName.toUpperCase());
      } catch(e) {}
    }

    let activeCourtsCount = Object.keys(courtAssignments).filter(c => courtAssignments[c].length >= 4).length;
    let totalByes = rows.filter(r => r[1] === "BYE").length;
    let modeText = forceIntegrateByes ? "Optimized 5/6s" : "Strict 4s";
    let unknownNote = unknownPlayers.length > 0 ? ` (paired with ${unknownPlayers.length} Unknown)` : "";
    return `✅ Rescheduled '${targetName}' [${modeText}] using ${rankInfo.sourceLabel}. Assigned ${activeCourtsCount} courts, ${totalByes} BYEs${unknownNote}.`;
  });
}

function scheduleAllCore(targetParam, courtsParam, forceIntegrateByes) {
  return executeWithLock(function() {
    let targetGroup = "";
    let courts = courtsParam;

    if (typeof targetParam === 'object' && targetParam !== null) {
      targetGroup = targetParam.group || targetParam.groupName || targetParam.genTarget || targetParam.target || targetParam.sheet || targetParam.tab || targetParam.arg || "";
      courts = targetParam.courts || courts;
    } else if (typeof targetParam === 'string') {
      targetGroup = targetParam;
    }

    const ss = getDb();
    const cleanP = (p) => {
      if (p === null || p === undefined) return "";
      if (typeof p === 'number') p = p.toFixed(0);
      return String(p).replace(/\D/g, '');
    };
    const cleanStr = (s) => String(s || '').trim().toLowerCase();
    const normKeyOf = (s) => typeof normalizeName === 'function' ? normalizeName(s) : cleanStr(s);
    const cleanCourtLabel = (c) => {
      if (!c) return ""; let str = String(c).trim();
      if (str.toUpperCase() === "BYE") return "BYE";
      let match = str.match(/\d+/); return match ? String(match[0]) : (str.replace(/^(court|crt|score)\s*#?\s*/i, "").trim() || str);
    };
    const isRowActive = (rawVal) => {
      if (rawVal === "" || rawVal === null || rawVal === undefined) return true;
      const s = String(rawVal).toUpperCase().trim();
      return s !== "INACTIVE" && s !== "FALSE" && s !== "NO" && s !== "QUIT" && s !== "DROPPED";
    };

    let groupsToProcess = [];
    const currentWeek = typeof calculateCurrentWeekNumber === 'function' ? calculateCurrentWeekNumber() : 1;

    if (targetGroup) {
      let cleanGroup = String(targetGroup).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
      groupsToProcess = [cleanGroup];
    } else {
      groupsToProcess = (typeof GROUPS !== 'undefined' && GROUPS.length > 0) ? GROUPS : [getTargetGroup()];
    }

    let summary = [];

    groupsToProcess.forEach(groupName => {
      let scoreSheet = getScoreSheetByGroup(groupName);
      if (!scoreSheet) {
        summary.push(`⚠ Score tab for '${groupName}' not found.`);
        return;
      }

      if (typeof sortActivePlayersForSheet === 'function') sortActivePlayersForSheet(scoreSheet);
      const data = scoreSheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const rankInfo = buildAuthoritativeRankLookup(ss, groupName, scoreSheet);
      const col = typeof buildColMap === 'function' ? buildColMap(data[0]) : {};
      let scoreHeaders = data[0].map(h => String(h || '').trim().toLowerCase());
      let phoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));

      let activePlayerObjects = [];
      let inactivePlayerObjects = [];
      let seenNames = new Set();

      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let activeFlag = col.status !== undefined ? isRowActive(row[col.status]) : true;
        
        let firstVal = (col.first !== undefined && row[col.first]) ? String(row[col.first]).trim() : '';
        let lastVal = (col.last !== undefined && row[col.last]) ? String(row[col.last]).trim() : '';
        let name = (firstVal || lastVal) ? `${firstVal} ${lastVal}`.trim() : (col.name !== undefined ? String(row[col.name]).trim() : '');
        if (!name || isUnknownPlayerName(name)) continue;

        let normName = normKeyOf(name);
        if (normName && seenNames.has(normName)) continue;
        if (normName) seenNames.add(normName);

        let rawPhone = phoneIdx !== -1 ? row[phoneIdx] : (col.phone !== undefined ? row[col.phone] : (col.cell !== undefined ? row[col.cell] : (col.mobile !== undefined ? row[col.mobile] : "")));
        let cleanedPhone = cleanP(rawPhone);
        let rEntry = rankInfo.getRankForPlayer(name, r);

        let pObj = { name: name, phone: cleanedPhone, rank: rEntry.rank, origIdx: r };
        if (activeFlag) {
          activePlayerObjects.push(pObj);
        } else {
          inactivePlayerObjects.push(pObj);
        }
      }

      activePlayerObjects.sort((a, b) => {
        if (Math.abs(a.rank - b.rank) > 0.0001) return a.rank - b.rank;
        return a.origIdx - b.origIdx;
      });

      let activePlayers = activePlayerObjects.map(p => p.name);

      let rawCourts = courts ? (typeof parseAndSortCourts === 'function' ? parseAndSortCourts(courts) : courts) : (typeof getCourtsForGroup === 'function' ? getCourtsForGroup(groupName) : [5, 6, 7, 8, 9, 10, 11, 12, 3, 4, 13, 14, 15, 16]);
      let cleanedCourts = rawCourts.map(cleanCourtLabel).filter(c => c !== "BYE" && c !== "");
      let prioritizedNums = typeof prioritizeCourts === 'function' ? prioritizeCourts(cleanedCourts) : cleanedCourts;
      let availableCourts = prioritizedNums.map(String);

      let schedSheetName = "Sched " + groupName;
      let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);

      schedSheet.clear();

      let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered", "", "Phone"];
      let rows = [headers];

      let numPlayers = activePlayers.length;
      let courtWarning = "";
      
      let playingIndices = [];
      let byeIndices = new Set();
      let playerCourtMap = {};
      let unknownRows = [];

      if (forceIntegrateByes && numPlayers >= 4) {
        let indicesCopy = Array.from({ length: numPlayers }, (_, i) => i);
        let chunkSizes = [];
        let len = numPlayers;

        if (len === 6) {
          chunkSizes = [6];
        } else if (len === 11) {
          chunkSizes = [5, 6];
        } else {
          let remainder = len % 4;
          if (remainder === 0) {
            for (let i = 0; i < len / 4; i++) chunkSizes.push(4);
          } else if (remainder === 1) {
            for (let i = 0; i < (len - 5) / 4; i++) chunkSizes.push(4);
            chunkSizes.push(5);
          } else if (remainder === 2) {
            for (let i = 0; i < (len - 10) / 4; i++) chunkSizes.push(4);
            chunkSizes.push(5, 5);
          } else if (remainder === 3) {
            if (len === 7) chunkSizes.push(4);
            else {
              for (let i = 0; i < (len - 15) / 4; i++) chunkSizes.push(4);
              chunkSizes.push(5, 5, 5);
            }
          }
        }

        if (chunkSizes.length > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";

        let courtNum = 0;
        for (let size of chunkSizes) {
           if (courtNum < availableCourts.length && indicesCopy.length >= size) {
              let chunk = indicesCopy.splice(0, size);
              let cName = availableCourts[courtNum++];
              chunk.forEach(idx => playerCourtMap[idx] = String(cName));
           } else break;
        }
        indicesCopy.forEach(idx => byeIndices.add(idx));
      } else {
        let foursomesCount = Math.floor(numPlayers / 4);
        if (foursomesCount > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";
        
        let assignedCourtsCount = Math.min(foursomesCount, availableCourts.length);
        let totalPlayingCount = assignedCourtsCount * 4;
        let leftoverCount = numPlayers - totalPlayingCount;

        for (let i = 0; i < totalPlayingCount; i++) playingIndices.push(i);

        playingIndices.forEach((playerIdx, orderIdx) => {
          let courtNumIdx = Math.floor(orderIdx / 4);
          playerCourtMap[playerIdx] = String(availableCourts[courtNumIdx]);
        });

        // Only pair leftover players with Unknowns if at least 1 full court exists OR at least 2 real players are playing
        if (
          leftoverCount > 0 &&
          leftoverCount < 4 &&
          assignedCourtsCount < availableCourts.length &&
          (assignedCourtsCount > 0 || leftoverCount >= 2)
        ) {
          let extraCourt = String(availableCourts[assignedCourtsCount]);
          for (let i = totalPlayingCount; i < numPlayers; i++) {
            playingIndices.push(i);
            playerCourtMap[i] = extraCourt;
          }
          let unknownNeeded = 4 - leftoverCount;
          for (let u = 1; u <= unknownNeeded; u++) {
            unknownRows.push(["Unknown " + u, extraCourt, "", "", "", "", "", "", "", "", "", "", ""]);
          }
        } else {
          for (let i = totalPlayingCount; i < numPlayers; i++) byeIndices.add(i);
        }
      }

      const courtLookupByName = {};
      const courtLookupByPhone = {};
      const phoneCounts = {};

      const registerLookupKey = (pName, pPhone, assignedCourt) => {
        if (!pName) return;
        const cleanFull = cleanStr(pName);
        courtLookupByName[cleanFull] = assignedCourt;
        const tokens = cleanFull.match(/[a-z0-9]+/g) || [];
        if (tokens.length > 0) courtLookupByName[tokens.sort().join(" ")] = assignedCourt;
        if (pPhone && pPhone.length >= 7) {
          const tail = pPhone.slice(-7);
          phoneCounts[tail] = (phoneCounts[tail] || 0) + 1;
          courtLookupByPhone[tail] = assignedCourt;
        }
      };

      for (let i = 0; i < numPlayers; i++) {
        let pName = activePlayers[i];
        let pPhone = activePlayerObjects[i] ? activePlayerObjects[i].phone : "";
        let assignedCourt = byeIndices.has(i) ? "BYE" : (playerCourtMap[i] || "BYE");

        registerLookupKey(pName, pPhone, assignedCourt);
        rows.push([pName, assignedCourt, "", "", "", "", "", "", "", "", "", "", pPhone]);
      }

      unknownRows.forEach(r => rows.push(r));

      for (let i = 0; i < inactivePlayerObjects.length; i++) {
        let pName = inactivePlayerObjects[i].name;
        let pPhone = inactivePlayerObjects[i].phone;
        registerLookupKey(pName, pPhone, "");
        rows.push([pName, "", "", "", "", "", "", "", "", "", "", "", pPhone]);
      }

      schedSheet.clearContents();
      schedSheet.getRange(1, 2, rows.length, 1).setNumberFormat("@");        
      schedSheet.getRange(1, 13, rows.length, 1).setNumberFormat("@");
      schedSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      schedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      schedSheet.getRange("N1").setValue("SCHEDULE_WEEK").setFontWeight("bold");
      schedSheet.getRange("N2").setValue(currentWeek).setHorizontalAlignment("center");
      schedSheet.getRange("N3").setValue("Week " + currentWeek).setHorizontalAlignment("center");
      schedSheet.getRange("N4").setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd")).setHorizontalAlignment("center");

      let scoreHeaders2 = data[0].map(h => String(h || '').trim().toLowerCase());
      let phoneIdx2 = scoreHeaders2.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
      let firstIdx = scoreHeaders2.findIndex(h => /first|fname|f_name/i.test(h));
      let lastIdx = scoreHeaders2.findIndex(h => /last|lname|l_name/i.test(h));
      let nameIdx = scoreHeaders2.findIndex(h => /player|full\s*name|^name$/i.test(h));
      let courtIdx = scoreHeaders2.findIndex(h => /court|crt/i.test(h));
      if (courtIdx === -1) courtIdx = 3; 

      let ptsIdx = scoreHeaders2.findIndex(h => /^pts$|^points$|^total$/i.test(h));
      if (ptsIdx === -1) ptsIdx = 4;

      if (data.length > 1) scoreSheet.getRange(2, ptsIdx + 1, data.length - 1, 1).clearContent();

      let scoreCourtValues = [];
      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let rowPhone = phoneIdx2 !== -1 ? cleanP(row[phoneIdx2]) : "";
        let rowFirst = firstIdx !== -1 ? String(row[firstIdx] || '').trim() : '';
        let rowLast = lastIdx !== -1 ? String(row[lastIdx] || '').trim() : '';
        let rowFullName = (rowFirst || rowLast) ? `${rowFirst} ${rowLast}`.trim() : (nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '');
        let cleanRowName = cleanStr(rowFullName);
        let tokensKey = (cleanRowName.match(/[a-z0-9]+/g) || []).sort().join(" ");
        let activeFlag = col.status !== undefined ? isRowActive(row[col.status]) : true;

        let matchedCourt = "";
        if (cleanRowName && courtLookupByName[cleanRowName] !== undefined) {
          matchedCourt = courtLookupByName[cleanRowName];
        } else if (tokensKey && courtLookupByName[tokensKey] !== undefined) {
          matchedCourt = courtLookupByName[tokensKey];
        } else if (rowPhone && rowPhone.length >= 7) {
          let tail = rowPhone.slice(-7);
          if (phoneCounts[tail] === 1 && courtLookupByPhone[tail] !== undefined) {
            matchedCourt = courtLookupByPhone[tail];
          }
        }

        if (!activeFlag) matchedCourt = "";
        else if (!matchedCourt) matchedCourt = "BYE";

        scoreCourtValues.push([matchedCourt]);
      }

      if (scoreCourtValues.length > 0) {
        scoreSheet.getRange(2, courtIdx + 1, scoreCourtValues.length, 1).setNumberFormat("@");
        scoreSheet.getRange(2, courtIdx + 1, scoreCourtValues.length, 1).setValues(scoreCourtValues);
      }

      const cacheKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(schedSheetName) : null;
      if (typeof CacheService !== 'undefined' && cacheKey) CacheService.getScriptCache().remove(cacheKey);
      if (typeof clearUnifiedCache === 'function') clearUnifiedCache(schedSheetName);
      if (typeof CacheService !== 'undefined') CacheService.getScriptCache().remove("UNIFIED_ROSTER_CACHE_" + groupName.toUpperCase());

      let modeText = forceIntegrateByes ? "Optimized 5/6s" : "Strict 4s";
      summary.push(`Generated schedule for '${groupName}' [${modeText}] using ${rankInfo.sourceLabel}.${courtWarning}`);
    });

    return "✅ " + summary.join("\n");
  });
}




/**
 * Backend lookup for court assignments, teammates, and game scores (G1 through G6).
 * Handles single-row-per-player sheet layout:
 * Col A: Name | Col B: Court | Col C: Phone | Col D-I: Scores G1 through G6
 * 
 * @param {Object} payload Contains { phone, groupName }
 * @return {Object} JSON payload with player info, teammates list, and full court game scores
 */
function findFoursomeByPhone(payload) {
  try {
    var rawPhone = String(payload.phone || payload.phoneNum || "").replace(/\D/g, "");
    var targetPlayerHint = String(payload.playerName || payload.name || "").trim();
    var groupName = String(payload.groupName || payload.group || "").replace(/^(Sched|Score)\s*/i, "").trim();

    if (!rawPhone || rawPhone.length < 7) {
      return { success: false, message: "Valid phone number required for lookup." };
    }

    if (!groupName) {
      return { success: false, message: "Target group name is required." };
    }

    var ss = getDb();
    var sheetName = "Sched " + groupName;
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: "Schedule sheet not found: " + sheetName };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: "Schedule sheet is currently empty." };
    }

    var colName = 0;
    var colCourt = 1;
    var colPhone = 12; // Col M (index 12) in standard 13-col Sched layout
    var gameCols = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8 };

    var headers = data[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (h.indexOf("name") !== -1 || h.indexOf("player") !== -1) colName = i;
      else if (h.indexOf("court") !== -1 || h === "ct") colCourt = i;
      else if (h.indexOf("phone") !== -1 || h.indexOf("cell") !== -1 || h.indexOf("mobile") !== -1) colPhone = i;
      else {
        for (var g = 1; g <= 6; g++) {
          if (h === "g" + g || h === "game " + g || h === "game" + g || h === "score " + g || h === "score" + g || h === "s" + g) {
            gameCols[g] = i;
          }
        }
      }
    }

    var targetLast7 = rawPhone.slice(-7);
    var normOf = function(s) {
      return typeof normalizeName === "function" ? normalizeName(s) : String(s || "").toLowerCase().trim();
    };
    var targetNormHint = normOf(targetPlayerHint);

    var targetCourtNum = "";
    var targetPlayerName = "";
    var fallbackRow = null;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var cellPhoneDigits = String(row[colPhone] || "").replace(/\D/g, "");
      if (cellPhoneDigits.length >= 7 && cellPhoneDigits.slice(-7) === targetLast7) {
        var rowPlayerName = String(row[colName] || "Player").trim();
        if (!fallbackRow) fallbackRow = row;
        if (targetNormHint && normOf(rowPlayerName) === targetNormHint) {
          fallbackRow = row;
          break;
        }
      }
    }

    if (fallbackRow) {
      targetPlayerName = String(fallbackRow[colName] || "Player").trim();
      var rawCourt = String(fallbackRow[colCourt] || "").trim();
      targetCourtNum = rawCourt.replace(/\D/g, "");
    }

    if (!targetCourtNum) {
      return {
        success: false,
        found: false,
        message: "No court assignment found for this phone number."
      };
    }

    var teammates = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var cellCourtNum = String(row[colCourt] || "").trim().replace(/\D/g, "");

      if (cellCourtNum === targetCourtNum) {
        var pName = String(row[colName] || "").trim();
        var pPhone = String(row[colPhone] || "").trim();

        if (pName && pName.toLowerCase() !== "bye" && pName !== "--") {
            var playerObj = {
                name: pName,
                first: pName.split(" ")[0] || pName,
                last: pName.split(" ").slice(1).join(" ") || "",
                phone: pPhone,
                isUnknown: typeof isUnknownPlayerName === "function" ? isUnknownPlayerName(pName) : false
            };
            

          for (var g = 1; g <= 6; g++) {
            var colIdx = gameCols[g];
            playerObj["g" + g] = (colIdx !== undefined && row[colIdx] !== undefined) ? String(row[colIdx]).trim() : "";
          }

          teammates.push(playerObj);
        }
      }
    }

    return {
      success: true,
      found: true,
      playerName: targetPlayerName,
      court: "Court " + targetCourtNum,
      group: groupName,
      teammates: teammates,
      foursome: teammates
    };

  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      message: "Server exception in findFoursomeByPhone: " + err.message
    };
  }
}






function buildAuthoritativeRankLookup(ss, groupName, scoreSheet) {
  const cleanGroup = String(groupName || "").replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  const rankLookup = {};
  const masterPhoneLookup = {};
  let sourceLabel = "Score sheet order";

  const cleanP = (p) => {
    if (p === null || p === undefined) return "";
    if (typeof p === "number") p = p.toFixed(0);
    return String(p).replace(/\D/g, "");
  };

  const canonicalName = (s) => {
    if (!s) return "";
    let str = String(s).trim();
    if (str.includes(",")) {
      const parts = str.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length === 2) str = parts[1] + " " + parts[0];
    }
    return typeof normalizeName === "function"
      ? normalizeName(str)
      : str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  };

  const tokenKeyOf = (s) => {
    const tokens = canonicalName(s).match(/[a-z0-9]+/g) || [];
    return tokens.sort().join(" ");
  };

  // Parses "4.2%", "12.5%-R", "3/24", "3/24-r", or plain integer rank into a 1..poolSize position
  const parseStandingToPosition = (val, poolSize) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") {
      if (val > 0 && val < 1) return val * poolSize;
      return val >= 1 ? val : null;
    }
    const str = String(val).trim();
    if (!str || /inactive/i.test(str)) return null;

    const pctMatch = str.match(/^(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      return isNaN(pct) ? null : (pct / 100) * poolSize;
    }

    const fracMatch = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fracMatch) {
      const num = parseFloat(fracMatch[1]);
      const den = parseFloat(fracMatch[2]);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        return (num / den) * poolSize;
      }
    }

    const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const n = parseFloat(numMatch[1]);
      if (isNaN(n) || n <= 0) return null;
      return n < 1 ? n * poolSize : n;
    }
    return null;
  };

  const tokenBuckets = {};
  const registerEntry = (rawName, entry) => {
    const cName = canonicalName(rawName);
    if (!cName) return;
    if (!rankLookup[cName]) {
      rankLookup[cName] = entry;
    }
    const tKey = tokenKeyOf(rawName);
    if (tKey) {
      if (!tokenBuckets[tKey]) tokenBuckets[tKey] = [];
      tokenBuckets[tKey].push(entry);
    }
  };

  // 1. PRIMARY AUTHORITY: "Rankings <Group>" sheet (finalized bounded standings)
  let rankedActiveCount = 0;
  let rankingsWeek = "";
  const rankSheet = ss ? ss.getSheetByName("Rankings " + cleanGroup) : null;

  if (rankSheet && rankSheet.getLastRow() > 1) {
    const rData = rankSheet.getDataRange().getDisplayValues();
    const rHeaders = rData[0].map(h => String(h || "").trim());

    if (rData[0].length >= 6 && String(rData[0][5] || "").trim()) {
      const m = String(rData[0][5]).match(/\d+/);
      if (m) rankingsWeek = m[0];
    }
    if (!rankingsWeek && rData.length > 1 && rData[1].length >= 6 && String(rData[1][5] || "").trim()) {
      const m = String(rData[1][5]).match(/\d+/);
      if (m) rankingsWeek = m[0];
    }
    if (!rankingsWeek && rHeaders[0]) {
      const m = rHeaders[0].match(/week\s*(\d+)/i);
      if (m) rankingsWeek = m[1];
    }

    const rRankIdx = rHeaders.findIndex(h => /^rank\b|^#$/i.test(h));
    const rNameIdx = rHeaders.findIndex(h => /name|player/i.test(h));
    const rankCol = rRankIdx !== -1 ? rRankIdx : 0;
    const nameCol = rNameIdx !== -1 ? rNameIdx : 1;

    let seqRank = 1;
    for (let r = 1; r < rData.length; r++) {
      const pName = String(rData[r][nameCol] || "").trim();
      if (!pName || pName === "Name" || pName === "Player Name" || pName.startsWith("---")) continue;

      const rawRank = String(rData[r][rankCol] || "").trim();
      if (!rawRank || rawRank.toUpperCase() === "INACTIVE") continue;

      const parsedRank = parseInt(rawRank.replace(/\D/g, ""), 10);
      const effectiveRank = (!isNaN(parsedRank) && parsedRank > 0) ? parsedRank : seqRank;

      registerEntry(pName, {
        rank: effectiveRank,
        origIdx: r,
        source: "Rankings"
      });
      rankedActiveCount++;
      seqRank = effectiveRank + 1;
    }

    if (rankedActiveCount > 0) {
      sourceLabel = "Rankings " + cleanGroup + (rankingsWeek ? " (Week " + rankingsWeek + ")" : "");
    }
  }

  // 2. FALLBACK / RETURNING INACTIVES: "Score <Group>" sheet (use getDisplayValues to preserve % vs integer 1)
  if (!scoreSheet && ss && typeof getScoreSheetByGroup === "function") {
    scoreSheet = getScoreSheetByGroup(cleanGroup);
  }

  if (scoreSheet && scoreSheet.getLastRow() > 1) {
    const sData = scoreSheet.getDataRange().getDisplayValues();
    const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase());
    const col = typeof buildColMap === "function" ? buildColMap(sData[0]) : {};

    const phoneIdx = sHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
    const firstIdx = col.first !== undefined ? col.first : sHeaders.findIndex(h => /first/i.test(h));
    const lastIdx  = col.last !== undefined ? col.last : sHeaders.findIndex(h => /last/i.test(h));
    const nameIdx  = col.name !== undefined ? col.name : sHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
    const newLeftIdx = sHeaders.findIndex(h => h === "newleft");
    const sortValIdx = sHeaders.findIndex(h => h === "sortval");
    const rawRankIdx = sHeaders.findIndex(h => h === "raw rank" || h === "rawrank");
    const rNumIdx    = col.rnum !== undefined ? col.rnum : sHeaders.findIndex(h => h === "rnum" || h === "rank");

    // Identify all R10..R0 columns in descending week order
    const rCols = [];
    for (let w = 10; w >= 0; w--) {
      const idx = sHeaders.indexOf("r" + w);
      if (idx !== -1) rCols.push({ week: w, idx: idx });
    }

    let latestPopulatedWeek = -1;
    let latestActivePool = 0;
    for (let c = 0; c < rCols.length; c++) {
      let count = 0;
      for (let r = 1; r < sData.length; r++) {
        const val = String(sData[r][rCols[c].idx] || "").trim();
        if (val !== "" && !/inactive/i.test(val)) {
          count++;
        }
      }
      if (count > 0) {
        latestPopulatedWeek = rCols[c].week;
        latestActivePool = count;
        break;
      }
    }

    const poolSize = rankedActiveCount > 0
      ? rankedActiveCount
      : (latestActivePool > 0 ? latestActivePool : Math.max(1, sData.length - 1));

    if (rankedActiveCount === 0 && latestPopulatedWeek >= 0) {
      sourceLabel = "Score " + cleanGroup + " (R" + latestPopulatedWeek + ")";
    }

    for (let r = 1; r < sData.length; r++) {
      const row = sData[r];
      const fName = firstIdx !== -1 ? String(row[firstIdx] || "").trim() : "";
      const lName = lastIdx !== -1 ? String(row[lastIdx] || "").trim() : "";
      const pName = (fName || lName) ? `${fName} ${lName}`.trim() : (nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "");
      if (!pName) continue;

      const cName = canonicalName(pName);
      const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : (col.phone !== undefined ? row[col.phone] : "");
      const cleanedPhone = cleanP(rawPhone);
      if (cName && cleanedPhone && !masterPhoneLookup[cName]) {
        masterPhoneLookup[cName] = cleanedPhone;
      }

      if (cName && rankLookup[cName]) continue;

      let derivedPos = null;
      for (let c = 0; c < rCols.length; c++) {
        derivedPos = parseStandingToPosition(row[rCols[c].idx], poolSize);
        if (derivedPos !== null) break;
      }

      if (derivedPos === null && newLeftIdx !== -1) {
        derivedPos = parseStandingToPosition(row[newLeftIdx], poolSize);
      }
      if (derivedPos === null && rNumIdx !== -1) {
        derivedPos = parseStandingToPosition(row[rNumIdx], poolSize);
      }
      if (derivedPos === null && sortValIdx !== -1) {
        derivedPos = parseStandingToPosition(row[sortValIdx], poolSize);
      }
      if (derivedPos === null && rawRankIdx !== -1) {
        derivedPos = parseStandingToPosition(row[rawRankIdx], poolSize);
      }
      if (derivedPos === null) {
        derivedPos = poolSize + r;
      }

      registerEntry(pName, {
        rank: derivedPos,
        origIdx: r,
        source: "Score"
      });
    }
  }

  Object.keys(tokenBuckets).forEach(tKey => {
    if (tokenBuckets[tKey].length === 1 && !rankLookup[tKey]) {
      rankLookup[tKey] = tokenBuckets[tKey][0];
    }
  });

  const getRankForPlayer = (playerName, fallbackIdx) => {
    const cName = canonicalName(playerName);
    if (cName && rankLookup[cName]) return rankLookup[cName];
    const tKey = tokenKeyOf(playerName);
    if (tKey && rankLookup[tKey]) return rankLookup[tKey];
    return { rank: 99999, origIdx: fallbackIdx !== undefined ? fallbackIdx : 99999, source: "Unranked" };
  };

  return {
    rankLookup: rankLookup,
    masterPhoneLookup: masterPhoneLookup,
    getRankForPlayer: getRankForPlayer,
    sourceLabel: sourceLabel,
    week: rankingsWeek
  };
}






/* =========================================================================
 *  HELPERS: COLUMN CHECK & SAFE PRIOR RANK PARSER
 * ========================================================================= */
function hasCol(idx) {
  return typeof idx === "number" && !isNaN(idx) && idx >= 0;
}

function safeParseRankVal(cellVal, defaultRank, currentPoolSize) {
  const pool = Math.max(1, Number(currentPoolSize) || 1);
  if (cellVal === null || cellVal === undefined || String(cellVal).trim() === "") {
    return {
      hasPrior: false,
      rank: defaultRank,
      numPeople: pool,
      percent: null,
      rawStr: ""
    };
  }

  const raw = String(cellVal).trim();

  // Format 1: Percentage standing e.g. "27.5%-R", "41.1%-I", "100.0%"
  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const estRank = Math.max(1, Math.min(pool, Math.round((pct / 100) * pool)));
    return {
      hasPrior: true,
      rank: estRank,
      numPeople: pool,
      percent: pct,
      rawStr: raw
    };
  }

  // Format 2: Fraction / Ratio e.g. "12/44", "30R73", "25/73-R"
  const fracMatch = raw.match(/^(\d+)\s*[\/R]\s*(\d+)/i);
  if (fracMatch) {
    const r = parseInt(fracMatch[1], 10);
    const denom = Math.max(1, parseInt(fracMatch[2], 10));
    const scaledRank = Math.max(1, Math.min(pool, Math.round((r / denom) * pool)));
    return {
      hasPrior: true,
      rank: scaledRank,
      numPeople: denom,
      percent: (r / denom) * 100,
      rawStr: raw
    };
  }

  // Format 3: Plain integer rank e.g. "14" or "14-i"
  const numMatch = raw.match(/^(\d+)/);
  if (numMatch) {
    const r = Math.max(1, Math.min(pool, parseInt(numMatch[1], 10)));
    return {
      hasPrior: true,
      rank: r,
      numPeople: pool,
      percent: (r / pool) * 100,
      rawStr: raw
    };
  }

  return {
    hasPrior: false,
    rank: defaultRank,
    numPeople: pool,
    percent: null,
    rawStr: raw
  };
}





/* =========================================================================
 *  BOUNDED RANK & MIXED LADDER ENGINE (> 4 WEEKS BY PT %, <= 4 WEEKS BOUNDED)
 * ========================================================================= */
function computeBoundedRanks(provisionalPlayers, allActivePlayers, customStep) {
  const N = allActivePlayers.length;
  const step = Math.max(1, Number(customStep) || Math.ceil(0.15 * N));

  const byPerf = allActivePlayers.slice().sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    if (b.total !== a.total) return b.total - a.total;
    return b.weeks - a.weeks;
  });
  const perfRankByName = new Map();
  byPerf.forEach((p, idx) => perfRankByName.set(p.name, idx + 1));

  return provisionalPlayers.map(p => {
    const perfRank = perfRankByName.get(p.name) || N;

    // New <= 4 week players with no prior standing anchor at bottom of ladder (N)
    const anchorRank = (p.hasPrior && p.priorRank > 0)
      ? Math.max(1, Math.min(N, p.priorRank))
      : N;

    const minAllowed = Math.max(1, anchorRank - step);
    const maxAllowed = Math.min(N, anchorRank + step);

    p.rawRank = perfRank;
    p.anchorRank = anchorRank;

    if (perfRank < minAllowed) {
      p.isBounded = true;
      p.targetRank = minAllowed;
      p.restrictionSuffix = "-R";
    } else if (perfRank > maxAllowed) {
      p.isBounded = true;
      p.targetRank = maxAllowed;
      p.restrictionSuffix = "-r";
    } else {
      // Within allowed movement window: insert by Pt % among > 4 week players
      p.isBounded = false;
      p.targetRank = null;
      p.restrictionSuffix = p.playedThisWeek === false ? "-i" : "";
    }
    return p;
  });
}



/* =========================================================================
 *  APP STANDINGS & SCHEDULE LOADER (READS RANKINGS SHEET DIRECTLY, NO RECOMPUTE)
 * ========================================================================= */
/* =========================================================================
 *  APP STANDINGS & SCHEDULE LOADER (READS RANKINGS SHEET & COL N DIRECTLY)
 * ========================================================================= */
function getRankingsAndSchedData(groupName) {
  const ss = (typeof getDb === "function") ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  const cleanGroup = String(groupName || "Womens").replace(/^(Score|Sched|Rankings)\s*/i, "").trim();

  const rankSheet  = ss.getSheetByName("Rankings " + cleanGroup);
  const schedSheet = ss.getSheetByName("Sched " + cleanGroup);

  const extractWeekOrNum = (val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number" && !isNaN(val) && val > 0) return Math.floor(val);
    const labeled = String(val).match(/(?:through\s*week|week|wk)\s*#?\s*(\d+)/i);
    if (labeled) return Number(labeled[1]);
    const numMatch = String(val).trim().match(/^(\d+)$/);
    return numMatch ? Number(numMatch[1]) : null;
  };

  // 1. Read "Rankings <Group>" directly (Column N stamp + exact row order)
  const rankings = [];
  let rankingsWeek = null;
  let rankingsDate = "";
  let maxWeeksPlayed = 0;

  if (rankSheet && rankSheet.getLastRow() >= 1) {
    // Read Column N stamp (same convention as Sched <Group>)
    const rN1 = rankSheet.getRange("N1").getDisplayValue();
    const rN2 = rankSheet.getRange("N2").getDisplayValue();
    const rN4 = rankSheet.getRange("N4").getDisplayValue();

    rankingsWeek = extractWeekOrNum(rN2) || extractWeekOrNum(rN1);
    if (rN4 && String(rN4).trim() !== "") {
      rankingsDate = String(rN4).trim();
    }

    if (rankSheet.getLastRow() >= 2) {
      const rRange = rankSheet.getDataRange();
      const rData = rRange.getValues();
      const rDisplay = rRange.getDisplayValues();
      const rHeaders = rData[0].map(h => String(h || "").trim().toLowerCase());

      const rankCol = rHeaders.findIndex(h => h === "rank" || h === "#");
      const nameCol = rHeaders.findIndex(h => h === "name" || h === "player" || h === "player name");
      const pctCol  = rHeaders.findIndex(h => h.includes("pt") && h.includes("%"));
      const ptsCol  = rHeaders.findIndex(h => h === "pts" || h === "points");
      const wksCol  = rHeaders.findIndex(h => h.startsWith("week"));

      const effRankCol = rankCol !== -1 ? rankCol : 0;
      const effNameCol = nameCol !== -1 ? nameCol : 1;
      const effPctCol  = pctCol  !== -1 ? pctCol  : 2;
      const effPtsCol  = ptsCol  !== -1 ? ptsCol  : 3;
      const effWksCol  = wksCol  !== -1 ? wksCol  : 4;

      for (let r = 1; r < rData.length; r++) {
        const row = rData[r];
        const dispRow = rDisplay[r];

        const name = String(row[effNameCol] || "").trim();
        if (!name) continue;

        const rawRankStr = String(dispRow[effRankCol] ?? row[effRankCol] ?? "").trim();
        const isInactive = rawRankStr.toUpperCase() === "INACTIVE";
        const parsedRank = Number(rawRankStr);

        const weeks = Number(row[effWksCol]) || 0;
        if (weeks > maxWeeksPlayed) maxWeeksPlayed = weeks;

        const total = Number(row[effPtsCol]) || 0;

        let pct = 0;
        const dispPctStr = String(dispRow[effPctCol] || "").trim();
        if (dispPctStr.endsWith("%")) {
          pct = parseFloat(dispPctStr.replace("%", "")) || 0;
        } else {
          pct = Number(row[effPctCol]) || 0;
          if (pct > 0 && pct <= 1 && total > 0) pct = pct * 100;
        }

        rankings.push({
          rank: isInactive ? "INACTIVE" : (!isNaN(parsedRank) && parsedRank > 0 ? parsedRank : rawRankStr),
          name: name,
          pct: Number(pct.toFixed(2)),
          total: total,
          weeks: weeks,
          status: isInactive ? "INACTIVE" : "ACTIVE"
        });
      }
    }

    // Fallback to max Weeks played on Rankings sheet only if Column N is not stamped yet
    if (!rankingsWeek && maxWeeksPlayed > 0) {
      rankingsWeek = maxWeeksPlayed;
    }
  }

  // 2. Read "Sched <Group>" independently (Column N stamp + court assignments)
  let scheduleWeek = null;
  let scheduleDate = "";
  let schedule = [];
  let hasSchedule = false;

  if (schedSheet && schedSheet.getLastRow() >= 1) {
    const sN1 = schedSheet.getRange("N1").getDisplayValue();
    const sN2 = schedSheet.getRange("N2").getDisplayValue();
    const sN4 = schedSheet.getRange("N4").getDisplayValue();

    scheduleWeek = extractWeekOrNum(sN2) || extractWeekOrNum(sN1);
    if (sN4 && String(sN4).trim() !== "") {
      scheduleDate = String(sN4).trim();
    }

    const schedLastRow = schedSheet.getLastRow();
    const schedLastCol = schedSheet.getLastColumn();
    if (schedLastRow >= 2 && schedLastCol >= 1) {
      const sData = schedSheet.getRange(1, 1, schedLastRow, Math.min(13, schedLastCol)).getValues();
      const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase());

      let nameIdx  = sHeaders.findIndex(h => /name|player/i.test(h));
      if (nameIdx === -1) nameIdx = 0;

      let courtIdx = sHeaders.findIndex(h => /court|crt/i.test(h));
      if (courtIdx === -1) courtIdx = 1;

      let checkIdx = sHeaders.findIndex(h => /check/i.test(h));
      let totIdx   = sHeaders.findIndex(h => /^(total|tot|pts|score)$/i.test(h));
      if (totIdx === -1) totIdx = 9;

      const gIdxs = [1, 2, 3, 4, 5, 6].map(num =>
        sHeaders.findIndex(h => new RegExp(`^(game\\s*${num}|g${num})$`, "i").test(h))
      );

      for (let r = 1; r < sData.length; r++) {
        const row = sData[r];
        const pName = String(row[nameIdx] || "").trim();
        if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;

        const court = String(row[courtIdx] || "").trim();
        if (!court) continue;

        hasSchedule = true;
        const entry = {
          name: pName,
          court: court,
          checkedIn: checkIdx !== -1 ? Boolean(String(row[checkIdx] || "").trim()) : false,
          total: (totIdx !== -1 && row[totIdx] !== "" && row[totIdx] !== null) ? row[totIdx] : ""
        };

        for (let g = 0; g < 6; g++) {
          const idx = gIdxs[g];
          entry["g" + (g + 1)] = (idx !== -1 && row[idx] !== "" && row[idx] !== null) ? row[idx] : "";
        }

        schedule.push(entry);
      }
    }
  }

  return {
    success: true,
    group: cleanGroup,
    week: rankingsWeek,
    rankingsWeek: rankingsWeek,
    rankingsDate: rankingsDate,
    scheduleWeek: scheduleWeek,
    scheduleDate: scheduleDate,
    rankings: rankings,
    hasSchedule: hasSchedule,
    schedule: hasSchedule ? schedule : []
  };
}



/* =========================================================================
 *  MAIN WEEKLY SCORE HARVEST & MIXED RANKING PROCESSOR (ALL 10 WEEKS)
 * ========================================================================= */
function processWeeklyScoresForSheet(sheet, forcedWeek, updateScores = true) {
  const doUpdateScores = (updateScores === false) ? false : true;

  return executeWithLock(function () {
    const ss = (typeof getDb === "function")
      ? getDb()
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!sheet) sheet = ss.getActiveSheet();
    if (typeof checkAndRunWeeklyBackup === "function") checkAndRunWeeklyBackup();

    const cleanGroupName = sheet.getName().replace(/^(Score|Sched|Rankings)\s+/i, "").trim();
    if (!/^Score\s+/i.test(sheet.getName())) {
      const resolvedScore = ss.getSheetByName("Score " + cleanGroupName);
      if (resolvedScore) sheet = resolvedScore;
    }

    const schedSheet =
      ss.getSheetByName("Sched " + cleanGroupName) ||
      ss.getSheetByName("Sched") ||
      ss.getSheetByName("Schedule");

    let origScoreData = null;
    let origSchedData = null;

    try {
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        throw new Error("No player data on tab: " + sheet.getName());
      }

      // Fast in-memory rollback snapshots
      origScoreData = data.map(r => r.slice());
      if (schedSheet) {
        origSchedData = schedSheet.getDataRange().getValues();
      }

      const headerRow = data[0];
      const col = (typeof buildColMap === "function") ? buildColMap(headerRow) : {};

      if (!hasCol(col.first)) col.first = headerRow.findIndex(h => /first/i.test(h));
      if (!hasCol(col.last))  col.last  = headerRow.findIndex(h => /last/i.test(h));

      const totColIdx     = resolveCol(col, headerRow, ["tot", "total"]);
      const posColIdx     = resolveCol(col, headerRow, ["pos", "possible"]);
      const pctColIdx     = resolveCol(col, headerRow, ["pct", "winPct"]);
      const ptsColIdx     = resolveCol(col, headerRow, ["pts", "points"]);
      const rawRankColIdx = resolveCol(col, headerRow, ["rawRankCol", "rawRank", "Raw Rank"]);
      const rNumIdx       = resolveCol(col, headerRow, ["rNum", "rnum"]);
      const lastRColIdx   = resolveCol(col, headerRow, ["lastr", "LASTR"]);
      const sortValColIdx = resolveCol(col, headerRow, ["sortval", "SortVal"]);
      const newLeftColIdx = resolveCol(col, headerRow, ["newleft", "NewLeft"]);

      let weekNum;
      if (forcedWeek !== null && forcedWeek !== undefined && forcedWeek !== "") {
        const m = forcedWeek.toString().match(/\d+/);
        weekNum = m ? parseInt(m[0], 10) : ((typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : 1);
      } else if (typeof getActiveWeekInfo === "function") {
        weekNum = getActiveWeekInfo(cleanGroupName).currentWeek;
      } else {
        weekNum = (typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : 1;
      }
      weekNum = Math.max(1, Math.min(10, weekNum));

      const targetWeekIdx = resolveCol(col, headerRow, ["w" + weekNum, "W" + weekNum, "Week " + weekNum]);
      const currRColIdx   = resolveCol(col, headerRow, ["r" + weekNum, "R" + weekNum]);
      const prevRColIdx   = resolveCol(col, headerRow, ["r" + (weekNum - 1), "R" + (weekNum - 1)]);

      let harvestWarnings = [];

      // 1. Harvest Game 1-6 / Totals from Sched sheet into Pts, then copy Pts into W<weekNum>
      if (doUpdateScores) {
        if (typeof harvestScoresFromSchedules === "function") {
          harvestWarnings = harvestScoresFromSchedules(ss, data, col, targetWeekIdx, schedSheet, weekNum) || [];
          if (harvestWarnings.length > 0) {
            Logger.log("Mismatches auto-corrected: " + harvestWarnings.join(" | "));
          }
        }

        if (hasCol(ptsColIdx) && hasCol(targetWeekIdx)) {
          for (let i = 1; i < data.length; i++) {
            const v = data[i][ptsColIdx];
            data[i][targetWeekIdx] = (v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v))) ? parseFloat(v) : "";
          }
        }
      }

      // 2. Pre-resolve ALL 10 rolling week columns (W1..W10)
      const weekColIndices = [];
      for (let w = 1; w <= 10; w++) {
        const wCol = resolveCol(col, headerRow, ["w" + w, "W" + w]);
        if (hasCol(wCol)) weekColIndices.push(wCol);
      }

      const activePlayers = [];
      const inactivePlayers = [];
      const maxPtsPerWeek = (typeof MAX_POINTS_PER_WEEK !== "undefined") ? MAX_POINTS_PER_WEEK : 45;

      // 3. Only players who played this week are ranked active; all non-playing players go to inactivePlayers
      const parsedRows = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const firstName = hasCol(col.first) ? String(row[col.first] || "").trim() : "";
        const lastName  = hasCol(col.last)  ? String(row[col.last] || "").trim() : "";
        const pName     = (hasCol(col.name) && row[col.name])
          ? row[col.name].toString().trim()
          : (firstName + " " + lastName).trim();
        if (!pName) continue;

        const phoneColIdx = hasCol(col.phone) ? col.phone : col.mobile;
        const pPhone = hasCol(phoneColIdx) ? cleanPhoneDigits(row[phoneColIdx]) : "";

        const v = hasCol(targetWeekIdx) ? row[targetWeekIdx] : "";
        const playedThisWeek = (v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v)));

        let cumScore = 0;
        let weeksPlayed = 0;
        for (let k = 0; k < weekColIndices.length; k++) {
          const wVal = row[weekColIndices[k]];
          if (wVal !== "" && wVal !== null && wVal !== undefined) {
            const val = parseFloat(wVal);
            if (!isNaN(val)) {
              cumScore += val;
              weeksPlayed++;
            }
          }
        }

        const rawStatus = (hasCol(col.status) && row[col.status] !== undefined && row[col.status] !== "")
          ? String(row[col.status]).toUpperCase().trim()
          : (playedThisWeek ? "ACTIVE" : "INACTIVE");

        // Preserve roster status for Score sheet (-i vs -I), while ranking ONLY players who played this week
        const rosterStatus = playedThisWeek ? "ACTIVE" : rawStatus;

        parsedRows.push({
          rowIndex: i,
          rowRaw: row.slice(),
          name: pName,
          firstName: firstName,
          lastName: lastName,
          phone: pPhone,
          playedThisWeek: playedThisWeek,
          isActive: playedThisWeek,
          status: rosterStatus,
          cumScore: cumScore,
          weeksPlayed: weeksPlayed
        });
      }

      const numActive = parsedRows.filter(p => p.isActive).length;
      if (numActive === 0) throw new Error("No active players with scores found for Week " + weekNum + ".");

      // 4. Parse prior standings R(weekNum - 1) scaled to current active pool size
      parsedRows.forEach(p => {
        const maxPts = maxPtsPerWeek * p.weeksPlayed;
        const cumPct = (maxPts > 0) ? (p.cumScore / maxPts) : 0;

        const prevCell = hasCol(prevRColIdx) ? p.rowRaw[prevRColIdx] : "";
        const prev = safeParseRankVal(prevCell, null, numActive);

        p.total = p.cumScore;
        p.weeks = p.weeksPlayed;
        p.maxPts = maxPts;
        p.maxPtsForPlayedWeeks = maxPts;
        p.pct = cumPct * 100;
        p.cumPct = cumPct;
        p.hasPrior = prev.hasPrior;
        p.prevRank = prev.hasPrior ? prev.rank : 0;
        p.priorRank = prev.hasPrior ? prev.rank : 0;
        p.priorNumPeople = prev.numPeople;
        p.priorPercent = prev.percent;
        p.priorRawStr = prev.rawStr;

        if (p.isActive) activePlayers.push(p);
        else inactivePlayers.push(p);
      });

      // 5. Compute unified mixed rankings (>4 wks pure Pt %, <=4 wks bounded movement)
      const rankedActive = computeMixedRankings(activePlayers);

      rankedActive.forEach(function (p) {
        const suffix = p.restrictionSuffix || "";
        const percentile = (p.rank / numActive) * 100;
        p.primaryFinalRank = p.rank;
        p.primaryIsRestr = (suffix !== "");
        p.primaryStr = percentile.toFixed(1) + "%" + suffix;
        p.method2Str = p.rank + "/" + numActive + suffix;
        p.diagSortVal = p.sortVal;
        p.diagNewLeft = p.rank;
      });

      inactivePlayers.forEach(function (p) {
        p.rank = "";
        p.primaryFinalRank = numActive + 1;
        p.primaryStr = (typeof formatInactiveStanding === "function")
          ? formatInactiveStanding(p, true)
          : (p.priorRawStr || "INACTIVE");
        p.method2Str = (typeof formatInactiveStanding === "function")
          ? formatInactiveStanding(p, false)
          : "INACTIVE";
      });

      // 6. Write accurate Tot, Pos, Pct, and standings back to Score sheet rows
      const writeRowData = (p, statusOverride) => {
        if (hasCol(col.group))      p.rowRaw[col.group] = cleanGroupName;
        if (hasCol(totColIdx))      p.rowRaw[totColIdx] = p.cumScore;
        if (hasCol(posColIdx))      p.rowRaw[posColIdx] = p.maxPtsForPlayedWeeks;
        if (hasCol(pctColIdx))      p.rowRaw[pctColIdx] = Number(p.cumPct.toFixed(6));
        if (hasCol(col.status))     p.rowRaw[col.status] = statusOverride || p.status;
        if (hasCol(rawRankColIdx))  p.rowRaw[rawRankColIdx] = p.diagSortVal || "";
        if (hasCol(sortValColIdx))  p.rowRaw[sortValColIdx] = p.diagSortVal || "";
        if (hasCol(newLeftColIdx))  p.rowRaw[newLeftColIdx] = p.isActive ? p.primaryFinalRank : "";
        if (hasCol(lastRColIdx))    p.rowRaw[lastRColIdx] = p.method2Str;
        if (hasCol(currRColIdx))    p.rowRaw[currRColIdx] = String(p.primaryStr || "").replace(/^'/, "");
        if (hasCol(rNumIdx))        p.rowRaw[rNumIdx] = p.isActive ? p.primaryFinalRank : "";
      };

      rankedActive.forEach(p => writeRowData(p, "ACTIVE"));
      inactivePlayers.forEach(p => writeRowData(p, p.status));

      rankedActive.sort((a, b) => a.primaryFinalRank - b.primaryFinalRank);
      inactivePlayers.sort((a, b) => {
        if (b.cumPct !== a.cumPct) return b.cumPct - a.cumPct;
        return b.cumScore - a.cumScore;
      });

      const finalRows = [headerRow];
      rankedActive.forEach(p => finalRows.push(p.rowRaw));
      inactivePlayers.forEach(p => finalRows.push(p.rowRaw));

      let targetColCount = headerRow.length;
      finalRows.forEach(r => {
        if (r.length > targetColCount) targetColCount = r.length;
      });
      finalRows.forEach(r => {
        while (r.length < targetColCount) r.push("");
        if (r.length > targetColCount) r.length = targetColCount;
      });

      if (hasCol(currRColIdx) && currRColIdx < targetColCount) {
        sheet.getRange(1, currRColIdx + 1, finalRows.length, 1).setNumberFormat("@");
      }
      if (hasCol(lastRColIdx) && lastRColIdx < targetColCount) {
        sheet.getRange(1, lastRColIdx + 1, finalRows.length, 1).setNumberFormat("@");
      }

      sheet.clearContents();
      sheet.getRange(1, 1, finalRows.length, targetColCount).setValues(finalRows);

      // 7. Update Rankings <Group> tab (non-playing players are listed as INACTIVE)
      if (typeof updateRankingsSheetForGroup === "function") {
        updateRankingsSheetForGroup(cleanGroupName, rankedActive, inactivePlayers, weekNum);
      }

      SpreadsheetApp.flush();

      // 8. Reorder Sched sheet to match updated rankings
      if (typeof rebuildSchedSheetOrder === "function") {
        rebuildSchedSheetOrder(ss, cleanGroupName, rankedActive, inactivePlayers, weekNum);
      }

      // 9. Clear stale roster caches
      if (typeof clearUnifiedCache === "function") clearUnifiedCache(cleanGroupName);
      try {
        CacheService.getScriptCache().remove("UNIFIED_ROSTER_CACHE_" + cleanGroupName.toUpperCase());
      } catch (e) {}

      let msg = "✅ Processed '" + sheet.getName() + "' (Week " + weekNum + "): " +
                numActive + " active, " + inactivePlayers.length + " inactive/did not play.";
      if (harvestWarnings.length > 0) {
        msg += " (" + harvestWarnings.length + " score mismatch(es) auto-corrected from schedule.)";
      }
      return msg;

    } catch (error) {
      try {
        if (origScoreData && origScoreData.length > 0 && sheet) {
          sheet.clearContents();
          sheet.getRange(1, 1, origScoreData.length, origScoreData[0].length).setValues(origScoreData);
        }
        if (origSchedData && origSchedData.length > 0 && schedSheet) {
          schedSheet.clearContents();
          schedSheet.getRange(1, 1, origSchedData.length, origSchedData[0].length).setValues(origSchedData);
        }
        SpreadsheetApp.flush();
      } catch (restoreErr) {}
      return "Processing failed. Data restored. Error: " + error.message;
    }
  });
}

function updateRankingsSheetForGroup(groupName, players, inactivePlayers, weekNum) {
  const ss = (typeof getDb === "function") ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  const cleanGroup = String(groupName || "").replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  const rankSheetName = "Rankings " + cleanGroup;
  let rankSheet = ss.getSheetByName(rankSheetName);

  if (!rankSheet) {
    rankSheet = ss.insertSheet(rankSheetName);
  }

  const maxPtsPerWeek = (typeof MAX_POINTS_PER_WEEK !== "undefined") ? MAX_POINTS_PER_WEEK : 45;

  // Exclude anyone who did not play this week (playedThisWeek === false) or is marked inactive
  const rawActive = (players || [])
    .filter(p => p && p.name && p.playedThisWeek !== false && String(p.status || "").trim().toUpperCase() !== "INACTIVE" && p.isActive !== false);

  const alreadyRanked = rawActive.length > 0 && rawActive.every(p => typeof p.rank === "number" && p.rank > 0);
  const ordered = alreadyRanked
    ? rawActive.slice().sort((a, b) => a.rank - b.rank)
    : computeMixedRankings(rawActive.map(p => {
        const weeks = Number(p.weeksPlayed ?? p.weeks) || 0;
        const total = Number(p.cumScore ?? p.totalPts ?? p.total) || 0;
        const maxPts = weeks * maxPtsPerWeek;
        const pct = maxPts > 0 ? (total / maxPts) * 100 : 0;
        return {
          rowIndex: p.rowIndex,
          name: String(p.name).trim(),
          total: total,
          weeks: weeks,
          maxPts: maxPts,
          pct: pct,
          playedThisWeek: true,
          prevRank: Number(p.prevRank ?? p.priorRank ?? p.rank) || 0,
          priorRank: Number(p.priorRank ?? p.prevRank ?? p.rank) || 0,
          priorNumPeople: Number(p.priorNumPeople) || 0,
          priorPercent: p.priorPercent ?? null,
          hasPrior: Boolean(p.hasPrior || Number(p.priorRank ?? p.prevRank) > 0)
        };
      }));

  const inactiveSource = inactivePlayers || (players || []).filter(p =>
    p && (p.playedThisWeek === false || p.isActive === false || String(p.status || "").trim().toUpperCase() === "INACTIVE")
  );

  const inactiveList = inactiveSource
    .filter(p => p && p.name)
    .map(p => {
      const weeks = Number(p.weeksPlayed ?? p.weeks) || 0;
      const total = Number(p.cumScore ?? p.totalPts ?? p.total) || 0;
      const maxPts = weeks * maxPtsPerWeek;
      const pct = maxPts > 0 ? (total / maxPts) * 100 : 0;

      return [
        "INACTIVE",
        String(p.name).trim(),
        Number(pct.toFixed(2)),
        total,
        weeks,
        "Inactive / Did Not Play"
      ];
    });

  rankSheet.clearContents();
  rankSheet.getRange(1, 1, 1, 6).setValues([[
    "Rank",
    "Name",
    "Pt %",
    "Pts",
    "Weeks",
    "Tier"
  ]]);
  rankSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  rankSheet.setFrozenRows(1);

  const activeRows = ordered.map(p => {
    const weeks = Number(p.weeksPlayed ?? p.weeks) || 0;
    const total = Number(p.cumScore ?? p.totalPts ?? p.total) || 0;
    const maxPts = weeks * maxPtsPerWeek;
    const pct = maxPts > 0 ? (total / maxPts) * 100 : (Number(p.pct) || 0);
    const isPctTier = weeks > 4;
    return [
      p.rank,
      String(p.name).trim(),
      Number(pct.toFixed(2)),
      total,
      weeks,
      isPctTier ? "> 4 Weeks (Pt %)" : "<= 4 Weeks (Bounded Movement)"
    ];
  });

  const allRows = [...activeRows, ...inactiveList];
  if (allRows.length > 0) {
    rankSheet.getRange(2, 1, allRows.length, 6).setValues(allRows);
  }

  if (weekNum !== undefined && weekNum !== null && weekNum !== "") {
    rankSheet.getRange(1, 1).setNote(
      "Week " + weekNum + " standings (10-week rolling window W1..W10).\n" +
      "> 4 weeks (> 180 possible pts): ranked purely by Pt %.\n" +
      "<= 4 weeks: bounded weekly movement within unified 1..N standings."
    );
  }

  const stampedWeek = Number(weekNum) || (typeof calculateCurrentWeekNumber === 'function' ? calculateCurrentWeekNumber() : 1);

  rankSheet.getRange("N1").setValue("RANKINGS_WEEK").setFontWeight("bold");
  rankSheet.getRange("N2").setValue(stampedWeek).setHorizontalAlignment("center");
  rankSheet.getRange("N3").setValue("Week " + stampedWeek).setHorizontalAlignment("center");
  rankSheet.getRange("N4").setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd")).setHorizontalAlignment("center");
}


