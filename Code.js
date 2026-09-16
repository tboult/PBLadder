/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */

const ENABLE_LOGGING = true; // Toggle to true/false to enable or disable system logging

/**
 * Global Logger Helper
 */
function logDebug(fnName, msg, extra = "") {
  if (!ENABLE_LOGGING) return;
  const extraStr = extra ? (typeof extra === "object" ? JSON.stringify(extra) : String(extra)) : "";
  Logger.log(`[${new Date().toISOString()}] [${fnName}] ${msg} ${extraStr}`.trim());
}

const SPREADSHEET_ID = "14jmYyesfG9btWcIeptDwD6Bkxj8UZiQVlAOGc6BdM84";
const SCORE_TABS = VALID_SCORE_TABS = ["Score Womens", "Score Mens", "Score Mixed"];
const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const ALWAYS_BYE_LOWEST = true;


const GROUPS = ["Womens", "Mens", "Mixed"];
const SCHEDULE_TABS = ["Sched Womens", "Sched Mens", "Sched Mixed"];


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
  return "1.1.2"; 
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
  return "1.1.2"; 
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


function getPlayersForCheckIn(schedSheetName) {
  logDebug("getPlayersForCheckIn", "Triggered for sheet", schedSheetName);
  if (!schedSheetName) return [];
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) return [];
  
  let sheet = ss.getSheetByName(schedSheetName);
  if (!sheet && !schedSheetName.startsWith("Sched ")) {
    sheet = ss.getSheetByName("Sched " + schedSheetName);
  }
  if (!sheet) {
    logDebug("getPlayersForCheckIn", "Sheet not found", schedSheetName);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  let result = [];
  
  for (let i = 0; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    let status = data[i][5] ? data[i][5].toString().trim().toUpperCase() : "";
    
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:") && !name.toLowerCase().startsWith("name")) {
      result.push({ 
        name: name, 
        court: court, 
        checked: status === "X" || status === "TRUE" || status === "CHECKED" || status === "YES" 
      });
    }
  }
  logDebug("getPlayersForCheckIn", `Parsed ${result.length} players for check-in on '${sheet.getName()}'`);
  return result;
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

  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    if (name && court && court !== "BYE" && !name.startsWith("---") && !name.startsWith("Time:")) {
      let isChecked = checkedSet.has(name.toLowerCase());
      sheet.getRange(i + 1, 6).setValue(isChecked ? "X" : "");
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

function processWeeklyScoresForSheet(scoreSheet, forcedWeek, shouldShift = true) {
  logDebug("processWeeklyScoresForSheet", `Processing sheet '${scoreSheet.getName()}'`, { forcedWeek, shouldShift });
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
  logDebug("processWeeklyScoresForSheet", "Standings updated for tab", scoreSheet.getName());
  return `✅ Scores harvested & standings updated for tab '${scoreSheet.getName()}'.`;
}

function harvestScoresFromSchedules(ss, scoreData, col, w10Idx) {
  logDebug("harvestScoresFromSchedules", "Harvesting scores from schedule tabs");
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

/* ==========================================
 * 6. SORTING & SCHEDULE GENERATION
 * ========================================== */

function sortActivePlayers() {
  logDebug("sortActivePlayers", "Triggered sort wrapper");
  const sheet = getValidActiveScoreSheet();
  return sortActivePlayersForSheet(sheet);
}

function sortActivePlayersForSheet(sheet) {
  logDebug("sortActivePlayersForSheet", "Sorting active roster for tab", sheet.getName());
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

  if (activePlayers.length === 0) {
    return "⚠️ No active players found on " + resolvedTabName;
  }

  let cleanGroupName = resolvedTabName.replace("Score ", "").trim();
  let schedSheetName = "Sched " + cleanGroupName;
  
  let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);
  schedSheet.clear();

  let schedOut = [["Name", "Court", "Game 1", "Game 2", "Game 3", "Check-In", "Entered By"]];
  let courtNum = 1;

  for (let i = 0; i < activePlayers.length; i += 4) {
    let courtName = "Court " + courtNum;
    for (let j = 0; j < 4; j++) {
      if (i + j < activePlayers.length) {
        schedOut.push([activePlayers[i+j].name, courtName, "", "", "", "", ""]);
      }
    }
    courtNum++;
  }

  let sRange = schedSheet.getRange(1, 1, schedOut.length, 7);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  schedSheet.getRange(1, 1, 1, 7).setFontWeight("bold");

  logDebug("generateScheduleTabs", "Schedule tab successfully updated", schedSheetName);
  return `✅ Schedule generated successfully for ${cleanGroupName} (${activePlayers.length} players, ${courtNum - 1} courts).`;
}

function rescheduleFromCheckIns(schedTabName) {
  logDebug("rescheduleFromCheckIns", "Rescheduling based on check-ins for tab", schedTabName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let targetName = (schedTabName || "").toString().trim();
  if (!targetName.startsWith("Sched ") && !targetName.startsWith("Score ")) {
    targetName = "Sched " + targetName;
  } else if (targetName.startsWith("Score ")) {
    targetName = targetName.replace("Score ", "Sched ");
  }
  
  let sheet = ss.getSheetByName(targetName);
  if (!sheet) {
    logDebug("rescheduleFromCheckIns", "Target sheet not found", targetName);
    return `⚠️ Target sheet '${targetName}' was not found.`;
  }

  let data = sheet.getDataRange().getValues();
  if (data.length <= 1) return `⚠️ No data found on ${targetName}`;

  let headers = data[0].map(h => h.toString().toLowerCase().trim());
  let nameIdx = headers.indexOf("name");
  let checkInIdx = headers.indexOf("check-in");

  if (nameIdx === -1 || checkInIdx === -1) {
    return `⚠️ Required columns ("Name" and "Check-In") missing on ${targetName}`;
  }

  let checkedInPlayers = [];
  let seen = new Set();

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = row[nameIdx] ? row[nameIdx].toString().trim() : "";
    let checkVal = row[checkInIdx] ? row[checkInIdx].toString().trim().toLowerCase() : "";

    let isCheckedIn = ["yes", "true", "x", "checked in", "1"].includes(checkVal);

    if (pName && isCheckedIn) {
      let cleanKey = pName.toLowerCase();
      if (!seen.has(cleanKey)) {
        seen.add(cleanKey);
        checkedInPlayers.push(pName);
      }
    }
  }

  if (checkedInPlayers.length === 0) {
    logDebug("rescheduleFromCheckIns", "No checked-in players found on tab", targetName);
    return `⚠️ No players are currently marked as checked-in on ${targetName}.`;
  }

  let schedOut = [["Name", "Court", "Game 1", "Game 2", "Game 3", "Check-In", "Entered By"]];
  let courtNum = 1;

  for (let i = 0; i < checkedInPlayers.length; i += 4) {
    let courtName = "Court " + courtNum;
    for (let j = 0; j < 4; j++) {
      if (i + j < checkedInPlayers.length) {
        schedOut.push([checkedInPlayers[i + j], courtName, "", "", "", "YES", ""]);
      }
    }
    courtNum++;
  }

  sheet.clearContents();
  let sRange = sheet.getRange(1, 1, schedOut.length, 7);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(1, 1, 1, 7).setFontWeight("bold");

  logDebug("rescheduleFromCheckIns", `Rescheduled ${checkedInPlayers.length} players across ${courtNum - 1} courts`);
  return `✅ Rescheduled ${checkedInPlayers.length} checked-in players across ${courtNum - 1} courts on '${targetName}'.`;
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
  logDebug("showPdfDownloadDialog", "Opening PDF download modal");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const built = buildScheduleSheet();
  const b64 = Utilities.base64Encode(exportSheetAsPDF(ss, built.sheet, built.fileName).getBytes());
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:sans-serif;text-align:center;padding:20px;"><h3>PDF Ready</h3><a download="${built.fileName}" href="data:application/pdf;base64,${b64}" style="padding:12px 24px;background:#2d6a4f;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">⬇ Download PDF</a></div>`
  ).setWidth(400).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, "Download Schedule");
}

