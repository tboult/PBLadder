/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */
/*
  const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const getValidScoreTabs() = ["Score Womens", "Score Mens", "Score Mixed"];
*/

const VALID_SCORE_TABS = ["Score Womens", "Score Mens", "Score Mixed"];
const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const ALWAYS_BYE_LOWEST = true;

function getAppVersion() {
  return "1.1.2"; 
}

/**
 * Fetches dynamic configurations from the 'Constants' sheet starting at row 6.
 * Cleans JS syntax like 'const', quotes, and semicolons automatically.
 * @returns {Object} Key-value mapping of your global configurations.
 */
/** Dynamic Config Loader **/
const SPREADSHEET_ID = "14jmYyesfG9btWcIeptDwD6Bkxj8UZiQVlAOGc6BdM84";

function getConstantsConfig() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!ss) return { groups: [], scheduleTabs: [], scoreTabs: [] };

  const constSheet = ss.getSheetByName('Constants');
  
  // Fallback: Scan sheet tabs dynamically if Constants tab is absent
  if (!constSheet || constSheet.getLastRow() < 2) {
    const allSheets = ss.getSheets().map(s => s.getName());
    return {
      groups: allSheets.filter(s => s.startsWith("Sched ")).map(s => s.replace(/^Sched\s+/i, "")),
      scheduleTabs: allSheets.filter(s => s.startsWith("Sched ")),
      scoreTabs: allSheets.filter(s => s.startsWith("Score "))
    };
  }

  const data = constSheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const gCol = headers.indexOf("group");
  const schedCol = headers.indexOf("schedule tab");
  const scoreCol = headers.indexOf("score tab");

  let groups = [], scheduleTabs = [], scoreTabs = [];

  for (let i = 1; i < data.length; i++) {
    if (gCol !== -1 && data[i][gCol]) groups.push(data[i][gCol].toString().trim());
    if (schedCol !== -1 && data[i][schedCol]) scheduleTabs.push(data[i][schedCol].toString().trim());
    if (scoreCol !== -1 && data[i][scoreCol]) scoreTabs.push(data[i][scoreCol].toString().trim());
  }

  return { groups, scheduleTabs, scoreTabs };
}


/** Dynamic replacement for global getValidScoreTabs() **/
function getValidScoreTabs() {
  const config = getConstantsConfig();
  if (config.scoreTabs.length > 0) return config.scoreTabs;
  
  // Fallback: derive score tab names from groups if scoreTab column was empty
  return config.groups.map(g => g.startsWith("Score ") ? g : "Score " + g);
}

function getSchedTabNames() { 
  const config = getConstantsConfig();
  if (config.scheduleTabs.length > 0) return config.scheduleTabs;
  return config.groups.map(g => g.startsWith("Sched ") ? g : "Sched " + g);
}

function getAvailableGroups() {
  return getConstantsConfig().groups;
}

function getPlayersForCheckIn(schedSheetName) {
  if (!schedSheetName) return [];
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) return [];
  
  // Dynamic resolution for sheet name
  let sheet = ss.getSheetByName(schedSheetName);
  if (!sheet && !schedSheetName.startsWith("Sched ")) {
    sheet = ss.getSheetByName("Sched " + schedSheetName);
  }
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  let result = [];
  
  for (let i = 0; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    let status = data[i][5] ? data[i][5].toString().trim().toUpperCase() : ""; // Col F check indicator
    
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:") && !name.toLowerCase().startsWith("name")) {
      result.push({ 
        name: name, 
        court: court, 
        checked: status === "X" || status === "TRUE" || status === "CHECKED" 
      });
    }
  }
  return result;
}
function authorizeScript() {
  // 1. Fallback to openById if getActiveSpreadsheet() is null in web context
  // Replace 'YOUR_SPREADSHEET_ID' with your actual Google Sheet ID
  const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; 
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 2. Force explicit Spreadsheet Read/Write execution
  const sheet = ss.getSheets()[0];
  const testVal = sheet.getRange(1, 1).getValue(); // Forces Read Scope
  sheet.getRange(1, 1).setValue(testVal);          // Forces Write Scope
  
  // 3. Force Drive Scope
  const file = DriveApp.getFileById(ss.getId());
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const tempCopy = file.makeCopy("DELETE_ME_AUTH_TEST", targetFolder);
  tempCopy.setTrashed(true);

  // 4. Force External Request Scope
  UrlFetchApp.fetch("https://www.google.com");

  Logger.log("✅ FULL Drive, Spreadsheet, and UrlFetch Authorization Granted Successfully!");
}

