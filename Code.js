/*
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

let _dbInstance = null;


function testgetRankingsAndSchedData() {
    getRankingsAndSchedData("Mens")
}


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

function getCheckInCacheKey(sheetName) {
  if (!sheetName) return "checkin_default";
  const clean = String(sheetName).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return "checkin_" + clean;
}

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
  col.rnum       = getColIdx(col, ["RNum", "Rank"]);
  col.rawRankCol = getColIdx(col, ["Raw Rank"]);

  for (let r = 0; r <= 10; r++) {
    col["r" + r] = getColIdx(col, ["R" + r, "r" + r]);
  }
  for (let w = 1; w <= 10; w++) {
    col["w" + w] = getColIdx(col, ["W" + w, "w" + w]);
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

function isCheckInTrue(val) {
  if (val === true) return true;
  if (!val) return false;
  let str = val.toString().trim().toLowerCase();
  return ["yes", "true", "x", "checked in", "1"].includes(str);
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
    maxMovement: MAX_MOVEMENT,
    maxPointsPerWeek: MAX_POINTS_PER_WEEK,
    alwaysByeLowest: ALWAYS_BYE_LOWEST
  };
}

function getAppVersion() {
  logDebug("getAppVersion", "Retrieving app version");
  return "0.9.5"; 
}

function getValidScoreTabs() { return SCORE_TABS; }
function getSchedTabNames() { return SCHEDULE_TABS; }
function getAvailableGroups() { return GROUPS; }

function getPlayersForCheckIn(sheetNameOrData) {
  try {
    if (!sheetNameOrData) return [];
    
    let rawSheet = sheetNameOrData;
    if (typeof sheetNameOrData === 'object' && sheetNameOrData !== null) {
      rawSheet = sheetNameOrData.sheet || sheetNameOrData.schedSheetName || sheetNameOrData.tab || sheetNameOrData.groupName || sheetNameOrData.group || "";
    }
    if (!rawSheet || typeof rawSheet !== 'string') return [];

    const cleanGroup = rawSheet.replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    if (!cleanGroup) return [];
    
    const schedSheetName = "Sched " + cleanGroup;
    const cacheKey = getCheckInCacheKey(schedSheetName);
    const cache = CacheService.getScriptCache();

    try {
      const cached = cache.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn("Cache read error in getPlayersForCheckIn:", err);
    }

    const players = fetchPlayersFromSheet(schedSheetName);

    if (Array.isArray(players) && players.length > 0) {
      try {
        const payloadString = JSON.stringify(players);
        if (payloadString.length < 100000) {
          cache.put(cacheKey, payloadString, 600);
        }
      } catch (err) {
        console.warn("Cache write error in getPlayersForCheckIn:", err);
      }
      return players;
    }

    return Array.isArray(players) ? players : [];

  } catch (err) {
    console.error("Safely handled error in getPlayersForCheckIn:", err);
    return [];
  }
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

function fetchPlayersFromSheet(inputName) {
  if (!inputName) return [];

  const ss = (typeof getDb === 'function') ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Could not access active Spreadsheet.");

  const cleanGroupName = String(inputName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  const schedSheetName = "Sched " + cleanGroupName;
  let sheet = ss.getSheetByName(schedSheetName);

  if (!sheet) sheet = ss.getSheetByName(inputName);

  if (!sheet) {
    const availableTabs = ss.getSheets().map(s => '"' + s.getName() + '"').join(", ");
    throw new Error(`Check-In tab "${schedSheetName}" not found. Available tabs in Google Sheet: [${availableTabs}]`);
  }

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
    let isCheckedIn = (typeof isCheckInTrue === 'function') 
      ? isCheckInTrue(checkVal) 
      : (checkVal === true || String(checkVal).toUpperCase() === "TRUE" || String(checkVal).toUpperCase() === "YES" || String(checkVal) === "1");

    let courtVal = (data[r][1] !== undefined && data[r][1] !== null && String(data[r][1]).trim() !== "") 
      ? String(data[r][1]).trim() 
      : "BYE";

    players.push({ 
      name: pName, 
      checkedIn: isCheckedIn, 
      checked: isCheckedIn, 
      court: courtVal 
    });
  }

  return players;
}


function findFoursomeByPhone(phoneOrPayload, groupArg) {
  let phone, group;
  if (typeof phoneOrPayload === "object" && phoneOrPayload !== null) {
    phone = phoneOrPayload.phone;
    group = phoneOrPayload.group || phoneOrPayload.groupName || phoneOrPayload.selectedGroup;
  } else {
    phone = phoneOrPayload;
    group = groupArg;
  }

  if (typeof logDebug === "function") {
    logDebug("findFoursomeByPhone", "Searching phone/group", { phone: phone, group: group });
  }

  if (!phone) return { found: false, scheduleReady: false, message: "No phone number provided" };

  const ss = getDb();
  const normPhone = String(phone).replace(/\D/g, "");
  if (normPhone.length < 7) return { found: false, scheduleReady: false, message: "Phone number must be at least 7 digits" };

  let cleanGroup = group ? String(group).replace(/^(Score|Sched)\s*/i, "").trim() : null;
  let targetGroups = cleanGroup ? [cleanGroup] : (typeof GROUPS !== "undefined" ? GROUPS : []);

  for (let g of targetGroups) {
    let scoreSheet = ss.getSheetByName("Score " + g);
    if (!scoreSheet) continue;

    let data = scoreSheet.getDataRange().getValues();
    if (!data || data.length <= 1) continue;

    let col = (typeof buildColMap === "function") ? buildColMap(data[0]) : {};
    if (col.phone === undefined) continue;

    for (let r = 1; r < data.length; r++) {
      let rowPhone = String(data[r][col.phone] || "").replace(/\D/g, "");
      if (rowPhone && rowPhone.endsWith(normPhone.slice(-7))) {
        let first = col.first !== undefined ? String(data[r][col.first] || "").trim() : "";
        let last = col.last !== undefined ? String(data[r][col.last] || "").trim() : "";
        let name = col.name !== undefined ? String(data[r][col.name] || "").trim() : `${first} ${last}`.trim();
        let status = col.status !== undefined ? String(data[r][col.status] || "").trim() : "Active";
        
        let court = "BYE";
        let foursome = [];
        let scheduleReady = false;

        let schedSheet = ss.getSheetByName("Sched " + g);
        if (schedSheet) {
          let sData = schedSheet.getDataRange().getValues();

          if (sData && sData.length > 0) {
            let headerI1 = (sData[0] && sData[0][8] !== undefined) ? String(sData[0][8] || "").trim() : "";
            let valueI2  = (sData.length > 1 && sData[1] && sData[1][8] !== undefined) ? String(sData[1][8] || "").trim() : "";
            let currentActiveWeek = typeof getActiveWeekForGroup === "function" ? getActiveWeekForGroup(g) : null;

            if (headerI1.indexOf("SCHEDULE_WEEK") === 0) {
              if (!currentActiveWeek || headerI1.includes(currentActiveWeek)) {
                scheduleReady = true;
              }
            } else if (headerI1.toLowerCase().includes("week") && valueI2 !== "") {
              if (!currentActiveWeek || valueI2.includes(currentActiveWeek) || String(currentActiveWeek).includes(valueI2)) {
                scheduleReady = true;
              }
            } else if (headerI1 !== "" || valueI2 !== "") {
              scheduleReady = true;
            }
          }

            //tb hack for now
            scheduleReady    =true;

          if (scheduleReady) {
            let lowerName = name.trim().toLowerCase(); // FIX: Trimmed to prevent spaces mismatch

            for (let sr = 1; sr < sData.length; sr++) {
              let sName = String(sData[sr][0] || "").trim().toLowerCase();
              if (sName === lowerName) {
                court = sData[sr][1] ? String(sData[sr][1]).trim() : "BYE";
                break;
              }
            }

            if (court && court !== "BYE") {
              let lowerCourt = court.toLowerCase();
              for (let sr = 1; sr < sData.length; sr++) {
                let sCourt = String(sData[sr][1] || "").trim().toLowerCase();
                if (sCourt === lowerCourt && sData[sr][0]) {
                  let pName = String(sData[sr][0]).trim();
                  let parts = pName.split(" ");
                  foursome.push({
                    name: pName,
                    playerName: pName,
                    first: parts[0] || "",
                    last: parts.slice(1).join(" ") || ""
                  });
                }
              }
            }
          }
        }

        const calculatedFirst = first || name.split(" ")[0] || "";
        const calculatedLast = last || name.split(" ").slice(1).join(" ") || "";

        return {
          found: true,
          scheduleReady: scheduleReady,
          message: scheduleReady ? "Player found" : "Schedule not yet ready for this week",
          player: {
            first: calculatedFirst,
            last: calculatedLast,
            name: name,
            playerName: name, // FIX: Added key expected by check-in routines
            phone: phone,
            group: g,
            court: scheduleReady ? court : "Pending",
            status: status
          },
          courtFoursome: foursome
        };
      }
    }
  }

  return { 
    found: false, 
    scheduleReady: false,
    message: cleanGroup 
      ? `Player phone not found in group '${cleanGroup}'.` 
      : "Player phone not found in any group." 
  };
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
  try {
    logDebug("submitCourtScores", "Submitting scores payload", payload);
    if (!payload || (!payload.group && !payload.groupName) || !Array.isArray(payload.scores)) {
      return { success: false, message: "Invalid payload: Missing group or scores array." };
    }

    const ss = getDb();
    let cleanGroup = String(payload.group || payload.groupName).replace(/^(Score|Sched)\s*/i, "").trim();
    let schedSheet = ss.getSheetByName("Sched " + cleanGroup);

    if (!schedSheet) {
      return { success: false, message: `Schedule sheet 'Sched ${cleanGroup}' not found.` };
    }

    const data = schedSheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "Schedule sheet has no player rows." };

    let headers = data[0].map(h => h.toString().toLowerCase().trim());
    let nameIdx = headers.indexOf("player name") !== -1 ? headers.indexOf("player name") : headers.indexOf("name");
    if (nameIdx === -1) nameIdx = 0;

    let g1Idx = headers.indexOf("game 1");
    let g2Idx = headers.indexOf("game 2");
    let g3Idx = headers.indexOf("game 3");
    let totIdx = headers.indexOf("total");

    let submitterIdx = headers.findIndex(h => 
      h === "entered" || h === "entered by" || h === "submitted by" || h.includes("entered")
    );
    if (submitterIdx === -1 && data[0].length >= 8) {
      submitterIdx = 7; 
    }

    let submitterName = payload.submittedByName || payload.userName || payload.enteredBy || payload.user || "";

    if (!submitterName) {
      let rawPhone = payload.submittedBy || payload.phone || payload.userPhone || "";
      let phoneDigits = String(rawPhone).replace(/\D/g, "");

      if (phoneDigits.length >= 7 && typeof findFoursomeByPhone === 'function') {
        try {
          // Pass sheet explicitly to prevent findFoursomeByPhone from failing
          let lookup = findFoursomeByPhone({ 
            phone: phoneDigits, 
            group: cleanGroup, 
            sheet: "Sched " + cleanGroup 
          });
          if (lookup && lookup.player && lookup.player.name) {
            submitterName = lookup.player.name;
          }
        } catch (e) {
          logDebug("submitCourtScores", "Lookup fallback failed", e.message);
        }
      }

      if (!submitterName && rawPhone) {
        submitterName = String(rawPhone).trim();
      }
    }

    let scoresMap = {};
    payload.scores.forEach(item => {
      let key = String(item.name || "").trim().toLowerCase();
      if (key) scoresMap[key] = item;
    });

    let updatedCount = 0;

    for (let r = 1; r < data.length; r++) {
      let rowName = String(data[r][nameIdx] || "").trim().toLowerCase();
      if (scoresMap[rowName]) {
        let pScore = scoresMap[rowName];

        let curG1 = g1Idx !== -1 ? data[r][g1Idx] : "";
        let curG2 = g2Idx !== -1 ? data[r][g2Idx] : "";
        let curG3 = g3Idx !== -1 ? data[r][g3Idx] : "";

        if (g1Idx !== -1 && pScore.g1 !== undefined && pScore.g1 !== null && pScore.g1 !== "") {
          curG1 = pScore.g1;
          schedSheet.getRange(r + 1, g1Idx + 1).setValue(pScore.g1);
        }
        if (g2Idx !== -1 && pScore.g2 !== undefined && pScore.g2 !== null && pScore.g2 !== "") {
          curG2 = pScore.g2;
          schedSheet.getRange(r + 1, g2Idx + 1).setValue(pScore.g2);
        }
        if (g3Idx !== -1 && pScore.g3 !== undefined && pScore.g3 !== null && pScore.g3 !== "") {
          curG3 = pScore.g3;
          schedSheet.getRange(r + 1, g3Idx + 1).setValue(pScore.g3);
        }

        if (totIdx !== -1) {
          let sum = 0;
          let hasAnyScore = false;
          [curG1, curG2, curG3].forEach(v => {
            let num = parseInt(v, 10);
            if (!isNaN(num)) {
              sum += num;
              hasAnyScore = true;
            }
          });
          if (hasAnyScore) {
            schedSheet.getRange(r + 1, totIdx + 1).setValue(sum);
          }
        }

        if (submitterIdx !== -1 && submitterName) {
          schedSheet.getRange(r + 1, submitterIdx + 1).setValue(submitterName);
        }

        updatedCount++;
      }
    }

    // Safely clear script cache if key helper exists
    if (typeof CacheService !== 'undefined') {
      try {
        let cacheKey = (typeof getCheckInCacheKey === 'function') 
          ? getCheckInCacheKey("Sched " + cleanGroup) 
          : "checkin_cache_Sched_" + cleanGroup;
        
        if (cacheKey) {
          CacheService.getScriptCache().remove(cacheKey);
        }
      } catch (cacheErr) {
        logDebug("submitCourtScores", "Cache clear warning", cacheErr.message);
      }
    }

    return { 
      success: true, 
      message: `Successfully updated scores for ${updatedCount} player(s) on Sched ${cleanGroup}.` 
    };

  } catch (err) {
    logDebug("submitCourtScores Error", err.toString(), err.stack);
    return {
      success: false,
      message: "Server Error submitting scores: " + err.message
    };
  }
}

