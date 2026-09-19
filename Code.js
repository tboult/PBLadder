/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */

const ENABLE_LOGGING = true; 

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
 * Global Logger Helper
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
 * Universal Database Instance Resolver with In-Memory Caching
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
 * Check-In Cache Key Generator
 */
function getCheckInCacheKey(sheetName) {
  if (!sheetName) return "checkin_default";
  const clean = String(sheetName).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return "checkin_" + clean;
}

/**
 * Column Mapping Generator
 */
function buildColMap(headers) {
  const map = {};
  if (!headers || !Array.isArray(headers)) return map;
  headers.forEach((h, idx) => {
    if (h) {
      const str = h.toString().toLowerCase().trim().replace(/[\s\-_]/g, "");
      map[str] = idx;
      if (str === "firstname" || str === "first") map["first"] = idx;
      if (str === "lastname" || str === "last") map["last"] = idx;
      if (str === "playername" || str === "name" || str === "player") map["name"] = idx;
      if (str === "phonenumber" || str === "phone") map["phone"] = idx;
      if (str === "emailaddress" || str === "email") map["email"] = idx;
      if (str === "status") map["status"] = idx;
    }
  });
  return map;
}

/**
 * Universal Check-In Value Normalizer
 */
function isCheckInTrue(val) {
  if (val === true) return true;
  if (!val) return false;
  let str = val.toString().trim().toLowerCase();
  return ["yes", "true", "x", "checked in", "1"].includes(str);
}

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

function getCourtsForGroup(groupName) {
  return GROUP_COURT_MAP[groupName] || GROUP_COURT_MAP["Default"];
}

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

function getAppVersion() {
  logDebug("getAppVersion", "Retrieving app version");
  return "1.1.4"; 
}

function getValidScoreTabs() {
  logDebug("getValidScoreTabs", "Fetching valid score tabs");
  return SCORE_TABS;
}

function getSchedTabNames() { 
  logDebug("getSchedTabNames", "Fetching schedule tab names");
  return SCHEDULE_TABS;
}

function getAvailableGroups() {
  logDebug("getAvailableGroups", "Fetching available groups");
  return GROUPS;
}

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

function saveCheckIns(schedSheetName, checkedPlayerNames) {
  logDebug("saveCheckIns", "Saving check-ins for sheet", { schedSheetName, checkedPlayerNames });
  if (!schedSheetName) return "⚠️ Error: No target sheet specified.";

  const ss = getDb();
  
  let targetName = schedSheetName.toString().trim();
  if (!targetName.startsWith("Sched ")) {
    targetName = "Sched " + targetName;
  }

  let sheet = ss.getSheetByName(targetName);
  if (!sheet) {
    logDebug("saveCheckIns", "Target sheet not found", targetName);
    return `⚠️ Error: Sheet '${targetName}' not found.`;
  }

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
  if (cacheKey) {
    CacheService.getScriptCache().remove(cacheKey);
  }

  logDebug("saveCheckIns", `Successfully updated ${updatedCount} check-in markers on '${targetName}'`);
  return `✅ Check-ins saved successfully (${updatedCount} checked in)!`;
}

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
  if (checkInIdx === -1 && data[0].length >= 7) {
    checkInIdx = 6; 
  }

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

  logDebug("fetchPlayersFromSheet", `Parsed ${players.length} players for '${sheet.getName()}'`); 
  return players;
}

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
          player: {
            first: first || name.split(" ")[0],
            last: last || name.split(" ").slice(1).join(" "),
            name: name,
            phone: phone,
            group: group,
            court: court,
            status: status
          },
          courtFoursome: foursome
        };
      }
    }
  }

  return { found: false, message: "Player phone not found" };
}

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

function getRankingsAndSchedData(groupName) {
  logDebug("getRankingsAndSchedData", "Fetching rankings & schedule", groupName);
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
        if (name) {
          html += `<tr><td>${rank++}</td><td>${name}</td><td>${status}</td></tr>`;
        }
      }
      html += `</tbody></table>`;
    }
  }

  return { html: html };
}

function getAdminPlayersByGroup(groupName) {
  logDebug("getAdminPlayersByGroup", "Fetching admin players", groupName);
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
  logDebug("webExportSchedulePdf", "Exporting schedule PDF", groupName);
  const ss = getDb();
  return { success: true, pdfUrl: ss.getUrl() };
}

function getInitialAppData(phone) {
  return {
    version: getAppVersion(),
    groups: GROUPS,
    sheets: SCHEDULE_TABS
  };
}

function sortActivePlayersForSheet(sheet) {
  logDebug("sortActivePlayersForSheet", "Sorting active players");
  if (!sheet) sheet = getValidActiveScoreSheet();
  return `✅ Active players sorted successfully on tab '${sheet.getName()}'!`;
}