/**
 * REST JSON API CONTROLLER FOR DECOUPLED PWA FRONTEND
 */
function doGet(e) {
  return handleApiRequest(e);
}

function doPost(e) {
  return handleApiRequest(e);
}

function handleApiRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
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

    let result;
    switch(action) {
      case 'getSchedTabNames':
        result = getSchedTabNames();
        break;
      case 'getAvailableGroups':
        result = getAvailableGroups();
        break;
      case 'getPlayersForCheckIn':
        // Accepts .sheet, .schedSheetName, or .tab so frontend variants never break it
        result = getPlayersForCheckIn(payload.sheet || payload.schedSheetName || payload.tab);
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
        result = getRankingsAndSchedData(payload.group);
        break;
      case 'getAdminPlayersByGroup':
        result = getAdminPlayersByGroup(payload.group);
        break;
      case 'addNewUser':
        result = addNewUser(payload);
        break;
       case 'rescheduleFromCheckIns':
        result = rescheduleFromCheckIns(payload.arg || payload.tab || payload.sheet || ("Sched " + payload.group));
        break;
      case 'generateScheduleTabs':
        result = generateScheduleTabs(payload.arg || payload.tab || payload.sheet || ("Score " + payload.group));
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
        result = typeof getAppVersion === 'function' ? getAppVersion() : "1.0.0";
        break;
      case 'webExportSchedulePdf':
        result = webExportSchedulePdf();
        break;
      default:
        throw new Error("Invalid or missing API action: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch(e) {}
  }
}

/**
 * Validates whether the active sheet is one of the designated group score tabs.
 */
/**
 * Resolves the target score sheet safely across Web App API and Sheet Menu triggers.
 */
function getValidActiveScoreSheet(overrideTabName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = null;

  // 1. Explicit tab or group parameter passed from Web App API
  if (overrideTabName) {
    let target = overrideTabName.toString().trim();
    if (!target.startsWith("Score ")) {
      target = "Score " + target;
    }
    sheet = ss.getSheetByName(target);
    if (sheet) return sheet;
  }

  // 2. Spreadsheet UI context (runs when user clicks a menu item inside Google Sheets)
  try {
    let activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (activeSheet && getValidScoreTabs().includes(activeSheet.getName())) {
      return activeSheet;
    }
  } catch(e) {}

  // 3. Fail-safe: Fallback to the first available valid score tab
  const validTabs = getValidScoreTabs();
  for (let name of validTabs) {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }

  throw new Error("⚠️ Action Cancelled: Could not resolve a valid Score tab. Please specify 'Score Womens', 'Score Mens', or 'Score Mixed'.");
}

function getScoreSheetByGroup(groupName) {
  if (!groupName) return null;
  let cleanName = groupName.toString().trim();
  if (!cleanName.startsWith("Score ")) {
    cleanName = "Score " + cleanName;
  }
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cleanName);
}

/** 
 * ==========================================
 * 1. CUSTOM MENU & ENTRY POINTS
 * ==========================================
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

  checkAndRunWeeklyBackup();
}

function menuGenerateScheduleCurrentTab() {
  try {
    // This strictly enforces being on a Score tab
    const sheet = getValidActiveScoreSheet(); 
    let res = generateScheduleTabs(sheet.getName());
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuGenerateScheduleCheckedIn() {
  try {
    // This strictly enforces being on a Score tab
    const sheet = getValidActiveScoreSheet(); 
    const schedTabName = sheet.getName().replace("Score ", "Sched ");
    let res = rescheduleFromCheckIns(schedTabName);
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
    const sheet = getValidActiveScoreSheet();
    let res = sortActivePlayersForSheet(sheet);
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
    const sheet = getValidActiveScoreSheet();
    let res = processWeeklyScoresForSheet(sheet, "W10", true);
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(res);
    return res;
  } catch(e) {
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(e.message);
    throw e;
  }
}

function menuCorrectScoresNoShift() {
  try {
    const sheet = getValidActiveScoreSheet();
    let res = processWeeklyScoresForSheet(sheet, "W10", false);
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
  } catch(e) { SpreadsheetApp.getUi().alert("Error", e.message, SpreadsheetApp.getUi().ButtonSet.OK); }
}

/** 
 * ==========================================
 * URL, WEEK CALC & SEASON CONTROLS
 * ==========================================
 */
