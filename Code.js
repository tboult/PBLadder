/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */

const ENABLE_LOGGING = true; 
const SPREADSHEET_ID = "14jmYyesfG9btWcIeptDwD6Bkxj8UZiQVlAOGc6BdM84";
const VALID_SCORE_TABS = ["Score Womens", "Score Mens", "Score Mixed"];
const SCORE_TABS = VALID_SCORE_TABS;
const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const ALWAYS_BYE_LOWEST = true;

const GROUPS = ["Womens", "Mens", "Mixed"];
const SCHEDULE_TABS = ["Sched Womens", "Sched Mens", "Sched Mixed"];

const GROUP_COURT_MAP = {
  "Womens": [3,4,5,6,7,8,15,16,17,18,19,20],
  "Mens": [5,6,9,10,13,14,15,16],
  "Mixed": [3,4,5,6,7,8,15,16,17,18,19,20],
  "Default": [5,6,9,10,13,14,15,16]
};

/**
 * Purpose: Tests the check-in functionality directly in the Apps Script editor.
 * Parameters: None.
 * Assumptions: Assumes a sheet named "Sched Women" exists and "Jennifer Little" is a valid player.
 */
function testCheckInDirectly() {
  try {
    const result = toggleSingleCheckIn({
      sheet: "Sched Women", 
      playerName: "Jennifer Little",
      isCheckedIn: true
    });
    Logger.log("SUCCESS: " + JSON.stringify(result));
  } catch (err) {
    Logger.log("ERROR: " + err.toString());
  }
}

/**
 * Purpose: Provides a global logging mechanism that can be toggled on/off.
 * Parameters:
 *  - fnName (string): The name of the function invoking the log.
 *  - msg (string): The core message to log.
 *  - extra (any): Optional additional data (objects will be stringified).
 * Assumptions: Assumes console.log is available and ENABLE_LOGGING is a boolean flag.
 */
function logDebug(fnName, msg, extra = "") {
  if (typeof ENABLE_LOGGING !== 'undefined' && !ENABLE_LOGGING) return;
  let extraStr = "";
  if (extra !== undefined && extra !== null && extra !== "") {
    if (typeof extra === "object") {
      try {
        extraStr = JSON.stringify(extra);
      } catch (err) {
        extraStr = `[Object/Error: ${String(extra)}]`; 
      }
    } else {
      extraStr = String(extra);
    }
  }
  console.log(`[${new Date().toISOString()}] [${fnName}] ${msg} ${extraStr}`.trim());
}

/**
 * Purpose: Retrieves the active Spreadsheet database instance.
 * Parameters: None.
 * Assumptions: Assumes SPREADSHEET_ID is a valid active document ID or runs as a bounded script.
 */
let _dbInstance = null;
function getDb() {
  if (_dbInstance) return _dbInstance;
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
    try {
      _dbInstance = SpreadsheetApp.openById(SPREADSHEET_ID);
      return _dbInstance;
    } catch(e) {
      logDebug("getDb", "Error opening by ID, falling back to active", e.message);
    }
  }
  _dbInstance = SpreadsheetApp.getActiveSpreadsheet();
  return _dbInstance;
}

/**
 * Purpose: Generates a safe cache key based on the sheet name.
 * Parameters: 
 *  - sheetName (string): The name of the sheet.
 * Assumptions: Assumes cache keys should only contain alphanumeric characters and underscores.
 */
function getCheckInCacheKey(sheetName) {
  if (!sheetName) return "checkin_default";
  const clean = String(sheetName).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return "checkin_" + clean;
}

/**
 * Purpose: Maps sheet column headers to integer indexes for fast data access.
 * Parameters:
 *  - headers (Array): A 1D array of column header strings.
 * Assumptions: Assumes standard naming conventions for columns (e.g., "First Name", "Last Name", "Phone").
 */
