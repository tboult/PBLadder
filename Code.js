/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */

function getAppVersion() {
  return "1.1.0"; 
}

/**
 * Fetches dynamic configurations from the 'Constants' sheet starting at row 6.
 * Cleans JS syntax like 'const', quotes, and semicolons automatically.
 * @returns {Object} Key-value mapping of your global configurations.
 */
function getGlobalConstants() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Constants');
  if (!sheet) throw new Error("Tab 'Constants' was not found.");

  const lastRow = sheet.getLastRow();
  if (lastRow < 6) return {};

  const rows = sheet.getRange(6, 1, lastRow - 5, 2).getValues();

  return rows.reduce((config, [colA, colB]) => {
    if (!colA) return config;

    const strA = colA.toString().trim();

    if (strA.includes('=')) {
      let [rawKey, ...valParts] = strA.split('=');

      // Remove 'const', 'let', or 'var' prefixes from the key
      const key = rawKey.replace(/^(const|let|var)\s+/i, '').trim();

      // Join value, remove trailing semicolons, and strip surrounding quotes
      let val = valParts.join('=').trim().replace(/;$/, '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      config[key] = val;
    } else {
      config[strA] = colB;
    }

    return config;
  }, {});
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
    let action = (e.parameter && e.parameter.action) ? e.parameter.action : "";
    let payload = {};

    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
        if (!action && payload.action) action = payload.action;
      } catch(ex) {}
    } else if (e.parameter) {
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
        result = getPlayersForCheckIn(payload.sheet);
        break;
      case 'saveCheckIns':
        result = saveCheckIns(payload.sheet, payload.checkedNames);
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
        result = rescheduleFromCheckIns(payload.arg || payload.tab);
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
        result = getAppVersion();
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
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Validates whether the active sheet is one of the designated group score tabs.
 */
function getValidActiveScoreSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();
  
  if (!VALID_SCORE_TABS.includes(sheetName)) {
    throw new Error(`⚠️ Action Cancelled: Current tab "${sheetName}" is not a valid score tab.\nPlease click on one of: ${VALID_SCORE_TABS.join(", ")} before running this function.`);
  }
  return sheet;
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
    .addItem('2. Admin: Generate Sched Tabs (All Groups)', 'menuGenerateScheduleTabs')
    .addItem('3. ➕ Add New Player', 'showAddPlayerDialog')
    .addSeparator()
    .addItem('4. 📥 Download Schedule PDFs', 'showPdfDownloadDialog')
    .addSeparator()
    .addItem('5. Update Standings (Current Tab - SHIFT)', 'menuUpdateStandingsWithShift')
    .addItem('6. Correct Current Scores (Current Tab - NO SHIFT)', 'menuCorrectScoresNoShift')
    .addSeparator()
    .addItem('📸 Save Pre-Work Tab', 'createPreWorkSnapshotTab')
    .addItem('⏪ Restore Score Data from Tab', 'restoreFromSnapshotTab')
    .addSeparator()
    .addItem('📁 Run Full Drive File Backup', 'menuCreateDriveBackup')
    .addItem('⏪ Restore Full File from Drive', 'restoreFullFileFromDrive')
    .addToUi();

  checkAndRunWeeklyBackup();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  let targetSheet = VALID_SCORE_TABS.includes(activeSheet.getName()) ? activeSheet : ss.getSheetByName("Score Womens");
  let url = ss.getUrl();
  if (targetSheet) {
    url += "#gid=" + targetSheet.getSheetId();
  }
  return url;
}