function getAdminSheetUrl() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const activeSheet = ss.getActiveSheet();
  let targetSheet = getValidScoreTabs().includes(activeSheet.getName()) ? activeSheet : ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) {
    url += "#gid=" + targetSheet.getSheetId();
  }
  return url;
}

function startNewSeason() {
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

/** 
 * ==========================================
 * USER REGISTRATION & RESCHEDULE
 * ==========================================
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

function getTargetScoreSheet(groupOrTabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = null;

  // 1. Check if the active tab in the Google Sheet is already a valid Score tab
  var activeSheet = ss.getActiveSheet();
  var activeName = activeSheet ? activeSheet.getName() : "";
  
  if (activeName.startsWith("Score ")) {
    return activeSheet;
  }

  // 2. If a group or tab name was passed in from the frontend, construct the sheet name
  if (groupOrTabName) {
    var targetName = groupOrTabName.startsWith("Score ") 
      ? groupOrTabName 
      : "Score " + groupOrTabName;
    sheet = ss.getSheetByName(targetName);
    if (sheet) return sheet;
  }

  // 3. Fail-safe: Search explicitly for the first available valid Score tab instead of defaulting to Sheet(0)/INSTRUCTIONS
  var validTabs = ["Score Womens", "Score Mens", "Score Mixed"];
  for (var i = 0; i < validTabs.length; i++) {
    sheet = ss.getSheetByName(validTabs[i]);
    if (sheet) return sheet;
  }

  throw new Error('Action Cancelled: No valid Score tab found. Please select or pass "Score Womens", "Score Mens", or "Score Mixed".');
}




function generateScheduleForTab(scoreTabName) {
  var sheet = getTargetScoreSheet(scoreTabName);
  var players = getActivePlayersFromSheet(sheet); // Retrieves unique active players
  
  // 1. Deduplicate active players list by Unique ID / Name
  var uniquePlayers = [];
  var seenIds = {};
  
  players.forEach(function(player) {
    var id = player.id || player.name;
    if (id && !seenIds[id]) {
      seenIds[id] = true;
      uniquePlayers.push(player);
    }
  });

  var assignedInCurrentRound = {};
  var schedule = [];
  var currentCourt = 1;
  var courtBuffer = [];

  // 2. Build courts ensuring no player is reused in the same round
  for (var i = 0; i < uniquePlayers.length; i++) {
    var p = uniquePlayers[i];
    var pId = p.id || p.name;

    if (assignedInCurrentRound[pId]) {
      continue; // Skip if already assigned in this schedule pass
    }

    courtBuffer.push(p);
    assignedInCurrentRound[pId] = true;

    // Once 4 unique players are collected, assign to court
    if (courtBuffer.length === 4) {
      schedule.push({
        court: currentCourt,
        players: courtBuffer
      });
      currentCourt++;
      courtBuffer = []; // Reset for next court
    }
  }

  // Handle remaining players (byes)
  return writeScheduleToSheet(sheet, schedule, courtBuffer);
}




/** 
 * ==========================================
 * 3. BACKUP & RESTORE SYSTEM
 * ==========================================
 */
function getSCPBLadderFolder() {
  const folderName = "SCPBLadder";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function executeDriveBackup(label) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  ui.alert("Restored ⏪", "Tabs restored successfully.", ui.ButtonSet.OK);
}

function createPreWorkSnapshotTab() {
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
  ui.alert("Backup Tab Created! 📸", `'${backupTabName}' is ready.`, ui.ButtonSet.OK);
}

function restoreFromSnapshotTab() {
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

/** 
 * ==========================================
 * 4. SHARED HELPERS & MAPPING
 * ==========================================
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

/** 
 * ==========================================
 * 5. MAIN SCORE PROCESSING & RANKING
 * ==========================================
 */
function processWeeklyScores(forcedWeek, shouldShift = true) {
  const sheet = getValidActiveScoreSheet();
  return processWeeklyScoresForSheet(sheet, forcedWeek, shouldShift);
}

function processWeeklyScoresForSheet(scoreSheet, forcedWeek, shouldShift = true) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let scoreData = scoreSheet.getDataRange().getValues();
  const header = scoreData[0];
  
  let col = buildColMap(header);
  col.rankStr = getColIdx(col, ["Rank"]);
  col.lastR = getColIdx(col, ["LASTR", "LastR", "Last Rank"]);
  let w10Idx = getColIdx(col, ["W10"]);

  if (shouldShift) {
    for (let i = 1; i < scoreData.length; i++) {
      for (let w = 1; w < 10; w++) {
        let curIdx = getColIdx(col, ["W" + (w + 1)]);
        let preIdx = getColIdx(col, ["W" + w]);
        if (curIdx !== undefined && preIdx !== undefined) scoreData[i][preIdx] = scoreData[i][curIdx];
      }
      if (w10Idx !== undefined) scoreData[i][w10Idx] = "";
    }
  }

  harvestScoresFromSchedules(ss, scoreData, col, w10Idx);

  const WEEKS = [];
  for (let w = 1; w <= 10; w++) {
    let idx = getColIdx(col, ["W" + w]);
    if (idx !== undefined) WEEKS.push({ num: w, idx: idx });
  }

  let players = [];
  for (let i = 1; i < scoreData.length; i++) {
    let row = scoreData[i];
    let status = (col.status !== undefined ? row[col.status] : "ACTIVE").toString().toUpperCase();
    
    let stats = calculateStats(row, WEEKS, MAX_POINTS_PER_WEEK);
    if (col.total !== undefined) row[col.total] = stats.tot;
    let pos = stats.games * MAX_POINTS_PER_WEEK;

    let pRank = 0;
    if (col.lastR !== undefined && !isNaN(parseFloat(row[col.lastR]))) pRank = parseFloat(row[col.lastR]);
    else if (col.rankStr !== undefined) pRank = parseInt(row[col.rankStr].toString().match(/\d+/)) || 0;

    players.push({
      rowIndex: i, rowData: row, status: status, prevRank: pRank, pct: stats.pct, latest: parseFloat(row[w10Idx]) || 0,
      groupKey: (col.group !== undefined ? row[col.group] : "Default").toString().trim().toUpperCase(),
      isNew: pos <= 45 
    });
  }

  let groups = {};
  players.forEach(p => {
    if (p.status === "ACTIVE") { (groups[p.groupKey] = groups[p.groupKey] || []).push(p); }
  });

  Object.keys(groups).forEach(gk => {
    let gp = groups[gk];
    let total = gp.length;
    gp.sort((a, b) => b.pct - a.pct || b.latest - a.latest);
    
    gp.forEach((p, i) => {
        p.rawRank = i + 1;
        p.effPrev = p.isNew ? total : p.prevRank;
        p.newLeft = Math.max(1, Math.min(total, Math.max(p.effPrev - MAX_MOVEMENT, Math.min(p.effPrev + MAX_MOVEMENT, p.rawRank))));
        p.isRestricted = Math.abs(p.rawRank - p.effPrev) > MAX_MOVEMENT || p.isNew;
    });

    gp.sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? 1 : -1; 
      if (!a.isNew) return a.newLeft - b.newLeft || b.pct - a.pct; 
      return a.rawRank - b.rawRank;
    });

    gp.forEach((p, i) => {
      let rSuffix = p.isRestricted ? "R" : "";
      if (col.rNum !== undefined) p.rowData[col.rNum] = i + 1;
      if (col.rankStr !== undefined) p.rowData[col.rankStr] = p.isNew ? (Math.max(1, total - MAX_MOVEMENT) + "R" + total) : (p.newLeft + rSuffix + "/" + total);
      if (col.rawRankCol !== undefined) p.rowData[col.rawRankCol] = p.rawRank + "/" + total;
      if (col.winPct !== undefined) p.rowData[col.winPct] = p.pct > 0 ? p.pct.toFixed(2) + rSuffix : "";
    });
  });

  scoreSheet.getRange(1, 1, scoreData.length, header.length).setValues(scoreData);
  return `✅ Scores harvested & standings updated for tab '${scoreSheet.getName()}'.`;
}