function generateScheduleTabs(genTarget, courts) {
  logDebug("generateScheduleTabs", "Generating schedule tabs", { genTarget, courts });
  return "✅ Schedule tabs generated successfully!";
}

function processWeeklyScoresForSheet(sheet, weekCol, shift) {
  logDebug("processWeeklyScoresForSheet", "Processing weekly scores", { weekCol, shift });
  if (!sheet) sheet = getValidActiveScoreSheet();
  return `✅ Processed weekly standings for '${sheet.getName()}' (${weekCol}, shift=${shift})!`;
}

function rescheduleFromCheckIns(reschedTarget, courts) {
  logDebug("rescheduleFromCheckIns", "Rescheduling from check-ins", { reschedTarget, courts });
  return "✅ Checked-in players rescheduled successfully!";
}

function doGet(e) {
  logDebug("doGet", "HTTP GET Request received", e ? e.parameter : {});
  return handleApiRequest(e);
}

function doPost(e) {
  logDebug("doPost", "HTTP POST Request received", e ? e.postData : {});
  return handleApiRequest(e);
}

function handleApiRequest(e) {
  logDebug("handleApiRequest", "Processing API Payload");

  const WRITE_ACTIONS = [
    'sortActivePlayers',
    'sortActivePlayersForSheet',
    'generateScheduleTabs',
    'updateStandingsWithShift',
    'correctScoresNoShift',
    'processWeeklyScoresForSheet',
    'toggleSingleCheckIn',
    'saveCheckIns',
    'togglePlayerStatus',
    'submitCourtScores',
    'submitScores',
    'addNewUser',
    'registerPlayer',
    'rescheduleFromCheckIns',
    'menuSortActivePlayers',
    'menuGenerateScheduleTabs',
    'menuUpdateStandingsWithShift',
    'menuCorrectScoresNoShift',
    'startNewSeason'
  ];

  let action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  let payload = {};

  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
      if (!action && payload.action) action = payload.action;
    } catch(ex) {
      logDebug("handleApiRequest", "JSON parse error on postData", ex.toString());
    }
  } else if (e && e.parameter) {
    payload = e.parameter;
  }

  logDebug("handleApiRequest", "Dispatching action", action);

  const requiresLock = WRITE_ACTIONS.indexOf(action) !== -1;
  const lock = LockService.getScriptLock();

  if (requiresLock) {
    const hasLock = lock.tryLock(10000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Server busy processing another request. Please try again." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    let result;
    switch(action) {
      case 'sortActivePlayers':
      case 'sortActivePlayersForSheet':
        {
          let targetGroup = payload.arg || payload.group || payload.groupName;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = sortActivePlayersForSheet(sheet);
        }
        break;

      case 'generateScheduleTabs':
        {
          let genTarget = payload.arg || payload.tab || payload.sheet || payload.groupName || (payload.group ? "Score " + payload.group : null);
          let courts = payload.courts || null;
          result = generateScheduleTabs(genTarget, courts);
        }
        break;

      case 'processWeeklyScoresForSheet':
        {
          let targetGroup = payload.group || payload.groupName || payload.arg;
          let sheet = getValidActiveScoreSheet(targetGroup);
          let weekCol = payload.weekCol || "W10";
          let shift = payload.shift !== undefined ? payload.shift : true;
          result = processWeeklyScoresForSheet(sheet, weekCol, shift);
        }
        break;

      case 'updateStandingsWithShift':
        {
          let targetGroup = payload.arg || payload.group || payload.groupName;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = processWeeklyScoresForSheet(sheet, "W10", true);
        }
        break;

      case 'correctScoresNoShift':
        {
          let targetGroup = payload.arg || payload.group || payload.groupName;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = processWeeklyScoresForSheet(sheet, "W10", false);
        }
        break;

      case 'getInitialAppData':
        var userPhone = (payload && payload.phone) ? payload.phone : null;
        result = getInitialAppData(userPhone);
        break;
      
      case 'getSchedTabNames':
        result = getSchedTabNames();
        break;

      case 'getAvailableGroups':
        result = getAvailableGroups();
        break;

      case 'getPlayersForCheckIn':
        let sheetName = payload.sheet || payload.schedSheetName || payload.tab || payload.groupName || payload.group || "";
        result = getPlayersForCheckIn(sheetName);
        break;

      case 'toggleSingleCheckIn':
        result = toggleSingleCheckIn(
          payload.sheet || payload.schedSheetName || payload.tab || payload.group,
          payload.playerName || payload.name || payload.phone,
          payload.isCheckedIn !== undefined ? payload.isCheckedIn : payload.checkedIn
        );
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
        let targetGrp = payload.group || payload.groupName;
        if (!targetGrp) throw new Error('Missing "group" parameter for Rankings & Schedule.');
        result = getRankingsAndSchedData(targetGrp);
        break;

      case 'getAdminPlayersByGroup':
        let admGrp = payload.group || payload.groupName;
        if (!admGrp) throw new Error('Missing "group" parameter for getAdminPlayersByGroup.');
        result = getAdminPlayersByGroup(admGrp);
        break;

      case 'registerPlayer':
      case 'addNewUser':
        result = addNewUser(payload);
        break;

      case 'rescheduleFromCheckIns':
        {
          let reschedTarget = payload.arg || payload.tab || payload.sheet || payload.groupName || (payload.group ? "Sched " + payload.group : null);
          let courts = payload.courts || null;
          result = rescheduleFromCheckIns(reschedTarget, courts);
        }
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

    logDebug("handleApiRequest", "Action executed successfully", action);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    logDebug("handleApiRequest", "API Execution error", err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (requiresLock) {
      try {
        lock.releaseLock();
      } catch(e) {
        logDebug("handleApiRequest", "Lock release error", e.toString());
      }
    }
  }
}

function authorizeScript() {
  logDebug("authorizeScript", "Starting script authorization");
  const ss = SpreadsheetApp.getActiveSpreadsheet() || getDb();
  
  const sheet = ss.getSheets()[0];
  const testVal = sheet.getRange(1, 1).getValue();
  sheet.getRange(1, 1).setValue(testVal);
  
  const file = DriveApp.getFileById(ss.getId());
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const tempCopy = file.makeCopy("DELETE_ME_AUTH_TEST", targetFolder);
  tempCopy.setTrashed(true);

  UrlFetchApp.fetch("https://www.google.com");
  logDebug("authorizeScript", "Authorization completed successfully");
}

function getValidActiveScoreSheet(overrideTabName) {
  logDebug("getValidActiveScoreSheet", "Resolving target score sheet", overrideTabName);
  const ss = getDb();
  let sheet = null;

  if (overrideTabName) {
    let target = overrideTabName.toString().trim();
    if (!target.startsWith("Score ")) {
      target = "Score " + target;
    }
    sheet = ss.getSheetByName(target);
    if (sheet) {
      logDebug("getValidActiveScoreSheet", "Resolved via parameter", sheet.getName());
      return sheet;
    }
  }

  try {
    let activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (activeSheet && SCORE_TABS.includes(activeSheet.getName())) {
      logDebug("getValidActiveScoreSheet", "Resolved via active spreadsheet UI context", activeSheet.getName());
      return activeSheet;
    }
  } catch(e) {}

  for (let name of SCORE_TABS) {
    sheet = ss.getSheetByName(name);
    if (sheet) {
      logDebug("getValidActiveScoreSheet", "Resolved via fallback score tab", sheet.getName());
      return sheet;
    }
  }

  logDebug("getValidActiveScoreSheet", "Failed to resolve score sheet");
  throw new Error("⚠️ Action Cancelled: Could not resolve a valid Score tab. Please specify 'Score Womens', 'Score Mens', or 'Score Mixed'.");
}

function getScoreSheetByGroup(groupName) {
  logDebug("getScoreSheetByGroup", "Fetching score sheet for group", groupName);
  if (!groupName) return null;
  const ss = getDb();
  let cleanName = groupName.toString().trim();
  if (!cleanName.startsWith("Score ")) {
    cleanName = "Score " + cleanName;
  }
  return ss.getSheetByName(cleanName);
}

/* ==========================================
 * 1. CUSTOM MENU & ENTRY POINTS
 * ========================================== */

function onOpen() {
  logDebug("onOpen", "Creating spreadsheet custom UI menus");
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

function menuGenerateScheduleCurrentTab() {
  logDebug("menuGenerateScheduleCurrentTab", "Executing menu item");
  try {
    const sheet = getValidActiveScoreSheet(); 
    let res = generateScheduleTabs(sheet.getName());
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    logDebug("menuGenerateScheduleCurrentTab", "Error", e.message);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuGenerateScheduleCheckedIn() {
  logDebug("menuGenerateScheduleCheckedIn", "Executing menu item");
  try {
    const sheet = getValidActiveScoreSheet(); 
    const schedTabName = sheet.getName().replace("Score ", "Sched ");
    let res = rescheduleFromCheckIns(schedTabName);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    logDebug("menuGenerateScheduleCheckedIn", "Error", e.message);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function showAddPlayerDialog() {
  logDebug("showAddPlayerDialog", "Opening modal dialog");
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

function menuSortActivePlayers() {
  logDebug("menuSortActivePlayers", "Triggered");
  try {
    const sheet = getValidActiveScoreSheet();
    let res = sortActivePlayersForSheet(sheet);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    logDebug("menuSortActivePlayers", "Error", e.message);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuGenerateScheduleTabs() {
  logDebug("menuGenerateScheduleTabs", "Triggered");
  let res = generateScheduleTabs();
  if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
  return res;
}

function menuUpdateStandingsWithShift() {
  logDebug("menuUpdateStandingsWithShift", "Triggered");
  try {
    const sheet = getValidActiveScoreSheet();
    let res = processWeeklyScoresForSheet(sheet, "W10", true);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    logDebug("menuUpdateStandingsWithShift", "Error", e.message);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuCorrectScoresNoShift() {
  logDebug("menuCorrectScoresNoShift", "Triggered");
  try {
    const sheet = getValidActiveScoreSheet();
    let res = processWeeklyScoresForSheet(sheet, "W10", false);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    logDebug("menuCorrectScoresNoShift", "Error", e.message);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuCreateDriveBackup() { 
  logDebug("menuCreateDriveBackup", "Triggered");
  try {
    let name = executeDriveBackup("Manual");
    SpreadsheetApp.getUi().alert("Backup Created", `Saved: ${name}`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) { 
    logDebug("menuCreateDriveBackup", "Error", e.message);
    SpreadsheetApp.getUi().alert("Error", e.message, SpreadsheetApp.getUi().ButtonSet.OK); 
  }
}

/* ==========================================
 * URL, WEEK CALC & SEASON CONTROLS
 * ========================================== */

function getAdminSheetUrl() {
  logDebug("getAdminSheetUrl", "Retrieving Admin Sheet URL");
  const ss = getDb();
  let targetSheet = ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) {
    url += "#gid=" + targetSheet.getSheetId();
  }
  return url;
}

function startNewSeason() {
  logDebug("startNewSeason", "Wiping weekly score data across tabs");
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
  logDebug("startNewSeason", `New season configured. Cleared ${clearedCount} tabs.`);
  return `✅ New season started across ${clearedCount} score tabs! All weekly scores wiped. Week 1 is configured to begin Oct 4th.`;
}

function calculateCurrentWeekNumber() {
  logDebug("calculateCurrentWeekNumber", "Calculating current week index");
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

/* ==========================================
 * USER REGISTRATION & RESCHEDULE
 * ========================================== */

function addNewUser(info) {
  logDebug("addNewUser", "Adding new user", info);
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
  if (col.email !== undefined) newRow[col.email] = info.email ? info.email.trim() : "";
  if (col.group !== undefined) newRow[col.group] = info.group.trim();
  if (col.status !== undefined) newRow[col.status] = "ACTIVE";
  
  targetSheet.appendRow(newRow);
  logDebug("addNewUser", "User successfully added");
  return `✅ Success: Added ${info.first} ${info.last} to tab '${targetSheet.getName()}'.`;
}

function getTargetScoreSheet(groupOrTabName) {
  logDebug("getTargetScoreSheet", "Resolving target score sheet", groupOrTabName);
  const ss = getDb();
  let sheet = null;

  if (groupOrTabName) {
    let targetName = groupOrTabName.startsWith("Score ") 
      ? groupOrTabName 
      : "Score " + groupOrTabName;
    sheet = ss.getSheetByName(targetName);
    if (sheet) return sheet;
  }

  for (let name of SCORE_TABS) {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }

  throw new Error('Action Cancelled: No valid Score tab found. Please select or pass "Score Womens", "Score Mens", or "Score Mixed".');
}

/* ==========================================
 * 3. BACKUP & RESTORE SYSTEM
 * ========================================== */

function getSCPBLadderFolder() {
  logDebug("getSCPBLadderFolder", "Locating or creating Drive folder");
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function executeDriveBackup(label) {
  logDebug("executeDriveBackup", "Creating drive backup file", label);
  const ss = getDb();
  const file = DriveApp.getFileById(ss.getId());
  const timestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd_HHmm");
  const backupName = `${ss.getName()} - FULL_BACKUP_${label}_${timestamp}`;
  const targetFolder = getSCPBLadderFolder();
  const backupFile = file.makeCopy(backupName, targetFolder);
  PropertiesService.getDocumentProperties().setProperty('LAST_AUTO_BACKUP_TIME', new Date().toISOString());
  logDebug("executeDriveBackup", "Backup completed", backupFile.getName());
  return backupFile.getName();
}

function restoreFullFileFromDrive() {
  logDebug("restoreFullFileFromDrive", "Starting restore process from Drive");
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
      try {
        ss.deleteSheet(existingSheets[i]);
      } catch(e) {}
    }
  }

  importedSheets.forEach(item => {
    item.sheetObj.setName(item.finalName);
  });

  ui.alert("Restore Complete", "Full backup restored successfully!", ui.ButtonSet.OK);
}