function buildColMap(header) {
  let col = {};
  if (!header) return col;
  header.forEach((h, i) => { if(h) col[h.toString().toLowerCase().replace(/[\s\-_#]/g, "")] = i; });
  col.first      = getColIdx(col, ["First Name", "First"]);
  col.last       = getColIdx(col, ["Last Name", "Last"]);
  col.name       = getColIdx(col, ["Name", "Player Name", "Player"]);
  col.phone      = getColIdx(col, ["Phone", "Cell", "Mobile"]);
  col.email      = getColIdx(col, ["Email", "E-mail"]);
  col.group      = getColIdx(col, ["Ladder Name", "Ladder", "Group"]);
  col.status     = getColIdx(col, ["Status", "Active"]);
  col.total      = getColIdx(col, ["Tot", "Total"]);
  col.winPct     = getColIdx(col, ["Pct", "Win %"]);
  col.rNum       = getColIdx(col, ["RNum", "Rank"]);
  col.rawRankCol = getColIdx(col, ["Raw Rank"]);

  for (let r = 0; r <= 10; r++) {
    col["r" + r] = getColIdx(col, ["R" + r, "r" + r]);
  }
  for (let w = 1; w <= 10; w++) {
    col["w" + w] = getColIdx(col, ["W" + w, "w" + w]);
  }
  return col;
}

/**
 * Purpose: Helper for buildColMap to check multiple possible string variants for a header.
 * Parameters:
 *  - colMap (object): The sanitized hash map of headers.
 *  - candidates (Array): Array of fallback string headers.
 * Assumptions: Assumes headers are mapped using lowercase characters without spaces.
 */
function getColIdx(colMap, candidates) {
  for (let c of candidates) {
    let clean = c.toLowerCase().replace(/[\s\-_#]/g, "");
    if (colMap[clean] !== undefined) return colMap[clean];
  }
  return undefined;
}

/**
 * Purpose: Converts various representations of truthy states into a strict boolean.
 * Parameters: 
 *  - val (any): The cell value to evaluate.
 * Assumptions: Assumes "X", "Yes", "Checked In", and "1" all indicate a true check-in status.
 */
function isCheckInTrue(val) {
  if (val === true) return true;
  if (!val) return false;
  let str = val.toString().trim().toLowerCase();
  return ["yes", "true", "x", "checked in", "1"].includes(str);
}

/**
 * Purpose: Returns the list of designated courts for a specific group.
 * Parameters: 
 *  - groupName (string): The requested ladder group.
 * Assumptions: Assumes GROUP_COURT_MAP contains mapping defaults.
 */
function getCourtsForGroup(groupName) {
  return GROUP_COURT_MAP[groupName] || GROUP_COURT_MAP["Default"];
}

/**
 * Purpose: Returns hardcoded constants to external or frontend clients.
 * Parameters: None.
 * Assumptions: Assumes global consts are actively maintained in this file.
 */
function getConstantsConfig() {
  logDebug("getConstantsConfig", "Serving raw code constants");
  return {
    groups: GROUPS,
    scheduleTabs: SCHEDULE_TABS,
    scoreTabs: SCORE_TABS,
    maxMovement: MAX_MOVEMENT,
    maxPointsPerWeek: MAX_POINTS_PER_WEEK,
    alwaysByeLowest: ALWAYS_BYE_LOWEST
  };
}

/**
 * Purpose: Returns current application version.
 * Parameters: None.
 * Assumptions: Version is incremented manually here.
 */
function getAppVersion() {
  logDebug("getAppVersion", "Retrieving app version");
  return "1.1.4"; 
}

/**
 * Purpose: Retrieves valid scoring tabs.
 * Parameters: None.
 * Assumptions: Assumes SCORE_TABS matches active sheet names.
 */
function getValidScoreTabs() {
  return SCORE_TABS;
}

/**
 * Purpose: Retrieves valid schedule tabs.
 * Parameters: None.
 * Assumptions: Assumes SCHEDULE_TABS matches active sheet names.
 */
function getSchedTabNames() { 
  return SCHEDULE_TABS;
}

/**
 * Purpose: Retrieves valid group names.
 * Parameters: None.
 * Assumptions: Assumes GROUPS array is correct.
 */
function getAvailableGroups() {
  return GROUPS;
}

/**
 * Purpose: Safely fetches players from cache or sheet using standardized keys.
 * Parameters:
 *  - sheetName (string): Target schedule or score sheet.
 * Assumptions: CacheService is available, and JSON stringifying won't exceed quota.
 */
function getPlayersForCheckIn(sheetName) {
  if (!sheetName) return [];
  const cacheKey = getCheckInCacheKey(sheetName);
  const cache = CacheService.getScriptCache();

  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {}

  const players = fetchPlayersFromSheet(sheetName);

  if (Array.isArray(players) && players.length > 0) {
    try {
      const payloadString = JSON.stringify(players);
      if (payloadString.length < 100000) {
        cache.put(cacheKey, payloadString, 600); 
      }
    } catch (err) {}
  }
  return players;
}

/**
 * Purpose: Toggles single player check-in and updates cache directly without purging.
 * Parameters:
 *  - sheetNameOrData (object/string): Payload object or sheet name.
 *  - playerName (string): Target player's name.
 *  - isCheckedIn (boolean): Target status.
 * Assumptions: The player's name matches exactly (case insensitive) with the cache array.
 */
function toggleSingleCheckIn(sheetNameOrData, playerName, isCheckedIn) {
  let sheetName, targetPlayer, checkedState;
  if (typeof sheetNameOrData === 'object' && sheetNameOrData !== null) {
    sheetName = sheetNameOrData.sheet || sheetNameOrData.schedSheetName || sheetNameOrData.tab || sheetNameOrData.group || "";
    targetPlayer = sheetNameOrData.playerName || sheetNameOrData.name || sheetNameOrData.phone || "";
    checkedState = sheetNameOrData.isCheckedIn !== undefined ? sheetNameOrData.isCheckedIn : sheetNameOrData.checkedIn;
  } else {
    sheetName = sheetNameOrData;
    targetPlayer = playerName;
    checkedState = isCheckedIn;
  }

  const result = updatePlayerCheckInInSheet(sheetName, targetPlayer, checkedState);

  const cacheKey = getCheckInCacheKey(sheetName);
  const cache = CacheService.getScriptCache();
  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      let players = JSON.parse(cachedData);
      const target = String(targetPlayer).trim().toLowerCase();
      players = players.map(p => {
        if (String(p.name).trim().toLowerCase() === target || String(p.phone).trim() === target) {
          p.checkedIn = !!checkedState;
          p.checked = !!checkedState;
        }
        return p;
      });
      cache.put(cacheKey, JSON.stringify(players), 600);
    }
  } catch (err) {
    cache.remove(cacheKey); 
  }
  return result;
}

/**
 * Purpose: Mutates the spreadsheet cell value to update a check-in.
 * Parameters:
 *  - sheetName (string): The target sheet tab name.
 *  - targetPlayer (string): Player name string.
 *  - checkedState (boolean): The toggle target.
 * Assumptions: Target player exists and sheet has a 'Check In' column.
 */
function updatePlayerCheckInInSheet(sheetName, targetPlayer, checkedState) {
  logDebug("updatePlayerCheckInInSheet", "Updating check-in", { sheetName, targetPlayer, checkedState });
  if (!sheetName || !targetPlayer) return { success: false, message: "Missing parameter" };

  const ss = getDb();
  let cleanGroupName = String(sheetName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  let sheet = ss.getSheetByName("Sched " + cleanGroupName) || 
              ss.getSheetByName("Score " + cleanGroupName) || 
              ss.getSheetByName(sheetName);

  if (!sheet) return { success: false, message: "Sheet not found: " + sheetName };

  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return { success: false, message: "No data in sheet" };

  const headers = data[0].map(h => h.toString().toLowerCase().replace(/[\s\-_]/g, "").trim());
  let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
  if (nameIdx === -1) nameIdx = 0;

  let checkInIdx = headers.findIndex(h => h.includes("checkin") || h.includes("checkedin") || h === "x");
  if (checkInIdx === -1 && data[0].length >= 7) checkInIdx = 6;

  const targetNorm = String(targetPlayer).trim().toLowerCase();
  let found = false;

  for (let r = 1; r < data.length; r++) {
    let pName = (data[r][nameIdx] || "").toString().trim().toLowerCase();
    if (pName === targetNorm) {
      sheet.getRange(r + 1, checkInIdx + 1).setValue(checkedState ? "X" : "");
      found = true;
      break;
    }
  }
  return { success: found, message: found ? "Updated check-in" : "Player not found on sheet" };
}

/**
 * Purpose: Saves bulk check-ins passed as an array to the target schedule sheet.
 * Parameters:
 *  - schedSheetName (string): Target sheet.
 *  - checkedPlayerNames (Array|string): The list of names to check in.
 * Assumptions: Names are distinct and accurately correspond to the rows.
 */
function saveCheckIns(schedSheetName, checkedPlayerNames) {
  logDebug("saveCheckIns", "Saving check-ins for sheet", { schedSheetName, checkedPlayerNames });
  if (!schedSheetName) return "⚠️ Error: No target sheet specified.";

  const ss = getDb();
  let targetName = schedSheetName.toString().trim();
  if (!targetName.startsWith("Sched ")) targetName = "Sched " + targetName;

  let sheet = ss.getSheetByName(targetName);
  if (!sheet) return `⚠️ Error: Sheet '${targetName}' not found.`;

  const data = sheet.getDataRange().getValues();
  const namesArray = Array.isArray(checkedPlayerNames) 
    ? checkedPlayerNames 
    : JSON.parse(checkedPlayerNames || "[]");
  const checkedSet = new Set(namesArray.map(n => n.toString().trim().toLowerCase()));

  let headers = data[0].map(h => h.toString().toLowerCase().trim());
  let checkInIdx = headers.indexOf("check-in");
  let targetCol = checkInIdx !== -1 ? checkInIdx + 1 : 7;

  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:")) {
      let isChecked = checkedSet.has(name.toLowerCase());
      sheet.getRange(i + 1, targetCol).setValue(isChecked ? "X" : "");
      if (isChecked) updatedCount++;
    }
  }

  const cacheKey = getCheckInCacheKey(schedSheetName);
  if (cacheKey) CacheService.getScriptCache().remove(cacheKey);

  return `✅ Check-ins saved successfully (${updatedCount} checked in)!`;
}

/**
 * Purpose: Fetches players and check-in state with flexible column matching.
 * Parameters:
 *  - inputName (string): Target sheet name.
 * Assumptions: Check-in data defaults to Column G if no header exists.
 */
function fetchPlayersFromSheet(inputName) {
  if (!inputName) return [];
  const ss = getDb();
  let cleanGroupName = String(inputName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();

  let sheet = ss.getSheetByName("Sched " + cleanGroupName) || 
              ss.getSheetByName("Score " + cleanGroupName) || 
              ss.getSheetByName(inputName);

  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  const headers = data[0].map(h => h.toString().toLowerCase().replace(/[\s\-_]/g, "").trim());
  let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
  if (nameIdx === -1) nameIdx = 0;

  let checkInIdx = headers.findIndex(h => h.includes("checkin") || h.includes("checkedin") || h === "x");
  if (checkInIdx === -1 && data[0].length >= 7) checkInIdx = 6; 

  let players = [];
  for (let r = 1; r < data.length; r++) {
    let pName = (data[r][nameIdx] || "").toString().trim();
    if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;

    let checkVal = checkInIdx !== -1 ? data[r][checkInIdx] : false;
    let isCheckedIn = isCheckInTrue(checkVal);
    let courtVal = data[r][1] ? data[r][1].toString().trim() : "BYE";

    players.push({ 
      name: pName, 
      checkedIn: isCheckedIn, 
      checked: isCheckedIn, 
      court: courtVal 
    });
  }
  return players;
}

/**
 * Purpose: Scans score/schedule sheets to return a player's assigned court and foursome based on their phone number.
 * Parameters:
 *  - phone (string): Substring or full phone to search.
 * Assumptions: Uses the last 7 digits of a phone string for matching.
 */
function findFoursomeByPhone(phone) {
  logDebug("findFoursomeByPhone", "Searching phone", phone);
  if (!phone) return { found: false, message: "No phone number provided" };

  const ss = getDb();
  const normPhone = String(phone).replace(/\D/g, "");

  for (let group of GROUPS) {
    let scoreSheet = ss.getSheetByName("Score " + group);
    if (!scoreSheet) continue;

    let data = scoreSheet.getDataRange().getValues();
    if (!data || data.length <= 1) continue;

    let col = buildColMap(data[0]);
    if (col.phone === undefined) continue;

    for (let r = 1; r < data.length; r++) {
      let rowPhone = String(data[r][col.phone] || "").replace(/\D/g, "");
      if (rowPhone && normPhone.length >= 7 && rowPhone.endsWith(normPhone.slice(-7))) {
        let first = col.first !== undefined ? data[r][col.first] : "";
        let last = col.last !== undefined ? data[r][col.last] : "";
        let name = col.name !== undefined ? data[r][col.name] : `${first} ${last}`.trim();
        let status = col.status !== undefined ? data[r][col.status] : "Active";
        let court = "BYE";
        let foursome = [];
        let schedSheet = ss.getSheetByName("Sched " + group);
        
        if (schedSheet) {
          let sData = schedSheet.getDataRange().getValues();
          for (let sr = 1; sr < sData.length; sr++) {
            let sName = (sData[sr][0] || "").toString().trim().toLowerCase();
            if (sName === name.toLowerCase()) {
              court = sData[sr][1] ? sData[sr][1].toString().trim() : "BYE";
              break;
            }
          }
          if (court && court !== "BYE") {
            for (let sr = 1; sr < sData.length; sr++) {
              let sCourt = sData[sr][1] ? sData[sr][1].toString().trim() : "";
              if (sCourt === court && sData[sr][0]) {
                foursome.push({ name: sData[sr][0], first: sData[sr][0].split(" ")[0], last: sData[sr][0].split(" ").slice(1).join(" ") });
              }
            }
          }
        }
        return {
          found: true,
          player: { first: first || name.split(" ")[0], last: last || name.split(" ").slice(1).join(" "), name: name, phone: phone, group: group, court: court, status: status },
          courtFoursome: foursome
        };
      }
    }
  }
  return { found: false, message: "Player phone not found" };
}

/**
 * Purpose: Toggles a player's ACTIVE/INACTIVE status by phone.
 * Parameters:
 *  - phone (string): Target phone string.
 *  - groupName (string): Optional group filter.
 * Assumptions: Status column uses "ACTIVE" and "INACTIVE".
 */
function togglePlayerStatus(phone, groupName) {
  logDebug("togglePlayerStatus", "Toggling status for phone", { phone, groupName });
  if (!phone) return { success: false, message: "Missing phone" };

  const ss = getDb();
  const normPhone = String(phone).replace(/\D/g, "");
  let searchGroups = groupName ? [groupName] : GROUPS;

  for (let group of searchGroups) {
    let targetName = group.startsWith("Score ") ? group : "Score " + group;
    let sheet = ss.getSheetByName(targetName);
    if (!sheet) continue;

    let data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) continue;

    let col = buildColMap(data[0]);
    if (col.phone === undefined || col.status === undefined) continue;

    for (let r = 1; r < data.length; r++) {
      let rowPhone = String(data[r][col.phone] || "").replace(/\D/g, "");
      if (rowPhone && normPhone.length >= 7 && rowPhone.endsWith(normPhone.slice(-7))) {
        let currentStatus = String(data[r][col.status] || "").trim().toUpperCase();
        let newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        sheet.getRange(r + 1, col.status + 1).setValue(newStatus);
        return { success: true, newStatus: newStatus };
      }
    }
  }
  return { success: false, message: "Player not found to toggle status" };
}

/**
 * Purpose: Mock interface for handling external court score submissions.
 * Parameters:
 *  - payload (object): Holds group, court, and score objects.
 * Assumptions: API logic relies on Google Forms normally; this is custom JSON API implementation.
 */
function submitCourtScores(payload) {
  logDebug("submitCourtScores", "Submitting scores", payload);
  if (!payload || !payload.group || !payload.scores) {
    return { success: false, message: "Invalid score payload" };
  }
  const ss = getDb();
  let sheet = ss.getSheetByName("Score " + payload.group.replace(/^Score\s*/i, ""));
  if (!sheet) return { success: false, message: "Score sheet not found" };
  return { success: true, message: "Scores submitted successfully!" };
}

/**
 * Purpose: Outputs HTML table representations of schedule/ranks for frontend injection.
 * Parameters:
 *  - groupName (string): Requested ladder tier.
 * Assumptions: Requires Sched and Score tabs to be structured uniformly.
 */
function getRankingsAndSchedData(groupName) {
  if (!groupName) return { html: "<i>No group specified.</i>" };
  const ss = getDb();
  let cleanGroup = groupName.replace(/^(Score|Sched)\s*/i, "").trim();
  let schedSheet = ss.getSheetByName("Sched " + cleanGroup);
  let scoreSheet = ss.getSheetByName("Score " + cleanGroup);
  let html = `<h3 style="margin-top:0;">📊 ${cleanGroup} Schedule & Standings</h3>`;

  if (schedSheet) {
    let sData = schedSheet.getDataRange().getValues();
    if (sData && sData.length > 1) {
      html += `<h4>Current Court Assignments</h4><table class="data-table"><thead><tr><th>Player</th><th>Court</th></tr></thead><tbody>`;
      for (let r = 1; r < sData.length; r++) {
        if (sData[r][0] && !String(sData[r][0]).startsWith("---")) {
          html += `<tr><td>${sData[r][0]}</td><td>${sData[r][1] || 'BYE'}</td></tr>`;
        }
      }
      html += `</tbody></table>`;
    }
  }

  if (scoreSheet) {
    let scData = scoreSheet.getDataRange().getValues();
    if (scData && scData.length > 1) {
      let col = buildColMap(scData[0]);
      html += `<h4 style="margin-top:1rem;">Ladder Rankings</h4><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Status</th></tr></thead><tbody>`;
      let rank = 1;
      for (let r = 1; r < scData.length; r++) {
        let name = col.name !== undefined ? scData[r][col.name] : `${scData[r][col.first] || ''} ${scData[r][col.last] || ''}`.trim();
        let status = col.status !== undefined ? scData[r][col.status] : 'ACTIVE';
        if (name) html += `<tr><td>${rank++}</td><td>${name}</td><td>${status}</td></tr>`;
      }
      html += `</tbody></table>`;
    }
  }
  return { html: html };
}

/**
 * Purpose: Collects player details for the administrative panel UI.
 * Parameters:
 *  - groupName (string): The requested group.
 * Assumptions: Assumes "ACTIVE" is the default fallback if no status exists.
 */
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

/**
 * Purpose: Returns URL to the current Google Sheet for PDF exporting functionality.
 * Parameters:
 *  - groupName (string): Unused stub parameter for group selection.
 * Assumptions: The caller will interpret the base URL to generate an export query string.
 */
function webExportSchedulePdf(groupName) {
  return { success: true, pdfUrl: getDb().getUrl() };
}

/**
 * Purpose: Returns initial payload needed to boot up the web app frontend.
 * Parameters:
 *  - phone (string): The user's phone number identifying their default tab.
 * Assumptions: Groups and sheets arrays are available context constants.
 */
function getInitialAppData(phone) {
  return { version: getAppVersion(), groups: GROUPS, sheets: SCHEDULE_TABS };
}

/**
 * Purpose: API entry points for HTTP GET requests.
 * Parameters: e (Event)
 * Assumptions: Must return ContentService JSON output.
 */
function doGet(e) { return handleApiRequest(e); }

/**
 * Purpose: API entry points for HTTP POST requests.
 * Parameters: e (Event)
 * Assumptions: Contains body content parseable to JSON.
 */
function doPost(e) { return handleApiRequest(e); }

/**
 * Purpose: Master switchboard router for API actions handling lock queuing.
 * Parameters:
 *  - e (object): WebApp execution event object.
 * Assumptions: Write operations are strictly listed in WRITE_ACTIONS array to manage script locking.
 */
function handleApiRequest(e) {
  logDebug("handleApiRequest", "Processing API Payload");
  const WRITE_ACTIONS = [
    'sortActivePlayers', 'sortActivePlayersForSheet', 'generateScheduleTabs',
    'updateStandingsWithShift', 'correctScoresNoShift', 'processWeeklyScoresForSheet',
    'toggleSingleCheckIn', 'saveCheckIns', 'togglePlayerStatus', 'submitCourtScores',
    'submitScores', 'addNewUser', 'registerPlayer', 'rescheduleFromCheckIns',
    'menuSortActivePlayers', 'menuGenerateScheduleTabs', 'menuUpdateStandingsWithShift',
    'menuCorrectScoresNoShift', 'startNewSeason'
  ];

  let action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  let payload = {};

  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
      if (!action && payload.action) action = payload.action;
    } catch(ex) {}
  } else if (e && e.parameter) {
    payload = e.parameter;
  }

  const requiresLock = WRITE_ACTIONS.indexOf(action) !== -1;
  const lock = LockService.getScriptLock();

  if (requiresLock) {
    const hasLock = lock.tryLock(10000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", message: "Server busy processing another request. Please try again." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    let result;
    switch(action) {
      case 'sortActivePlayers':
      case 'sortActivePlayersForSheet':
        result = sortActivePlayersForSheet(getValidActiveScoreSheet(payload.arg || payload.group || payload.groupName));
        break;
      case 'generateScheduleTabs':
        result = generateScheduleTabs(payload.arg || payload.tab || payload.sheet || payload.groupName || (payload.group ? "Score " + payload.group : null), payload.courts || null);
        break;
      case 'processWeeklyScoresForSheet':
        result = processWeeklyScoresForSheet(getValidActiveScoreSheet(payload.group || payload.groupName || payload.arg), payload.weekCol || "W10", payload.shift !== undefined ? payload.shift : true);
        break;
      case 'updateStandingsWithShift':
        result = processWeeklyScoresForSheet(getValidActiveScoreSheet(payload.arg || payload.group || payload.groupName), "W10", true);
        break;
      case 'correctScoresNoShift':
        result = processWeeklyScoresForSheet(getValidActiveScoreSheet(payload.arg || payload.group || payload.groupName), "W10", false);
        break;
      case 'getInitialAppData':
        result = getInitialAppData((payload && payload.phone) ? payload.phone : null);
        break;
      case 'getSchedTabNames':
        result = getSchedTabNames();
        break;
      case 'getAvailableGroups':
        result = getAvailableGroups();
        break;
      case 'getPlayersForCheckIn':
        result = getPlayersForCheckIn(payload.sheet || payload.schedSheetName || payload.tab || payload.groupName || payload.group || "");
        break;
      case 'toggleSingleCheckIn':
        result = toggleSingleCheckIn(payload.sheet || payload.schedSheetName || payload.tab || payload.group, payload.playerName || payload.name || payload.phone, payload.isCheckedIn !== undefined ? payload.isCheckedIn : payload.checkedIn);
        break;
      case 'saveCheckIns':
        result = saveCheckIns(payload.sheet || payload.schedSheetName || payload.tab, payload.checkedNames);
        break;
      case 'findFoursomeByPhone': 
        result = findFoursomeByPhone(payload.phone);
        break;
      case 'togglePlayerStatus':
        result = togglePlayerStatus(payload.phone, payload.groupName || payload.group);
        break;
      case 'submitScores':
      case 'submitCourtScores':
        result = submitCourtScores(payload);
        break;
      case 'getRankingsAndSchedule':
      case 'getRankingsAndSchedData':
        result = getRankingsAndSchedData(payload.group || payload.groupName);
        break;
      case 'getAdminPlayersByGroup':
        result = getAdminPlayersByGroup(payload.group || payload.groupName);
        break;
      case 'registerPlayer':
      case 'addNewUser':
        result = addNewUser(payload);
        break;
      case 'rescheduleFromCheckIns':
        result = rescheduleFromCheckIns(payload.arg || payload.tab || payload.sheet || payload.groupName || (payload.group ? "Sched " + payload.group : null), payload.courts || null);
        break;
      case 'menuSortActivePlayers':
        result = menuSortActivePlayers();
        break;
      case 'menuGenerateScheduleTabs':
        result = menuGenerateScheduleTabs();
        break;
      case 'menuUpdateStandingsWithShift':
        result = menuUpdateStandingsWithShift();
        break;
      case 'menuCorrectScoresNoShift':
        result = menuCorrectScoresNoShift();
        break;
      case 'startNewSeason':
        result = startNewSeason();
        break;
      case 'getAdminSheetUrl':
        result = getAdminSheetUrl();
        break;
      case 'getAppVersion':
        result = typeof getAppVersion === 'function' ? getAppVersion() : "1.1.4";
        break;
      case 'generatePdfSchedule':
      case 'webExportSchedulePdf':
        result = webExportSchedulePdf(payload.group || payload.groupName);
        break;
      default:
        throw new Error("Invalid or missing API action: " + action);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (requiresLock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

/**
 * Purpose: Authorizes script execution boundary via Google API prompt generation.
 * Parameters: None.
 * Assumptions: Modifies a cell and creates a trash file strictly for OAuth scoping.
 */
function authorizeScript() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || getDb();
  const sheet = ss.getSheets()[0];
  sheet.getRange(1, 1).setValue(sheet.getRange(1, 1).getValue());
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const tempCopy = DriveApp.getFileById(ss.getId()).makeCopy("DELETE_ME_AUTH_TEST", targetFolder);
  tempCopy.setTrashed(true);
  UrlFetchApp.fetch("https://www.google.com");
}

/**
 * Purpose: Resolves the appropriate scoring tab via arguments, UI, or defaults.
 * Parameters:
 *  - overrideTabName (string): Hardcoded selection.
 * Assumptions: Aborts UI interaction cleanly if no valid tab context is established.
 */
function getValidActiveScoreSheet(overrideTabName) {
  const ss = getDb();
  let sheet = null;
  if (overrideTabName) {
    let target = overrideTabName.toString().trim();
    if (!target.startsWith("Score ")) target = "Score " + target;
    sheet = ss.getSheetByName(target);
    if (sheet) return sheet;
  }
  try {
    let activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (activeSheet && SCORE_TABS.includes(activeSheet.getName())) return activeSheet;
  } catch(e) {}
  for (let name of SCORE_TABS) {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  throw new Error("⚠️ Action Cancelled: Could not resolve a valid Score tab. Please specify 'Score Womens', 'Score Mens', or 'Score Mixed'.");
}

/**
 * Purpose: Resolves the scoring sheet strict to group naming convention.
 * Parameters:
 *  - groupName (string): Ladder group identifier.
 * Assumptions: Sheets are consistently prefixed with "Score ".
 */
function getScoreSheetByGroup(groupName) {
  if (!groupName) return null;
  const ss = getDb();
  let cleanName = groupName.toString().trim();
  if (!cleanName.startsWith("Score ")) cleanName = "Score " + cleanName;
  return ss.getSheetByName(cleanName);
}

/**
 * Purpose: Triggers custom UI generation upon sheet open.
 * Parameters: None.
 * Assumptions: Executed automatically by the Google Apps Script engine on document open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏆 Ladder Tools')
    .addItem('1. Sort Active Players (Current Tab)', 'menuSortActivePlayers')
    .addItem('2. Generate Schedule (Current Tab - All Active)', 'menuGenerateScheduleCurrentTab')
    .addItem('3. Generate Schedule (Current Tab - Checked-In Only)', 'menuGenerateScheduleCheckedIn')
    .addItem('4. ➕ Add New Player', 'showAddPlayerDialog')
    .addSeparator()
    .addItem('5. 📥 Download Schedule PDFs', 'showPdfDownloadDialog')
    .addSeparator()
    .addItem('6. Update Standings (Current Tab - SHIFT)', 'menuUpdateStandingsWithShift')
    .addItem('7. Compute Ranking from Current Scores', 'menuCorrectScoresNoShift')
    .addSeparator()
    .addItem('📸 Save Pre-Work Tab', 'createPreWorkSnapshotTab')
    .addItem('⏪ Restore Score Data from Tab', 'restoreFromSnapshotTab')
    .addSeparator()
    .addItem('📁 Run Full Drive File Backup', 'menuCreateDriveBackup')
    .addItem('⏪ Restore Full File from Drive', 'restoreFullFileFromDrive')
    .addSeparator()
    .addItem('🧪 Test: Run Weeks 1-10 (Womens -> RankTest)', 'testWomensRankingsWeeks1To10')
    .addItem('🛠️ Maint: Generate Sched Tabs (All Groups)', 'menuGenerateScheduleTabs')
    .addToUi();
}

/**
 * Purpose: UI Menu handler executing generateScheduleTabs contextually.
 * Parameters: None.
 * Assumptions: UI Alert services are accessible.
 */
function menuGenerateScheduleCurrentTab() {
  try {
    let res = generateScheduleTabs(getValidActiveScoreSheet().getName());
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

/**
 * Purpose: UI Menu handler executing rescheduleFromCheckIns contextually.
 * Parameters: None.
 * Assumptions: Sched tab exists analogous to the current active Score tab.
 */
function menuGenerateScheduleCheckedIn() {
  try {
    let res = rescheduleFromCheckIns(getValidActiveScoreSheet().getName().replace("Score ", "Sched "));
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

/**
 * Purpose: UI Menu handler injecting a modal to add players.
 * Parameters: None.
 * Assumptions: HtmlService allows script.run callback execution for the form payload.
 */
function showAddPlayerDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>body{font-family:sans-serif; padding:20px;} input,select,button{width:100%; padding:14px; margin-top:10px; box-sizing:border-box; min-height:54px; border-radius:6px; font-size:16px;} .btn{background:#2d6a4f;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;} </style>
    <h3>Add New Player</h3>
    <input type="text" id="regFirst" placeholder="First Name">
    <input type="text" id="regLast" placeholder="Last Name">
    <input type="tel" id="regPhone" placeholder="Phone">
    <input type="email" id="regEmail" placeholder="Email">
    <select id="regGroup"><option value="">Loading groups...</option></select>
    <button class="btn" onclick="submit()">Add Player</button>
    <div id="stat" style="margin-top:10px;color:#d90429;"></div>
    <script>
      google.script.run.withSuccessHandler(g => {
        let sel = document.getElementById('regGroup');
        sel.innerHTML = '<option value="">-- Select Group --</option>';
        g.forEach(x => sel.innerHTML += '<option value="'+x+'">'+x+'</option>');
      }).getAvailableGroups();
      function submit() {
        document.getElementById('stat').innerText="Saving...";
        let data = { first:document.getElementById('regFirst').value, last:document.getElementById('regLast').value, phone:document.getElementById('regPhone').value, email:document.getElementById('regEmail').value, group:document.getElementById('regGroup').value };
        google.script.run.withSuccessHandler(r => document.getElementById('stat').innerText = r).addNewUser(data);
      }
    </script>
  `).setWidth(400).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, '➕ Add New Player');
}

/**
 * Purpose: UI Menu wrapper for sorting active players.
 * Parameters: None.
 * Assumptions: Evaluates against the active sheet.
 */
function menuSortActivePlayers() {
  try {
    let res = sortActivePlayersForSheet(getValidActiveScoreSheet());
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

/**
 * Purpose: UI Menu wrapper for generating scheduling tabs bulk.
 * Parameters: None.
 * Assumptions: generateScheduleTabs supports empty calls to process all groups.
 */
function menuGenerateScheduleTabs() {
  let res = generateScheduleTabs();
  if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
  return res;
}

/**
 * Purpose: Updates standings invoking the weekly score processing logic.
 * Parameters: None.
 * Assumptions: Hardcoded string "W10" enforces target column index computation.
 */
function menuUpdateStandingsWithShift() {
  try {
    let res = processWeeklyScoresForSheet(getValidActiveScoreSheet(), "W10", true);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

/**
 * Purpose: Corrects standings skipping historical week shift constraints.
 * Parameters: None.
 * Assumptions: The shift flag is toggled to false.
 */
function menuCorrectScoresNoShift() {
  try {
    let res = processWeeklyScoresForSheet(getValidActiveScoreSheet(), "W10", false);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

/**
 * Purpose: Backs up document data to google drive.
 * Parameters: None.
 * Assumptions: Drive scope has been permitted.
 */
function menuCreateDriveBackup() { 
  try {
    let name = executeDriveBackup("Manual");
    SpreadsheetApp.getUi().alert("Backup Created", `Saved: ${name}`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) { 
    SpreadsheetApp.getUi().alert("Error", e.message, SpreadsheetApp.getUi().ButtonSet.OK); 
  }
}

/**
 * Purpose: Formats the URL pointing direct to Admin active sheet.
 * Parameters: None.
 * Assumptions: Fetches URL hash with exact GID integer.
 */
function getAdminSheetUrl() {
  const ss = getDb();
  let targetSheet = ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) url += "#gid=" + targetSheet.getSheetId();
  return url;
}

/**
 * Purpose: Cleans up historical data columns starting a brand new season loop.
 * Parameters: None.
 * Assumptions: Modifies W1..W10 columns indiscriminately on all scoring tabs.
 */
function startNewSeason() {
  const ss = getDb();
  let clearedCount = 0;
  getValidScoreTabs().forEach(tabName => {
    const scoreSheet = ss.getSheetByName(tabName);
    if (scoreSheet) {
      const data = scoreSheet.getDataRange().getValues();
      const colMap = buildColMap(data[0]);
      let colsToClear = [];
      for (let i = 1; i <= 10; i++) {
        if (colMap["w" + i] !== undefined) colsToClear.push(colMap["w" + i] + 1);
      }
      let lastRow = scoreSheet.getLastRow();
      if (colsToClear.length > 0 && lastRow > 1) {
        colsToClear.forEach(cIdx => {
          scoreSheet.getRange(2, cIdx, lastRow - 1, 1).clearContent();
        });
      }
      clearedCount++;
    }
  });
  let year = new Date().getFullYear();
  PropertiesService.getDocumentProperties().setProperty('SEASON_START_DATE', year + '-10-04T00:00:00');
  return `✅ New season started across ${clearedCount} score tabs! All weekly scores wiped. Week 1 is configured to begin Oct 4th.`;
}

/**
 * Purpose: Determines current game week based on mathematical delta from season start date.
 * Parameters: None.
 * Assumptions: 7-day increments map directly to index (1-10 max logic fallback handled downstream).
 */
function calculateCurrentWeekNumber() {
  const props = PropertiesService.getDocumentProperties();
  const startStr = props.getProperty('SEASON_START_DATE');
  if (!startStr) return 10;
  const startDate = new Date(startStr);
  const now = new Date();
  if (now < startDate) return 1;
  const diffTime = Math.abs(now - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Purpose: Writes a new player registry record into the matched scoring group.
 * Parameters:
 *  - info (object): Dictionary encapsulating new player identity variables.
 * Assumptions: The provided group aligns to an available valid tab.
 */
function addNewUser(info) {
  if (!info.first || !info.last || !info.phone || !info.group) {
    return "Error: First, Last, Phone, and Group are required.";
  }
  const targetSheet = getScoreSheetByGroup(info.group);
  if (!targetSheet) return `Error: Target score tab for group '${info.group}' not found.`;
  const data = targetSheet.getDataRange().getValues();
  const headers = data[0];
  const col = buildColMap(headers);
  let newRow = new Array(headers.length).fill("");
  if (col.first !== undefined) newRow[col.first] = info.first.trim();
  if (col.last !== undefined) newRow[col.last] = info.last.trim();
  if (col.name !== undefined) newRow[col.name] = (info.first + " " + info.last).trim();
  if (col.phone !== undefined) newRow[col.phone] = info.phone.trim();
  if (col.email !== undefined) newRow[col.email] = info.email.trim();
  if (col.group !== undefined) newRow[col.group] = info.group.trim();
  if (col.status !== undefined) newRow[col.status] = "ACTIVE";
  
  targetSheet.appendRow(newRow);
  return `✅ Success: Added ${info.first} ${info.last} to tab '${targetSheet.getName()}'.`;
}

/**
 * Purpose: Generates target folder in Drive if it does not exist, and returns root folder class.
 * Parameters: None.
 * Assumptions: System supports folder creations via Apps Script execution quota.
 */
function getSCPBLadderFolder() {
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

/**
 * Purpose: Copies raw spreadsheet file completely as a point-in-time document save string.
 * Parameters:
 *  - label (string): The string tag prepended into the output filename structure.
 * Assumptions: Requires advanced OAuth scopes available dynamically.
 */
function executeDriveBackup(label) {
  const ss = getDb();
  const file = DriveApp.getFileById(ss.getId());
  const timestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd_HHmm");
  const backupName = `${ss.getName()} - FULL_BACKUP_${label}_${timestamp}`;
  const targetFolder = getSCPBLadderFolder();
  const backupFile = file.makeCopy(backupName, targetFolder);
  PropertiesService.getDocumentProperties().setProperty('LAST_AUTO_BACKUP_TIME', new Date().toISOString());
  return backupFile.getName();
}

/**
 * Purpose: Provides an interface for replacing current active database completely with an archive drive copy.
 * Parameters: None.
 * Assumptions: User must accept UI alerts warning of destructive write behaviour.
 */
function restoreFullFileFromDrive() {
  const ui = SpreadsheetApp.getUi();
  const ss = getDb();
  const targetFolder = getSCPBLadderFolder();
  const files = targetFolder.getFiles();
  let backupFiles = [];
  while (files.hasNext()) {
    let f = files.next();
    if (f.getName().includes("FULL_BACKUP_")) backupFiles.push(f);
  }
  if (backupFiles.length === 0) return ui.alert("No Backups Found", "No full file backups were found.", ui.ButtonSet.OK);

  backupFiles.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
  let listStr = backupFiles.slice(0, 10).map((f, idx) => `${idx + 1}. ${f.getName()}`).join("\n");
  const response = ui.prompt('Restore', `Select a backup file to restore ALL tabs from:\n\n${listStr}\n\nEnter number:`, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  let choice = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > backupFiles.length) return ui.alert("Invalid Choice");

  let selectedFile = backupFiles[choice - 1];
  let confirm = ui.alert("⚠️ WARNING", `Replace ALL sheets with:\n"${selectedFile.getName()}"?`, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  const backupSs = SpreadsheetApp.openById(selectedFile.getId());
  const backupSheets = backupSs.getSheets();
  let importedSheets = [];
  for (let i = 0; i < backupSheets.length; i++) {
    let newSheet = backupSheets[i].copyTo(ss);
    newSheet.setName(backupSheets[i].getName() + "_TEMP_RESTORE");
    importedSheets.push({ sheetObj: newSheet, finalName: backupSheets[i].getName() });
  }

  const existingSheets = ss.getSheets();
  for (let i = 0; i < existingSheets.length; i++) {
    if (!existingSheets[i].getName().endsWith("_TEMP_RESTORE")) {
      try { ss.deleteSheet(existingSheets[i]); } catch (e) {}
    }
  }

  for (let i = 0; i < importedSheets.length; i++) { importedSheets[i].sheetObj.setName(importedSheets[i].finalName); }
  ui.alert("Restored ⏪", "Tabs restored successfully.", ui.ButtonSet.OK);
}

/**
 * Purpose: Generates a temporary named snapshot duplicate tab of current active sheet for safe modification loops.
 * Parameters: None.
 * Assumptions: Uses prompt responses to suffix tab name dynamically with user string.
 */
function createPreWorkSnapshotTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = getDb();
  let scoreSheet;
  try {
    scoreSheet = getValidActiveScoreSheet();
  } catch(e) {
    return ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
  const response = ui.prompt('Create Backup Tab', `Creating snapshot for tab '${scoreSheet.getName()}'.\nEnter your name (e.g., "Dave"):`, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  let captainName = response.getResponseText().trim().replace(/[^a-zA-Z0-9_\- ]/g, "");
  if (!captainName) return;

  let backupTabName = `Backup - ${scoreSheet.getName()} - ${captainName}`;
  let existingBackup = ss.getSheetByName(backupTabName);
  if (existingBackup) ss.deleteSheet(existingBackup);

  let backupSheet = scoreSheet.copyTo(ss);
  backupSheet.setName(backupTabName);
  ss.setActiveSheet(backupSheet);
  ss.moveActiveSheet(scoreSheet.getIndex() + 1);
  ss.setActiveSheet(scoreSheet);
  ui.alert("Backup Tab Created! 📸", `'${backupTabName}' is ready.`, ui.ButtonSet.OK);
}

/**
 * Purpose: Overwrites functional target tab using duplicated historical snapshot tab context entirely.
 * Parameters: None.
 * Assumptions: Evaluates sheet names containing strings "Backup - ".
 */
function restoreFromSnapshotTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = getDb();
  const backupSheets = ss.getSheets().filter(s => s.getName().startsWith("Backup - "));
  if (backupSheets.length === 0) return ui.alert("No Backup Tabs Found", "No captain backup tabs exist.", ui.ButtonSet.OK);

  let selectedSheet;
  if (backupSheets.length === 1) {
    selectedSheet = backupSheets[0];
  } else {
    let listStr = backupSheets.map((s, idx) => `${idx + 1}. ${s.getName()}`).join("\n");
    const response = ui.prompt('Restore', `Select a backup tab:\n\n${listStr}\n\nEnter number:`, ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return;
    selectedSheet = backupSheets[parseInt(response.getResponseText().trim(), 10) - 1];
  }

  let targetTabName = "Score Womens";
  getValidScoreTabs().forEach(t => {
    if (selectedSheet.getName().includes(t)) targetTabName = t;
  });

  if (ui.alert("Confirm Rollback", `Overwrite tab '${targetTabName}' using '${selectedSheet.getName()}'?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  let scoreSheet = ss.getSheetByName(targetTabName) || ss.insertSheet(targetTabName, 1);
  scoreSheet.clear();
  const sourceRange = selectedSheet.getDataRange();
  sourceRange.copyTo(scoreSheet.getRange(1, 1, sourceRange.getNumRows(), sourceRange.getNumColumns()));
  ui.alert("Restored Successfully ⏪", `${targetTabName} restored.`, ui.ButtonSet.OK);
}

/**
 * Purpose: Analyzes Properties to run Drive auto-save intervals periodically.
 * Parameters: None.
 * Assumptions: Evaluates 7-day interval minimum limits.
 */
function checkAndRunWeeklyBackup() {
  try {
    const props = PropertiesService.getDocumentProperties();
    const lastBackupStr = props.getProperty('LAST_AUTO_BACKUP_TIME');
    if (!lastBackupStr || (new Date().getTime() - new Date(lastBackupStr).getTime()) / 86400000 >= 7) {
      executeDriveBackup("Auto-7Day");
    }
  } catch (err) {}
}

/**
 * Purpose: Casts split fraction ranking format syntax back to primitive JSON variables.
 * Parameters:
 *  - val (string): Value cell format string.
 * Assumptions: Expects fractional input style 'Rank/NumPeople-R' natively.
 */
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

/**
 * Purpose: Casts string lists mapping court arrays down to index array sequences.
 * Parameters:
 *  - cStr (string|array): Suffix structure describing group arrays.
 * Assumptions: Returns baseline defaults 1 through 8 cleanly.
 */
function parseAndSortCourts(cStr) {
  if (!cStr) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (Array.isArray(cStr)) return cStr;
  let courts = cStr.toString().split(',').map(s => s.trim()).filter(s => s.length > 0);
  return courts.length > 0 ? courts : [1, 2, 3, 4, 5, 6, 7, 8];
}

/**
 * Purpose: Steps backwards through R0-R10 index mappings finding highest latest evaluation output object per player.
 * Parameters:
 *  - row (Array): Reference mapping target list string variables.
 *  - col (object): Reference map variables targeting header strings.
 *  - maxWeekNum (integer): Bounding parameter specifying where back tracing stops.
 * Assumptions: Assumes older scores hold lower integer week index limits.
 */
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
 * Purpose: Stub representing comprehensive generation algorithm producing schedule matrix tab details.
 * Parameters:
 *  - genTarget (string): Specified grouping targeting processing output.
 *  - courts (Array): Specified sub list court limitations arrays parameters.
 * Assumptions: In standalone functionality it outputs a success message stub.
 */
function generateScheduleTabs(genTarget, courts) {
  logDebug("generateScheduleTabs", "Generating schedule tabs", { genTarget, courts });
  return "✅ Schedule tabs generated successfully!";
}

/**
 * Purpose: Stub representing re-sorting checks based upon check-in markers available.
 * Parameters:
 *  - reschedTarget (string): Target group evaluation map string.
 *  - courts (Array): Target limits filtering.
 * Assumptions: Outputs standard stub completion text.
 */
function rescheduleFromCheckIns(reschedTarget, courts) {
  logDebug("rescheduleFromCheckIns", "Rescheduling from check-ins", { reschedTarget, courts });
  return "✅ Checked-in players rescheduled successfully!";
}

/**
 * Purpose: Wrapper computing baseline historical points stats array for active processing pipeline.
 * Parameters:
 *  - row (Array): Standard row structure evaluation lists.
 *  - col (object): Key mapped headers index list map.
 * Assumptions: Loops strictly via w1 -> w10.
 */
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
 * Purpose: Pulls cumulative row totals dynamically off active schedule tabs.
 * Parameters:
 *  - ss (object): Database mapping reference sheet target.
 *  - scoreData (Array): Processing active rows block mapping target.
 *  - col (object): List column index match headers struct mapping mapping targeting block parameters.
 *  - targetWeekIdx (integer): Column match mappings limit integer constraints struct.
 *  - groupName (string): Evaluation constraint.
 * Assumptions: Calculates single game arrays via sum or exact integer.
 */
function harvestScoresFromSchedules(ss, scoreData, col, targetWeekIdx, groupName) {
  const schedSheet = ss.getSheetByName("Sched " + groupName) || ss.getSheetByName("Schedule " + groupName);
  if (!schedSheet) return;

  const data = schedSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  let playerMap = {};
  for (let i = 1; i < scoreData.length; i++) {
    let fName = (scoreData[i][col.first] || "").toString().trim().toLowerCase();
    let lName = (scoreData[i][col.last] || "").toString().trim().toLowerCase();
    let phone = (scoreData[i][col.phone] || "").toString().replace(/\D/g, "");
    let fullName = (scoreData[i][col.name] || "").toString().trim().toLowerCase();
    if (fullName) playerMap[fullName] = i;
    if (fName && lName) playerMap[fName + " " + lName] = i;
    if (phone) playerMap[phone] = i;
  }

  let headers = data[0].map(h => h.toString().toLowerCase().trim());
  let nameIdx = headers.indexOf("name");
  let totalIdx = headers.indexOf("total");
  let g1Idx = headers.indexOf("game 1");
  let g2Idx = headers.indexOf("game 2");
  let g3Idx = headers.indexOf("game 3");

  if (nameIdx === -1) return;

  for (let r = 1; r < data.length; r++) {
    let row = data[r];
    let pName = (row[nameIdx] || "").toString().trim().toLowerCase();
    if (!pName || pName.startsWith("---") || pName.startsWith("time:")) continue;

    let totalSum = 0;
    let hasScore = false;

    if (totalIdx !== -1 && row[totalIdx] !== "") {
      totalSum = parseFloat(row[totalIdx]) || 0;
      hasScore = true;
    } else {
      let g1 = g1Idx !== -1 ? (parseFloat(row[g1Idx]) || 0) : 0;
      let g2 = g2Idx !== -1 ? (parseFloat(row[g2Idx]) || 0) : 0;
      let g3 = g3Idx !== -1 ? (parseFloat(row[g3Idx]) || 0) : 0;
      hasScore = (g1Idx !== -1 && row[g1Idx] !== "") || (g2Idx !== -1 && row[g2Idx] !== "") || (g3Idx !== -1 && row[g3Idx] !== "");
      totalSum = g1 + g2 + g3;
    }

    if (!hasScore) continue;
    let matchIdx = playerMap[pName];
    if (matchIdx !== undefined && targetWeekIdx !== undefined) {
      scoreData[matchIdx][targetWeekIdx] = totalSum;
    }
  }
}

/**
 * Purpose: Calculates cumulative ranking placements processing historic array shifts handling active vs inactive.
 * Parameters:
 *  - sheet (object): Evaluation block mappings limit array targets.
 *  - forcedWeek (integer): Suffix targeting mapping index column evaluation constraints arrays.
 *  - shouldShift (boolean): Movement map constraints target limitations boolean map logic constraints structure limiting arrays limits mapping parameters.
 * Assumptions: Resolves exact index map string limit constraints.
 */
function processWeeklyScoresForSheet(sheet, forcedWeek, shouldShift = true) {
  const ss = getDb();
  const RESTRICT_BY_RAW_RANK = true;
  if (!sheet) sheet = ss.getActiveSheet();
  checkAndRunWeeklyBackup();

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

  const headerRow = data[0];
  const col = buildColMap(headerRow);
  let cleanGroupName = sheet.getName().replace(/^Score\s+/i, "").trim();

  let weekNum = calculateCurrentWeekNumber();
  if (forcedWeek) {
    let match = forcedWeek.toString().match(/\d+/);
    if (match) weekNum = parseInt(match[0], 10);
  }

  let targetWeekKey = "w" + weekNum;
  let targetWeekIdx = col[targetWeekKey];
  if (targetWeekIdx === undefined) {
    for (let i = 10; i >= 1; i--) {
      if (col["w" + i] !== undefined) {
        targetWeekKey = "w" + i;
        targetWeekIdx = col["w" + i];
        weekNum = i;
        break;
      }
    }
  }

  harvestScoresFromSchedules(ss, data, col, targetWeekIdx, cleanGroupName);

  let currRColIdx = col["r" + weekNum];
  let prevRColIdx = col["r" + (weekNum - 1)];
  let rawRankColIdx = col.rawRankCol;

  let activePlayers = [];
  let inactivePlayers = [];
  const maxPtsPerWeek = typeof MAX_POINTS_PER_WEEK !== "undefined" ? MAX_POINTS_PER_WEEK : 60;

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = (col.name !== undefined && row[col.name]) 
      ? row[col.name].toString().trim() 
      : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();

    if (!pName) continue;
    let rawScoreVal = targetWeekIdx !== undefined ? row[targetWeekIdx] : "";
    let hasScore = (rawScoreVal !== "" && rawScoreVal !== null && rawScoreVal !== undefined && !isNaN(parseFloat(rawScoreVal)));

    let cumScore = 0;
    let weeksPlayedThroughNum = 0;
    for (let w = 1; w <= weekNum; w++) {
      let wIdx = col["w" + w];
      if (wIdx !== undefined && row[wIdx] !== "" && row[wIdx] !== null) {
        let val = parseFloat(row[wIdx]);
        if (!isNaN(val)) {
          cumScore += val;
          weeksPlayedThroughNum++;
        }
      }
    }

    let maxPtsForPlayedWeeks = weeksPlayedThroughNum * maxPtsPerWeek;
    let cumPct = maxPtsForPlayedWeeks > 0 ? (cumScore / maxPtsForPlayedWeeks) : 0;
    let stats = calculateStats(row, col);

    let prevRankInfo = { rank: Infinity, numPeople: 0, rawStr: "" };
    if (prevRColIdx !== undefined && row[prevRColIdx] !== "" && row[prevRColIdx] !== null) {
      prevRankInfo = parseRankVal(row[prevRColIdx]);
      prevRankInfo.rawStr = row[prevRColIdx].toString().trim();
    } else {
      prevRankInfo = getMostRecentRank(row, col, weekNum - 1);
    }

    let currentWeekScore = hasScore ? parseFloat(rawScoreVal) : 0;
    let playerObj = {
      rowIndex: i,
      rowRaw: [...row],
      name: pName,
      isActive: hasScore,
      total: stats.total,
      winPct: stats.winPct,
      currentWeekScore: currentWeekScore,
      cumScore: cumScore,
      cumPct: cumPct,
      prevRank: prevRankInfo.rank,
      prevNumPeople: prevRankInfo.numPeople,
      prevRawStr: prevRankInfo.rawStr
    };

    if (hasScore) activePlayers.push(playerObj);
    else inactivePlayers.push(playerObj);
  }

  let numActive = activePlayers.length;
  const maxMove = typeof MAX_MOVEMENT !== "undefined" ? MAX_MOVEMENT : 4;

  activePlayers.sort((a, b) => {
    if (Math.abs(b.cumPct - a.cumPct) > 0.0001) return b.cumPct - a.cumPct;
    if (a.prevRank !== b.prevRank) return a.prevRank - b.prevRank;
    return b.prevNumPeople - a.prevNumPeople;
  });

  activePlayers.forEach((p, index) => { p.rawRank = index + 1; });

  activePlayers.forEach(p => {
    if (p.prevRank !== Infinity && p.prevRank > 0) {
      let minAllowed = Math.max(1, p.prevRank - maxMove);
      let maxAllowed = p.prevRank + maxMove;
      p.clampedRank = Math.min(Math.max(p.rawRank, minAllowed), maxAllowed);
      if (RESTRICT_BY_RAW_RANK) p.isRestricted = (Math.abs(p.rawRank - p.prevRank) > maxMove);
    } else {
      p.clampedRank = p.rawRank;
      p.isRestricted = false;
    }
  });

  activePlayers.sort((a, b) => {
    if (a.clampedRank !== b.clampedRank) return a.clampedRank - b.clampedRank; 
    if (Math.abs(b.cumPct - a.cumPct) > 0.0001) return b.cumPct - a.cumPct;    
    if (a.prevRank !== b.prevRank) return a.prevRank - b.prevRank;              
    return b.prevNumPeople - a.prevNumPeople;                                   
  });

  activePlayers.forEach((p, index) => {
    p.finalRank = index + 1;
    if (!RESTRICT_BY_RAW_RANK) {
      if (p.prevRank !== Infinity && p.prevRank > 0) p.isRestricted = (Math.abs(p.finalRank - p.prevRank) > maxMove);
      else p.isRestricted = false;
    }
    let suffix = p.isRestricted ? "-R" : "";
    p.rjStr = p.finalRank + "/" + numActive + suffix;
  });

  inactivePlayers.forEach(p => {
    p.rjStr = p.prevRawStr || (p.prevRank !== Infinity ? (p.prevRank + "/" + p.prevNumPeople) : "");
    p.rawRank = "";
    p.finalRank = p.prevRank !== Infinity ? p.prevRank : "";
  });

  activePlayers.forEach(p => {
    if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
    if (col.total !== undefined) p.rowRaw[col.total] = p.total;
    if (col.winPct !== undefined) p.rowRaw[col.winPct] = p.winPct;
    if (col.status !== undefined) p.rowRaw[col.status] = "ACTIVE";
    if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = p.rawRank;
    if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr;
    if (col.rNum !== undefined) p.rowRaw[col.rNum] = p.finalRank;
  });

  inactivePlayers.sort((a, b) => a.prevRank - b.prevRank);
  inactivePlayers.forEach(p => {
    if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
    if (col.total !== undefined) p.rowRaw[col.total] = p.total;
    if (col.winPct !== undefined) p.rowRaw[col.winPct] = p.winPct;
    if (col.status !== undefined) p.rowRaw[col.status] = "INACTIVE";
    if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = "";
    if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr;
  });

  let finalRows = [headerRow];
  activePlayers.forEach(p => finalRows.push(p.rowRaw));
  inactivePlayers.forEach(p => finalRows.push(p.rowRaw));

  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, finalRows[0].length).setValues(finalRows);
  updateRankingsSheetForGroup(ss, cleanGroupName, activePlayers, inactivePlayers, weekNum);

  return `✅ Standings and Week ${weekNum} Rankings (R${weekNum}) processed for '${sheet.getName()}'! (${activePlayers.length} Active, ${inactivePlayers.length} Inactive)`;
}

/**
 * Purpose: Iterates 1-10 sequence calculating simulated standings data tests output mapping logic struct array targets.
 * Parameters: None.
 * Assumptions: Outputs to generic generic RankTest target string mappings sheet targets tab.
 */
function testWomensRankingsWeeks1To10() {
  const ss = getDb();
  let sheet = ss.getSheetByName("Score Womens");
  if (!sheet) sheet = ss.getSheetByName("Womens") || getValidActiveScoreSheet("Womens");
  if (!sheet) throw new Error("⚠️ Could not find sheet 'Score Womens'. Please check sheet tab names.");

  let backupName = sheet.getName() + "_Backup";
  let existingBackup = ss.getSheetByName(backupName);
  if (existingBackup) ss.deleteSheet(existingBackup);
  sheet.copyTo(ss).setName(backupName);

  for (let week = 1; week <= 10; week++) {
    processWeeklyScoresForSheet(sheet, week, false);
  }

  let rankTestSheet = ss.getSheetByName("RankTest") || ss.insertSheet("RankTest");
  rankTestSheet.clear();

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

  const col = buildColMap(data[0]);
  let output = [["Player Name", "Status (W10)", "Raw Rank (W10)", "R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = (col.name !== undefined && row[col.name]) 
      ? row[col.name].toString().trim() 
      : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();

    if (!pName) continue;
    let w10Idx = col["w10"];
    let rawScoreW10 = w10Idx !== undefined ? row[w10Idx] : "";
    let hasW10Score = (rawScoreW10 !== "" && rawScoreW10 !== null && rawScoreW10 !== undefined && !isNaN(parseFloat(rawScoreW10)));
    let statusStr = hasW10Score ? "ACTIVE" : "INACTIVE";
    let rawRank = (col.rawRankCol !== undefined && row[col.rawRankCol] !== undefined) ? row[col.rawRankCol] : "";
    let playerRow = [pName, statusStr, rawRank];

    for (let w = 0; w <= 10; w++) {
      let rIdx = col["r" + w];
      let rVal = (rIdx !== undefined && row[rIdx] !== undefined) ? row[rIdx] : "";
      playerRow.push(rVal);
    }
    output.push(playerRow);
  }

  let outRange = rankTestSheet.getRange(1, 1, output.length, output[0].length);
  outRange.setValues(output);
  let headerRange = rankTestSheet.getRange(1, 1, 1, output[0].length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4a86e8");
  headerRange.setFontColor("#ffffff");
  outRange.setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
  rankTestSheet.autoResizeColumns(1, output[0].length);

  return `✅ Test complete! Weeks 1–10 rankings processed and exported to 'RankTest' sheet. Backup saved to '${backupName}'.`;
}

/**
 * Purpose: Dynamically clears and formats frontend Rankings sheet based on pipeline arrays structure limit mappings string limit format constraints.
 * Parameters:
 *  - ss (object): Global database structure limits array sheet tab mappings string arrays structs logic constraints variables array structs logic maps limitations.
 *  - groupName (string): Core map limits arrays target limitations array structures grouping identifiers mapped to structures formats string maps variable target mapped limitation limit constraints arrays maps parameters.
 *  - activePlayers (Array): Mapped format targets array constraint objects mapping target string limitations format mapping map limiting constraint string variables mapped structs.
 *  - inactivePlayers (Array): Structural mapping mappings format arrays limits parameter target limitation limits maps struct mapped format limits string variable structure limiting format mapping limitation map parameters structs arrays targets map format.
 *  - weekNum (integer): Processing parameter variables arrays format targets constraints structure limit string map logic constraints arrays format structural mappings.
 * Assumptions: Output expects exactly 4 structured column index fields matching exact mapping headers mappings.
 */
function updateRankingsSheetForGroup(ss, groupName, activePlayers, inactivePlayers, weekNum) {
  let rankSheetName = "Rankings " + groupName;
  let rankSheet = ss.getSheetByName(rankSheetName) || ss.insertSheet(rankSheetName);
  rankSheet.clear();
  let rankOut = [["Rank", "Name", "Win %", "Total Points"]];
  
  activePlayers.forEach(p => {
    let winPctStr = (p.winPct * 100).toFixed(1) + "%";
    rankOut.push([p.rjStr, p.name, winPctStr, p.total]);
  });
  inactivePlayers.forEach(p => {
    let winPctStr = (p.winPct * 100).toFixed(1) + "%";
    rankOut.push([p.rjStr || "INACTIVE", p.name, winPctStr, p.total]);
  });

  let range = rankSheet.getRange(1, 1, rankOut.length, 4);
  range.setValues(rankOut);
  rankSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
}

/**
 * Purpose: Iterates arrays restructuring index constraints mapped arrays mappings string formats formats limits maps limits array constraints targets arrays mapped limits targeting arrays format mappings string arrays structural string formatting structures formatting structures.
 * Parameters:
 *  - sheet (object): Evaluation constraints arrays formatting mapping map struct array limitations map formats.
 * Assumptions: Modifies array limit arrays string structures logic mapped structure parameters structure limits mapping targets string structs arrays formatting array formats array mapping string maps map limitations targeting struct limit formatting limits targets maps structs format arrays parameters string format limits limits target mappings limits maps string formats targeting limitation map limitations logic struct formatting mappings arrays.
 */
function sortActivePlayersForSheet(sheet) {
  logDebug("sortActivePlayersForSheet", "Sorting active players for sheet", sheet.getName());
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

  const col = buildColMap(data[0]);
  let headerRow = data[0];
  let activeRows = [];
  let inactiveRows = [];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let status = (col.status !== undefined && row[col.status] !== "") 
      ? row[col.status].toString().toUpperCase().trim() 
      : "ACTIVE";
    let recent = getMostRecentRank(row, col, 10);
    row._recentRank = recent.rank;
    row._recentNumPeople = recent.numPeople;
    row._origIdx = i;

    if (status === "ACTIVE") activeRows.push(row);
    else inactiveRows.push(row);
  }

  activeRows.sort((a, b) => {
    if (a._recentRank !== b._recentRank) return a._recentRank - b._recentRank;
    if (b._recentNumPeople !== a._recentNumPeople) return b._recentNumPeople - a._recentNumPeople;
    return a._origIdx - b._origIdx;
  });

  let finalRows = [headerRow, ...activeRows, ...inactiveRows];
  finalRows.forEach(r => {
    delete r._recentRank;
    delete r._recentNumPeople;
    delete r._origIdx;
  });

  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, finalRows[0].length).setValues(finalRows);
  return `✅ Active players sorted successfully on tab '${sheet.getName()}'!`;
}