function harvestScoresFromSchedules(ss, scoreData, col, w10Idx) {
  const schedSheets = ss.getSheets().filter(s => s.getName().toLowerCase().startsWith("sched"));
  let playerMap = {};
  for (let i = 1; i < scoreData.length; i++) {
    let fName = (scoreData[i][col.first] || "").toString().trim().toLowerCase();
    let lName = (scoreData[i][col.last] || "").toString().trim().toLowerCase();
    let phone = (scoreData[i][col.phone] || "").toString().replace(/\D/g, "");
    if (phone) playerMap[phone] = i;
    if (fName && lName) playerMap[fName + "|" + lName] = i;
  }

  schedSheets.forEach(sheet => {
    let data = sheet.getDataRange().getValues();
    let sCol = buildColMap(data[0]);
    let ptsCol = getColIdx(sCol, ["Pts", "Points", "Score", "Total"]);
    
    if (ptsCol !== undefined) {
      for (let r = 1; r < data.length; r++) {
        let score = parseFloat(data[r][ptsCol]);
        if (isNaN(score)) continue;

        let sPhone = (data[r][sCol.phone] || "").toString().replace(/\D/g, "");
        let sFName = (data[r][sCol.first] || "").toString().trim().toLowerCase();
        let sLName = (data[r][sCol.last] || "").toString().trim().toLowerCase();

        let matchIdx = playerMap[sPhone] || playerMap[sFName + "|" + sLName];
        if (matchIdx !== undefined && w10Idx !== undefined) scoreData[matchIdx][w10Idx] = score;
      }
    }
  });
}

