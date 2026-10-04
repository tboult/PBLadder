/* ==========================================================================
 * GLOBAL CONFIGURATION & DYNAMIC TEST GROUP HELPER DEFINITIONS
 * ========================================================================== */
let _dbInstance = null;


// Global utility map if not defined elsewhere
function buildColMap(headers) {
  let map = {};
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) map[headers[i].toString().toLowerCase()] = i;
  }
  return map;
}


/**
 * Sets the test group flag in Script Properties.
 * Call this from the frontend console or backend API.
 */
function setTestGroupState(enabled) {
  PropertiesService.getScriptProperties().setProperty("USE_TEST_GROUP", enabled ? "true" : "false");
  return {
    success: true,
    enabled: enabled,
    message: `Test group ("TG") is now ${enabled ? "ENABLED" : "DISABLED"}.`
  };
}

/**
 * Dynamic getters for system groups and tab names
 */
function getActiveGroups() {
  const groups = ["Womens", "Mens", "Mixed"];
  if (isTestGroupEnabled() && !groups.includes("TG")) groups.push("TG");
  return groups;
}

function getActiveScheduleTabs() {
  const tabs = ["Sched Womens", "Sched Mens", "Sched Mixed"];
  if (isTestGroupEnabled() && !tabs.includes("Sched TG")) tabs.push("Sched TG");
  return tabs;
}

function getActiveScoreTabs() {
  const tabs = ["Score Womens", "Score Mens", "Score Mixed"];
  if (isTestGroupEnabled() && !tabs.includes("Score TG")) tabs.push("Score TG");
  return tabs;
}

// Fallback constant arrays for standard legacy execution
const GROUPS = ["Womens", "Mens", "Mixed", "TG"];
const SCHEDULE_TABS = ["Sched Womens", "Sched Mens", "Sched Mixed", "Sched TG"];
const VALID_SCORE_TABS = ["Score Womens", "Score Mens", "Score Mixed", "Score TG"];
const SCORE_TABS = VALID_SCORE_TABS;

const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const ALWAYS_BYE_BOTTOM = true;

const GROUP_COURT_MAP = {
  "Womens": [3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20],
  "Mens": [5, 6, 9, 10, 13, 14, 15, 16],
  "Mixed": [3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20],
  "TG": [1, 2, 3, 4],
  "Default": [5, 6, 9, 10, 13, 14, 15, 16]
};

// Global constant for Week 1 start date
const WEEK_1_START_DATE = "2026-10-03"; 

/**
 * Calculates current week number (1 to 10) based on WEEK_1_START_DATE.
 * Defaults to 1 if current date is prior to start date, capped at 10.
 */
function calculateCurrentWeekNumber() {
  const startDate = new Date(WEEK_1_START_DATE + "T00:00:00");
  const today = new Date();
  
  // Reset time portions for accurate day boundary calculations
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 1; // Prior to start date
  
  const calculatedWeek = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(calculatedWeek, 1), 10); // Clamped between 1 and 10
}


/**
 * Creates the test sheets ("Score TG", "Sched TG", "Rankings TG") by duplicating 
 * the existing "Mens" sheets to retain all test data, formatting, and formulas.
 */
function createTestGroupSheets() {
  return executeWithLock(function() {
    const ss = getDb();
    
    const sheetMappings = [
      { source: "Score Mens", target: "Score TG" },
      { source: "Sched Mens", target: "Sched TG" },
      { source: "Rankings Mens", target: "Rankings TG" }
    ];

    const createdSheets = [];

    sheetMappings.forEach(mapping => {
      const sourceSheet = ss.getSheetByName(mapping.source);
      if (!sourceSheet) {
        throw new Error(`Source sheet '${mapping.source}' was not found in the database.`);
      }

      // Remove existing target sheet if present
      const existingTarget = ss.getSheetByName(mapping.target);
      if (existingTarget) {
        ss.deleteSheet(existingTarget);
      }

      // Duplicate source sheet and rename
      const newSheet = sourceSheet.copyTo(ss);
      newSheet.setName(mapping.target);
      createdSheets.push(mapping.target);
    });

    // Automatically turn on the test group flag upon creating test sheets
    setTestGroupState(true);

    return {
      success: true,
      message: `✅ Successfully created test sheets by copying 'Mens' data: ${createdSheets.join(", ")}. Test group ("TG") enabled.`
    };
  });
}
 
function testTimestampUpdates() {
  const testGroup = "Mens"; // Change to match one of your groups
  const testPlayerName = "Terry Boult"; // Use a real player name from your sheet
  const testPhone = "7199630573"; // Use that player's phone number

  Logger.log("--- 1. Testing Active/Inactive Toggle ---");
  const statusResult = toggleUnifiedActiveStatus({
    groupName: testGroup,
    playerName: testPlayerName,
    phone: testPhone
  });
  Logger.log("Status Result: " + JSON.stringify(statusResult));

  Logger.log("--- 2. Testing Check-In Toggle ---");
  const checkInResult = toggleSingleCheckIn(testGroup, testPlayerName, true);
  Logger.log("Check-in Result: " + JSON.stringify(checkInResult));
}

function testToggleDebug() {
  // Replace these with actual values from your Google Sheet to test!
  var testPayload = {
    groupName: "Mens",          // Your group name
    phone: "7199630573",        // A phone number present in your sheet
    playerName: "Terry Boult"      // A name present in your sheet
  };
}

function testfindfour() {
  // Replace these with actual values from your Google Sheet to test!
  var testPayload = {
    groupName: "Mens",          // Your group name
    phone: "7199630573",        // A phone number present in your sheet
    playerName: "Terry Boult"      // A name present in your sheet
  };
    
  var result = findFoursomeByPhone(testPayload);
  Logger.log("RESULT: " + JSON.stringify(result));
}


function testgetRankingsAndSchedData() {
    const result=getRankingsAndSchedData("Mens")
     Logger.log("SUCCESS: " + JSON.stringify(result));
}



function testunifiedata() {
  var testPayload = {
      groupName: "Mens",         
      forceRefresh: true      
  };
    const result= getUnifiedRoster(testPayload,true)
     Logger.log("SUCCESS: " + JSON.stringify(result));
}


function testCheckInDirectly() {
  try {
    const result = toggleSingleCheckIn({
      sheet: "Mens", 
      playerName: "Terry Boult",
      isCheckedIn: true
    });
    Logger.log("SUCCESS: " + JSON.stringify(result));
  } catch (err) {
    Logger.log("ERROR: " + err.toString());
  }
}
function testCheckbyPhone() {
  try {
    const result = toggleSingleCheckIn({
      sheet: "Mens", 
      phone: "7199630573",
      isCheckedin: true
    });
    Logger.log("SUCCESS: " + JSON.stringify(result));
  } catch (err) {
    Logger.log("ERROR: " + err.toString());
  }
}
// Replace hardcoded boolean with a Script Property check
function isLoggingEnabled() {
  const prop = PropertiesService.getScriptProperties().getProperty("ENABLE_LOGGING");
  return prop === "true"; // Defaults to false if missing or set to "false"
}

function logDebug(fnName, msg, extra = "") {
  // if (!isLoggingEnabled()) return;
  let extraStr = "";
  if (extra !== undefined && extra !== null && extra !== "") {
    if (extra instanceof Error) {
      // Capture error stack/message properly
      extraStr = `[Error: ${extra.message}${extra.stack ? '\n' + extra.stack : ''}]`;
    } else if (typeof extra === "object") {
      try {
        extraStr = JSON.stringify(extra);
      } catch (err) {
        extraStr = `[Object/Circular: ${String(extra)}]`; 
      }
    } else {
      extraStr = String(extra);
    }
  }
  
  // Goes straight to GAS Executions Log / Cloud Logging
  console.log(`[${new Date().toISOString()}] [${fnName}] ${msg} ${extraStr}`.trim());
}



function getDb(SHEET_ID) {
  if (_dbInstance) return _dbInstance;

  // 1. Resolve sheetId cleanly in the outer function scope
  const sheetId = SHEET_ID || PropertiesService.getScriptProperties().getProperty("SHEET_ID");

  // 2. Try opening by ID if an ID exists
  if (sheetId) {
    try {
      _dbInstance = SpreadsheetApp.openById(sheetId);
      return _dbInstance;
    } catch (e) {
      if (typeof logDebug === 'function') {
        logDebug("getDb", "Error opening by Sheet ID, falling back to active", e.message);
      }
    }
  }

  // 3. Fallback to container-bound active spreadsheet
  _dbInstance = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!_dbInstance) {
    throw new Error("Missing 'SHEET_ID' in Script Properties and no active spreadsheet found.");
  }

  return _dbInstance;
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
    alwaysByeBottom: ALWAYS_BYE_BOTTOM
  };
}

function getAppVersion() {
  logDebug("getAppVersion", "Retrieving app version");
  return "0.9.8.2"; 
}

function getValidScoreTabs() { return SCORE_TABS; }
function getSchedTabNames() { return SCHEDULE_TABS; }
function getAvailableGroups() { return GROUPS; }







// In-Memory Global Memoization Cache for single-execution reuse
var _ROSTER_LOOKUP_CACHE = null;

/**
 * High-performance Phone Lookup with In-Memory Array Caching
 */
/**
 * Finds a player's court assignment and foursome by searching Score sheets for phone/identity
 * and Sched sheets for court pairings.
 */
/**
 * Finds a player's court assignment and foursome by searching Score sheets for phone/identity
 * and Sched sheets for court pairings.
 */
function findFoursomeByPhone(params, groupNameArg) {
  let phoneInput = "", targetGroup = "";
  if (typeof params === 'object' && params !== null) {
    phoneInput = params.phone || params.userPhone || params.target || "";
    targetGroup = params.group || params.groupName || params.sheet || groupNameArg || "";
  } else {
    phoneInput = String(params || "");
    targetGroup = String(groupNameArg || "");
  }
  if (!targetGroup) return { html: "<i>No group specified.</i>" };

  
  const cleanPhone = String(phoneInput).replace(/\D/g, "");
  const searchName = String(phoneInput).trim().toLowerCase();
  
  if (cleanPhone.length < 7 && searchName.length < 2) {
    return { success: false, message: "Search term too short." };
  }

  function cleanStr(val) {
    return String(val || '')
      .replace(/[\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
      .trim();
  }

  // Extract group name and preserve exact title casing ("Womens", "Mens", "Mixed")
  const rawTarget = cleanStr(targetGroup).replace(/^(Score|Sched)\s*/i, "").trim();
  const knownGroups = typeof GROUPS !== 'undefined' ? GROUPS : ["Womens", "Mens", "Mixed"];
  const matchedGroup = knownGroups.find(g => g.toLowerCase() === rawTarget.toLowerCase());
  const cleanTarget = matchedGroup || rawTarget;

  const ss = getDb();
  let groupsToSearch = cleanTarget 
    ? [cleanTarget] 
    : knownGroups;

  for (let g = 0; g < groupsToSearch.length; g++) {
    const group = cleanStr(groupsToSearch[g]);
    const schedSheet = ss.getSheetByName("Sched " + group);
    const scoreSheet = ss.getSheetByName("Score " + group);

    if (!schedSheet && !scoreSheet) continue;

    let targetPlayerName = "";
    let targetPhone = cleanPhone;

    // STEP 1: Search Score Sheet (Master Roster) for Phone or Name Match
    if (scoreSheet) {
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 1) {
        const headers = scoreData[0].map(h => cleanStr(h).toLowerCase());
        const nameIdx = headers.findIndex(h => /name|player/i.test(h));
        const firstIdx = headers.findIndex(h => /\bfirst\b/i.test(h));
        const lastIdx = headers.findIndex(h => /\blast\b/i.test(h));
        const phoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));

        for (let r = 1; r < scoreData.length; r++) {
          let pName = "";
          if (firstIdx !== -1 || lastIdx !== -1) {
            const f = firstIdx !== -1 ? cleanStr(scoreData[r][firstIdx]) : "";
            const l = lastIdx !== -1 ? cleanStr(scoreData[r][lastIdx]) : "";
            pName = `${f} ${l}`.trim();
          }
          if (!pName && nameIdx !== -1) pName = cleanStr(scoreData[r][nameIdx]);
          if (!pName) continue;

          const pPhone = phoneIdx !== -1 ? cleanStr(scoreData[r][phoneIdx]).replace(/\D/g, "") : "";

          const isPhoneMatch = cleanPhone.length >= 7 && pPhone.length >= 7 && 
            (pPhone.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(pPhone.slice(-7)));

          const isNameMatch = searchName.length >= 2 && pName.toLowerCase().includes(searchName);

          if (isPhoneMatch || isNameMatch) {
            targetPlayerName = pName;
            if (pPhone) targetPhone = pPhone;
            break;
          }
        }
      }
    }

    // STEP 2: Search Sched Sheet for Court & Check-In status
    if (!schedSheet) continue;
    const schedData = schedSheet.getDataRange().getValues();
    if (schedData.length <= 1) continue;

    const headers = schedData[0].map(h => cleanStr(h).toLowerCase());
    const nameIdx = headers.findIndex(h => /name|player/i.test(h)) !== -1 
      ? headers.findIndex(h => /name|player/i.test(h)) 
      : 1;
    const courtIdx = headers.findIndex(h => /court/i.test(h));
    let checkIdx = headers.findIndex(h => /check|x/i.test(h));
    if (checkIdx === -1 && schedData[0].length >= 7) checkIdx = 6;
    const schedPhoneIdx = headers.findIndex(h => /phone|cell|mobile/i.test(h));

    let targetCourt = "";
    let matchedSchedName = "";

    for (let r = 1; r < schedData.length; r++) {
      const pName = cleanStr(schedData[r][nameIdx]);
      if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;

      const pPhone = schedPhoneIdx !== -1 ? cleanStr(schedData[r][schedPhoneIdx]).replace(/\D/g, "") : "";

      const isPhoneMatch = cleanPhone.length >= 7 && pPhone.length >= 7 && 
        (pPhone.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(pPhone.slice(-7)));

      const isDirectNameMatch = searchName.length >= 2 && pName.toLowerCase().includes(searchName);

      const isScoreMatch = targetPlayerName && (
        pName.toLowerCase().includes(targetPlayerName.toLowerCase()) || 
        targetPlayerName.toLowerCase().includes(pName.toLowerCase()) ||
        pName.toLowerCase().split(/\s+/)[0] === targetPlayerName.toLowerCase().split(/\s+/)[0]
      );

      if (isPhoneMatch || isDirectNameMatch || isScoreMatch) {
        matchedSchedName = pName;
        targetCourt = courtIdx !== -1 ? cleanStr(schedData[r][courtIdx]) : "BYE";
        break;
      }
    }

    if (!matchedSchedName || !targetCourt || targetCourt.toUpperCase() === "BYE ") continue;

    // STEP 3: Gather all 4 players assigned to targetCourt
    const foursome = [];
    for (let r = 1; r < schedData.length; r++) {
      const pName = cleanStr(schedData[r][nameIdx]);
      const court = courtIdx !== -1 ? cleanStr(schedData[r][courtIdx]) : "";
      const rawCheck = checkIdx !== -1 ? schedData[r][checkIdx] : false;
      
      const isChecked = (typeof isCheckInTrue === 'function') 
        ? isCheckInTrue(rawCheck) 
        : ["x", "true", "yes", "1"].includes(cleanStr(rawCheck).toLowerCase());

      if (pName && court.toLowerCase() === targetCourt.toLowerCase() && !pName.startsWith("---")) {
        foursome.push({
          name: pName,
          court: court,
          checkedIn: isChecked
        });
      }
    }

    return {
      success: true,
      group: group,
      court: targetCourt,
      player: matchedSchedName,
      foursome: foursome
    };
  }

  return { success: false, message: "Player or assigned court not found." };
}