function startNewSeason() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let clearedCount = 0;

  VALID_SCORE_TABS.forEach(tabName => {
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

function rescheduleFromCheckIns(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return "Error: Schedule sheet not found.";

  const data = sheet.getDataRange().getValues();
  let timeStr = "";
  if (data[0] && data[0][0].toString().includes("Time:")) timeStr = data[0][0];

  let checkedInPlayers = [];
  for (let i = 1; i < data.length; i++) {
    let name = data[i][0] ? data[i][0].toString().trim() : "";
    let court = data[i][1] ? data[i][1].toString().trim() : "";
    let checked = data[i][5] === "X";
    
    if (name && court && !name.startsWith("---") && checked) {
      checkedInPlayers.push({ name: name });
    }
  }

  if (checkedInPlayers.length === 0) return "Error: Nobody is checked in!";

  const groupName = sheetName.replace("Sched ", "").trim();
  const constSheet = ss.getSheetByName("Constants");
  let availCourts = [1,2,3,4,5,6,7,8];
  
  if (constSheet) {
    const cData = constSheet.getDataRange().getValues();
    let gCol = -1, cCol = -1;
    cData[0].forEach((h, i) => { 
      if(h.toString().toLowerCase() === "group") gCol = i;
      if(h.toString().toLowerCase().includes("court")) cCol = i;
    });
    for(let i=1; i<cData.length; i++) {
      if(gCol>=0 && cData[i][gCol].toString().toLowerCase() === groupName.toLowerCase() && cCol>=0) {
        availCourts = parseAndSortCourts(cData[i][cCol]);
        break;
      }
    }
  }

  let numByes = checkedInPlayers.length % 4;
  let playingRoster = [];
  let byePlayers = [];
  
  for(let i=0; i < checkedInPlayers.length - numByes; i++) playingRoster.push(checkedInPlayers[i]);
  for(let i=checkedInPlayers.length - numByes; i < checkedInPlayers.length; i++) byePlayers.push(checkedInPlayers[i]);

  sheet.clear();
  let schedOut = [];
  if (timeStr) schedOut.push([timeStr, "", "", "", "", "", ""]);
  schedOut.push(["Name", "Court", "Game 1", "Game 2", "Game 3", "Check-In", "Entered By"]);

  let courtIdx = 0;
  for (let i = 0; i < playingRoster.length; i += 4) {
    let currentCourt = availCourts[courtIdx] !== undefined ? availCourts[courtIdx] : ("Extra " + (courtIdx + 1));
    for (let j = 0; j < 4; j++) {
      if (i + j < playingRoster.length) {
        schedOut.push([playingRoster[i+j].name, currentCourt, "", "", "", "X", ""]);
      }
    }
    courtIdx++;
  }

  if (byePlayers.length > 0) {
    schedOut.push(["", "", "", "", "", "", ""]);
    schedOut.push(["--- PLAYERS ON BYE ---", "", "", "", "", "", ""]);
    byePlayers.forEach(p => schedOut.push([p.name, "BYE", "-", "-", "-", "X", "-"]));
  }

  let sRange = sheet.getRange(1, 1, schedOut.length, 7);
  sRange.setValues(schedOut);
  sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(timeStr ? 2 : 1, 1, 1, 7).setFontWeight("bold");
  if (timeStr) sheet.getRange(1, 1, 1, 1).setFontWeight("bold");

  return `✅ Rebuilt Schedule for ${checkedInPlayers.length} checked-in players.`;
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  VALID_SCORE_TABS.forEach(t => {
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function generateScheduleTabs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    VALID_SCORE_TABS.forEach(tabName => {
      let sheet = ss.getSheetByName(tabName);
      if (sheet && sheet.getLastRow() > 1) {
        sortActivePlayersForSheet(sheet);
      }
    });

    const constSheet = ss.getSheetByName("Constants");
    let groupConfig = {};
    if (constSheet) {
      const constData = constSheet.getDataRange().getValues();
      let constCol = {};
      constData[0].forEach((h, i) => { constCol[h.toString().toLowerCase().replace(/[\s\-\/]/g, '')] = i; });
      for (let i = 1; i < constData.length; i++) {
        let gName = constData[i][constCol.group || 0];
        if (gName) {
          groupConfig[gName.toString().trim().toLowerCase()] = {
            time: constData[i][constCol.datetime !== undefined ? constCol.datetime : 1] || "",
            courts: parseAndSortCourts(constData[i][constCol.courtlist !== undefined ? constCol.courtlist : 2])
          };
        }
      }
    }

    let groups = {};

    VALID_SCORE_TABS.forEach(tabName => {
      const sourceSheet = ss.getSheetByName(tabName);
      if (!sourceSheet || sourceSheet.getLastRow() <= 1) return;
      
      const data = sourceSheet.getDataRange().getValues();
      const col = buildColMap(data[0]);

      let activePrevCol = -1;
      for (let cName of ["w10", "w9", "w8", "w7"]) {
        if (col[cName] !== undefined) {
          let hasData = false;
          for (let r = 1; r < data.length; r++) { if (parseFloat(data[r][col[cName]]) > 0) { hasData = true; break; } }
          if (hasData) { activePrevCol = col[cName]; break; }
        }
      }

      for (let i = 1; i < data.length; i++) {
        let row = data[i];
        let status = (col.status !== undefined && row[col.status] !== "") ? row[col.status].toString().toUpperCase().trim() : "ACTIVE";

        if (status === "ACTIVE") {
          let g = (col.group !== undefined && row[col.group] !== "") ? row[col.group].toString().trim() : tabName.replace("Score ", "");
          if (!g || g.toLowerCase() === "default") continue; 

          let safeGroupName = g.replace(/[\\\/*?\[\]:]/g, "").substring(0, 25); 
          if (!groups[safeGroupName]) groups[safeGroupName] = [];

          let pName = (col.name !== undefined && row[col.name]) ? row[col.name] : ((row[col.first] || "") + " " + (row[col.last] || "")).trim();
          let playedLast = true;
          if (activePrevCol !== -1 && (isNaN(parseFloat(row[activePrevCol])) || parseFloat(row[activePrevCol]) <= 0)) playedLast = false; 

          groups[safeGroupName].push({
            name: pName,
            rank: col.rNum !== undefined ? parseInt(row[col.rNum]) || 999 : 999,
            winPct: col.winPct !== undefined ? row[col.winPct] : "",
            totalPts: col.total !== undefined ? row[col.total] : "",
            playedLastWeek: playedLast
          });
        }
      }
    });

    let tabsCreated = 0;
    Object.keys(groups).forEach(gName => {
      let players = groups[gName].sort((a,b) => a.rank - b.rank);
      let numByes = players.length % 4;
      let playingRoster = [], byePlayers = [];

      if (numByes > 0 && ALWAYS_BYE_LOWEST) {
        let byesAssigned = 0, tempRoster = [];
        for (let i = players.length - 1; i >= 0; i--) {
          if (byesAssigned < numByes) {
            if (players[i].playedLastWeek) { byePlayers.push(players[i]); byesAssigned++; } 
            else tempRoster.unshift(players[i]);
          } else { tempRoster.unshift(players[i]); }
        }
        while (byesAssigned < numByes && tempRoster.length > 0) { byePlayers.push(tempRoster.pop()); byesAssigned++; }
        playingRoster = tempRoster;
      } else {
        for (let i = 0; i < numByes; i++) byePlayers.push(players.pop());
        playingRoster = players;
      }

      let configMatch = groupConfig[gName.toLowerCase()];
      let timeStr = configMatch ? configMatch.time : "";
      let availCourts = configMatch ? configMatch.courts : [1,2,3,4,5,6,7,8];

      let schedSheet = ss.getSheetByName("Sched " + gName) || ss.insertSheet("Sched " + gName);
      schedSheet.clear();

      let schedOut = [];
      if (timeStr) schedOut.push([`Time: ${timeStr}`, "", "", "", "", "", ""]);
      schedOut.push(["Name", "Court", "Game 1", "Game 2", "Game 3", "Check-In", "Entered By"]);

      let courtIdx = 0;
      for (let i = 0; i < playingRoster.length; i += 4) {
        let currentCourt = availCourts[courtIdx] !== undefined ? availCourts[courtIdx] : ("Extra " + (courtIdx + 1));
        for (let j = 0; j < 4; j++) { if (i + j < playingRoster.length) schedOut.push([playingRoster[i+j].name, currentCourt, "", "", "", "", ""]); }
        courtIdx++;
      }

      if (byePlayers.length > 0) {
        schedOut.push(["", "", "", "", "", "", ""]);
        schedOut.push(["--- PLAYERS ON BYE ---", "", "", "", "", "", ""]);
        byePlayers.forEach(p => schedOut.push([p.name, "BYE", "-", "-", "-", "-", "-"]));
      }

      let sRange = schedSheet.getRange(1, 1, schedOut.length, 7);
      sRange.setValues(schedOut);
      sRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
      schedSheet.getRange(timeStr ? 2 : 1, 1, 1, 7).setFontWeight("bold");
      if (timeStr) schedSheet.getRange(1, 1, 1, 1).setFontWeight("bold");
      
      let rankSheet = ss.getSheetByName("Rankings " + gName) || ss.insertSheet("Rankings " + gName);
      rankSheet.clear();
      let rankOut = [["Rank", "Name", "Win %", "Total Pts"]];
      players.forEach(p => rankOut.push([p.rank === 999 ? "UR" : p.rank, p.name, p.winPct, p.totalPts]));
      
      let rRange = rankSheet.getRange(1, 1, rankOut.length, 4);
      rRange.setValues(rankOut);
      rRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
      rankSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
      
      tabsCreated += 2;
    });

    return tabsCreated > 0 ? `✅ Success: Generated ${tabsCreated} schedule/ranking tabs.` : "⚠️ No active players found across score tabs.";
  } catch (error) { return `❌ ERROR: ${error.message}`; }
}

/** 
 * ==========================================
 * 7. PDF GENERATION
 * ==========================================
 */
function buildScheduleSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let matchedName = "", matchedGroup = "", playerStatus = "ACTIVE";

  for (let tabName of VALID_SCORE_TABS) {
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (let tabName of VALID_SCORE_TABS) {
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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