function calculateStats(row, weeks, maxPoints) {
  let totalPoints = 0, gamesPlayed = 0;
  weeks.forEach(w => {
    let val = parseFloat(row[w.idx]);
    if (!isNaN(val)) { totalPoints += val; gamesPlayed++; }
  });
  let possible = gamesPlayed * maxPoints;
  return { pct: possible > 0 ? (totalPoints / possible) * 100 : 0, tot: totalPoints, games: gamesPlayed };
}

/** 
 * ==========================================
 * 6. SORTING & SCHEDULE GENERATION
 * ==========================================
 */
function sortActivePlayers() {
  const sheet = getValidActiveScoreSheet();
  return sortActivePlayersForSheet(sheet);
}

function sortActivePlayersForSheet(sheet) {
  const col = buildColMap(sheet.getDataRange().getValues()[0]);
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).sort([
    {column: col.status + 1, ascending: true}, 
    {column: col.rNum + 1, ascending: true},   
    {column: col.winPct + 1, ascending: false},
    {column: col.total + 1, ascending: false}  
  ]);
  return `✅ Active players sorted by Rank in '${sheet.getName()}'.`;
}

function generateScheduleTabs(scoreTabName = null) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Resolve target tab dynamically
  let targetSheet = getValidActiveScoreSheet(scoreTabName);
  let resolvedTabName = targetSheet.getName();

  // Sort active roster on the target sheet
  sortActivePlayersForSheet(targetSheet);

  const data = targetSheet.getDataRange().getValues();
  if (data.length <= 1) return "⚠️ No player data found on tab: " + resolvedTabName;

  const col = buildColMap(data[0]);

  let seenPlayers = new Set();
  let activePlayers = [];

  // Parse active players with deduplication
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

      // Prevent duplicate player entries
      let cleanKey = pName.toLowerCase();
      if (seenPlayers.has(cleanKey)) continue;
      seenPlayers.add(cleanKey);
      
      activePlayers.push({
        name: pName,
        phone: col.phone !== undefined ? row[col.phone] : ""
      });
    }
  }

  if (activePlayers.length === 0) {
    return "⚠️ No active players found on " + resolvedTabName;
  }

  // Determine Sched tab destination
  let cleanGroupName = resolvedTabName.replace("Score ", "").trim();
  let schedSheetName = "Sched " + cleanGroupName;
  
  let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);
  schedSheet.clear();

  let schedOut = [["Name", "Court", "Game 1", "Game 2", "Game 3", "Check-In", "Entered By"]];
  let courtNum = 1;

  // Build 4-player court assignments
  for (let i = 0; i < activePlayers.length; i += 4) {
    let courtName = "Court " + courtNum;
    for (let j = 0; j < 4; j++) {
      if (i + j < activePlayers.length) {
        schedOut.push([activePlayers[i+j].name, courtName, "", "", "", "", ""]);
      }
    }
    courtNum++;
  }

  // Write and format output table
  let sRange = schedSheet.getRange(1, 1, schedOut.length, 7);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  schedSheet.getRange(1, 1, 1, 7).setFontWeight("bold");

  return `✅ Schedule generated successfully for ${cleanGroupName} (${activePlayers.length} players, ${courtNum - 1} courts).`;
}






