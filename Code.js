/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */

const ENABLE_LOGGING = true; // Toggle to true/false to enable or disable system logging

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
  // Safely check if ENABLE_LOGGING is declared without throwing a ReferenceError
  if (typeof ENABLE_LOGGING !== 'undefined' && !ENABLE_LOGGING) return;

  let extraStr = "";
  if (extra !== undefined && extra !== null && extra !== "") {
    if (typeof extra === "object") {
      try {
        extraStr = JSON.stringify(extra);
      } catch (err) {
        extraStr = `[Object/Error: ${String(extra)}]`; // Safe fallback for circular references
      }
    } else {
      extraStr = String(extra);
    }
  }

  console.log(`[${new Date().toISOString()}] [${fnName}] ${msg} ${extraStr}`.trim());
}

/**
 * Universal Check-In Value Normalizer
 * Standardizes boolean values, string representations, and cell markers.
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


/**
 * Returns configuration directly from hardcoded constants.
 * Bypasses all spreadsheet tab reads.
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

/**
 * Fetches players and their current check-in state with flexible column matching.
 */
function fetchPlayersFromSheet(inputName) {
  if (!inputName) return { error: "No sheet or group name provided." };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let cleanGroupName = inputName.replace(/^(Score|Sched|Rankings)\s*/i, "").trim();

  let sheet = ss.getSheetByName("Sched " + cleanGroupName) || 
              ss.getSheetByName("Score " + cleanGroupName) || 
              ss.getSheetByName(inputName);

  if (!sheet) return { error: `Sheet not found for group '${inputName}'` };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  // Clean headers for matching
  const headers = data[0].map(h => h.toString().toLowerCase().replace(/[\s\-_]/g, "").trim());
  
  // Look for Name column (default to col 0)
  let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
  if (nameIdx === -1) nameIdx = 0;

  // Flexible Check-In column lookup with fallback to Column 7 (Column G)
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

    players.push({ name: pName, checkedIn: isCheckedIn, checked: isCheckedIn, court: courtVal });
  }

  logDebug("getPlayersForCheckIn", `Parsed ${players.length} players for '${sheet.getName()}' (Check-In Col Index: ${checkInIdx})`); 
  return players;
}

/**
 * Instant Single Player Check-In Toggle (Auto-Save on Click)
 */