function submitCourtScores(payload) {
  return executeWithLock(function() {
  try {
    logDebug("submitCourtScores", "Submitting scores payload", payload);
    if (!payload || (!payload.group && !payload.groupName) || !Array.isArray(payload.scores)) {
      return { success: false, message: "Invalid payload: Missing group or scores array." };
    }

    const ss = getDb();
    const cleanGroup = String(payload.group || payload.groupName).replace(/^(Score|Sched)\s*/i, "").trim();
    const schedSheet = ss.getSheetByName("Sched " + cleanGroup);

    if (!schedSheet) {
      return { success: false, message: `Schedule sheet 'Sched ${cleanGroup}' not found.` };
    }

    // 1. Single Bulk Read into Memory
    const dataRange = schedSheet.getDataRange();
    const data = dataRange.getValues();
    if (data.length <= 1) return { success: false, message: "Schedule sheet has no player rows." };

    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    let nameIdx = headers.indexOf("player name") !== -1 ? headers.indexOf("player name") : headers.indexOf("name");
    if (nameIdx === -1) nameIdx = 0;

    const g1Idx = headers.indexOf("game 1");
    const g2Idx = headers.indexOf("game 2");
    const g3Idx = headers.indexOf("game 3");
    const totIdx = headers.indexOf("total");

    let submitterIdx = headers.findIndex(h => 
      h === "entered" || h === "entered by" || h === "submitted by" || h.includes("entered")
    );
    if (submitterIdx === -1 && data[0].length >= 8) submitterIdx = 7;

    let submitterName = payload.submittedByName || payload.userName || payload.enteredBy || payload.user || "";

    // Submitter lookup fallback (Optimized)
    if (!submitterName) {
      const rawPhone = payload.submittedBy || payload.phone || payload.userPhone || "";
      const phoneDigits = String(rawPhone).replace(/\D/g, "");

      if (phoneDigits.length >= 7 && typeof findFoursomeByPhone === 'function') {
        try {
          const lookup = findFoursomeByPhone({ 
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
      if (!submitterName && rawPhone) submitterName = String(rawPhone).trim();
    }

    // Pre-index incoming payload scores by lowercased name for O(1) fast lookup
    const scoresMap = {};
    payload.scores.forEach(item => {
      const key = String(item.name || "").trim().toLowerCase();
      if (key) scoresMap[key] = item;
    });

    let updatedCount = 0;
    let dataModified = false;

    // 2. Modify 2D Array strictly in-memory (0 Sheet API calls)
    for (let r = 1; r < data.length; r++) {
      const rowName = String(data[r][nameIdx] || "").trim().toLowerCase();
      if (scoresMap[rowName]) {
        const pScore = scoresMap[rowName];

        let curG1 = g1Idx !== -1 ? data[r][g1Idx] : "";
        let curG2 = g2Idx !== -1 ? data[r][g2Idx] : "";
        let curG3 = g3Idx !== -1 ? data[r][g3Idx] : "";

        if (g1Idx !== -1 && pScore.g1 !== undefined && pScore.g1 !== null && pScore.g1 !== "") {
          curG1 = pScore.g1;
          data[r][g1Idx] = pScore.g1;
        }
        if (g2Idx !== -1 && pScore.g2 !== undefined && pScore.g2 !== null && pScore.g2 !== "") {
          curG2 = pScore.g2;
          data[r][g2Idx] = pScore.g2;
        }
        if (g3Idx !== -1 && pScore.g3 !== undefined && pScore.g3 !== null && pScore.g3 !== "") {
          curG3 = pScore.g3;
          data[r][g3Idx] = pScore.g3;
        }

        if (totIdx !== -1) {
          let sum = 0;
          let hasAnyScore = false;
          [curG1, curG2, curG3].forEach(v => {
            const num = parseInt(v, 10);
            if (!isNaN(num)) {
              sum += num;
              hasAnyScore = true;
            }
          });
          if (hasAnyScore) {
            data[r][totIdx] = sum;
          }
        }

        if (submitterIdx !== -1 && submitterName) {
          data[r][submitterIdx] = submitterName;
        }

        updatedCount++;
        dataModified = true;
      }
    }

    // 3. Single Bulk Write Operation to Google Sheet
    if (dataModified) {
      dataRange.setValues(data); 
    }

    // 4. Optimized Bulk Cache Invalidation
    if (typeof CacheService !== 'undefined') {
      try {
        const cache = CacheService.getScriptCache();
        const keysToRemove = [
          `checkin_cache_Sched_${cleanGroup}`,
          `SCHEDULE_${cleanGroup}`,
          `APP_INIT_DATA`
        ];
        cache.removeAll(keysToRemove);
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
  );
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
    isWeekFinalized = true;
    if (!isWeekFinalized) {
      html += `
        <div style="background:#fff3bf; color:#856404; border:1px solid #ffeeba; padding:12px; margin-bottom:15px; border-radius:6px; font-weight:bold; text-align:center;">
          ⏳ Schedule for this week not yet finalized. 
        </div>`;
      hasData = true;
    } else {
      let sData = schedSheet.getDataRange().getDisplayValues();
      if (sData && sData.length > 1) {
        let validRows = [];
        let hasAnyCourtAssigned = false;

        // Check for player rows and determine if ANY court is assigned
        for (let r = 1; r < sData.length; r++) {
          let pName = String(sData[r][0] || "").trim();
          let court = String(sData[r][1] || "").trim();

          if (pName && pName !== "Player Name" && !pName.startsWith("---") && !pName.toLowerCase().startsWith("time:")) {
            validRows.push({ name: pName, court: court });
            if (court !== "" && court.toUpperCase() !== "BYE" && court.toUpperCase() !== "NOSCHEDYET") {
              hasAnyCourtAssigned = true;
            }
          }
        }

        // Only render the table if at least one player has an assigned court
        if (hasAnyCourtAssigned && validRows.length > 0) {
          html += `<h4>Current Court Assignments</h4>
                   <table class="data-table">
                     <thead><tr><th>Player</th><th>Court</th></tr></thead>
                     <tbody>`;

          for (let row of validRows) {
            html += `<tr><td>${row.name}</td><td>${row.court || "BYE"}</td></tr>`;
          }
          html += `</tbody></table>`;
        } else {
          // If no courts are assigned, show notice instead of table
          html += `
            <div style="background:#e3f2fd; color:#0c5460; border:1px solid #bee5eb; padding:12px; margin-bottom:15px; border-radius:6px; font-weight:bold; text-align:center;">
              📅 No Schedule Yet, check back closer to start time
            </div>`;
        }
        hasData = true;
      } else {
        html += `
          <div style="background:#e3f2fd; color:#0c5460; border:1px solid #bee5eb; padding:12px; margin-bottom:15px; border-radius:6px; font-weight:bold; text-align:center;">
            📅 No Schedule Yet, check back closer to start time
          </div>`;
        hasData = true;
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

      html += `<h3 style="margin-top:1rem; background:#FFAAAAAA margin-bottom:0.5rem;"> Ranking CODE under REVISION-- this is probably  wrong --  check back later</h3>`;      
        
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
  // Determine default group or extract from phone/params
  var defaultGroup = GROUPS[0] || "Mens";
  
  return { 
    version: getAppVersion(), 
    groups: GROUPS, 
    sheets: SCHEDULE_TABS,
    // Add the player roster here so frontend gets it instantly
    checkInPlayers: getAdminPlayersByGroup({ group: defaultGroup }) 
  };
}

function doGet(e) { return handleApiRequest(e); }
function doPost(e) { return handleApiRequest(e); }

function handleApiRequest(e) {
  let requiresLock = false;
  let lock = null;
 logDebug("HandelApiRequest", "Request received", e.postData.contents);
  try {
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

    // Unify parameters into a single normalized payload object
    let payload = Object.assign({}, urlParams, bodyParams);
    if (payload.payload && typeof payload.payload === 'object') {
      payload = Object.assign({}, payload, payload.payload);
    }

    let rawAction = urlParams.action || bodyParams.action || payload.action || "";
    let action = String(rawAction)
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
      .trim();

    if (!action) throw new Error("Invalid or missing API action");

      const WRITE_ACTIONS = [
          'sortActivePlayers', 'sortActivePlayersForSheet', 'generateScheduleTabs',
          'updateStandingsWithShift', 'correctScoresNoShift', 'processWeeklyScoresForSheet',
          'toggleSingleCheckIn', 'checkInPlayer', 'CheckInPlayer', 'saveCheckIns', 
          'toggleUnifiedActiveStatus', 'submitCourtScores', 'submitScores', 'addNewUser', 
          'registerPlayer', 'rescheduleFromCheckIns', 'startNewSeason', 'createTestGroupSheets',
          'setTestGroupState', 'updatePlayerScore'
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

    case 'getdb':
          getDb(payload.sheetid)
          break;
        
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
            var rosterData = getUnifiedRoster({ group: targetSheet });
            if (rosterData && rosterData.success && Array.isArray(rosterData.players) && rosterData.players.length > 0) {
              initData.checkInPlayers = rosterData.players;
            }
          } catch (err) {
            console.warn("Failed fetching initial players safely:", err);
          }
        }
        result = initData;
        break;

    case 'getActiveGroups':
        result = { success: true, groups: getActiveGroups() };
        break;

        
    case 'createTestGroupSheets':
        result = createTestGroupSheets();
        break;

    case 'setTestGroupState':
        result = setTestGroupState(payload.enabled === true || payload.enabled === 'true');
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
        result = ScheduleAll(payload.arg || payload.tab || payload.sheet || payload.groupName || (payload.group ? "Score " + payload.group : null), payload.courts || null);
        break;

      case 'processWeeklyScoresForSheet':
          result = processWeeklyScoresForSheet(
              getValidActiveScoreSheet(payload.group || payload.groupName || payload.arg),
              payload.weekCol || payload.week || null,
              payload.shift !== undefined ? payload.shift : true
          );
          break;

      case 'updateStandingsWithShift':
          result = processWeeklyScoresForSheet(
              getValidActiveScoreSheet(payload.arg || payload.group || payload.groupName),
              payload.weekCol || payload.week || null,
              true
          );
          break;

      case 'correctScoresNoShift':
          result = processWeeklyScoresForSheet(
              getValidActiveScoreSheet(payload.arg || payload.group || payload.groupName),
              payload.weekCol || payload.week || null,
              false
          );
          break;

      case 'getSchedTabNames':
        result = getSchedTabNames();
        break;

      case 'getAvailableGroups':
        result = getAvailableGroups();
        break;

      case 'toggleSingleCheckIn':
        result = toggleSingleCheckIn(payload.sheet || payload.schedSheetName || payload.tab || payload.group, payload.playerName || payload.name || payload.phone, payload.isCheckedIn !== undefined ? payload.isCheckedIn : payload.checkedIn);
        break;

      case 'saveCheckIns':
        result = saveCheckIns(payload.sheet || payload.schedSheetName || payload.tab, payload.checkedNames);
        break;

      case 'findFoursomeByPhone': 
        result = findFoursomeByPhone(payload);
        break;

      case 'getUnifiedRoster':
        result = getUnifiedRoster(payload);
        break;

      case 'toggleUnifiedActiveStatus':
        result = toggleUnifiedActiveStatus(payload);
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

      case 'getGroupPlayers':        
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
        result = typeof getAppVersion === 'function' ? getAppVersion() : "CodeisBroken";
        break;

      case 'generatePdfSchedule':
      case 'webExportSchedulePdf':
        result = webExportSchedulePdf(payload.group || payload.groupName);
        break;

      case 'findPlayerAcrossGroups':
        return findPlayerAcrossGroups(payload.phone || payload.targetPlayer);        

      case 'batchUpdatePlayerScores':
          result = batchUpdatePlayerScores(payload);
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
    let sheetName = getValidActiveScoreSheet().getName();
    let res = ScheduleAll(sheetName);
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

function menuGenerateScheduleCheckedIn() {
  try {
    // Passes schedule sheet name ("Sched Mens"). If rescheduleFromCheckIns expects 
    // the raw group name ("Mens"), change "Sched " to "" below.
    let target = getValidActiveScoreSheet().getName().replace("Score ", "Sched ");
    let res = rescheduleFromCheckIns(target);
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

function menuSortActivePlayers() {
  try {
    let res = sortActivePlayersForSheet(getValidActiveScoreSheet());
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

function menuGenerateScheduleTabs() {
  try {
    let res = ScheduleAll();
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

function menuUpdateStandingsWithShift() {
  try {
    let sheet = getValidActiveScoreSheet();
    let res = processWeeklyScoresForSheet(sheet, getCurrentWeekIdentifier(sheet.getName()), true);
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

function menuCorrectScoresNoShift() {
  try {
    let sheet = getValidActiveScoreSheet();
    // CHANGED: Passed false for shift parameter
    let res = processWeeklyScoresForSheet(sheet, getCurrentWeekIdentifier(sheet.getName()), false);
    showAlert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert("Error: " + e.message);
    throw e;
  }
}

/**
 * Helper to safely display strings or objects in Spreadsheet UI alert
 */
function showAlert(res) {
  if (!SpreadsheetApp.getUi()) return;
  let msg = (typeof res === 'object' && res !== null) ? (res.message || JSON.stringify(res)) : String(res);
  SpreadsheetApp.getUi().alert(msg);
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

  // --- DUPLICATE CHECK ---
  const inputFirst = info.first.trim().toLowerCase();
  const inputLast = info.last.trim().toLowerCase();
  const inputFullName = `${inputFirst} ${inputLast}`;
  const inputPhone = String(info.phone).replace(/\D/g, ""); // Digits only for clean comparison

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const existingFirst = col.first !== undefined ? String(row[col.first] || "").trim().toLowerCase() : "";
    const existingLast = col.last !== undefined ? String(row[col.last] || "").trim().toLowerCase() : "";
    const existingName = col.name !== undefined ? String(row[col.name] || "").trim().toLowerCase() : "";
    const existingPhone = col.phone !== undefined ? String(row[col.phone] || "").replace(/\D/g, "") : "";

    const isNameMatch = (existingFirst === inputFirst && existingLast === inputLast) ||
                        (existingName !== "" && existingName === inputFullName);
    const isPhoneMatch = inputPhone !== "" && existingPhone !== "" && existingPhone === inputPhone;

    if (isNameMatch || isPhoneMatch) {
      return `⚠️ Notice: User '${info.first.trim()} ${info.last.trim()}' is already registered in '${targetSheet.getName()}'.`;
    }
  }
  
  let newRow = new Array(headers.length).fill("");
  if (col.first !== undefined) newRow[col.first] = info.first.trim();
  if (col.last !== undefined) newRow[col.last] = info.last.trim();
  if (col.name !== undefined) newRow[col.name] = (info.first + " " + info.last).trim();
  if (col.phone !== undefined) newRow[col.phone] = info.phone.trim();
  if (col.email !== undefined) newRow[col.email] = (info.email || "").trim();
  if (col.group !== undefined) newRow[col.group] = info.group.trim();
  
  // Set initial status to Inactive
  if (col.status !== undefined) newRow[col.status] = "Inactive";

  // 1. SEARCH FOR FIRST ROW WITHOUT NAME AND STATUS
  let targetRowNumber = -1; // 1-based row number for Google Sheets

  for (let i = 1; i < data.length; i++) { // Skip header row at index 0
    const row = data[i];
    
    const nameVal = col.name !== undefined ? String(row[col.name] || "").trim() : "";
    const firstVal = col.first !== undefined ? String(row[col.first] || "").trim() : "";
    const statusVal = col.status !== undefined ? String(row[col.status] || "").trim() : "";

    // Check if Name (or First Name) AND Status are empty
    const hasNoName = nameVal === "" && firstVal === "";
    const hasNoStatus = statusVal === "";

    if (hasNoName && hasNoStatus) {
      targetRowNumber = i + 1; // Array index 0 is Row 1 in Sheets
      break; // Stop at the first empty row
    }
  }

  // 2. WRITE TO SHEET & HIGHLIGHT ROW IN YELLOW
  let targetRange;

  if (targetRowNumber > -1) {
    // Fill the found empty slot
    targetRange = targetSheet.getRange(targetRowNumber, 1, 1, newRow.length);
    targetRange.setValues([newRow]);
  } else {
    // Fallback append if no empty row exists
    targetSheet.appendRow(newRow);
    const lastRow = targetSheet.getLastRow();
    targetRange = targetSheet.getRange(lastRow, 1, 1, newRow.length);
  }

  // Highlight the row yellow (#ffff00) for easy admin identification
  targetRange.setBackground("#ffff00");
  
  return `✅ Success: Added ${info.first} ${info.last} (Inactive) to tab '${targetSheet.getName()}'.`;
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

/**
 * Generates schedule tabs on Sched sheet, clears previous weekly scores/totals
 * on Sched sheet, clears 'Pts' on Score sheet, and synchronizes court assignments 
 * directly into Column D ('Court') on the corresponding Score sheet.
 *
 * BYE Logic:
 * Uses ALWAYS_BYE_BOTTOM (or payload parameter):
 * - true: Lowest-ranked bottom players receive BYE.
 * - false: Random players are chosen for BYE; remaining players stay in rank order across courts.
 */
function ScheduleAll(genTarget, courts) {
  return executeWithLock(function() {
    let targetGroup = genTarget;
    let payloadByeFlag = undefined;

    // Unpack payload if passed as a single object
    if (typeof genTarget === 'object' && genTarget !== null) {
      courts = genTarget.courts || courts;
      payloadByeFlag = genTarget.alwaysByeBottom !== undefined ? genTarget.alwaysByeBottom : genTarget.ALWAYS_BYE_BOTTOM;
      targetGroup = genTarget.group || genTarget.sheet || genTarget.schedSheetName || genTarget.genTarget || genTarget.target || "";
    }

    // Determine ALWAYS_BYE_BOTTOM flag priority: payload > global variable > default (true)
    const alwaysByeBottom = (payloadByeFlag !== undefined) 
      ? Boolean(payloadByeFlag) 
      : (typeof ALWAYS_BYE_BOTTOM !== 'undefined' ? Boolean(ALWAYS_BYE_BOTTOM) : true);

    logDebug("ScheduleAll", "Generating schedule tabs and clearing active scores", { genTarget: targetGroup, courts, alwaysByeBottom });

    const ss = getDb();
    const cleanP = (p) => String(p || '').replace(/\D/g, '');
    const cleanStr = (s) => String(s || '').trim().toLowerCase();

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
        summary.push(`⚠️️ Score tab for '${groupName}' not found.`);
        return;
      }

      sortActivePlayersForSheet(scoreSheet);
      const data = scoreSheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const col = buildColMap(data[0]);
      let activePlayers = [];
      let activePlayerObjects = [];

      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let status = (col.status !== undefined && row[col.status]) ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";
        let name = col.name !== undefined ? row[col.name] : `${row[col.first] || ''} ${row[col.last] || ''}`.trim();
        let rawPhone = col.phone !== undefined ? row[col.phone] : (col.cell !== undefined ? row[col.cell] : (col.mobile !== undefined ? row[col.mobile] : ""));

        if (name && status === "ACTIVE") {
          activePlayers.push(name);
          activePlayerObjects.push({
            name: name,
            phone: cleanP(rawPhone)
          });
        }
      }

      let availableCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
      let schedSheetName = "Sched " + groupName;
      let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);

      // 1. Wipe entire Sched tab (clears Game 1-3, Total, Entered, Check-In)
      schedSheet.clear();

      let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Total", "Entered"];
      let rows = [headers];

      let numPlayers = activePlayers.length;
      let foursomesCount = Math.floor(numPlayers / 4);

      let courtWarning = "";
      if (foursomesCount > availableCourts.length) {
        courtWarning = ` ⚠️ Error: Insufficient courts! Needed: ${foursomesCount}, Available: ${availableCourts.length}. Oversubscribed players assigned BYE.`;
        logDebug("ScheduleAll", "Insufficient courts error", { groupName, required: foursomesCount, available: availableCourts.length });
      }

      // -------------------------------------------------------------
      // 2. BYE & COURT ALLOCATION LOGIC
      // -------------------------------------------------------------
      let assignedCourtsCount = Math.min(foursomesCount, availableCourts.length);
      let totalPlayingCount = assignedCourtsCount * 4;
      let byeCount = numPlayers - totalPlayingCount;

      let playingIndices = [];
      let byeIndices = new Set();

      if (byeCount > 0) {
        if (alwaysByeBottom) {
          // Bottom-ranked players receive BYE
          for (let i = 0; i < totalPlayingCount; i++) playingIndices.push(i);
          for (let i = totalPlayingCount; i < numPlayers; i++) byeIndices.add(i);
        } else {
          // Randomly select byeCount players for BYE
          let availableIndices = Array.from({ length: numPlayers }, (_, idx) => idx);
          while (byeIndices.size < byeCount) {
            let randPos = Math.floor(Math.random() * availableIndices.length);
            let pickedIndex = availableIndices.splice(randPos, 1)[0];
            byeIndices.add(pickedIndex);
          }
          // Remaining players stay in rank order across courts
          playingIndices = availableIndices;
        }
      } else {
        // Everyone fits into courts
        for (let i = 0; i < numPlayers; i++) playingIndices.push(i);
      }

      // Map playing players to court slots (4 players per court)
      let playerCourtMap = {};
      playingIndices.forEach((playerIdx, orderIdx) => {
        let courtNumIdx = Math.floor(orderIdx / 4);
        let rawCourt = availableCourts[courtNumIdx];
        let courtLabel = String(rawCourt).toLowerCase().startsWith("court") ? String(rawCourt) :  rawCourt;
        playerCourtMap[playerIdx] = courtLabel;
      });

      // Construct Sched output rows & dictionary lookup
      let courtLookup = {};

      for (let i = 0; i < numPlayers; i++) {
        let pName = activePlayers[i];
        let pPhone = activePlayerObjects[i] ? activePlayerObjects[i].phone : "";
        let assignedCourt = byeIndices.has(i) ? "BYE" : (playerCourtMap[i] || "BYE");

        courtLookup[cleanStr(pName)] = assignedCourt;
        if (pPhone) courtLookup[pPhone] = assignedCourt;

        // Fresh schedule row with empty game score columns
        rows.push([pName, assignedCourt, "", "", "", "", "", ""]);
      }

      // Write fresh schedule grid to Sched sheet
      schedSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      schedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      // Preserve Week Marker metadata in I1:I2
      var i1Cell = schedSheet.getRange("I1");
      i1Cell.setValue("SCHEDULE_WEEK");
      i1Cell.setFontWeight("bold");

      var i2Cell = schedSheet.getRange("I2");
      i2Cell.setValue(currentWeek);
      i2Cell.setHorizontalAlignment("center");

      // -------------------------------------------------------------
      // 3. SCORE SHEET: Clear 'Pts' & Update Column D ('Court')
      // -------------------------------------------------------------
      let scoreHeaders = data[0].map(h => String(h || '').trim().toLowerCase());
      let phoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
      let nameIdx = scoreHeaders.findIndex(h => /name|player/i.test(h));

      let courtIdx = scoreHeaders.findIndex(h => /court|crt/i.test(h));
      if (courtIdx === -1) courtIdx = 3; // Index 3 = Column D

      let ptsIdx = scoreHeaders.findIndex(h => /^pts$|^points$\vert{}^total$/i.test(h));
      if (ptsIdx === -1) ptsIdx = 4; // Index 4 = Column E
          
      // Wipe Pts column content on Score sheet for all player rows
      if (data.length > 1) {
        scoreSheet.getRange(2, ptsIdx + 1, data.length - 1, 1).clearContent();
      }

      let scoreCourtValues = [];
      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let rowPhone = phoneIdx !== -1 ? cleanP(row[phoneIdx]) : "";
        let rowName = nameIdx !== -1 ? cleanStr(row[nameIdx]) : "";

        let matchedCourt = "";

        // Primary match: Phone number (last 7 digits)
        if (rowPhone) {
          for (let k in courtLookup) {
            if (k.length >= 7 && rowPhone.endsWith(k.slice(-7))) {
              matchedCourt = courtLookup[k];
              break;
            }
          }
        }

        // Secondary match: Player name
        if (!matchedCourt && rowName && courtLookup[rowName]) {
          matchedCourt = courtLookup[rowName];
        }

        // Non-active or unassigned players default to BYE
        if (!matchedCourt) matchedCourt = "BYE";

        scoreCourtValues.push([matchedCourt]);
      }

      if (scoreCourtValues.length > 0) {
        scoreSheet.getRange(2, courtIdx + 1, scoreCourtValues.length, 1).setValues(scoreCourtValues);
      }

      // -------------------------------------------------------------
      // 4. FLUSH CACHE
      // -------------------------------------------------------------
      const cacheKey = getCheckInCacheKey(schedSheetName);
      if (typeof CacheService !== 'undefined' && cacheKey) {
        CacheService.getScriptCache().remove(cacheKey);
      }

      if (typeof clearUnifiedCache === 'function') {
        clearUnifiedCache(schedSheetName);
      }

      const unifiedCacheKey = "UNIFIED_ROSTER_CACHE_" + groupName.toUpperCase();
      if (typeof CacheService !== 'undefined') {
        CacheService.getScriptCache().remove(unifiedCacheKey);
      }

      summary.push(`Generated schedule for '${groupName}' (BYE mode: ${alwaysByeBottom ? 'Bottom Players' : 'Random'}). Cleared scores on Sched & Pts on Score sheet (${numPlayers} players, ${assignedCourtsCount} courts assigned, ${byeCount} BYEs).${courtWarning}`);
    });

    return "✅ " + summary.join("\n");
  });
}




function rescheduleFromCheckIns(reschedTarget, courts) {
  return executeWithLock(function() {
    let payloadByeFlag = undefined;

    // Unpack payload if parameters were passed as a single object
    if (typeof reschedTarget === 'object' && reschedTarget !== null) {
      courts = reschedTarget.courts || courts;
      payloadByeFlag = reschedTarget.alwaysByeBottom !== undefined ? reschedTarget.alwaysByeBottom : reschedTarget.ALWAYS_BYE_BOTTOM;
      reschedTarget = reschedTarget.reschedTarget || reschedTarget.group || reschedTarget.target || reschedTarget.groupName;
    }

    // Determine ALWAYS_BYE_BOTTOM flag priority: payload > global variable > default (true)
    const alwaysByeBottom = (payloadByeFlag !== undefined) 
      ? Boolean(payloadByeFlag) 
      : (typeof ALWAYS_BYE_BOTTOM !== 'undefined' ? Boolean(ALWAYS_BYE_BOTTOM) : true);

    logDebug("rescheduleFromCheckIns", "Rescheduling checked-in players while preserving locked foursomes", { reschedTarget, courts, alwaysByeBottom });

    const ss = getDb();
    const cleanP = (p) => String(p || '').replace(/\D/g, '');
    
    // Bulletproof court label helper: extracts pure digit string ("Court 5" -> "5") or returns "BYE"
    const cleanCourtLabel = (c) => {
      if (!c) return "BYE";
      let str = String(c).trim();
      if (!str || str.toUpperCase() === "BYE") return "BYE";
      let match = str.match(/\d+/);
      if (match) return match[0];
      let cleaned = str.replace(/^(court|crt|score)\s*#?\s*/i, "").trim();
      return cleaned || "BYE";
    };

    // Normalize name helper: handles "Last, First" vs "First Last" and extra spaces
    const normalizeName = (s) => {
      if (!s) return "";
      let str = String(s).trim().toLowerCase();
      if (str.includes(",")) {
        let parts = str.split(",").map(p => p.trim()).filter(Boolean);
        if (parts.length === 2) str = parts[1] + " " + parts[0];
      }
      return str.replace(/\s+/g, " ");
    };

    let targetName = reschedTarget ? String(reschedTarget).replace(/^Score\s*/i, "Sched ").trim() : "Sched Womens";
    if (!targetName.startsWith("Sched ")) targetName = "Sched " + targetName;
    let groupName = targetName.replace(/^Sched\s*/i, "").trim();

    let sheet = ss.getSheetByName(targetName);
    if (!sheet) return `⚠️ Error: Schedule tab '${targetName}' not found.`;

    const currentWeek = calculateCurrentWeekNumber();

    // 1. Read existing row data
    let existingData = sheet.getDataRange().getValues();
    let existingMap = {};
    if (existingData.length > 1) {
      for (let r = 1; r < existingData.length; r++) {
        let row = existingData[r];
        let pName = row[0] ? String(row[0]).trim() : "";
        if (pName) {
          existingMap[normalizeName(pName)] = {
            court: cleanCourtLabel(row[1]),
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
    let rawCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
    let availableCourts = rawCourts.map(cleanCourtLabel).filter(c => c !== "BYE");

    let checkedInPlayers = [];
    let uncheckedPlayers = [];

    players.forEach(p => {
      let prev = existingMap[normalizeName(p.name)] || { court: "BYE", checkIn: "", g1: "", g2: "", g3: "", total: "", entered: "" };
      let isChecked = Boolean(p.checkedIn || p.checked || (prev.checkIn && prev.checkIn !== ""));
      p.prev = prev;
      p.isChecked = isChecked;

      if (isChecked) {
        checkedInPlayers.push(p);
      } else {
        uncheckedPlayers.push(p);
      }
    });

    // 3. Strict 4-Player Court Allocation
    let numChecked = checkedInPlayers.length;
    let maxFullCourts = Math.min(Math.floor(numChecked / 4), availableCourts.length);
    let totalPlayingAllowed = maxFullCourts * 4;
    let activeCourts = availableCourts.slice(0, maxFullCourts);

    let courtAssignments = {};
    activeCourts.forEach(c => { courtAssignments[c] = []; });

    let unassignedCheckedIn = [];

    // Phase A: Lock in checked-in players ALREADY assigned to active courts (capped at 4 per court)
    checkedInPlayers.forEach(p => {
      let prevCourt = cleanCourtLabel(p.prev.court);

      if (activeCourts.includes(prevCourt) && courtAssignments[prevCourt].length < 4) {
        courtAssignments[prevCourt].push(p);
        p.assignedCourt = prevCourt;
      } else {
        unassignedCheckedIn.push(p);
      }
    });

    // Phase B: Calculate open slots to reach exactly 4 players per active court
    let lockedCount = 0;
    activeCourts.forEach(c => { lockedCount += courtAssignments[c].length; });
    let openSlotsNeeded = totalPlayingAllowed - lockedCount;

    let playersToAssign = [];
    let playersForBye = [];

    if (unassignedCheckedIn.length > openSlotsNeeded) {
      if (alwaysByeBottom) {
        playersToAssign = unassignedCheckedIn.slice(0, openSlotsNeeded);
        playersForBye = unassignedCheckedIn.slice(openSlotsNeeded);
      } else {
        let copy = [...unassignedCheckedIn];
        let chosenSet = new Set();
        while (chosenSet.size < openSlotsNeeded && copy.length > 0) {
          let randIdx = Math.floor(Math.random() * copy.length);
          chosenSet.add(copy.splice(randIdx, 1)[0]);
        }

        unassignedCheckedIn.forEach(p => {
          if (chosenSet.has(p)) {
            playersToAssign.push(p);
          } else {
            playersForBye.push(p);
          }
        });
      }
    } else {
      playersToAssign = [...unassignedCheckedIn];
    }

    // Phase C: Fill active courts sequentially so every active court gets exactly 4 players
    activeCourts.forEach(c => {
      while (courtAssignments[c].length < 4 && playersToAssign.length > 0) {
        let candidate = playersToAssign.shift();
        candidate.assignedCourt = c;
        courtAssignments[c].push(candidate);
      }
    });

    // Excess players receive BYE
    playersToAssign.concat(playersForBye).forEach(p => {
      p.assignedCourt = "BYE";
    });

    // Unchecked players default to BYE
    uncheckedPlayers.forEach(p => {
      p.assignedCourt = "BYE";
    });

    // Safety validation: Ensure no court has fewer than 4 players
    activeCourts.forEach(c => {
      if (courtAssignments[c].length < 4) {
        courtAssignments[c].forEach(p => { p.assignedCourt = "BYE"; });
        courtAssignments[c] = [];
      }
    });

    // 4. Construct output rows for Sched sheet
    let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Total", "Entered"];
    let rows = [headers];
    let playerCourtLookup = {};

    checkedInPlayers.forEach(p => {
      let finalCourt = cleanCourtLabel(p.assignedCourt || "BYE");
      let checkInVal = p.prev.checkIn || "X";

      let normName = normalizeName(p.name);
      if (normName) playerCourtLookup[normName] = finalCourt;

      let pPhone = cleanP(p.phone || p.cell || p.mobile || p.phoneNumber);
      if (pPhone && pPhone.length >= 7) playerCourtLookup[pPhone.slice(-7)] = finalCourt;

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
      let normName = normalizeName(p.name);
      if (normName) playerCourtLookup[normName] = "BYE";

      let pPhone = cleanP(p.phone || p.cell || p.mobile || p.phoneNumber);
      if (pPhone && pPhone.length >= 7) playerCourtLookup[pPhone.slice(-7)] = "BYE";

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

    // 5. Write updated schedule data to Sched sheet
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

    // 6. Synchronize court assignments to Column D on the corresponding Score sheet
    let scoreSheetName = "Score " + groupName;
    let scoreSheet = ss.getSheetByName(scoreSheetName);

    if (scoreSheet) {
      let scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 1) {
        const col = typeof buildColMap === 'function' ? buildColMap(scoreData[0]) : {};

        let courtIdx = col.court !== undefined ? col.court : scoreData[0].map(h => String(h || '').trim().toLowerCase()).findIndex(h => /court|crt/i.test(h));
        if (courtIdx === -1) courtIdx = 3;

        let courtValues = [];
        for (let r = 1; r < scoreData.length; r++) {
          let row = scoreData[r];
          let rowName = col.name !== undefined ? row[col.name] : `${row[col.first] || ''} ${row[col.last] || ''}`.trim();
          let normRowName = normalizeName(rowName);
          let rowPhone = col.phone !== undefined ? cleanP(row[col.phone]) : "";

          let assignedCourt = "";

          if (rowPhone && rowPhone.length >= 7 && playerCourtLookup[rowPhone.slice(-7)]) {
            assignedCourt = playerCourtLookup[rowPhone.slice(-7)];
          }

          if (!assignedCourt && normRowName && playerCourtLookup[normRowName]) {
            assignedCourt = playerCourtLookup[normRowName];
          }

          if (!assignedCourt) {
            assignedCourt = "BYE";
          }

          courtValues.push([cleanCourtLabel(assignedCourt)]);
        }

        if (courtValues.length > 0) {
          scoreSheet.getRange(2, courtIdx + 1, courtValues.length, 1).setValues(courtValues);
        }
      }
    }

    // 7. Flush cache
    if (typeof CacheService !== 'undefined') {
      const cacheKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(targetName) : null;
      if (cacheKey) CacheService.getScriptCache().remove(cacheKey);

      const unifiedCacheKey = "UNIFIED_ROSTER_CACHE_" + groupName.toUpperCase();
      CacheService.getScriptCache().remove(unifiedCacheKey);
    }

    let activeCourtsCount = activeCourts.filter(c => courtAssignments[c] && courtAssignments[c].length === 4).length;
    let totalByes = rows.filter(r => r[1] === "BYE").length - 1;

    return `✅ Rescheduled '${targetName}' (BYE mode: ${alwaysByeBottom ? 'Bottom Players' : 'Random'}) and synced courts to '${scoreSheetName}' (${numChecked} checked-in, ${activeCourtsCount} full courts assigned, ${totalByes} BYEs).`;
  });
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

  // 1. Read players from the current Schedule sheet (Column A)
  if (sheet) {
    let data = sheet.getDataRange().getValues();
    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      let name = data[i][0] ? String(data[i][0]).trim() : "";
      if (name && name !== "Player Name" && !playerSet.has(name)) {
        playerSet.add(name);
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

        // Include player if group matches or if group filtering isn't present
        if (name && (!group || group.toLowerCase() === groupName.toLowerCase()) && !playerSet.has(name)) {
          playerSet.add(name);
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
 * Harvests scores from the Schedule sheet into the Pts column of the Score sheet.
 * Respects manual admin overrides in the Pts column.
 */
function harvestScoresFromSchedules(ss, data, col, targetWeekIdx, cleanGroupName, weekNum) {
  const schedSheet = ss.getSheetByName("Sched " + cleanGroupName);
  if (!schedSheet) return;

  const schedData = schedSheet.getDataRange().getValues();
  if (schedData.length <= 1) return;

  const ptsColIdx = col.pts !== undefined ? col.pts : col.points;
  const prevWeekIdx = weekNum > 1 ? col["w" + (weekNum - 1)] : undefined;

  // Build lookup map from Sched tab
  let schedScoresMap = {};
  const schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
  const nameIdx = schedHeaders.findIndex(h => /name|player/i.test(h));
  const scoreIdx = schedHeaders.findIndex(h => /pts|points|score|total/i.test(h));

  if (nameIdx === -1 || scoreIdx === -1) return;

  for (let r = 1; r < schedData.length; r++) {
    let pName = String(schedData[r][nameIdx] || '').trim();
    let score = schedData[r][scoreIdx];
    if (pName && score !== "" && score !== null && !isNaN(parseFloat(score))) {
      schedScoresMap[pName.toLowerCase()] = parseFloat(score);
    }
  }

  // Update Pts column in memory while respecting hand-edited entries
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = (col.name !== undefined && row[col.name]) 
      ? row[col.name].toString().trim() 
      : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();

    if (!pName) continue;
    let pKey = pName.toLowerCase();

    if (schedScoresMap[pKey] !== undefined) {
      let schedVal = schedScoresMap[pKey];
      let currentPts = ptsColIdx !== undefined ? row[ptsColIdx] : "";
      let prevWeekVal = prevWeekIdx !== undefined ? row[prevWeekIdx] : "";

      let ptsIsEmpty = (currentPts === "" || currentPts === null || currentPts === undefined);
      
      let ptsIsStaleLastWeek = false;
      if (!ptsIsEmpty && prevWeekVal !== "" && prevWeekVal !== null && prevWeekVal !== undefined) {
        let parsedPts = parseFloat(currentPts);
        let parsedPrev = parseFloat(prevWeekVal);
        if (!isNaN(parsedPts) && !isNaN(parsedPrev) && parsedPts === parsedPrev) {
          ptsIsStaleLastWeek = true; // Score in Pts is leftover from W(N-1)
        }
      }

      // Overwrite Pts with Sched value ONLY IF Pts is empty OR contains leftover W(N-1) score
      if (ptsIsEmpty || ptsIsStaleLastWeek) {
        if (ptsColIdx !== undefined) {
          row[ptsColIdx] = schedVal;
        }
      }
      // Hand-adjusted Pts values (that don't match last week) remain untouched
    }
  }
}

function processWeeklyScoresForSheet(sheet, forcedWeek, shouldShift = true) {
  return executeWithLock(function() {
    const ss = getDb();
    const RESTRICT_BY_RAW_RANK = true;
    if (!sheet) sheet = ss.getActiveSheet();
    checkAndRunWeeklyBackup();

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

    const headerRow = data[0];
    const col = buildColMap(headerRow);
    let cleanGroupName = sheet.getName().replace(/^Score\s+/i, "").trim();

    let totColIdx = col.tot !== undefined ? col.tot : col.total;
    let posColIdx = col.pos !== undefined ? col.pos : col.possible;
    let pctColIdx = col.pct !== undefined ? col.pct : col.winPct;
    let ptsColIdx = col.pts !== undefined ? col.pts : col.points;

    // Determine target week number
    let weekNum;
    if (forcedWeek !== null && forcedWeek !== undefined && forcedWeek !== "") {
      let match = forcedWeek.toString().match(/\d+/);
      weekNum = match ? parseInt(match[0], 10) : calculateCurrentWeekNumber();
    } else {
      weekNum = calculateCurrentWeekNumber();
    }

    let targetWeekKey = "w" + weekNum;
    let targetWeekIdx = col[targetWeekKey];
    if (targetWeekIdx === undefined) {
      for (let i = 10; i >= 1; i--) {
        if (col["w" + i] !== undefined) {
          targetWeekKey = "w" + i;
          targetWeekIdx = col["w" + i];
          if (!forcedWeek) weekNum = i;
          break;
        }
      }
    }

    // Shift data into W10 if shouldShift is true
    if (shouldShift) {
      for (let i = 1; i < data.length; i++) {
        for (let w = 10; w >= 2; w--) {
          let currWIdx = col["w" + w];
          let prevWIdx = col["w" + (w - 1)];
          if (currWIdx !== undefined && prevWIdx !== undefined) {
            data[i][currWIdx] = data[i][prevWIdx];
          }
        }
        if (ptsColIdx !== undefined && col.w1 !== undefined) {
          let ptsVal = data[i][ptsColIdx];
          if (ptsVal !== "" && ptsVal !== null && ptsVal !== undefined && !isNaN(parseFloat(ptsVal))) {
            data[i][col.w1] = parseFloat(ptsVal);
          }
        }
      }
    }

    // Check if pct column has points/scores
    let hasPctPoints = false;
    if (pctColIdx !== undefined) {
      for (let i = 1; i < data.length; i++) {
        let val = data[i][pctColIdx];
        if (val !== "" && val !== null && val !== undefined && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
          hasPctPoints = true;
          break;
        }
      }
    }

    let warnings = [];

    // If pct column does not have points, call harvestScoresFromSchedules
    if (!hasPctPoints) {
      harvestScoresFromSchedules(ss, data, col, targetWeekIdx, cleanGroupName, weekNum);
    } else {
      // If pct is filled, check if total matches total column in sched sheet and warn if different
      let schedSheetName = "Sched " + cleanGroupName;
      let schedSheet = ss.getSheetByName(schedSheetName) || ss.getSheetByName("Sched") || ss.getSheetByName("Schedule");
      if (schedSheet) {
        let schedData = schedSheet.getDataRange().getValues();
        if (schedData.length > 1) {
          let schedCol = buildColMap(schedData[0]);
          let schedTotIdx = schedCol.tot !== undefined ? schedCol.tot : schedCol.total;
          let schedNameIdx = schedCol.name;

          if (schedTotIdx !== undefined) {
            let schedTotals = {};
            for (let r = 1; r < schedData.length; r++) {
              let sName = schedNameIdx !== undefined ? schedData[r][schedNameIdx] : ((schedData[r][0] || "") + " " + (schedData[r][1] || "")).trim();
              if (sName) {
                schedTotals[sName.toString().trim().toLowerCase()] = parseFloat(schedData[r][schedTotIdx]) || 0;
              }
            }

            for (let i = 1; i < data.length; i++) {
              let pName = (col.name !== undefined && data[i][col.name]) 
                ? data[i][col.name].toString().trim() 
                : ((data[i][col.first] || "") + " " + (data[i][col.last] || "")).trim();
              if (!pName) continue;

              let sheetTot = totColIdx !== undefined ? (parseFloat(data[i][totColIdx]) || 0) : 0;
              let schedTot = schedTotals[pName.toLowerCase()];

              if (schedTot !== undefined && Math.abs(sheetTot - schedTot) > 0.001) {
                warnings.push(`Mismatch for ${pName}: Sheet Total (${sheetTot}) != Sched Total (${schedTot})`);
              }
            }
          }
        }
      }

      if (warnings.length > 0) {
        try {
          SpreadsheetApp.getUi().alert("⚠️ Schedule Total Mismatch Detected:\n\n" + warnings.join("\n"));
        } catch (e) {
          Logger.log("Schedule Total Mismatches: " + warnings.join("; "));
        }
      }
    }

    // Sync authoritative Pts score into target week column W(N)
    if (ptsColIdx !== undefined && targetWeekIdx !== undefined) {
      for (let i = 1; i < data.length; i++) {
        let ptsVal = data[i][ptsColIdx];
        if (ptsVal !== "" && ptsVal !== null && ptsVal !== undefined && !isNaN(parseFloat(ptsVal))) {
          data[i][targetWeekIdx] = parseFloat(ptsVal);
        }
      }
    }

    let currRColIdx = col["r" + weekNum];
    if (currRColIdx === undefined && typeof getColIdx === "function") {
      currRColIdx = getColIdx(col, ["R" + weekNum, "r" + weekNum, "R " + weekNum, "Rank " + weekNum]);
    }

    let prevRColIdx = col["r" + (weekNum - 1)];
    if (prevRColIdx === undefined && weekNum > 1 && typeof getColIdx === "function") {
      prevRColIdx = getColIdx(col, ["R" + (weekNum - 1), "r" + (weekNum - 1), "R " + (weekNum - 1)]);
    }

    let rawRankColIdx = col.rawRankCol;
    let rNumIdx = col.rNum !== undefined ? col.rNum : col.rnum;

    // Calculate active player count first for new player default rank calculation
    let numActive = 0;
    for (let i = 1; i < data.length; i++) {
      let pName = (col.name !== undefined && data[i][col.name]) 
        ? data[i][col.name].toString().trim() 
        : ((data[i][col.first] || "") + " " + (data[i][col.last] || "")).trim();
      if (!pName) continue;
      let rawScoreVal = targetWeekIdx !== undefined ? data[i][targetWeekIdx] : "";
      if (rawScoreVal !== "" && rawScoreVal !== null && rawScoreVal !== undefined && !isNaN(parseFloat(rawScoreVal))) {
        numActive++;
      }
    }

    // Default rank for new players: 1 + active players
    let defaultPrevRank = numActive + 1;

    // Rank parser (never sets rank to Infinity)
    function safeParseRankVal(val) {
      if (val === null || val === undefined || val === "") {
        return { rank: defaultPrevRank, numPeople: 0, rawStr: "" };
      }
      let str = (val instanceof Date) ? ((val.getMonth() + 1) + "/" + val.getDate()) : val.toString().trim();
      str = str.replace(/^'/, "");
      let clean = str.replace(/-(R|I)$/i, "").trim();
      let parts = clean.split("/");
      let rank = parseInt(parts[0], 10);
      let numPeople = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      return {
        rank: (isNaN(rank) || rank === Infinity) ? defaultPrevRank : rank,
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
      let weeksPlayed = 0;
      for (let w = 1; w <= 10; w++) {
        let wIdx = col["w" + w];
        if (wIdx !== undefined && row[wIdx] !== "" && row[wIdx] !== null) {
          let val = parseFloat(row[wIdx]);
          if (!isNaN(val)) {
            cumScore += val;
            weeksPlayed++;
          }
        }
      }

      let maxPtsForPlayedWeeks = weeksPlayed * maxPtsPerWeek;
      let cumPct = maxPtsForPlayedWeeks > 0 ? (cumScore / maxPtsForPlayedWeeks) : 0;
      let stats = calculateStats(row, col);

      let prevRankInfo = { rank: defaultPrevRank, numPeople: 0, rawStr: "" };
      if (prevRColIdx !== undefined && row[prevRColIdx] !== "" && row[prevRColIdx] !== null) {
        prevRankInfo = safeParseRankVal(row[prevRColIdx]);
      } else {
        let recent = getMostRecentRank(row, col, weekNum - 1);
        if (recent && typeof recent === "object" && recent.rank !== undefined) {
          prevRankInfo = recent;
          if (prevRankInfo.rank === Infinity || isNaN(prevRankInfo.rank)) {
            prevRankInfo.rank = defaultPrevRank;
          }
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
        maxPtsForPlayedWeeks: maxPtsForPlayedWeeks,
        cumPct: cumPct,
        prevRank: prevRankInfo.rank,
        prevNumPeople: prevRankInfo.numPeople,
        prevRawStr: prevRankInfo.rawStr
      };

      if (hasScore) activePlayers.push(playerObj);
      else inactivePlayers.push(playerObj);
    }

    const maxMove = typeof MAX_MOVEMENT !== "undefined" ? MAX_MOVEMENT : 4;

    activePlayers.sort((a, b) => {
      if (Math.abs(b.cumPct - a.cumPct) > 0.0001) return b.cumPct - a.cumPct;
      let prevA = (a.prevRank > 0) ? a.prevRank : defaultPrevRank;
      let prevB = (b.prevRank > 0) ? b.prevRank : defaultPrevRank;
      if (prevA !== prevB) return prevA - prevB;
      return b.prevNumPeople - a.prevNumPeople;
    });

    activePlayers.forEach((p, index) => { p.rawRank = index + 1; });

    activePlayers.forEach(p => {
      let effectivePrevRank = (p.prevRank > 0) ? p.prevRank : defaultPrevRank;
      let minAllowed = Math.max(1, effectivePrevRank - maxMove);
      let maxAllowed = effectivePrevRank + maxMove;
      p.clampedRank = Math.min(Math.max(p.rawRank, minAllowed), maxAllowed);
      p.isRestricted = RESTRICT_BY_RAW_RANK ? (Math.abs(p.rawRank - effectivePrevRank) > maxMove) : false;
    });

    activePlayers.sort((a, b) => {
      if (a.clampedRank !== b.clampedRank) return a.clampedRank - b.clampedRank; 
      if (Math.abs(b.cumPct - a.cumPct) > 0.0001) return b.cumPct - a.cumPct;    
      let prevA = (a.prevRank > 0) ? a.prevRank : defaultPrevRank;
      let prevB = (b.prevRank > 0) ? b.prevRank : defaultPrevRank;
      if (prevA !== prevB) return prevA - prevB;              
      return b.prevNumPeople - a.prevNumPeople;                                   
    });

    activePlayers.forEach((p, index) => {
      p.finalRank = index + 1;
      if (!RESTRICT_BY_RAW_RANK) {
        let effectivePrevRank = (p.prevRank > 0) ? p.prevRank : defaultPrevRank;
        p.isRestricted = (Math.abs(p.finalRank - effectivePrevRank) > maxMove);
      }
      let suffix = p.isRestricted ? "-R" : "";
      p.rjStr = p.finalRank + "/" + numActive + suffix;
    });

    inactivePlayers.forEach(p => {
      p.rawRank = "";
      p.finalRank = p.prevRank !== defaultPrevRank ? p.prevRank : "";

      if (p.prevRank > 0 && p.prevRank !== defaultPrevRank) {
        let numP = p.prevNumPeople > 0 ? p.prevNumPeople : numActive;
        p.rjStr = p.prevRank + "/" + numP + "-I";
      } else if (p.prevRawStr) {
        let cleanStr = p.prevRawStr.replace(/-(R|I)$/i, "").trim();
        p.rjStr = cleanStr ? (cleanStr + "-I") : "";
      } else {
        p.rjStr = "";
      }
    });

    // Update active players: explicitly set status to ACTIVE if they have a score
    activePlayers.forEach(p => {
      if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
      if (totColIdx !== undefined) p.rowRaw[totColIdx] = p.cumScore;
      if (posColIdx !== undefined) p.rowRaw[posColIdx] = p.maxPtsForPlayedWeeks;
      if (pctColIdx !== undefined) p.rowRaw[pctColIdx] = p.cumPct;
      if (col.status !== undefined) p.rowRaw[col.status] = "ACTIVE";
      if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = p.rawRank;
      if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr ? p.rjStr.replace(/^'/, "") : "";
      
      if (rNumIdx !== undefined) {
        let rNumPct = (p.cumPct * 100).toFixed(2);
        p.rowRaw[rNumIdx] = p.isRestricted ? (rNumPct + "R") : rNumPct;
      }
    });

    // Update inactive players: NEVER set status to INACTIVE
    inactivePlayers.forEach(p => {
      if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
      if (totColIdx !== undefined) p.rowRaw[totColIdx] = p.cumScore;
      if (posColIdx !== undefined) p.rowRaw[posColIdx] = p.maxPtsForPlayedWeeks;
      if (pctColIdx !== undefined) p.rowRaw[pctColIdx] = p.cumPct;
      // Note: col.status is intentionally left unchanged so no player is set to INACTIVE
      if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = "";
      if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = p.rjStr ? p.rjStr.replace(/^'/, "") : "";
      if (rNumIdx !== undefined) p.rowRaw[rNumIdx] = "";
    });

    let finalRows = [headerRow];
    activePlayers.forEach(p => finalRows.push(p.rowRaw));
    inactivePlayers.forEach(p => finalRows.push(p.rowRaw));

    if (currRColIdx !== undefined) {
      sheet.getRange(1, currRColIdx + 1, finalRows.length, 1).setNumberFormat('@');
    }

    sheet.clearContents();
    sheet.getRange(1, 1, finalRows.length, finalRows[0].length).setValues(finalRows);
    updateRankingsSheetForGroup(ss, cleanGroupName, activePlayers, inactivePlayers, weekNum);
    clearAllGroupCaches(cleanGroupName);

    let warnSummary = warnings.length > 0 ? ` (⚠️ ${warnings.length} Sched Total mismatches detected)` : "";
    return `✅ Standings and Week ${weekNum} Rankings (R${weekNum}) processed for '${sheet.getName()}'! (${activePlayers.length} Active, ${inactivePlayers.length} Inactive)${warnSummary}`;
  });
}

function updateRankingsSheetForGroup(ss, groupName, activePlayers, inactivePlayers, weekNum) {
  let rankSheetName = "Rankings " + groupName;
  let rankSheet = ss.getSheetByName(rankSheetName) || ss.insertSheet(rankSheetName);
  rankSheet.clear();
  
  let rankOut = [["Rank", "Name", "Win %", "Total Points"]];
  
  // Helper to strip leading quotes for clean plain-text output
  function cleanRankStr(val, fallback) {
    if (val === null || val === undefined || val === "") return fallback;
    let str = String(val).replace(/^'/, "").trim();
    return str || fallback;
  }

  activePlayers.forEach(p => {
    // Use cumulative weekly percentage and total score for consistency
    let pctVal = p.cumPct !== undefined ? p.cumPct : (p.winPct || 0);
    let winPctStr = (pctVal * 100).toFixed(1) + "%";
    let scoreVal = p.cumScore !== undefined ? p.cumScore : (p.total || 0);
    let rankStr = cleanRankStr(p.rjStr, "");
    
    rankOut.push([rankStr, p.name, winPctStr, scoreVal]);
  });
  
  inactivePlayers.forEach(p => {
    let pctVal = p.cumPct !== undefined ? p.cumPct : (p.winPct || 0);
    let winPctStr = (pctVal * 100).toFixed(1) + "%";
    let scoreVal = p.cumScore !== undefined ? p.cumScore : (p.total || 0);
    let rankStr = cleanRankStr(p.rjStr, "INACTIVE");
    
    rankOut.push([rankStr, p.name, winPctStr, scoreVal]);
  });

  let range = rankSheet.getRange(1, 1, rankOut.length, 4);
  
  // Format range as Plain Text BEFORE setting values to prevent Date auto-coercion
  range.setNumberFormat("@");
  range.setValues(rankOut);
  
  rankSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
}


function oldprocessWeeklyScoresForSheet(sheet, forcedWeek, shouldShift = true) {
return executeWithLock(function() {
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
  function oldsafeParseRankVal(val) {
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
  clearAllGroupCaches(cleanGroupName);
  return `✅ Standings and Week ${weekNum} Rankings (R${weekNum}) processed for '${sheet.getName()}'! (${activePlayers.length} Active, ${inactivePlayers.length} Inactive)`;
})
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
  if (weekVal === "" || weekVal === null || weekVal === undefined) return 1;
  var num = parseInt(String(weekVal).replace(/\D/g, ""), 10);
  return isNaN(num) ? 1 : num;
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
  let matchedName = ""; 
 
   for (let r = 1; r < data.length; r++) {
    let pName = (data[r][nameIdx] || "").toString().trim().toLowerCase();
    let pPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";

    let isMatch = (pName && pName === targetNorm) || 
                  (normPhone.length >= 7 && pPhone.endsWith(normPhone.slice(-7)));

    if (isMatch) {
      sheet.getRange(r + 1, checkInIdx + 1).setValue("X");
      found = true;
      matchedName = String(data[r][nameIdx] || "").trim();
      break;
    }
  }

  if (found) {
    // Update Score Sheet timestamp column
    if (typeof updateScoreSheetTimestamp === 'function') {
      try {
        updateScoreSheetTimestamp(cleanGroupName, matchedName || targetPlayer, "Last Check-In", new Date());
      } catch (e) {
        logDebug("ensurePlayerCheckedIn", "Warning: Failed to update Score Sheet timestamp", e.toString());
      }
    }

    const cacheKey = getCheckInCacheKey("Sched " + cleanGroupName);
    if (typeof CacheService !== 'undefined') {
      try { CacheService.getScriptCache().remove(cacheKey); } catch(e) {}
    }
  }

  return { 
    success: found, 
    status: found ? "success" : "failed", 
    message: found ? `You are successfully checked in!<br> Loading everyone....` : "Player not found on sheet." 
  };
}





/**
 * Unified function to get roster data with score sync and auto-register missing players.
 * - Sched Sheet: Total score read/synced at Column G ("Total")
 * - Score Sheet: Points read/synced at Column E ("Pts")
 * - Returns player objects containing `score` property (returns "" if empty).
 */
/**
 * Unified function to get roster data with score sync and auto-register missing players.
 * - Sched Sheet: Total score read/synced at Column G ("Total")
 * - Score Sheet: Points read/synced at Column E ("Pts")
 * - Returns player objects containing `score` property (returns "" if empty).
 */
/**
 * Unified function to get roster data with score sync and auto-register missing players.
 * - Sched Sheet: Total score read/synced at Column G ("Total")
 * - Score Sheet: Points read/synced at Column E ("Pts")
 * - Returns player objects containing `score` property (returns "" if empty).
 * - Court status: "NoSchedYet" if no courts are assigned anywhere; "BYE" for unscheduled players once a schedule exists.
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

    // Helper: Clean whitespace & artifacts
    function cleanStr(val) {
      return String(val || '')
        .replace(/[\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Helper: Safely format score value (returns "" if empty)
    function cleanScore(val) {
      if (val === "" || val === null || val === undefined) return "";
      const strVal = String(val).trim();
      if (strVal === "") return "";
      const num = Number(strVal);
      return isNaN(num) ? strVal : num;
    }

    // Helper: Extract last name safely
    function extractLastName(fullName) {
      const str = cleanStr(fullName).toLowerCase();
      if (!str) return "";
      if (str.includes(",")) return str.split(",")[0].trim();
      const parts = str.split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    }

    // Helper: Split full name into first and last
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

    // 1. Check Cache unless forceRefresh or autoSync is true
    if (!payloadObj.forceRefresh && !payloadObj.autoSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
            return Object.assign({}, parsed, { source: "cache" });
          }
        } catch (e) {
          // Ignore corrupt cache
        }
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
    const scoreUpdates = []; // Collect cell updates for Score sheet (Col E)
    const schedUpdates = []; // Collect cell updates for Sched sheet (Col G)

    let scoreHeaders = [];
    let scoreFirstIdx = -1;
    let scoreLastIdx = -1;
    let scoreFullNameIdx = -1;
    let scorePhoneIdx = -1;
    let scoreActiveIdx = -1;
    let scoreEmailIdx = -1;
    let scorePtsIdx = 4; // Default to Column E (0-indexed 4)

    // 2. READ SCORE SHEET (Pts in Column E / Index 4)
    if (scoreSheet) {
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 0) {
        scoreHeaders = scoreData[0].map(h => cleanStr(h).toLowerCase());

        scoreFirstIdx = scoreHeaders.findIndex(h => /\bfirst\b/i.test(h));
        scoreLastIdx = scoreHeaders.findIndex(h => /\blast\b/i.test(h));
        scoreFullNameIdx = scoreHeaders.findIndex(h => /(full\s*name|^name$\vert{}^player$|player\s*name)/i.test(h) && !/first|last/i.test(h));
        scorePhoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        scoreActiveIdx = scoreHeaders.findIndex(h => /status|active/i.test(h));
        scoreEmailIdx = scoreHeaders.findIndex(h => /email|mail/i.test(h));

        const foundPtsIdx = scoreHeaders.findIndex(h => /^pts$|^points$\vert{}^total$/i.test(h));
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

          const cleanPhone = scorePhoneIdx !== -1 ? cleanStr(scoreData[r][scorePhoneIdx]).replace(/\D/g, "") : "";
          const cleanEmail = scoreEmailIdx !== -1 ? cleanStr(scoreData[r][scoreEmailIdx]) : "";

          let isActive = true;
          if (scoreActiveIdx !== -1) {
            const rawStatus = cleanStr(scoreData[r][scoreActiveIdx]).toUpperCase();
            isActive = (rawStatus !== "INACTIVE" && rawStatus !== "FALSE");
          }

          scorePlayers.push({
            rawName: pName,
            normFull: pName.toLowerCase(),
            normLast: lName ? lName.toLowerCase() : extractLastName(pName),
            phone: cleanPhone,
            email: cleanEmail,
            active: isActive,
            score: cleanScore(scoreData[r][scorePtsIdx]),
            scoreRow: r + 1, // 1-based row index in Score Sheet
            used: false
          });
        }
      }
    }

    const finalRoster = [];
    let syncedCount = 0;
    const newScoreRowsToAppend = [];

    // 3. READ SCHED SHEET (Total in Column G / Index 6) & PERFORM SYNC
    if (schedSheet) {
      const schedData = schedSheet.getDataRange().getValues();
      if (schedData.length > 1) {
        const headers = schedData[0].map(h => cleanStr(h).toLowerCase());

        const matchedNameIdx = headers.findIndex(h => /name|player/i.test(h));
        const nameIdx = matchedNameIdx !== -1 ? matchedNameIdx : (schedData[0].length > 1 ? 1 : 0);
        const schedPhoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        let checkIdx = headers.findIndex(h => /check|checked|x/i.test(h));
        const courtIdx = headers.findIndex(h => /court/i.test(h));

        // Locate Column G (Total)
        let totalIdx = headers.findIndex(h => /^total$|^pts$\vert{}^score$/i.test(h));
        if (totalIdx === -1) totalIdx = 6;

        // Check if ANY valid player row currently has an assigned court
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

        // Standard fallback label depending on schedule state
        const fallbackCourt = hasAnyCourtAssigned ? "BYE" : "NoSchedYet";

        for (let r = 1; r < schedData.length; r++) {
          const pName = cleanStr(schedData[r][nameIdx]);
          if (!pName || pName.startsWith("---") || pName.toLowerCase().startsWith("time:")) continue;

          const schedRow = r + 1; // 1-based row index in Sched Sheet
          const normFull = pName.toLowerCase();
          const normLast = extractLastName(pName);
          const schedPhone = schedPhoneIdx !== -1 ? cleanStr(schedData[r][schedPhoneIdx]).replace(/\D/g, "") : "";

          let rawCheck = checkIdx !== -1 ? schedData[r][checkIdx] : false;
          let isCheckedIn = (typeof isCheckInTrue === 'function')
            ? isCheckInTrue(rawCheck)
            : ["x", "true", "yes", "1"].includes(cleanStr(rawCheck).toLowerCase());

          const rawCourt = courtIdx !== -1 ? cleanStr(schedData[r][courtIdx]) : "";
          const courtVal = rawCourt || fallbackCourt;
          const schedScore = cleanScore(schedData[r][totalIdx]);

          let match = null;

          // Matching logic
          match = scorePlayers.find(sp => !sp.used && sp.normFull === normFull);
          if (!match && schedPhone && schedPhone.length >= 7) {
            match = scorePlayers.find(sp => !sp.used && sp.phone && sp.phone.endsWith(schedPhone.slice(-7)));
          }
          if (!match && normLast && normLast.length >= 3) {
            const lastMatches = scorePlayers.filter(sp => !sp.used && sp.normLast === normLast);
            if (lastMatches.length === 1) match = lastMatches[0];
          }

          if (match) {
            match.used = true;
            let finalScore = "";

            // TWO-WAY SCORE SYNC LOGIC
            if (schedScore !== "" && match.score === "") {
              // Sched Col G has value, Score Col E is empty -> Sync G -> E
              finalScore = schedScore;
              if (scoreSheet) {
                scoreUpdates.push({ row: match.scoreRow, col: scorePtsIdx + 1, val: schedScore });
              }
            } else if (schedScore === "" && match.score !== "") {
              // Score Col E has value, Sched Col G is empty -> Sync E -> G
              finalScore = match.score;
              schedUpdates.push({ row: schedRow, col: totalIdx + 1, val: match.score });
            } else if (schedScore !== "") {
              // Both populated -> Use Sched Col G as current week total
              finalScore = schedScore;
            } else {
              // Both empty
              finalScore = "";
            }

            finalRoster.push({
              name: pName,
              phone: schedPhone || match.phone,
              email: match.email,
              active: match.active,
              checkedIn: isCheckedIn,
              court: courtVal,
              score: finalScore
            });
          } else {
            // UNMATCHED PLAYER: Queue for Score sheet creation & assignment
            finalRoster.push({
              name: pName,
              phone: schedPhone,
              email: "",
              active: true,
              checkedIn: isCheckedIn,
              court: courtVal,
              score: schedScore // Returns "" if schedScore is empty
            });

            if (scoreSheet) {
              const numCols = Math.max(scoreSheet.getLastColumn(), scoreHeaders.length, 5);
              const newRow = new Array(numCols).fill("");
              const nameParts = splitName(pName);

              if (scoreFirstIdx !== -1) newRow[scoreFirstIdx] = nameParts.first;
              if (scoreLastIdx !== -1) newRow[scoreLastIdx] = nameParts.last;
              if (scoreFullNameIdx !== -1) newRow[scoreFullNameIdx] = pName;
              if (scoreFirstIdx === -1 && scoreLastIdx === -1 && scoreFullNameIdx === -1) newRow[0] = pName;

              if (scorePhoneIdx !== -1) newRow[scorePhoneIdx] = schedPhone;
              if (scoreActiveIdx !== -1) newRow[scoreActiveIdx] = "ACTIVE";
              newRow[scorePtsIdx] = schedScore; // Syncs Col G value into Col E

              newScoreRowsToAppend.push(newRow);
              syncedCount++;
            }
          }
        }
      }
    }

    // Apply two-way updates to actual sheets
    scoreUpdates.forEach(u => scoreSheet.getRange(u.row, u.col).setValue(u.val));
    schedUpdates.forEach(u => schedSheet.getRange(u.row, u.col).setValue(u.val));

    // Append new synced players to Score sheet
    if (scoreSheet && newScoreRowsToAppend.length > 0) {
      const startRow = scoreSheet.getLastRow() + 1;
      scoreSheet.getRange(startRow, 1, newScoreRowsToAppend.length, newScoreRowsToAppend[0].length).setValues(newScoreRowsToAppend);
    }

    // 4. ADD UNASSIGNED SCORE SHEET PLAYERS
    const fallbackCourtForUnassigned = (schedSheet && finalRoster.some(p => p.court && p.court !== "BYE" && p.court !== "NoSchedYet")) 
      ? "BYE" 
      : "NoSchedYet";

    scorePlayers.forEach(sp => {
      if (!sp.used) {
        finalRoster.push({
          name: sp.rawName,
          phone: sp.phone,
          email: sp.email,
          active: sp.active,
          checkedIn: false,
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

    // Save to Cache
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
 * Helper to get or append a header column if it doesn't already exist on a sheet.
 */
function getOrAddHeaderColumn(sheet, headerRowIdx, headerRowValues, targetHeaderName) {
  const cleanTarget = targetHeaderName.toLowerCase().replace(/[\s\-_]/g, "");
  let colIdx = headerRowValues.findIndex(h => {
    const cleanH = String(h || "").toLowerCase().replace(/[\s\-_]/g, "");
    return cleanH.includes(cleanTarget);
  });

  if (colIdx === -1) {
    colIdx = headerRowValues.length;
    sheet.getRange(headerRowIdx + 1, colIdx + 1).setValue(targetHeaderName);
  }
  return colIdx;
}

/**
 * Helper to update a long-term timestamp column on the master "Score <Group>" sheet.
 */
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
    targetPlayer = sheetNameOrData.playerName || sheetNameOrData.name || sheetNameOrData.phone || "";
    
    // Fall back through isCheckedIn -> checkedIn -> status -> default to true
    checkedState = sheetNameOrData.isCheckedIn !== undefined 
      ? sheetNameOrData.isCheckedIn 
      : (sheetNameOrData.checkedIn !== undefined ? sheetNameOrData.checkedIn : (sheetNameOrData.status !== undefined ? sheetNameOrData.status : true));
  } else {
    sheetName = sheetNameOrData;
    targetPlayer = playerName;
    checkedState = isCheckedIn !== undefined ? isCheckedIn : true;
  }

  // Coerce to explicit boolean
  const isCheckedInBool = (checkedState === true || checkedState === 'true' || checkedState === 1);

  const now = new Date();
  
  // 1. Update the Google Sheet
  const result = updatePlayerCheckInInSheet(sheetName, targetPlayer, isCheckedInBool, now);

  // 2. Only update Script Cache if the sheet update was SUCCESSFUL
  if (result && result.success) {
    const cacheKey = getCheckInCacheKey(sheetName);
    const cache = CacheService.getScriptCache();
    try {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        let players = JSON.parse(cachedData);
        const targetStr = String(targetPlayer).trim().toLowerCase();
        const targetDigits = String(targetPlayer).replace(/\D/g, ''); // Extract digits only

        players = players.map(p => {
          const pName = String(p.name || '').trim().toLowerCase();
          const pPhoneDigits = String(p.phone || '').replace(/\D/g, '');

          // Match by Name OR by formatted/unformatted Phone digits
          const nameMatch = targetStr && pName === targetStr;
          const phoneMatch = targetDigits && targetDigits.length >= 7 && pPhoneDigits === targetDigits;

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

  return result;
}

/**
 * Searches the schedule sheet by Name OR Phone, validates Active status,
 * and records check-in status ("X").
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

  // Robust Phone Digits Extractor (handles Numbers, Scientific Notation & Strings)
  const getDigits = val => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'number') return val.toFixed(0); 
    return String(val).replace(/\D/g, "");
  };

  let headerRowIdx = 0;
  let nameIdx = -1;
  let phoneIdx = -1;
  let checkInIdx = -1;
  let activeIdx = -1;

  for (let r = 0; r < Math.min(data.length, 5); r++) {
    const rowHeaders = data[r].map(h => cleanStr(h).replace(/[\s\-_]/g, ""));
    const tempNameIdx = rowHeaders.findIndex(h => h.includes("player") || h.includes("name"));
    
    if (tempNameIdx !== -1) {
      headerRowIdx = r;
      nameIdx = tempNameIdx;
      phoneIdx = rowHeaders.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("cell"));
      checkInIdx = rowHeaders.findIndex(h => h.includes("checkin") || h.includes("status") || h === "x");
      activeIdx = rowHeaders.findIndex(h => h.includes("active") || h === "act");
      break;
    }
  }

  if (nameIdx === -1) nameIdx = 0;
  if (checkInIdx === -1) checkInIdx = 2;

  const targetNorm = cleanStr(targetPlayer);
  const targetDigits = getDigits(targetPlayer);
  
  let found = false;
  const updateTime = timestamp || new Date();

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    let pName = cleanStr(data[r][nameIdx]);
    let pPhone = phoneIdx !== -1 ? getDigits(data[r][phoneIdx]) : "";
    
    if (!pName && !pPhone) continue;

    const nameMatch = targetNorm && (pName === targetNorm || pName.includes(targetNorm) || targetNorm.includes(pName));
    const phoneMatch = targetDigits.length >= 7 && pPhone && pPhone === targetDigits;

    if (nameMatch || phoneMatch) {
      
      // ⚡ Active Guardrail
      if (activeIdx !== -1) {
        const rawActive = data[r][activeIdx];
        const cleanActive = cleanStr(rawActive);
        
        const isInactive = (
          rawActive === false || 
          cleanActive === "false" || 
          cleanActive === "inactive" || 
          cleanActive === "no" || 
          cleanActive === "n"
        );

        if (isInactive) {
          logDebug("updatePlayerCheckInInSheet", "Check-in blocked: Player is inactive", { targetPlayer });
          return { 
            success: false, 
            isInactive: true, 
            message: "Inactive cannot check in" 
          };
        }
      }

      schedSheet.getRange(r + 1, checkInIdx + 1).setValue(checkedState ? "X" : "");
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, message: `Player '${targetPlayer}' not found on sheet` };
  }

  // Safe execution for Score Sheet timestamp update
  if (checkedState && typeof updateScoreSheetTimestamp === 'function') {
    try {
      updateScoreSheetTimestamp(cleanGroupName, targetPlayer, "Last Check-In", updateTime);
    } catch (e) {
      logDebug("updatePlayerCheckInInSheet", "Warning: Failed to update Score Sheet timestamp", e.toString());
    }
  }

  return { success: true, message: "Updated check-in" };
}






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
  const checkedSet = new Set(namesArray.map(n => n.toString().trim().toLowerCase()));

  let headers = data[0].map(h => h.toString().toLowerCase().trim());
  let checkInIdx = headers.indexOf("check-in");
  let targetCol = checkInIdx !== -1 ? checkInIdx + 1 : 7;

  const now = new Date();
  let updatedCount = 0;

  for (let i = 1; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:")) {
      let isChecked = checkedSet.has(name.toLowerCase());
      sheet.getRange(i + 1, targetCol).setValue(isChecked ? "X" : "");
      
      if (isChecked) {
        updatedCount++;
        // Write long-term timestamp on Score sheet
        updateScoreSheetTimestamp(cleanGroupName, name, "Last Check-In", now);
      }
    }
  }

  const cacheKey = getCheckInCacheKey(schedSheetName);
  if (cacheKey) CacheService.getScriptCache().remove(cacheKey);

  return `✅ Check-ins saved successfully (${updatedCount} checked in)!`;
}


// --- 2. AVAILABILITY / ACTIVE STATUS TOGGLE ---

function toggleUnifiedActiveStatus(payload) {
  return executeWithLock(function() {
    try {
      const group = payload.groupName || payload.group || "";
      const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim();
      const targetPhone = String(payload.phone || "").replace(/\D/g, "");
      const targetName = String(payload.playerName || payload.name || "").trim().toLowerCase();

      const ss = getDb();
      const scoreSheet = ss.getSheetByName("Score " + cleanGroup);
      if (!scoreSheet) return { success: false, error: "Score sheet 'Score " + cleanGroup + "' not found." };

      const data = scoreSheet.getDataRange().getValues();
      if (data.length < 2) return { success: false, error: "Sheet has no player rows." };

      const headers = data[0].map(h => h.toString().toLowerCase().trim());
      let activeIdx = headers.findIndex(h => h === "status" || h === "active" || h.includes("active"));
      let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile"));
      let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));

      if (activeIdx === -1) return { success: false, error: "Status/Active column header not found." };

      // Get or add "Last Availability Change" column on Score sheet
      const lastAvailabilityIdx = getOrAddHeaderColumn(scoreSheet, 0, data[0], "Last Availability Change");

      for (let r = 1; r < data.length; r++) {
        let rowPhone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").replace(/\D/g, "") : "";
        let rowName = nameIdx !== -1 ? String(data[r][nameIdx] || "").trim().toLowerCase() : "";

        let isPhoneMatch = targetPhone && rowPhone && rowPhone.endsWith(targetPhone.slice(-7));
        let isNameMatch = targetName && rowName && (rowName === targetName || rowName.includes(targetName));

        if (isPhoneMatch || isNameMatch) {
          const cell = scoreSheet.getRange(r + 1, activeIdx + 1);
          const currentStatus = String(cell.getValue() || "").trim().toUpperCase();
          const newStatus = (currentStatus === "ACTIVE") ? "INACTIVE" : "ACTIVE";

          cell.setValue(newStatus);
          cell.setBackground(newStatus === "ACTIVE" ? "#d4FF8a" : "#fff366");

          // Update "Last Availability Change" timestamp on Score sheet
          const now = new Date();
          scoreSheet.getRange(r + 1, lastAvailabilityIdx + 1).setValue(now);

          SpreadsheetApp.flush();

          try {
            if (typeof getCheckInCacheKey === 'function') {
              const cacheKey = getCheckInCacheKey("Sched " + cleanGroup);
              CacheService.getScriptCache().remove(cacheKey);
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
      }

      return { success: false, error: "Player not found by phone (" + targetPhone + ") or name (" + targetName + ")." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}



function getCheckInCacheKey(groupName) {
  return "CHECKIN_CACHE_" + (groupName || 'DEFAULT').toUpperCase();
}



function clearUnifiedCache(groupOrSheetName) {
  if (typeof CacheService === 'undefined') return;
  const cache = CacheService.getScriptCache();
  const cacheKey = getCheckInCacheKey(groupOrSheetName);
  
  try {
    cache.removeAll([cacheKey, "APP_INIT_DATA", "GLOBAL_SCHEDULE_INDEX"]);
  } catch (err) {
    logDebug("clearUnifiedCache", "Failed cache clear", err.message);
  }
}


function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  
  // If an admin manually edits a Sched or Score sheet, clear its cache
  if (sheetName.startsWith("Sched ") || sheetName.startsWith("Score ")) {
    clearUnifiedCache(sheetName);
  }
  
}    


/**
 * Executes a function under a ScriptLock with automatic retries and randomized backoff.
 * 
 * @param {Function} actionFn - The function containing business logic to execute securely.
 * @param {number} [maxRetries=3] - Maximum number of retry attempts if lock is busy.
 * @param {number} [timeoutMs=4000] - Time (in ms) to wait per attempt for the lock.
 * @returns {Object} Result object from actionFn or failure response.
 */
function executeWithLock(actionFn, maxRetries = 3, timeoutMs = 4000) {
  const lock = LockService.getScriptLock();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let hasLock = false;

    try {
      // tryLock returns true if acquired, false if timed out
      hasLock = lock.tryLock(timeoutMs);

      if (hasLock) {
        // Lock successfully acquired — execute business logic
        return actionFn();
      }
    } catch (err) {
      logDebug("executeWithLock Error", `Execution error on attempt ${attempt}`, err.toString());
      return {
        success: false,
        message: "Server Execution Error: " + err.message
      };
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }

    // Lock was busy — wait a random time (Jitter + Exponential Backoff) before retrying
    if (attempt < maxRetries) {
      // Random delay between 150ms and 450ms plus backoff per attempt
      const jitter = Math.floor(Math.random() * 300) + 150;
      const backoff = Math.pow(2, attempt - 1) * 200;
      const sleepMs = jitter + backoff;

      logDebug("executeWithLock", `Lock busy on attempt ${attempt}/${maxRetries}. Retrying in ${sleepMs}ms...`);
      Utilities.sleep(sleepMs);
    }
  }

  // All retries failed
  return {
    success: false,
    message: "Server is currently busy processing another request. Please try again in a few seconds."
  };
}
 

/**
 * Searches across all group sheets for an existing player by phone number.
 */
/**
 * Helper to discover all group names dynamically from sheet names.
 * Example: "Score MENS", "Sched WOMENS" -> ["MENS", "WOMENS"]
 */
function getAllGroupNames() {
  const ss = getDb();
  const sheets = ss.getSheets();
  const groupSet = new Set();
  
  sheets.forEach(sheet => {
    const sName = sheet.getName();
    const match = sName.match(/^(Score|Sched)\s+(.+)$/i);
    if (match && match[2]) {
      groupSet.add(match[2].trim().toUpperCase());
    }
  });
  
  return Array.from(groupSet);
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
 * Batch updates or clears weekly scores across Score and Sched sheets.
 * - Score sheet: Clears/updates ONLY the 'Pts' column.
 * - Sched sheet: Clears/updates ONLY 'Game 1', 'Game 2', 'Game 3', and 'Total'.
 * - Stamps the admin phone in the 'Entered' column on Sched sheet for any change.
 */
function batchUpdatePlayerScores(payload) {
  try {
    const payloadObj = payload || {};
    const group = payloadObj.group || payloadObj.groupName || payloadObj.sheet || "";
    const updates = payloadObj.updates || []; // Array of { playerName, phone, score }
    const isClearAll = payloadObj.option === "clear_all" || payloadObj.action === "clear_all";

    const cleanP = (p) => String(p || '').replace(/\D/g, '');
    const adminPhone = cleanP(payloadObj.adminPhone || payloadObj.enteredBy || payloadObj.userPhone || "");

    if (!group || (!isClearAll && (!Array.isArray(updates) || updates.length === 0))) {
      return { success: false, message: "No target group or updates provided." };
    }

    const cleanGroup = String(group).replace(/^(Score|Sched)\s*/i, "").trim().toUpperCase();
    const schedSheetName = "Sched " + cleanGroup;
    const scoreSheetName = "Score " + cleanGroup;

    const ss = getDb();
    const schedSheet = ss.getSheetByName(schedSheetName);
    const scoreSheet = ss.getSheetByName(scoreSheetName);

    // Invalidate script cache for this group
    const cacheKey = "UNIFIED_ROSTER_CACHE_" + cleanGroup;
    CacheService.getScriptCache().remove(cacheKey);

    // -------------------------------------------------------------
    // 1. SCORE SHEET: Update / Clear 'Pts' Column ONLY (Col E)
    // -------------------------------------------------------------
    if (scoreSheet) {
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 1) {
        const headers = scoreData[0].map(h => String(h || '').trim().toLowerCase());
        
        const phoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        const nameIdx = headers.findIndex(h => /name|player/i.test(h));
        let ptsIdx = headers.findIndex(h => /^pts$|^points$\vert{}^total$/i.test(h));
        if (ptsIdx === -1) ptsIdx = 4; // Default to Column E

        if (isClearAll) {
          // Clear ONLY the Pts column
          scoreSheet.getRange(2, ptsIdx + 1, scoreData.length - 1, 1).clearContent();
        } else {
          updates.forEach(item => {
            const targetPhone = cleanP(item.phone);
            const targetName = String(item.playerName || '').toLowerCase().trim();

            for (let r = 1; r < scoreData.length; r++) {
              const rowPhone = phoneIdx !== -1 ? cleanP(scoreData[r][phoneIdx]) : "";
              const rowName = nameIdx !== -1 ? String(scoreData[r][nameIdx] || '').toLowerCase().trim() : "";

              const matchByPhone = targetPhone && rowPhone && rowPhone.endsWith(targetPhone.slice(-7));
              const matchByName = targetName && rowName && rowName === targetName;

              if (matchByPhone || matchByName) {
                scoreSheet.getRange(r + 1, ptsIdx + 1).setValue(item.score);
                break;
              }
            }
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 2. SCHED SHEET: Update / Clear 'Game 1', 'Game 2', 'Game 3', 'Total'
    //    & Stamp 'Entered' Column with Admin Phone
    // -------------------------------------------------------------
    if (schedSheet) {
      const schedData = schedSheet.getDataRange().getValues();
      if (schedData.length > 1) {
        const headers = schedData[0].map(h => String(h || '').trim().toLowerCase());

        const phoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        const nameIdx = headers.findIndex(h => /name|player/i.test(h));
        
        let totalIdx = headers.findIndex(h => /^total$|^pts$\vert{}^score$/i.test(h));
        if (totalIdx === -1) totalIdx = 6; // Default to Column G

        let enteredIdx = headers.findIndex(h => /^entered\s*(by)?$\vert{}^admin$/i.test(h));

        if (isClearAll) {
          // Identify specifically Game 1, Game 2, Game 3, and Total
          const schedColsToClear = [];
          headers.forEach((h, idx) => {
            if (/^game\s*1$\vert{}^g1$/i.test(h) ||
                /^game\s*2$\vert{}^g2$/i.test(h) ||
                /^game\s*3$\vert{}^g3$/i.test(h) ||
                /^total$|^pts$\vert{}^score$/i.test(h)) {
              schedColsToClear.push(idx);
            }
          });

          // Fallback to Total column if no header matches
          if (schedColsToClear.length === 0) schedColsToClear.push(totalIdx);

          const numRows = schedData.length - 1;
          schedColsToClear.forEach(colIdx => {
            schedSheet.getRange(2, colIdx + 1, numRows, 1).clearContent();
          });

          // Stamp admin phone in 'Entered' column for cleared rows
          if (enteredIdx !== -1 && adminPhone) {
            const adminVals = Array(numRows).fill([adminPhone]);
            schedSheet.getRange(2, enteredIdx + 1, numRows, 1).setValues(adminVals);
          }

        } else {
          // Standard weekly score updates
          updates.forEach(item => {
            const targetPhone = cleanP(item.phone);
            const targetName = String(item.playerName || '').toLowerCase().trim();

            for (let r = 1; r < schedData.length; r++) {
              const rowPhone = phoneIdx !== -1 ? cleanP(schedData[r][phoneIdx]) : "";
              const rowName = nameIdx !== -1 ? String(schedData[r][nameIdx] || '').toLowerCase().trim() : "";

              const matchByPhone = targetPhone && rowPhone && rowPhone.endsWith(targetPhone.slice(-7));
              const matchByName = targetName && rowName && rowName === targetName;

              if (matchByPhone || matchByName) {
                // Update Total column
                schedSheet.getRange(r + 1, totalIdx + 1).setValue(item.score);

                // Stamp Admin Phone in 'Entered' column
                if (enteredIdx !== -1 && adminPhone) {
                  schedSheet.getRange(r + 1, enteredIdx + 1).setValue(adminPhone);
                }
                break;
              }
            }
          });
        }
      }
    }

    if (isClearAll) {
      return { 
        success: true, 
        option: "clear_all", 
        message: `Cleared Game 1-3 & Total on Sched and Pts on Score for ${cleanGroup}.` 
      };
    }

    return { success: true, updatedCount: updates.length };

  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