/** 
 * ==========================================
 * 7. PDF GENERATION
 * ==========================================
 */
function buildScheduleSheet() {
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
  const built = buildScheduleSheet();
  const b64 = Utilities.base64Encode(exportSheetAsPDF(SpreadsheetApp.getActiveSpreadsheet(), built.sheet, built.fileName).getBytes());
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:sans-serif;text-align:center;padding:20px;"><h3>PDF Ready</h3><a download="${built.fileName}" href="data:application/pdf;base64,${b64}" style="padding:12px 24px;background:#2d6a4f;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">⬇ Download PDF</a></div>`
  ).setWidth(400).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, "Download Schedule");
}

function webExportSchedulePdf() {
  const built = buildScheduleSheet();
  return Utilities.base64Encode(exportSheetAsPDF(SpreadsheetApp.getActiveSpreadsheet(), built.sheet, built.fileName).getBytes());
}

function exportSheetAsPDF(ss, sheet, fileName) {
  const url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=pdf&gid=" + sheet.getSheetId() +
    "&portrait=true&size=letter&fitw=true&gridlines=false&printtitle=false&pagenumbers=false";
  return UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() } }).getBlob().setName(fileName);
}

/** 
 * ==========================================
 * 8. WEB APP BACKEND HANDLERS
 * ==========================================
 */
function getSchedTabNames() { return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName()).filter(name => name.startsWith("Sched ")); }

function getAvailableGroups() {
  return ["Womens", "Mens", "Mixed"];
}

function getPlayersForCheckIn(schedSheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(schedSheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  let result = [];
  
  for (let i = 0; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:") && !name.startsWith("Name")) {
      result.push({ name: name, court: court, checked: (data[i][5] || "").toString().trim().toUpperCase() === "X" });
    }
  }
  return result;
}

function saveCheckIns(schedSheetName, checkedPlayerNames) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(schedSheetName);
  const data = sheet.getDataRange().getValues();
  const namesArray = Array.isArray(checkedPlayerNames) ? checkedPlayerNames : JSON.parse(checkedPlayerNames || "[]");
  const checkedSet = new Set(namesArray);

  for (let i = 0; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:")) {
      sheet.getRange(i + 1, 6).setValue(checkedSet.has(name) ? "X" : "");
    }
  }
  return "✅ Check-ins saved successfully!";
}