function toggleSingleCheckIn(sheetNameOrData, playerName, isCheckedIn) {
  // Normalize parameters (handles both object payloads and positional arguments)
  let sheetName, targetPlayer, checkedState;
  
  if (typeof sheetNameOrData === 'object' && sheetNameOrData !== null) {
    sheetName = sheetNameOrData.sheet || sheetNameOrData.sheetName || "";
    targetPlayer = sheetNameOrData.playerName || sheetNameOrData.name || "";
    checkedState = sheetNameOrData.isCheckedIn;
  } else {
    sheetName = sheetNameOrData;
    targetPlayer = playerName;
    checkedState = isCheckedIn;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Normalize tab name prefix if missing
  const resolvedName = String(sheetName).startsWith("Sched ") ? sheetName : "Sched " + sheetName;
  const sheet = ss.getSheetByName(resolvedName) || ss.getSheetByName(sheetName);
  
  if (!sheet) throw new Error("Sheet not found: " + sheetName);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No player data found in sheet: " + sheetName);

  const data = sheet.getRange(1, 1, lastRow, 7).getValues();
  const targetName = String(targetPlayer || '').trim().toLowerCase();
  
  for (let i = 0; i < data.length; i++) {
    const rowName = String(data[i][0] || '').trim().toLowerCase();
    
    if (rowName === targetName) {
      const targetRow = i + 1;
      const checkInCol = 7; // Column G (Check-In)
      const marker = checkedState ? "X" : ""; // Uses "X" / empty string standard

      // Write directly to Column G (Check-In)
      sheet.getRange(targetRow, checkInCol).setValue(marker);
      
      SpreadsheetApp.flush(); // Force changes to write immediately
      
      if (typeof logDebug === 'function') {
        logDebug("toggleSingleCheckIn", `Successfully updated ${targetPlayer} to check-in: '${marker}' on row ${targetRow}`);
      }
      
      return { success: true, name: targetPlayer, checkedIn: !!checkedState, row: targetRow };
    }
  }
  
  throw new Error("Player '" + targetPlayer + "' not found on sheet " + sheetName);
}

function saveCheckIns(schedSheetName, checkedPlayerNames) {
  logDebug("saveCheckIns", "Saving check-ins for sheet", { schedSheetName, checkedPlayerNames });
  if (!schedSheetName) return "⚠️ Error: No target sheet specified.";

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
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

  logDebug("saveCheckIns", `Successfully updated ${updatedCount} check-in markers on '${targetName}'`);
  return `✅ Check-ins saved successfully (${updatedCount} checked in)!`;
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
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
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

    let result;
    switch(action) {
       case 'sortActivePlayers':
        {
          let targetGroup = payload.arg || payload.group;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = sortActivePlayersForSheet(sheet);
        }
        break;

      case 'generateScheduleTabs':
        {
          let genTarget = payload.arg || payload.tab || payload.sheet || (payload.group ? "Score " + payload.group : null);
          let courts = payload.courts || null;
          result = generateScheduleTabs(genTarget, courts);
        }
        break;

      case 'updateStandingsWithShift':
        {
          let targetGroup = payload.arg || payload.group;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = processWeeklyScoresForSheet(sheet, "W10", true);
        }
        break;

      case 'correctScoresNoShift':
        {
          let targetGroup = payload.arg || payload.group;
          let sheet = getValidActiveScoreSheet(targetGroup);
          result = processWeeklyScoresForSheet(sheet, "W10", false);
        }
        break;

      case 'getInitialAppData':
        // Safely check if data.phone exists before passing it
        var userPhone = (payload && payload.phone) ? payload.phone : null;
        result = getInitialAppData(userPhone);
      
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
          payload.playerName || payload.name,
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
        result = togglePlayerStatus(payload.phone);
        break;

      case 'submitCourtScores':
        result = submitCourtScores(payload);
        break;

      case 'getRankingsAndSchedData':
        if (!payload.group) throw new Error('Missing "group" parameter for getRankingsAndSchedData.');
        result = getRankingsAndSchedData(payload.group);
        break;

      case 'getAdminPlayersByGroup':
        if (!payload.group) throw new Error('Missing "group" parameter for getAdminPlayersByGroup.');
        result = getAdminPlayersByGroup(payload.group);
        break;

      case 'addNewUser':
        result = addNewUser(payload);
        break;

      case 'rescheduleFromCheckIns':
        {
          let reschedTarget = payload.arg || payload.tab || payload.sheet || (payload.group ? "Sched " + payload.group : null);
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
        result = typeof getAppVersion === 'function' ? getAppVersion() : "1.1.2";
        break;

      case 'webExportSchedulePdf':
        result = webExportSchedulePdf();
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
    try {
      lock.releaseLock();
    } catch(e) {}
  }
}

function authorizeScript() {
  logDebug("authorizeScript", "Starting script authorization");
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    .addItem('7. Correct Current Scores (Current Tab - NO SHIFT)', 'menuCorrectScoresNoShift')
    .addSeparator()
    .addItem('📸 Save Pre-Work Tab', 'createPreWorkSnapshotTab')
    .addItem('⏪ Restore Score Data from Tab', 'restoreFromSnapshotTab')
    .addSeparator()
    .addItem('📁 Run Full Drive File Backup', 'menuCreateDriveBackup')
    .addItem('⏪ Restore Full File from Drive', 'restoreFullFileFromDrive')
    .addSeparator()
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let targetSheet = ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) {
    url += "#gid=" + targetSheet.getSheetId();
  }
  return url;
}

function startNewSeason() {
  logDebug("startNewSeason", "Wiping weekly score data across tabs");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  if (col.email !== undefined) newRow[col.email] = info.email.trim();
  if (col.group !== undefined) newRow[col.group] = info.group.trim();
  if (col.status !== undefined) newRow[col.status] = "ACTIVE";
  
  targetSheet.appendRow(newRow);
  logDebug("addNewUser", "User successfully added");
  return `✅ Success: Added ${info.first} ${info.last} to tab '${targetSheet.getName()}'.`;
}

function getTargetScoreSheet(groupOrTabName) {
  logDebug("getTargetScoreSheet", "Resolving target score sheet", groupOrTabName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  logDebug("restoreFullFileFromDrive", "Restore finished successfully");
  ui.alert("Restored ⏪", "Tabs restored successfully.", ui.ButtonSet.OK);
}

function createPreWorkSnapshotTab() {
  logDebug("createPreWorkSnapshotTab", "Creating snapshot tab");
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  logDebug("createPreWorkSnapshotTab", "Snapshot created", backupTabName);
  ui.alert("Backup Tab Created! 📸", `'${backupTabName}' is ready.`, ui.ButtonSet.OK);
}

function restoreFromSnapshotTab() {
  logDebug("restoreFromSnapshotTab", "Restoring tab from snapshot");
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  logDebug("restoreFromSnapshotTab", "Restored target tab", targetTabName);
  ui.alert("Restored Successfully ⏪", `${targetTabName} restored.`, ui.ButtonSet.OK);
}

function checkAndRunWeeklyBackup() {
  logDebug("checkAndRunWeeklyBackup", "Checking backup timeline");
  try {
    const props = PropertiesService.getDocumentProperties();
    const lastBackupStr = props.getProperty('LAST_AUTO_BACKUP_TIME');
    if (!lastBackupStr || (new Date().getTime() - new Date(lastBackupStr).getTime()) / 86400000 >= 7) {
      executeDriveBackup("Auto-7Day");
    }
  } catch (err) {
    logDebug("checkAndRunWeeklyBackup", "Weekly backup check failed", err.toString());
  }
}

/* ==========================================
 * 4. SHARED HELPERS & MAPPING
 * ========================================== */

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
  return col;
}

function getColIdx(colMap, candidates) {
  for (let c of candidates) {
    let clean = c.toLowerCase().replace(/[\s\-_#]/g, "");
    if (colMap[clean] !== undefined) return colMap[clean];
  }
  return undefined;
}

function parseAndSortCourts(cStr) {
  if (!cStr) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (Array.isArray(cStr)) return cStr;
  let courts = cStr.toString().split(',').map(s => s.trim()).filter(s => s.length > 0);
  return courts.length > 0 ? courts : [1, 2, 3, 4, 5, 6, 7, 8];
}

/* ==========================================
 * 5. MAIN SCORE PROCESSING & RANKING
 * ========================================== */

function processWeeklyScores(forcedWeek, shouldShift = true) {
  logDebug("processWeeklyScores", "Processing weekly scores wrapper");
  const sheet = getValidActiveScoreSheet();
  return processWeeklyScoresForSheet(sheet, forcedWeek, shouldShift);
}

function harvestScoresFromSchedules(ss, scoreData, col, targetWeekIdx, groupName) {
  logDebug("harvestScoresFromSchedules", `Harvesting scores for group '${groupName}'`);
  
  const schedSheet = ss.getSheetByName("Sched " + groupName) || 
                     ss.getSheetByName("Schedule " + groupName);
  
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

    // Use Total column directly if available
    if (totalIdx !== -1 && row[totalIdx] !== "") {
      totalSum = parseFloat(row[totalIdx]) || 0;
      hasScore = true;
    } else {
      // Fallback: Sum individual game columns if Total column is empty
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
  logDebug("processWeeklyScoresForSheet", "Processing sheet standings", { sheet: sheet.getName(), forcedWeek, shouldShift });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  checkAndRunWeeklyBackup();

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + sheet.getName();

  const col = buildColMap(data[0]);

  let cleanGroupName = sheet.getName().replace("Score ", "").trim();

  let targetWeekKey = (forcedWeek || ("w" + calculateCurrentWeekNumber())).toLowerCase();
  let targetWeekIdx = col[targetWeekKey];

  if (targetWeekIdx === undefined) {
    for (let i = 10; i >= 1; i--) {
      if (col["w" + i] !== undefined) {
        targetWeekKey = "w" + i;
        targetWeekIdx = col["w" + i];
        break;
      }
    }
  }

  harvestScoresFromSchedules(ss, data, col, targetWeekIdx, cleanGroupName);

  let activePlayers = [];
  let inactivePlayers = [];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = (col.name !== undefined && row[col.name]) 
      ? row[col.name].toString().trim() 
      : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();

    if (!pName) continue;

    let status = (col.status !== undefined && row[col.status] !== "") 
      ? row[col.status].toString().toUpperCase().trim() 
      : "ACTIVE";

    let stats = calculateStats(row, col);

    let playerObj = {
      rowIndex: i,
      rowRaw: row,
      name: pName,
      status: status,
      total: stats.total,
      winPct: stats.winPct,
      rNum: col.rNum !== undefined ? (parseFloat(row[col.rNum]) || i) : i,
      currentWeekScore: targetWeekIdx !== undefined ? (parseFloat(row[targetWeekIdx]) || 0) : 0
    };

    if (status === "ACTIVE") {
      activePlayers.push(playerObj);
    } else {
      inactivePlayers.push(playerObj);
    }
  }

  if (shouldShift) {
    activePlayers.sort((a, b) => {
      let courtA = Math.floor((a.rNum - 1) / 4);
      let courtB = Math.floor((b.rNum - 1) / 4);

      if (courtA !== courtB) {
        return courtA - courtB;
      }

      if (b.currentWeekScore !== a.currentWeekScore) {
        return b.currentWeekScore - a.currentWeekScore;
      }

      return a.rNum - b.rNum;
    });

    let reorderedActive = [];
    for (let c = 0; c < activePlayers.length; c += 4) {
      let courtGroup = activePlayers.slice(c, c + 4);
      courtGroup.sort((a, b) => {
        if (b.currentWeekScore !== a.currentWeekScore) {
          return b.currentWeekScore - a.currentWeekScore;
        }
        return a.rNum - b.rNum;
      });
      reorderedActive.push(...courtGroup);
    }
    activePlayers = reorderedActive;
  }

  activePlayers.forEach((p, index) => {
    p.newRank = index + 1;
  });

  let allPlayers = activePlayers.concat(inactivePlayers);

  for (let p of allPlayers) {
    if (col.total !== undefined) data[p.rowIndex][col.total] = p.total;
    if (col.winPct !== undefined) data[p.rowIndex][col.winPct] = p.winPct;
    if (p.status === "ACTIVE" && col.rNum !== undefined) {
      data[p.rowIndex][col.rNum] = p.newRank;
    }
  }

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

  sortActivePlayersForSheet(sheet);

  return `✅ Standings processed for '${sheet.getName()}'! (Week column updated: ${targetWeekKey.toUpperCase()})`;
}

function calculateStats(row, col) {
  let sum = 0;
  let playedWeeks = 0;

  for (let i = 1; i <= 10; i++) {
    let wIdx = col["w" + i];
    if (wIdx !== undefined && row[wIdx] !== "" && row[wIdx] !== null && !isNaN(row[wIdx])) {
      let val = parseFloat(row[wIdx]);
      sum += val;
      playedWeeks++;
    }
  }

  let possibleTotal = playedWeeks * MAX_POINTS_PER_WEEK;
  let pct = possibleTotal > 0 ? (sum / possibleTotal) : 0;

  return { total: sum, winPct: pct };
}

function sortActivePlayers() {
  logDebug("sortActivePlayers", "Sorting active players wrapper");
  const sheet = getValidActiveScoreSheet();
  return sortActivePlayersForSheet(sheet);
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

    let rNum = col.rNum !== undefined ? (parseFloat(row[col.rNum]) || i) : i;
    row._rNum = rNum;

    if (status === "ACTIVE") {
      activeRows.push(row);
    } else {
      inactiveRows.push(row);
    }
  }

  activeRows.sort((a, b) => a._rNum - b._rNum);

  activeRows.forEach(r => delete r._rNum);
  inactiveRows.forEach(r => delete r._rNum);

  let sortedData = [headerRow, ...activeRows, ...inactiveRows];

  sheet.clearContents();
  sheet.getRange(1, 1, sortedData.length, sortedData[0].length).setValues(sortedData);

  return `✅ Active players sorted successfully on tab '${sheet.getName()}'! (${activeRows.length} Active, ${inactiveRows.length} Inactive)`;
}

/* ==========================================
 * SCHEDULE GENERATION WITH GROUP COURT MAPPING
 * ========================================== */

function generateScheduleTabs(scoreTabName = null, overrideCourts = null) {
  logDebug("generateScheduleTabs", "Generating schedule for score tab", scoreTabName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let targetSheet = getValidActiveScoreSheet(scoreTabName);
  let resolvedTabName = targetSheet.getName();

  sortActivePlayersForSheet(targetSheet);

  const data = targetSheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + resolvedTabName;

  const col = buildColMap(data[0]);
  let seenPlayers = new Set();
  let activePlayers = [];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let status = (col.status !== undefined && row[col.status] !== "") 
      ? row[col.status].toString().toUpperCase().trim() 
      : "ACTIVE";

    if (status === "ACTIVE") {
      let pName = (col.name !== undefined && row[col.name]) 
        ? row[col.name].toString().trim() 
        : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();
      
      if (!pName) continue;
      let cleanKey = pName.toLowerCase();
      if (seenPlayers.has(cleanKey)) continue;
      seenPlayers.add(cleanKey);
      
      activePlayers.push({
        name: pName,
        phone: col.phone !== undefined ? row[col.phone] : ""
      });
    }
  }

  if (activePlayers.length === 0) return "⚠️ No active players found on " + resolvedTabName;

  let cleanGroupName = resolvedTabName.replace("Score ", "").trim();
  let schedSheetName = "Sched " + cleanGroupName;
  
  let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);
  schedSheet.clear();

  // Retrieve assigned court numbers list for this group, with optional overrides from Admin UI
  const defaultCourts = getCourtsForGroup(cleanGroupName);
  const availableCourts = (overrideCourts && Array.isArray(overrideCourts) && overrideCourts.length > 0) 
    ? overrideCourts 
    : defaultCourts;

  let schedOut = [["Name", "Court", "Game 1", "Game 2", "Game 3", "Total", "Check-In", "Entered By"]];
  let courtIdx = 0;

  for (let i = 0; i < activePlayers.length; i += 4) {
    let courtNumber = availableCourts[courtIdx] !== undefined 
      ? availableCourts[courtIdx] 
      : (courtIdx + 1);
    let courtName = "Court " + courtNumber;

    for (let j = 0; j < 4; j++) {
      if (i + j < activePlayers.length) {
        let rowNum = schedOut.length + 1;
        let sumFormula = `=IF(COUNT(C${rowNum}:E${rowNum})>0, SUM(C${rowNum}:E${rowNum}), "")`;
        schedOut.push([activePlayers[i+j].name, courtName, "", "", "", sumFormula, "", ""]);
      }
    }
    courtIdx++;
  }

  let sRange = schedSheet.getRange(1, 1, schedOut.length, 8);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  schedSheet.getRange(1, 1, 1, 8).setFontWeight("bold");

  logDebug("generateScheduleTabs", "Schedule tab successfully updated", schedSheetName);
  return `✅ Schedule generated successfully for ${cleanGroupName} (${activePlayers.length} players, ${courtIdx} courts).`;
}

function rescheduleFromCheckIns(schedTabName, overrideCourts = null) {
  logDebug("rescheduleFromCheckIns", "Rescheduling based on check-ins for tab", schedTabName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let targetName = (schedTabName || "").toString().trim();
  if (!targetName.startsWith("Sched ") && !targetName.startsWith("Score ")) {
    targetName = "Sched " + targetName;
  } else if (targetName.startsWith("Score ")) {
    targetName = targetName.replace("Score ", "Sched ");
  }

  let schedSheet = ss.getSheetByName(targetName);
  if (!schedSheet) return "⚠️ Error: Schedule sheet '" + targetName + "' not found.";

  // Fetch all players
  const allPlayers = getPlayersForCheckIn(targetName);
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
    return "⚠️ No players found for " + targetName;
  }

  // Separate checked-in vs unchecked players
  const checkedInPlayers = allPlayers.filter(p => p.checkedIn || p.checked);
  const uncheckedPlayers = allPlayers.filter(p => !(p.checkedIn || p.checked));

  if (checkedInPlayers.length === 0) return "⚠️ No checked-in players found on " + targetName;

  let cleanGroupName = targetName.replace("Sched ", "").trim();

  const defaultCourts = getCourtsForGroup(cleanGroupName);
  const availableCourts = (overrideCourts && Array.isArray(overrideCourts) && overrideCourts.length > 0) 
    ? overrideCourts 
    : defaultCourts;

  schedSheet.clear();
  let schedOut = [["Name", "Court", "Game 1", "Game 2", "Game 3", "Total", "Check-In", "Entered By"]];

  // Calculate how many complete 4-player courts can be formed
  const fullCourtsCount = Math.floor(checkedInPlayers.length / 4);
  const assignedCheckedCount = fullCourtsCount * 4;
  let courtIdx = 0;

  // 1. Assign full 4-player courts for checked-in players
  for (let i = 0; i < assignedCheckedCount; i += 4) {
    let courtNumber = availableCourts[courtIdx] !== undefined 
      ? availableCourts[courtIdx] 
      : (courtIdx + 1);
    let courtName = "Court " + courtNumber;

    for (let j = 0; j < 4; j++) {
      let player = checkedInPlayers[i + j];
      let rowNum = schedOut.length + 1;
      let sumFormula = `=IF(COUNT(C${rowNum}:E${rowNum})>0, SUM(C${rowNum}:E${rowNum}), "")`;
      schedOut.push([player.name, courtName, "", "", "", sumFormula, "X", ""]);
    }
    courtIdx++;
  }

  // 2. Checked-in leftovers (1-3 players) assigned to BYE with "X"
  for (let i = assignedCheckedCount; i < checkedInPlayers.length; i++) {
    let player = checkedInPlayers[i];
    let rowNum = schedOut.length + 1;
    let sumFormula = `=IF(COUNT(C${rowNum}:E${rowNum})>0, SUM(C${rowNum}:E${rowNum}), "")`;
    schedOut.push([player.name, "BYE", "", "", "", sumFormula, "X", ""]);
  }

  // 3. Unchecked players assigned to BYE with empty check-in ""
  for (let i = 0; i < uncheckedPlayers.length; i++) {
    let player = uncheckedPlayers[i];
    let rowNum = schedOut.length + 1;
    let sumFormula = `=IF(COUNT(C${rowNum}:E${rowNum})>0, SUM(C${rowNum}:E${rowNum}), "")`;
    schedOut.push([player.name, "BYE", "", "", "", sumFormula, "", ""]);
  }

  let sRange = schedSheet.getRange(1, 1, schedOut.length, 8);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  schedSheet.getRange(1, 1, 1, 8).setFontWeight("bold");

  logDebug("rescheduleFromCheckIns", "Check-in schedule regenerated", targetName);
  return `✅ Rescheduled ${checkedInPlayers.length} checked-in players across ${courtIdx} courts. (${uncheckedPlayers.length} unchecked players placed on BYE).`;
}




/* ==========================================
 * 7. PDF GENERATION
 * ========================================== */

function buildScheduleSheet() {
  logDebug("buildScheduleSheet", "Building combined schedule sheet for export");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const instr = ss.getSheetByName("Instructions");
  const league = instr ? instr.getRange("B2").getValue().toString().trim() : "Ladders";
  const dateStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "MMM d");
  let sched = ss.getSheetByName("Schedule") || ss.insertSheet("Schedule");
  sched.clear();

  let out = [["Schedule for " + dateStr, "", "", "", "", "", "", ""], [league, "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""]];
  const tabs = ss.getSheets().filter(sh => sh.getName().startsWith("Sched ") && sh.getName().trim() !== "Sched");

  tabs.forEach(sh => {
    let ladderName = sh.getName().replace("Sched ", "").trim();
    let data = sh.getDataRange().getValues();
    if (data.length <= 1) return;
    let sCol = buildColMap(data[0]);

    out.push([ladderName + " Ladder", "", "", "", "", "", "", ""]);
    out.push(["Court", "Player", "Phone", "", "", "", "", ""]);

    let byCourt = {};
    for (let i = 1; i < data.length; i++) {
      let nm = data[i][sCol.name] || (data[i][sCol.first] + " " + data[i][sCol.last]).trim();
      let ct = data[i][getColIdx(sCol, ["Court"])];
      let ph = data[i][sCol.phone] || "";
      if (nm && !nm.startsWith("---") && !nm.startsWith("Time:")) (byCourt[ct] = byCourt[ct] || []).push({name: nm, phone: ph});
    }

    Object.keys(byCourt).sort((a,b)=> (parseFloat(a)||0)-(parseFloat(b)||0)).forEach(ct => {
      byCourt[ct].forEach((p, idx) => out.push([idx === 0 ? ct : "", p.name, p.phone, "", "", "", "", ""]));
    });
    out.push(["", "", "", "", "", "", "", ""]);
  });

  sched.getRange(1, 1, out.length, 8).setValues(out);
  sched.getRange(1, 1, 2, 1).setFontWeight("bold").setFontSize(14);
  return { sheet: sched, fileName: league + " Schedule " + dateStr + ".pdf" };
}

function showPdfDownloadDialog() {
  logDebug("showPdfDownloadDialog", "Opening PDF download modal dialog");
  const res = buildScheduleSheet();
  const pdfBlob = exportSheetAsPDF(res.sheet, res.fileName);
  const base64 = Utilities.base64Encode(pdfBlob.getBytes());
  const html = HtmlService.createHtmlOutput(`
    <style>body{font-family:sans-serif; text-align:center; padding:30px;} .btn{background:#2d6a4f; color:white; padding:15px 25px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:20px;}</style>
    <h3>PDF Ready!</h3>
    <a href="data:application/pdf;base64,${base64}" download="${res.fileName}" class="btn">Download ${res.fileName}</a>
  `).setWidth(350).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, '📥 Download Schedule PDF');
}

function webExportSchedulePdf() {
  logDebug("webExportSchedulePdf", "Executing web export for PDF");
  const res = buildScheduleSheet();
  const pdfBlob = exportSheetAsPDF(res.sheet, res.fileName);
  return {
    fileName: res.fileName,
    base64: Utilities.base64Encode(pdfBlob.getBytes())
  };
}

function exportSheetAsPDF(sheet, fileName) {
  logDebug("exportSheetAsPDF", "Rendering sheet to PDF blob", fileName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const url = ss.getUrl().replace(/edit$/, '') + 'export?exportFormat=pdf&format=pdf' +
    '&size=letter&portrait=true&fitw=true&gridlines=true&printtitle=false&sheetnames=false&fzr=false' +
    '&gid=' + sheet.getSheetId();

  const params = { method: "GET", headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  const blob = UrlFetchApp.fetch(url, params).getBlob().setName(fileName);
  return blob;
}

function findFoursomeByPhone(phone) {
  logDebug("findFoursomeByPhone", "Locating foursome for phone number", phone);
  if (!phone) return { error: "No phone number provided." };
  let cleanInput = phone.toString().replace(/\D/g, "");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let foundPlayer = null, foundGroup = null, isCheckedIn = false;

  for (let g of GROUPS) {
    let scoreSheet = ss.getSheetByName("Score " + g);
    if (!scoreSheet) continue;
    let data = scoreSheet.getDataRange().getValues();
    let col = buildColMap(data[0]);

    for (let i = 1; i < data.length; i++) {
      let pPhone = (col.phone !== undefined && data[i][col.phone]) ? data[i][col.phone].toString().replace(/\D/g, "") : "";
      if (pPhone && pPhone === cleanInput) {
        foundPlayer = (col.name !== undefined && data[i][col.name]) ? data[i][col.name].toString().trim() : ((data[i][col.first] || "") + " " + (data[i][col.last] || "")).trim();
        foundGroup = g;
        break;
      }
    }
    if (foundPlayer) break;
  }

  if (!foundPlayer) return { error: "Phone number not found in any player group." };

  let schedSheet = ss.getSheetByName("Sched " + foundGroup);
  if (!schedSheet) return { error: `Schedule for ${foundGroup} not found.` };

  let schedData = schedSheet.getDataRange().getValues();
  let headers = schedData[0].map(h => h.toString().toLowerCase().trim());
  let nameIdx = headers.indexOf("name");
  let checkInIdx = headers.indexOf("check-in");

  let userCourt = null;
  for (let i = 1; i < schedData.length; i++) {
    let rowName = (nameIdx !== -1 && schedData[i][nameIdx]) ? schedData[i][nameIdx].toString().trim() : "";
    if (rowName.toLowerCase() === foundPlayer.toLowerCase()) {
      userCourt = schedData[i][1] ? schedData[i][1].toString().trim() : null;
      if (checkInIdx !== -1) {
        isCheckedIn = isCheckInTrue(schedData[i][checkInIdx]);
      }
      break;
    }
  }

  let foursome = [];
  if (userCourt && userCourt !== "BYE") {
    for (let i = 0; i < schedData.length; i++) {
      if (schedData[i][1] && schedData[i][1].toString().trim() === userCourt) {
        foursome.push({ name: schedData[i][0], g1: schedData[i][2] || "", g2: schedData[i][3] || "", g3: schedData[i][4] || "" });
      }
    }
  }

  logDebug("findFoursomeByPhone", "Found user foursome details successfully");
  return { playerName: foundPlayer, groupName: foundGroup, court: userCourt, foursome: foursome, checkedIn: isCheckedIn, status: "ACTIVE" };
}

function togglePlayerStatus(phone) {
  logDebug("togglePlayerStatus", "Toggling active/inactive player status", phone);
  if (!phone) return { error: "No phone number provided." };
  let cleanInput = phone.toString().replace(/\D/g, "");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  for (let g of GROUPS) {
    let scoreSheet = ss.getSheetByName("Score " + g);
    if (!scoreSheet) continue;
    let data = scoreSheet.getDataRange().getValues();
    let col = buildColMap(data[0]);

    for (let i = 1; i < data.length; i++) {
      let pPhone = (col.phone !== undefined && data[i][col.phone]) ? data[i][col.phone].toString().replace(/\D/g, "") : "";
      if (pPhone && pPhone === cleanInput) {
        let currentStatus = (col.status !== undefined && data[i][col.status]) ? data[i][col.status].toString().toUpperCase().trim() : "ACTIVE";
        let newStatus = (currentStatus === "ACTIVE") ? "INACTIVE" : "ACTIVE";
        
        if (col.status !== undefined) {
          scoreSheet.getRange(i + 1, col.status + 1).setValue(newStatus);
          let pName = (col.name !== undefined && data[i][col.name]) ? data[i][col.name].toString().trim() : "Player";
          logDebug("togglePlayerStatus", `Status updated to ${newStatus} for ${pName}`);
          return { success: true, name: pName, group: g, newStatus: newStatus };
        }
      }
    }
  }
  return { error: "Phone number not found in any player group." };
}

function getRankingsAndSchedData(groupName) {
  logDebug("getRankingsAndSchedData", "Fetching rankings & schedule data for group", groupName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let schedList = [], rankingList = [];
  const currentWeek = calculateCurrentWeekNumber();

  const schedSheet = ss.getSheetByName("Sched " + groupName);
  if (schedSheet) {
    const sData = schedSheet.getDataRange().getDisplayValues();
    for (let i = 0; i < sData.length; i++) {
      let name = sData[i][0] ? sData[i][0].toString().trim() : "", court = sData[i][1] ? sData[i][1].toString().trim() : "";
      if (name && court && !name.startsWith("Time:") && !name.startsWith("Name") && !name.startsWith("---")) schedList.push({ name: name, court: court });
    }
  }

  const rankSheet = ss.getSheetByName("Rankings " + groupName);
  if (rankSheet) {
    const rData = rankSheet.getDataRange().getDisplayValues();
    for (let i = 1; i < rData.length; i++) {
      if (rData[i][1]) rankingList.push({ rank: rData[i][0], name: rData[i][1], pct: rData[i][2], pts: rData[i][3] });
    }
  }
  return { sched: schedList, rankings: rankingList, weekNum: currentWeek };
}

function getAdminPlayersByGroup(groupName) {
  logDebug("getAdminPlayersByGroup", "Fetching admin player list for group", groupName);
  const scoreSheet = getScoreSheetByGroup(groupName);
  if (!scoreSheet) return { error: `Score sheet for group '${groupName}' not found.` };

  const data = scoreSheet.getDataRange().getValues();
  if (!data || data.length <= 1) return { players: [] };

  const col = buildColMap(data[0]);
  
  let players = [];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let name = (col.name !== undefined && row[col.name]) ? row[col.name].toString().trim() : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();
    if (!name) continue;

    let phone = (col.phone !== undefined && row[col.phone]) ? row[col.phone].toString().trim() : "";
    let email = (col.email !== undefined && row[col.email]) ? row[col.email].toString().trim() : "";
    let status = (col.status !== undefined && row[col.status]) ? row[col.status].toString().toUpperCase().trim() : "ACTIVE";
    let rank = col.rNum !== undefined ? (row[col.rNum] || i) : i;

    players.push({ name, phone, email, status, rank });
  }

  logDebug("getAdminPlayersByGroup", `Retrieved ${players.length} players for '${groupName}'`);
  return { players: players };
}

function submitCourtScores(payload) {
  logDebug("submitCourtScores", "Submitting court scores payload", payload);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sched " + payload.groupName);
  if (!sheet) return "Error: Schedule sheet not found.";
  
  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return "Error: No schedule data found.";

  let headers = data[0].map(h => h.toString().toLowerCase().trim());
  let g1Idx = headers.indexOf("game 1");
  let g2Idx = headers.indexOf("game 2");
  let g3Idx = headers.indexOf("game 3");
  let totalIdx = headers.indexOf("total");
  let enteredIdx = headers.indexOf("entered by");

  for (let i = 1; i < data.length; i++) {
    let pName = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";

    if (court === payload.court.toString().trim() && payload.scores[pName]) {
      let pScores = payload.scores[pName];

      // Read current values from sheet to preserve already completed games
      let existingG1 = g1Idx !== -1 ? data[i][g1Idx] : "";
      let existingG2 = g2Idx !== -1 ? data[i][g2Idx] : "";
      let existingG3 = g3Idx !== -1 ? data[i][g3Idx] : "";

      // Preserve existing score if payload sends empty string or undefined for that game
      let g1Val = (pScores.g1 !== undefined && pScores.g1 !== "") ? pScores.g1 : existingG1;
      let g2Val = (pScores.g2 !== undefined && pScores.g2 !== "") ? pScores.g2 : existingG2;
      let g3Val = (pScores.g3 !== undefined && pScores.g3 !== "") ? pScores.g3 : existingG3;

      // Write individual game values
      if (g1Idx !== -1) sheet.getRange(i + 1, g1Idx + 1).setValue(g1Val);
      if (g2Idx !== -1) sheet.getRange(i + 1, g2Idx + 1).setValue(g2Val);
      if (g3Idx !== -1) sheet.getRange(i + 1, g3Idx + 1).setValue(g3Val);

      // Re-apply total formula to guarantee automatic summation remains active
      let rowNum = i + 1;
      if (totalIdx !== -1) {
        sheet.getRange(rowNum, totalIdx + 1).setFormula(`=IF(COUNT(C${rowNum}:E${rowNum})>0, SUM(C${rowNum}:E${rowNum}), "")`);
      }
      if (enteredIdx !== -1) sheet.getRange(rowNum, enteredIdx + 1).setValue(payload.submitter);
    }
  }

  logDebug("submitCourtScores", "Updated incremental court scores successfully");
  return "✅ Game scores updated successfully!";
}


// Normalizes tab names based on target prefix ("Sched " or "Score ")
function resolveSheetName(rawInput, prefix) {
  if (!rawInput) return SpreadsheetApp.getActiveSheet().getName();
  
  // Clean up existing prefixes if present
  let cleanName = rawInput.replace(/^(Sched\s+|Score\s+)/i, '');
  
  // Return formatted name or current sheet if empty
  return prefix ? prefix + cleanName : cleanName;
}

// Resolves target sheet object dynamically from API or Active Sheet Context
function getTargetSheetDynamic(payload, prefix) {
  let target = payload ? (payload.arg || payload.tab || payload.sheet || payload.group) : null;
  let sheetName = target ? resolveSheetName(target, prefix) : SpreadsheetApp.getActiveSheet().getName();
  
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Could not find sheet tab: '" + sheetName + "'");
  }
  return sheet;
}


function getInitialAppData(phone) {
  return {
    sheets: getSchedTabNames(),
    groups: getAvailableGroups(),
    userData: phone ? lookupPhoneInternal(phone) : null
  };
}


// 1. Returns tab names that represent schedule/ladder sheets
function getSchedTabNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  // Filters tabs containing "Sched" or "Ladder" (adjust filter criteria if needed)
  return sheets
    .map(sheet => sheet.getName())
    .filter(name => /sched|ladder/i.test(name));
}

// 2. Returns unique group names from a "Groups" or "Players" tab
function getAvailableGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheet = ss.getSheetByName("Groups") || ss.getSheetByName("Players");
  if (!groupSheet) return [];
  
  const data = groupSheet.getDataRange().getValues();
  const groups = new Set();

  if (!data || data.length <= 1) return "Error: No Groups found.";  
  // Assumes Group names are in Column A starting at Row 2
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      groups.add(String(data[i][0]).trim());
    }
  }
  return Array.from(groups);
}