function getRankingsAndSchedData(groupName) {
  if (!groupName) return { html: "<i>No group specified.</i>" };
  const ss = getDb();
  let cleanGroup = String(groupName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();

  let schedSheet = ss.getSheetByName("Sched " + cleanGroup);
  let rankSheet = ss.getSheetByName("Rankings " + cleanGroup) || 
                  ss.getSheetByName("Score " + cleanGroup) || 
                  (typeof getScoreSheetByGroup === "function" ? getScoreSheetByGroup(cleanGroup) : null);

  let html = `<h3 style="margin-top:0;">📊 ${cleanGroup} Schedule & Standings</h3>`;
  let hasData = false;

  if (schedSheet) {
    let sheetWeekVal = (typeof getWeekNumber === "function") ? getWeekNumber(schedSheet) : schedSheet.getRange("I2").getValue();
    let sheetWeekNum = String(sheetWeekVal || "").replace(/\D/g, "");

    let activeWeekVal = (typeof getActiveWeek === "function" && getActiveWeek()) ? getActiveWeek() : 
                        (typeof getActiveWeekForGroup === "function" && getActiveWeekForGroup(cleanGroup)) ? getActiveWeekForGroup(cleanGroup) : 
                        (typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : null;
    let activeWeekNum = activeWeekVal ? String(activeWeekVal).replace(/\D/g, "") : "";

    let isWeekFinalized = Boolean(sheetWeekNum) && Boolean(activeWeekNum) && (sheetWeekNum === activeWeekNum);

    //TB hack for now
    isWeekFinalized      =true;
    if (!isWeekFinalized) {
      html += `
        <div style="background:#fff3bf; color:#856404; border:1px solid #ffeeba; padding:12px; margin-bottom:15px; border-radius:6px; font-weight:bold; text-align:center;">
          ⏳ Schedule for this week not yet finalized. 
        </div>`;
        hasData = true;
    } else {
      let sData = schedSheet.getDataRange().getDisplayValues();
      if (sData && sData.length > 1) {
        html += `<h4>Current Court Assignments</h4>
                 <table class="data-table">
                   <thead><tr><th>Player</th><th>Court</th></tr></thead>
                   <tbody>`;

        for (let r = 1; r < sData.length; r++) {
          let pName = sData[r][0];
          let court = sData[r][1] || 'BYE';

          if (pName && pName !== "Player Name" && !String(pName).startsWith("---")) {
            html += `<tr><td>${pName}</td><td>${court}</td></tr>`;
            hasData = true;
          }
        }
        html += `</tbody></table>`;
      }
    }
  }

  if (rankSheet) {
    let scData = rankSheet.getDataRange().getDisplayValues();
    if (scData && scData.length > 1) {
      let colMap = typeof buildColMap === "function" ? buildColMap(scData[0]) : {};
      let headers = scData[0];

      let findColIdx = function(possibleKeys) {
        if (colMap) {
          for (let k of possibleKeys) {
            let clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (colMap[clean] !== undefined) return colMap[clean];
            if (colMap[k] !== undefined) return colMap[k];
          }
        }
        for (let i = 0; i < headers.length; i++) {
          let h = String(headers[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
          for (let k of possibleKeys) {
            let target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (h === target || h.includes(target)) return i;
          }
        }
        return undefined;
      };

      let nameIdx  = findColIdx(["Player Name", "Name", "Player", "First"]);
      let rankIdx  = findColIdx(["Rank", "rnum", "#", "R", "Position"]);
      let winIdx   = findColIdx(["Win %", "WinPct", "Win", "Pct", "Win Rate"]);
      let totalIdx = findColIdx(["Total Points", "TotalPoints", "Total", "Points", "Pts", "Tot", "Score"]);

      html += `<h4 style="margin-top:1.5rem;">Ladder Rankings</h4>
               <table class="data-table">
                 <thead>
                   <tr><th>Player</th><th>Rank</th><th>Win %</th><th>Total</th></tr>
                 </thead>
                 <tbody>`;

      let rankorder = 1;
      let totalPlayers = scData.length - 1;

      for (let r = 1; r < scData.length; r++) {
        let row = scData[r];
        let name = nameIdx !== undefined ? row[nameIdx] : `${row[colMap.first || 0] || ''} ${row[colMap.last || 1] || ''}`.trim();

        if (!name || name === "Player Name" || name.startsWith("---")) continue;

        let rankVal = (rankIdx !== undefined && row[rankIdx]) ? row[rankIdx] : `${rankorder}/${totalPlayers}`;

        let winVal = "0.0%";
        if (winIdx !== undefined && row[winIdx] !== "" && row[winIdx] !== null) {
          let rawWinStr = String(row[winIdx]).replace('%', '').trim();
          let winNum = parseFloat(rawWinStr) || 0;
          if (winNum <= 1.0 && winNum > 0) winNum = winNum * 100;
          winVal = winNum.toFixed(1) + "%";
        }          

        let totalVal = "";
        if (totalIdx !== undefined && row[totalIdx] !== "" && row[totalIdx] !== null) {
          totalVal = row[totalIdx];
        } else {
          let gameSum = 0;
          let foundGames = false;
          for (let c = 0; c < row.length; c++) {
            let hName = String(headers[c]).toLowerCase();
            if (hName.includes("game") || hName.includes("g1") || hName.includes("g2") || hName.includes("g3")) {
              let pts = parseFloat(row[c]);
              if (!isNaN(pts)) {
                gameSum += pts;
                foundGames = true;
              }
            }
          }
          totalVal = foundGames ? String(gameSum) : "0";
        }

        html += `<tr>
          <td>${name}</td>
          <td>${rankVal}</td>
          <td>${winVal}</td>
          <td>${totalVal}</td>
        </tr>`;
        hasData = true;
        rankorder++;
      }
      html += `</tbody></table>`;
    }
  }

  if (!hasData) {
    return { html: `<i>No published schedule or rankings found for '${cleanGroup}'.</i>` };
  }

  return { html: html };
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
  return { version: getAppVersion(), groups: GROUPS, sheets: SCHEDULE_TABS };
}

function doGet(e) { return handleApiRequest(e); }
function doPost(e) { return handleApiRequest(e); }

function handleApiRequest(e) {
  let requiresLock = false;
  let lock = null;

  try {
    // 1. Safely parse URL query parameters and JSON post body
    e = e || {};
    let urlParams = e.parameter || {};
    let bodyParams = {};

    if (e.postData && e.postData.contents) {
      try {
        bodyParams = JSON.parse(e.postData.contents) || {};
      } catch (ex) {
        console.warn("Could not parse JSON post body:", ex);
      }
    }

    // Merge URL and Body parameters (Body parameters take precedence)
    let payload = Object.assign({}, urlParams, bodyParams);

    // 2. Extract action from parameter, top-level body, or nested payload wrapper
    let rawAction = urlParams.action || 
                    bodyParams.action || 
                    (bodyParams.payload && bodyParams.payload.action) || 
                    "";

    // 3. Clean hidden non-breaking spaces (\u00A0) and whitespace
    let action = String(rawAction)
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
      .trim();

    if (typeof logDebug === 'function') {
      logDebug("handleApiRequest", "Processing action: '" + action + "'");
    }

    if (!action) {
      throw new Error("Invalid or missing API action: action parameter is empty or undefined");
    }

    const WRITE_ACTIONS = [
      'sortActivePlayers', 'sortActivePlayersForSheet', 'generateScheduleTabs',
      'updateStandingsWithShift', 'correctScoresNoShift', 'processWeeklyScoresForSheet',
      'toggleSingleCheckIn', 'checkInPlayer', 'CheckInPlayer', 'saveCheckIns', 
      'togglePlayerStatus', 'submitCourtScores', 'submitScores', 'addNewUser', 
      'registerPlayer', 'rescheduleFromCheckIns', 'menuSortActivePlayers', 
      'menuGenerateScheduleTabs', 'menuUpdateStandingsWithShift',
      'menuCorrectScoresNoShift', 'startNewSeason'
    ];

    requiresLock = WRITE_ACTIONS.indexOf(action) !== -1;
    if (requiresLock) {
      lock = LockService.getScriptLock();
      const hasLock = lock.tryLock(10000);
      if (!hasLock) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "error", 
          message: "Server busy processing another request. Please try again." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    let result;
    switch(action) {

      case 'getInitialAppData':
        // Resolve nested payload object if frontend passes data as { payload: { phone: "...", group: "..." } }
        var actualPayload = (payload.payload && typeof payload.payload === 'object') ? payload.payload : payload;
        var userPhone = actualPayload.phone || payload.phone || null;
        var groupName = actualPayload.groupName || actualPayload.group || payload.groupName || payload.group || '';

        var initData = getInitialAppData(userPhone) || {};
        initData.checkInPlayers = initData.checkInPlayers || [];

        // Ignore 'N/A' placeholder values from initial load
        if (groupName && groupName.toUpperCase() !== 'N/A') {
          try {
            var targetSheet = "Sched " + String(groupName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
            var players = getPlayersForCheckIn(targetSheet);
            if (Array.isArray(players) && players.length > 0) {
              initData.checkInPlayers = players;
            }
          } catch (err) {
            console.warn("Failed fetching initial players safely:", err);
          }
        }
        result = initData;
        break;

      case 'getAdminPlayerStatus':
        result = getAdminPlayerStatus(payload);
        break;

      case 'togglePlayerActive':
        result = togglePlayerActive(payload);
        break;




        
      case 'checkInPlayer':
      case 'CheckInPlayer':         
        result = handleCheckInPlayer(payload);
        break;

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
        result = findFoursomeByPhone(payload.phone, payload.groupName || payload.group);
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
      case 'getRankingsAndScheduleData':
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
        result = typeof getAppVersion === 'function' ? getAppVersion() : "0.9.5";
        break;

      case 'generatePdfSchedule':
      case 'webExportSchedulePdf':
        result = webExportSchedulePdf(payload.group || payload.groupName);
        break;

      default:
        throw new Error("Invalid or missing API action: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() + (err.stack ? " | Stack: " + err.stack : "") 
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    if (requiresLock && lock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

function authorizeScript() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || getDb();
  const sheet = getValidActiveScoreSheet();
  sheet.getRange(1, 1).setValue(sheet.getRange(1, 1).getValue());
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const tempCopy = DriveApp.getFileById(ss.getId()).makeCopy("DELETE_ME_AUTH_TEST", targetFolder);
  tempCopy.setTrashed(true);
  UrlFetchApp.fetch("https://www.google.com");
}

function getValidActiveScoreSheet(groupOrSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();
  let rawInput = "";

  if (groupOrSheetName && typeof groupOrSheetName === 'string' && groupOrSheetName.trim() !== "") {
    rawInput = groupOrSheetName.trim();
  } else {
    const activeSheet = ss.getActiveSheet();
    if (activeSheet) rawInput = activeSheet.getName().trim();
  }

  if (!rawInput) {
    throw new Error("No tab or group name provided. Please select a valid group sheet.");
  }

  let cleanGroup = rawInput.replace(/^(Score|Sched|Rankings)\s*/i, "").trim();

  if (!cleanGroup) {
    throw new Error(`Could not extract group name from tab '${rawInput}'.`);
  }

  const targetScoreName = ("Score " + cleanGroup).toLowerCase();

  let scoreSheet = allSheets.find(s => {
    return s.getName().trim().toLowerCase() === targetScoreName;
  });

  if (!scoreSheet) {
    scoreSheet = allSheets.find(s => {
      const sNameClean = s.getName().trim().toLowerCase();
      return sNameClean.startsWith("score ") && sNameClean.includes(cleanGroup.toLowerCase());
    });
  }

  if (!scoreSheet) {
    const availableScoreSheets = allSheets
      .map(s => `'${s.getName()}'`)
      .filter(name => name.toLowerCase().includes("score"))
      .join(", ");
      
    throw new Error(
      `Could not match sheet 'Score ${cleanGroup}' from input '${rawInput}'. ` +
      `Existing score tabs in spreadsheet: [${availableScoreSheets || 'None found'}]. ` +
      `Please check tab names for typos or unexpected characters.`
    );
  }

  return scoreSheet;
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

function menuGenerateScheduleTabs() {
  let res = generateScheduleTabs();
  if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
  return res;
}

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

function menuCreateDriveBackup() { 
  try {
    let name = executeDriveBackup("Manual");
    SpreadsheetApp.getUi().alert("Backup Created", `Saved: ${name}`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) { 
    SpreadsheetApp.getUi().alert("Error", e.message, SpreadsheetApp.getUi().ButtonSet.OK); 
  }
}

function getAdminSheetUrl() {
  const ss = getDb();
  let targetSheet = ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) url += "#gid=" + targetSheet.getSheetId();
  return url;
}

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

function getSCPBLadderFolder() {
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

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

function checkAndRunWeeklyBackup() {
  try {
    const props = PropertiesService.getDocumentProperties();
    const lastBackupStr = props.getProperty('LAST_AUTO_BACKUP_TIME');
    if (!lastBackupStr || (new Date().getTime() - new Date(lastBackupStr).getTime()) / 86400000 >= 7) {
      executeDriveBackup("Auto-7Day");
    }
  } catch (err) {}
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

function generateScheduleTabs(genTarget, courts) {
  let targetGroup = genTarget;
  if (typeof genTarget === 'object' && genTarget !== null) {
    targetGroup = genTarget.group || genTarget.sheet || genTarget.schedSheetName || "";
  }

  logDebug("generateScheduleTabs", "Generating schedule tabs", { genTarget: targetGroup, courts });

  const ss = getDb();
  let groupsToProcess = [];
  const currentWeek = calculateCurrentWeekNumber();

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
      summary.push(`⚠️ Score tab for '${groupName}' not found.`);
      return;
    }

    sortActivePlayersForSheet(scoreSheet);
    const data = scoreSheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const col = buildColMap(data[0]);
    let activePlayers = [];

    for (let r = 1; r < data.length; r++) {
      let row = data[r];
      let status = (col.status !== undefined && row[col.status]) ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";
      let name = col.name !== undefined ? row[col.name] : `${row[col.first] || ''} ${row[col.last] || ''}`.trim();
      if (name && status === "ACTIVE") {
        activePlayers.push(name);
      }
    }

    let availableCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
    let schedSheetName = "Sched " + groupName;
    let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);

    schedSheet.clear();

    let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Total", "Entered"];
    let rows = [headers];

    let numPlayers = activePlayers.length;
    let foursomesCount = Math.floor(numPlayers / 4);

    let courtWarning = "";
    if (foursomesCount > availableCourts.length) {
      courtWarning = ` ⚠️ Error: Insufficient courts! Needed: ${foursomesCount}, Available: ${availableCourts.length}. Oversubscribed players assigned BYE.`;
      logDebug("generateScheduleTabs", "Insufficient courts error", { groupName, required: foursomesCount, available: availableCourts.length });
    }

    for (let i = 0; i < activePlayers.length; i++) {
      let pName = activePlayers[i];
      let currentFoursome = Math.floor(i / 4);
      let assignedCourt = "BYE";

      if (currentFoursome < availableCourts.length) {
        assignedCourt = "Court " + availableCourts[currentFoursome];
      }

      rows.push([pName, assignedCourt, "", "", "", "", "", ""]);
    }

    schedSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    schedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    var i1Cell = schedSheet.getRange("I1");
    i1Cell.setValue("SCHEDULE_WEEK");
    i1Cell.setFontWeight("bold");

    var i2Cell = schedSheet.getRange("I2");
    i2Cell.setValue(currentWeek);
    i2Cell.setHorizontalAlignment("center");

    const cacheKey = getCheckInCacheKey(schedSheetName);
    if (typeof CacheService !== 'undefined' && cacheKey) {
      CacheService.getScriptCache().remove(cacheKey);
    }

    let assignedCourtsCount = Math.min(foursomesCount, availableCourts.length);
    let byeCount = numPlayers - (assignedCourtsCount * 4);

    summary.push(`Created schedule for '${groupName}' with ${numPlayers} players (${assignedCourtsCount} courts assigned, ${byeCount} BYEs).${courtWarning}`);
  });

  return "✅ " + summary.join("\n");
}

function rescheduleFromCheckIns(reschedTarget, courts) {
  logDebug("rescheduleFromCheckIns", "Rescheduling checked-in players while preserving scores & check-in marks", { reschedTarget, courts });
  const ss = getDb();
  let targetName = reschedTarget ? String(reschedTarget).replace(/^Score\s*/i, "Sched ").trim() : "Sched Womens";
  if (!targetName.startsWith("Sched ")) targetName = "Sched " + targetName;
  let groupName = targetName.replace(/^Sched\s*/i, "").trim();

  let sheet = ss.getSheetByName(targetName);
  if (!sheet) return `⚠️ Error: Schedule tab '${targetName}' not found.`;

  const currentWeek = calculateCurrentWeekNumber();

  // 1. Read existing row data to preserve scores, check-in status, and prior court assignments
  let existingData = sheet.getDataRange().getValues();
  let existingMap = {};
  if (existingData.length > 1) {
    for (let r = 1; r < existingData.length; r++) {
      let row = existingData[r];
      let pName = row[0] ? String(row[0]).trim() : "";
      if (pName) {
        existingMap[pName] = {
          court: row[1] ? String(row[1]).trim() : "BYE",
          checkIn: row[2] !== undefined ? String(row[2]).trim() : "",
          g1: row[3] !== undefined ? row[3] : "",
          g2: row[4] !== undefined ? row[4] : "",
          g3: row[5] !== undefined ? row[5] : "",
          total: row[6] !== undefined ? row[6] : "",
          entered: row[7] !== undefined ? row[7] : ""
        };
      }
    }
  }

  // 2. Fetch current list of players and determine check-in statuses
  let players = fetchPlayersFromSheet(targetName);
  let availableCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
  let availableCourtNames = availableCourts.map(c => "Court " + c);

  let checkedInPlayers = [];
  let uncheckedPlayers = [];

  players.forEach(p => {
    let prev = existingMap[p.name] || { court: "BYE", checkIn: "", g1: "", g2: "", g3: "", total: "", entered: "" };
    // A player is checked in if marked via app OR if they already have a check-in mark on the sheet
    let isChecked = Boolean(p.checkedIn || p.checked || (prev.checkIn && prev.checkIn !== ""));
    p.prev = prev;
    p.isChecked = isChecked;

    if (isChecked) {
      checkedInPlayers.push(p);
    } else {
      uncheckedPlayers.push(p);
    }
  });

  // 3. Allocate players to courts
  let courtAssignments = {};
  availableCourtNames.forEach(cName => { courtAssignments[cName] = []; });

  let unassignedCheckedIn = [];

  // Phase A: Lock in players who are already assigned to valid courts
  checkedInPlayers.forEach(p => {
    let prevCourt = p.prev.court;
    let hasScores = (p.prev.g1 !== "" || p.prev.g2 !== "" || p.prev.g3 !== "" || p.prev.total !== "" || p.prev.entered !== "");

    if (availableCourtNames.includes(prevCourt) && (hasScores || courtAssignments[prevCourt].length < 4)) {
      courtAssignments[prevCourt].push(p);
      p.assignedCourt = prevCourt;
    } else {
      // Includes newly checked-in players previously sitting on "BYE"
      unassignedCheckedIn.push(p);
    }
  });

  // Phase B: Fill open court slots (< 4 players) with newly checked-in players
  availableCourtNames.forEach(cName => {
    while (courtAssignments[cName].length < 4 && unassignedCheckedIn.length > 0) {
      let candidate = unassignedCheckedIn.shift();
      candidate.assignedCourt = cName;
      courtAssignments[cName].push(candidate);
    }
  });

  // Phase C: Excess checked-in players remain on BYE
  unassignedCheckedIn.forEach(p => {
    p.assignedCourt = "BYE";
  });

  // 4. Construct output rows
  let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Total", "Entered"];
  let rows = [headers];

  checkedInPlayers.forEach(p => {
    let finalCourt = p.assignedCourt || "BYE";
    // Maintain check-in mark "X" even when assigned to BYE
    let checkInVal = p.prev.checkIn || "X";
    rows.push([
      p.name,
      finalCourt,
      checkInVal,
      p.prev.g1,
      p.prev.g2,
      p.prev.g3,
      p.prev.total,
      p.prev.entered
    ]);
  });

  uncheckedPlayers.forEach(p => {
    rows.push([
      p.name,
      "BYE",
      "",
      p.prev.g1,
      p.prev.g2,
      p.prev.g3,
      p.prev.total,
      p.prev.entered
    ]);
  });

  // 5. Write updated data to sheet
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

  // Preserve Week Marker metadata in I1:I2
  var i1Cell = sheet.getRange("I1");
  i1Cell.setValue("SCHEDULE_WEEK");
  i1Cell.setFontWeight("bold");

  var i2Cell = sheet.getRange("I2");
  i2Cell.setValue(currentWeek);
  i2Cell.setHorizontalAlignment("center");

  const cacheKey = getCheckInCacheKey(targetName);
  if (typeof CacheService !== 'undefined' && cacheKey) {
    CacheService.getScriptCache().remove(cacheKey);
  }

  let numChecked = checkedInPlayers.length;
  let activeCourtsCount = availableCourtNames.filter(c => courtAssignments[c].length > 0).length;
  let totalByes = rows.filter(r => r[1] === "BYE").length - 1;

  return `✅ Rescheduled '${targetName}' while preserving existing scores and check-in marks (${numChecked} checked-in, ${activeCourtsCount} courts assigned, ${totalByes} BYEs).`;
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

  // Helper to safely parse rank values (recovers Date objects and extracts numeric primary rank)
  function safeParseRankVal(val) {
    if (val === null || val === undefined || val === "") {
      return { rank: Infinity, numPeople: 0, rawStr: "" };
    }
    let str = "";
    if (val instanceof Date) {
      // Reconstruct "1/23" if Google Sheets converted the string to a Date object
      str = (val.getMonth() + 1) + "/" + val.getDate();
    } else {
      str = val.toString().trim();
    }
    str = str.replace(/^'/, ""); // Remove leading quote prefix if present
    let clean = str.replace(/-R$/i, "").trim();
    let parts = clean.split("/");
    let rank = parseInt(parts[0], 10);
    let numPeople = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return {
      rank: isNaN(rank) ? Infinity : rank,
      numPeople: isNaN(numPeople) ? 0 : numPeople,
      rawStr: str
    };
  }

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
      prevRankInfo = safeParseRankVal(row[prevRColIdx]);
    } else {
      let recent = getMostRecentRank(row, col, weekNum - 1);
      if (recent && typeof recent === "object" && recent.rank !== undefined) {
        prevRankInfo = recent;
      } else {
        prevRankInfo = safeParseRankVal(recent);
      }
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

  // Primary active player sort (Numeric)
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

  // Clamped rank sort (Numeric)
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
    if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr ? "'" + p.rjStr.replace(/^'/, "") : "";
    if (col.rNum !== undefined) p.rowRaw[col.rNum] = p.finalRank;
  });

  // Inactive player sort (Numeric)
  inactivePlayers.sort((a, b) => {
    if (a.prevRank === b.prevRank) return 0;
    if (a.prevRank === Infinity) return 1;
    if (b.prevRank === Infinity) return -1;
    return a.prevRank - b.prevRank;
  });

  inactivePlayers.forEach(p => {
    if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
    if (col.total !== undefined) p.rowRaw[col.total] = p.total;
    if (col.winPct !== undefined) p.rowRaw[col.winPct] = p.winPct;
    if (col.status !== undefined) p.rowRaw[col.status] = "INACTIVE";
    if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = "";
    if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr ? "'" + p.rjStr.replace(/^'/, "") : "";
  });

  let finalRows = [headerRow];
  activePlayers.forEach(p => finalRows.push(p.rowRaw));
  inactivePlayers.forEach(p => finalRows.push(p.rowRaw));

  // Set number format of target rank column to Plain Text to prevent Google Sheets date auto-coercion
  if (currRColIdx !== undefined) {
    sheet.getRange(1, currRColIdx + 1, finalRows.length, 1).setNumberFormat('@');
  }

  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, finalRows[0].length).setValues(finalRows);
  updateRankingsSheetForGroup(ss, cleanGroupName, activePlayers, inactivePlayers, weekNum);

  return `✅ Standings and Week ${weekNum} Rankings (R${weekNum}) processed for '${sheet.getName()}'! (${activePlayers.length} Active, ${inactivePlayers.length} Inactive)`;
}


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

function getTargetGroup(sheetOrName) {
  let sheetName = "";

  if (sheetOrName) {
    sheetName = typeof sheetOrName === 'string' ? sheetOrName : (sheetOrName.getName ? sheetOrName.getName() : "");
  } else {
    try {
      const activeSheet = getDb().getActiveSheet();
      if (activeSheet) sheetName = activeSheet.getName();
    } catch (e) {
      logDebug("getTargetGroup", "Could not fetch active sheet", e.toString());
    }
  }

  if (sheetName) {
    sheetName = sheetName.trim();

    let match = sheetName.match(/^(Score|Sched|Schedule|Ranking|Rankings|Standings)\s+(.+)$/i);
    if (match && match[2] && match[2].trim()) {
      return match[2].trim();
    }

    if (typeof GROUPS !== 'undefined' && Array.isArray(GROUPS)) {
      let foundGroup = GROUPS.find(g => g.toLowerCase() === sheetName.toLowerCase());
      if (foundGroup) return foundGroup;
    }
  }

  let errorMessage = `Invalid Active Sheet ('${sheetName || "Unknown"}'). Please select a valid Group tab (e.g., 'Score Mens', 'Sched Mens', or 'Rankings Mens') before running this action.`;

  try {
    let ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert("⚠️ Action Stopped: Invalid Sheet", errorMessage, ui.ButtonSet.OK);
    }
  } catch (e) {}

  throw new Error(errorMessage);
}

function cleanGroupName(input) {
  let str = "";

  if (typeof input === 'object' && input !== null) {
    str = input.group || input.groupName || (input.sheet && input.sheet !== "N/A" ? input.sheet : "") || input.schedSheetName || "";
  } else if (input) {
    str = String(input);
  }

  str = str.trim();
  if (!str || str.toLowerCase() === "n/a") {
    try {
      return getTargetGroup();
    } catch (e) {
      return (typeof GROUPS !== 'undefined' && GROUPS.length > 0) ? GROUPS[0] : "Womens";
    }
  }

  return str.replace(/^(Score|Sched|Schedule|Ranking|Rankings|Standings)\s*/i, "").trim();
}

function getScoreSheetByGroup(groupName) {
  const ss = getDb();
  const group = cleanGroupName(groupName);

  return ss.getSheetByName("Score " + group) || 
         ss.getSheetByName("Rankings " + group) || 
         ss.getSheetByName("Ranking " + group) || 
         ss.getSheetByName(group);
}

function getWeekNumber(sheet) {
  if (!sheet) return 1;
  var weekVal = sheet.getRange("I2").getValue();
  return weekVal !== "";
}

function setWeekNumber(sheet, weekNum) {
  if (!sheet) return;
  
  var titleCell = sheet.getRange("I1");
  titleCell.setValue("SCHEDULE_WEEK");
  titleCell.setFontWeight("bold");
  titleCell.setHorizontalAlignment("center");

  var valueCell = sheet.getRange("I2");
  valueCell.setValue(weekNum);
  valueCell.setHorizontalAlignment("center");
}

function getCurrentWeekIdentifier(group) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetGroup = group ? String(group).replace(/^(Sched|Score)\s*/i, '').trim() : '';
  var sheet = ss.getSheetByName("Sched " + targetGroup) || ss.getSheetByName(targetGroup) || ss.getActiveSheet();
  var rawWeek = getWeekNumber(sheet);
  var weekNum = String(rawWeek).replace(/[^0-9]/g, '');
  return weekNum ? "W" + weekNum : "W1";
}

function getActiveWeekForGroup(group) {
  return getCurrentWeekIdentifier(group);
}

function handleCheckInPlayer(payload) {
  try {
    const groupName = payload.group || payload.sheet || payload.schedSheetName || "";
    const cleanGroup = String(groupName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
    
    const ss = getDb();
    const schedSheet = ss.getSheetByName("Sched " + cleanGroup);

    // 1. First check if schedule sheet exists
    if (!schedSheet) {
      return {
        status: "failed",
        success: false,
        message: "Schedule sheet not found for " + cleanGroup
      };
    }

    // 2. CHECK IF WEEK IS FINALIZED BEFORE SEARCHING FOR PLAYER
    let sheetWeekVal = (typeof getWeekNumber === "function") ? getWeekNumber(schedSheet) : schedSheet.getRange("I2").getValue();
    let sheetWeekNum = sheetWeekVal ? String(sheetWeekVal).replace(/\D/g, "") : "";

    let activeWeekVal = (typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : null;
    let activeWeekNum = activeWeekVal ? String(activeWeekVal).replace(/\D/g, "") : "";

    let isWeekFinalized = Boolean(sheetWeekNum) && Boolean(activeWeekNum) && (sheetWeekNum === activeWeekNum);

      //TB HACK
      isWeekFinalized=true;      

    if (!isWeekFinalized) {
      return {
        status: "not_finalized",
        success: false,
        message: "⏳ Schedule for this week is not yet finalized. Check-in will open once the schedule is published."
      };
    }

    // 3. Week is finalized -> Proceed with player search
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


function ensurePlayerCheckedIn(sheetName, targetPlayer) {
  if (!sheetName || !targetPlayer) {
    return { success: false, status: "failed", message: "Missing required group or player parameters." };
  }

  const ss = typeof getDb === 'function' ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
  let cleanGroupName = String(sheetName).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  let sheet = ss.getSheetByName("Sched " + cleanGroupName) || 
              ss.getSheetByName("Score " + cleanGroupName) || 
              ss.getSheetByName(sheetName);

  if (!sheet) {
    return { success: false, status: "failed", message: "Sheet not found: " + sheetName };
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) {
    return { success: false, status: "failed", message: "No data found in sheet." };
  }

  const headers = data[0].map(h => h.toString().toLowerCase().replace(/[\s\-_]/g, "").trim());
  let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
  if (nameIdx === -1) nameIdx = 0;

  let checkInIdx = headers.findIndex(h => h.includes("checkin") || h.includes("checkedin") || h === "x");
  if (checkInIdx === -1 && data[0].length >= 7) checkInIdx = 2;

  let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("cell") || h.includes("mobile"));

  const targetNorm = String(targetPlayer).trim().toLowerCase();
  const normPhone = String(targetPlayer).replace(/\D/g, "");
  let found = false;

  for (let r = 1; r < data.length; r++) {
    let pName = (data[r][nameIdx] || "").toString().trim().toLowerCase();
    let pPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";

    let isMatch = (pName && pName === targetNorm) || 
                  (normPhone.length >= 7 && pPhone.endsWith(normPhone.slice(-7)));

    if (isMatch) {
      sheet.getRange(r + 1, checkInIdx + 1).setValue("X");
      found = true;
      break;
    }
  }

  if (found) {
    const cacheKey = getCheckInCacheKey("Sched " + cleanGroupName);
    if (typeof CacheService !== 'undefined') {
      try { CacheService.getScriptCache().remove(cacheKey); } catch(e) {}
    }
  }

  return { 
    success: found, 
    status: found ? "success" : "failed", 
    message: found ? "Player checked in successfully." : "Player not found on sheet." 
  };
}



function getAdminPlayerStatus(payload) {
  try {
    const group = payload.group || payload.groupName || "";
    const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim();
    const ss = getDb();

    const schedSheet = ss.getSheetByName("Sched " + cleanGroup);
    const scoreSheet = ss.getSheetByName("Score " + cleanGroup);

    if (!schedSheet && !scoreSheet) {
      return { success: false, message: "Sheets not found for group: " + cleanGroup, players: [] };
    }

    // A. Read Status & Phone from "Score [Group]"
    const activeMap = {}; 
    if (scoreSheet) {
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 0) {
        const scoreHeaders = scoreData[0].map(h => h.toString().toLowerCase().trim());
        
        // Find Status Column (Looks for StatusatusSt, Status, or Active)
        let activeIdx = scoreHeaders.findIndex(h => h.includes("status") || h.includes("active"));
        if (activeIdx === -1) activeIdx = 0; // Fallback to Column A

        let nameIdx = scoreHeaders.findIndex(h => h.includes("name") || h.includes("player"));
        if (nameIdx === -1) nameIdx = 1; // Fallback to Column B

        let phoneIdx = scoreHeaders.findIndex(h => h.includes("phone") || h.includes("mobile"));
        if (phoneIdx === -1) phoneIdx = 5; // Fallback to Column F

        for (let r = 1; r < scoreData.length; r++) {
          const row = scoreData[r];
          const pName = String(row[nameIdx] || "").trim().toLowerCase();
          const pPhone = String(row[phoneIdx] || "").replace(/\D/g, "");

          const statusVal = String(row[activeIdx] || "").trim().toLowerCase();
          const isActive = statusVal === "" || ["active", "y", "yes", "true", "x"].includes(statusVal);

          if (pName) activeMap[pName] = isActive;
          if (pPhone) activeMap[pPhone] = isActive;
        }
      }
    }

    // B. Build Player List from "Sched [Group]"
    let players = [];
    const mainSheet = schedSheet || scoreSheet;
    const data = mainSheet.getDataRange().getValues();

    if (data.length > 1) {
      const headers = data[0].map(h => h.toString().toLowerCase().trim());
      
      let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
      if (nameIdx === -1) nameIdx = 1;

      let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile"));
      if (phoneIdx === -1 && mainSheet === scoreSheet) phoneIdx = 5;

      const checkIdx = headers.findIndex(h => h.includes("check") || h === "checked in" || h === "checkedin");
      const courtIdx = headers.findIndex(h => h.includes("court"));

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const pName = String(row[nameIdx] || "").trim();
        if (!pName) continue;

        const cleanName = pName.toLowerCase();
        const phoneStr = phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : "";
        const cleanPhone = phoneStr.replace(/\D/g, "");

        let isActive = true;
        if (activeMap.hasOwnProperty(cleanName)) {
          isActive = activeMap[cleanName];
        } else if (cleanPhone && activeMap.hasOwnProperty(cleanPhone)) {
          isActive = activeMap[cleanPhone];
        }

        const rawCheck = checkIdx !== -1 ? String(row[checkIdx]).trim().toLowerCase() : "";
        const isCheckedIn = ["x", "true", "yes", "checked"].includes(rawCheck) || row[checkIdx] === true;

        players.push({
          name: pName,
          phone: phoneStr,
          active: isActive,
          checkedIn: isCheckedIn,
          court: courtIdx !== -1 ? String(row[courtIdx] || "").trim() : ""
        });
      }
    }

    return { success: true, players: players };
  } catch (err) {
    return { success: false, error: err.toString(), players: [] };
  }
}

function togglePlayerActive(payload) {
  try {
    const group = payload.group || payload.groupName || "";
    const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim();
    
    const targetName = String(payload.name || payload.playerName || payload.identifier || "").trim().toLowerCase();
    const targetPhone = String(payload.phone || payload.identifier || "").replace(/\D/g, "");
    const newActiveState = payload.active === true || String(payload.active).toLowerCase() === "true";

    const ss = getDb();
    const scoreSheet = ss.getSheetByName("Score " + cleanGroup);

    if (!scoreSheet) return { success: false, message: "Score sheet not found: Score " + cleanGroup };

    const data = scoreSheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "No data found on Score sheet" };

    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    let activeIdx = headers.findIndex(h => h === "status" || h === "active");
    if (activeIdx === -1) {
      return { success: false, message: "Status column not found on Score sheet." };
    }

    let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
    if (nameIdx === -1) nameIdx = 0;

    let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile"));

    let updated = false;
    for (let r = 1; r < data.length; r++) {
      const rowName = String(data[r][nameIdx] || "").trim().toLowerCase();
      const rowPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";

      const nameMatch = targetName && rowName && (rowName === targetName || rowName.includes(targetName));
      const phoneMatch = targetPhone && rowPhone && rowPhone.includes(targetPhone);

      if (nameMatch || phoneMatch) {
        const cell = scoreSheet.getRange(r + 1, activeIdx + 1);
        
        cell.setValue(newActiveState ? "ACTIVE" : "INACTIVE");
        cell.setBackground(newActiveState ? "#d4FF8a" : "#fff366");
        
        updated = true;
        break;
      }
    }

    // Safely clear the cache instead of using the undefined clearBackendAdminCache function
    const cacheKey = getCheckInCacheKey("Sched " + cleanGroup);
    if (typeof CacheService !== 'undefined') {
      try { CacheService.getScriptCache().remove(cacheKey); } catch(e) {}
    }

    return { 
      success: updated, 
      message: updated ? "Status updated" : `Player '${targetName || targetPhone}' not found.` 
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