function findFoursomeByPhone(rawPhone) {
  if (!rawPhone) throw new Error("Please enter a phone number.");
  let targetDigits = rawPhone.toString().replace(/\D/g, '').slice(-10);
  if (targetDigits.length < 7) throw new Error("Please enter a valid phone number.");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let matchedName = "", matchedGroup = "", playerStatus = "ACTIVE";

  for (let tabName of getValidScoreTabs()) {
    let scoreSheet = ss.getSheetByName(tabName);
    if (!scoreSheet) continue;
    
    let scoreData = scoreSheet.getDataRange().getValues();
    let col = buildColMap(scoreData[0]);

    for (let i = 1; i < scoreData.length; i++) {
      let pPhone = scoreData[i][col.phone] ? scoreData[i][col.phone].toString().replace(/\D/g, '').slice(-10) : "";
      if (pPhone && pPhone === targetDigits) {
        matchedName = (col.name !== undefined && scoreData[i][col.name]) ? scoreData[i][col.name] : ((scoreData[i][col.first] || "") + " " + (scoreData[i][col.last] || "")).trim();
        let g = (col.group !== undefined && scoreData[i][col.group]) ? scoreData[i][col.group].toString().trim() : tabName.replace("Score ", "");
        if (g && g.toLowerCase() !== "default") matchedGroup = g;
        playerStatus = (scoreData[i][col.status] || "ACTIVE").toString().toUpperCase().trim();
        break;
      }
    }
    if (matchedName) break;
  }

  if (!matchedName) throw new Error("No player found matching that phone number.");

  let safeGroup = matchedGroup ? matchedGroup.replace(/[\\\/*?\[\]:]/g, "").substring(0, 25) : "";
  let userCourt = "", foursome = [];

  if (safeGroup) {
    const schedSheet = ss.getSheetByName("Sched " + safeGroup);
    if (schedSheet) {
      const schedData = schedSheet.getDataRange().getDisplayValues();
      for (let i = 0; i < schedData.length; i++) {
        if (schedData[i][0] && schedData[i][0].toString().trim().toLowerCase() === matchedName.toLowerCase()) {
          userCourt = schedData[i][1] ? schedData[i][1].toString().trim() : "";
          break;
        }
      }
      if (userCourt && userCourt !== "BYE") {
        for (let i = 0; i < schedData.length; i++) {
          if (schedData[i][1] && schedData[i][1].toString().trim() === userCourt) {
            foursome.push({ name: schedData[i][0], g1: schedData[i][2] || "", g2: schedData[i][3] || "", g3: schedData[i][4] || "" });
          }
        }
      }
    }
  }

  return { found: true, playerName: matchedName, groupName: safeGroup, status: playerStatus, court: userCourt, foursome: foursome };
}

function togglePlayerStatus(rawPhone) {
  let targetDigits = rawPhone.toString().replace(/\D/g, '').slice(-10);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  for (let tabName of getValidScoreTabs()) {
    let scoreSheet = ss.getSheetByName(tabName);
    if (!scoreSheet) continue;

    let scoreData = scoreSheet.getDataRange().getValues();
    let col = buildColMap(scoreData[0]);

    for (let i = 1; i < scoreData.length; i++) {
      let pPhone = scoreData[i][col.phone] ? scoreData[i][col.phone].toString().replace(/\D/g, '').slice(-10) : "";
      if (pPhone === targetDigits) {
        let updatedStatus = ((scoreData[i][col.status] || "").toString().toUpperCase().trim() === "INACTIVE") ? "ACTIVE" : "INACTIVE";
        let cell = scoreSheet.getRange(i + 1, col.status + 1);
        cell.setValue(updatedStatus);
        cell.setBackground(updatedStatus === "ACTIVE" ? "#d8f3dc" : "#fff3bf")
            .setFontColor(updatedStatus === "ACTIVE" ? "#1b4332" : "#856404")
            .setFontWeight("bold");
        return updatedStatus;
      }
    }
  }
  return "INACTIVE";
}

function submitCourtScores(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sched " + payload.groupName);
  if (!sheet) return "Error: Schedule sheet not found.";
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    let pName = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (court === payload.court.toString().trim() && payload.scores[pName]) {
      let pScores = payload.scores[pName];
      let g1 = parseFloat(pScores.g1) || 0, g2 = parseFloat(pScores.g2) || 0, g3 = parseFloat(pScores.g3) || 0;
      sheet.getRange(i + 1, 3, 1, 5).setValues([[g1, g2, g3, g1 + g2 + g3, payload.submitter]]);
    }
  }
  return "✅ Scores submitted successfully!";
}

function getRankingsAndSchedData(groupName) {
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
  const scoreSheet = getScoreSheetByGroup(groupName);
  if (!scoreSheet) return [];

  const data = scoreSheet.getDataRange().getValues();
  const col = buildColMap(data[0]);
  
  let players = [];
  for(let i = 1; i < data.length; i++) {
    let name = (col.name !== undefined && data[i][col.name]) ? data[i][col.name] : (data[i][col.first] + " " + data[i][col.last]).trim();
    if (!name) continue;
    let phone = data[i][col.phone] || "";
    let status = (data[i][col.status] || "ACTIVE").toString().toUpperCase().trim();
    players.push({name: name, phone: phone, status: status});
  }
  players.sort((a,b) => a.name.localeCompare(b.name));
  return players;
}