// 3. Searches the "Players" sheet for a matching phone number
function lookupPhoneInternal(phone) {
  if (!phone) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = ss.getSheetByName("Players") || ss.getSheetByName("Master");
  if (!playerSheet) return null;
  
  const cleanPhone = String(phone).replace(/\D/g, ''); // Strip formatting
  const data = playerSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  const phoneCol = headers.findIndex(h => h.includes('phone'));
  const nameCol = headers.findIndex(h => h.includes('name'));
  const groupCol = headers.findIndex(h => h.includes('group') || h.includes('ladder'));
  
  if (phoneCol === -1) return null;
  if (!data || data.length <= 1) return "Error: phones found.";    
  for (let i = 1; i < data.length; i++) {
    const rowPhone = String(data[i][phoneCol]).replace(/\D/g, '');
    if (rowPhone && rowPhone === cleanPhone) {
      return {
        name: nameCol !== -1 ? data[i][nameCol] : '',
        group: groupCol !== -1 ? data[i][groupCol] : '',
        phone: data[i][phoneCol]
      };
    }
  }
  return null;
}

function getPlayersForCheckIn(sheetName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "checkin_" + sheetName;
  const cached = cache.get(cacheKey);

  // Return cached data if valid
  if (cached) return JSON.parse(cached);

  // Fetch from Google Sheet if cache miss
  const players = fetchPlayersFromSheet(sheetName); 
  cache.put(cacheKey, JSON.stringify(players), 600); // Cache for up to 10 mins
  return players;
}

function toggleSingleCheckIn(data) {
  // 1. Write update to Google Sheet
  updatePlayerCheckInInSheet(data.sheet, data.playerName, data.isCheckedIn);

  // 2. INVALIDATE SHARED CACHE: Forces ALL users to get fresh data on next poll
  const cache = CacheService.getScriptCache();
  cache.remove("checkin_" + data.sheet);

  return { status: "success" };
}