function webExportSchedulePdf() {
  logDebug("webExportSchedulePdf", "Exporting schedule PDF via Web API");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const built = buildScheduleSheet();
  return Utilities.base64Encode(exportSheetAsPDF(ss, built.sheet, built.fileName).getBytes());
}

function exportSheetAsPDF(ss, sheet, fileName) {
  logDebug("exportSheetAsPDF", "Generating PDF Blob", fileName);
  const url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=pdf&gid=" + sheet.getSheetId() +
    "&portrait=true&size=letter&fitw=true&gridlines=false&printtitle=false&pagenumbers=false";
  return UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() } }).getBlob().setName(fileName);
}

/* ==========================================
 * 8. WEB APP BACKEND HANDLERS
 * ========================================== */

function findFoursomeByPhone(rawPhone) {
  logDebug("findFoursomeByPhone", "Searching for foursome by phone", rawPhone);
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

  logDebug("findFoursomeByPhone", "Match results found", { matchedName, userCourt });
  return { found: true, playerName: matchedName, groupName: safeGroup, status: playerStatus, court: userCourt, foursome: foursome };
}

function togglePlayerStatus(rawPhone) {
  logDebug("togglePlayerStatus", "Toggling status for phone number", rawPhone);
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
        logDebug("togglePlayerStatus", "Updated player status to", updatedStatus);
        return updatedStatus;
      }
    }
  }
  logDebug("togglePlayerStatus", "Player phone not found");
  return "INACTIVE";
}

function submitCourtScores(payload) {
  logDebug("submitCourtScores", "Submitting court scores payload", payload);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sched " + payload.groupName);
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
  logDebug("submitCourtScores", "Submitted court scores successfully");
  return "✅ Scores submitted successfully!";
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
  logDebug("getAdminPlayersByGroup", "Fetching admin players list for group", groupName);
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
