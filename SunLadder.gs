/* ==========================================
 * GLOBAL CONFIGURATION & HELPER DEFINITIONS
 * ========================================== */
const ALWAYS_BYE_LOWEST = true;
const MAX_MOVEMENT = 4;
const MAX_POINTS_PER_WEEK = 45;
const VALID_SCORE_TABS = ["Score Womens", "Score Mens", "Score Mixed"];

function getAppVersion() {
  return "1.1.0"; 
}

/**
 * Validates whether the active sheet is one of the designated group score tabs.
 * Returns the Sheet object if valid, or throws an error string if invalid.
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

/**
 * Helper to map a group name (e.g., "Womens") to its dedicated score tab.
 */
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
    .addItem('📱 Open Check-In & Score Dialog', 'showCheckInDialog')
    .addSeparator()
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

function doGet(e) {
  return getCheckInHtmlOutput();
}

function showCheckInDialog() {
  const html = getCheckInHtmlOutput().setWidth(450).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, '🥒 SCPB Ladder 🥒');
}

function showAddPlayerDialog() {
  const html = getAddPlayerHtmlOutput().setWidth(400).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, '➕ Add New Player');
}

// Menu Wrappers (Enforce operating on currently active valid score tab)
function menuSortActivePlayers() {
  try {
    const sheet = getValidActiveScoreSheet();
    SpreadsheetApp.getUi().alert(sortActivePlayersForSheet(sheet));
  } catch(e) {
    SpreadsheetApp.getUi().alert(e.message);
  }
}

function menuGenerateScheduleTabs() {
  SpreadsheetApp.getUi().alert(generateScheduleTabs());
}

function menuUpdateStandingsWithShift() {
  try {
    const sheet = getValidActiveScoreSheet();
    SpreadsheetApp.getUi().alert(processWeeklyScoresForSheet(sheet, "W10", true));
  } catch(e) {
    SpreadsheetApp.getUi().alert(e.message);
  }
}

function menuCorrectScoresNoShift() {
  try {
    const sheet = getValidActiveScoreSheet();
    SpreadsheetApp.getUi().alert(processWeeklyScoresForSheet(sheet, "W10", false));
  } catch(e) {
    SpreadsheetApp.getUi().alert(e.message);
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
 * 2. MOBILE-OPTIMIZED HTML UI GENERATOR
 * ==========================================
 */
function getCheckInHtmlOutput() {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Pickleball Ladder">
        <title>SunCity Pickleball Ladder</title>
        <link rel="apple-touch-icon" href="https://raw.githubusercontent.com/tboult/RR/refs/heads/main/SunLadder.png">
        <link rel="icon" type="image/png" sizes="192x192" href="https://raw.githubusercontent.com/tboult/RR/refs/heads/main/SunLadder.png">

        <style>
          :root {
            --bg-color: #f4f6f8;
            --text-color: #212529;
            --header-bg: #2d6a4f;
            --header-text: white;
            --nav-bg: #e9ecef;
            --nav-text: #495057;
            --nav-active-bg: #2d6a4f;
            --nav-active-text: white;
            --card-bg: white;
            --card-border: rgba(0,0,0,0.08);
            --input-border: #ced4da;
            --input-bg: white;
            --btn-main-bg: #2d6a4f;
            --btn-main-text: white;
            --btn-sub-bg: #6c757d;
            --btn-sub-text: white;
            --btn-danger-bg: #d90429;
            --btn-danger-text: white;
            --row-border: #f1f3f5;
            --row-hover: #e9ecef;
            --row-checked-bg: #d8f3dc;
            --court-header-bg: #e8f5e9;
            --court-header-text: #1b4332;
            --focus-ring: #ffbf47;
          }

          body.high-contrast {
            --bg-color: #000000;
            --text-color: #ffffff;
            --header-bg: #ffff00;
            --header-text: #000000;
            --nav-bg: #1a1a1a;
            --nav-text: #ffffff;
            --nav-active-bg: #ffff00;
            --nav-active-text: #000000;
            --card-bg: #1a1a1a;
            --card-border: #ffff00;
            --input-border: #ffff00;
            --input-bg: #000000;
            --btn-main-bg: #ffff00;
            --btn-main-text: #000000;
            --btn-sub-bg: #ffffff;
            --btn-sub-text: #000000;
            --btn-danger-bg: #ff4d4d;
            --btn-danger-text: #000000;
            --row-border: #333333;
            --row-hover: #333300;
            --row-checked-bg: #333300;
            --court-header-bg: #ffff00;
            --court-header-text: #000000;
            --focus-ring: #ffffff;
          }

          * { box-sizing: border-box; }
          html { font-size: 100%; transition: font-size 0.2s ease; }
          
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            padding: 0.75rem; 
            background-color: var(--bg-color); 
            color: var(--text-color); 
            line-height: 1.6;
          }
          
         .header-title { 
             text-align: center; 
             font-size: 1.25rem; 
             margin: 0 0 0.75rem 0; 
             padding: 0.75rem; 
             background-color: #e8f5e9;
             color: #1b5e20;
             border: 1px solid #a5d6a7;
             border-radius: 0.5rem; 
             user-select: none;
             -webkit-user-select: none;
             touch-action: manipulation;
             cursor: pointer;
         }
          
          .access-panel {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            background: var(--card-bg);
            padding: 0.5rem;
            border-radius: 0.5rem;
            border: 2px solid var(--card-border);
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
          }
          .access-panel button {
            flex: 1;
            min-width: 44px;
            margin-top: 0;
            padding: 0.5rem;
            min-height: 44px;
            font-size: 1.1rem;
            font-weight: bold;
            background: var(--btn-sub-bg);
            color: var(--btn-sub-text);
          }
          .access-panel button.active {
            border: 3px solid var(--text-color);
            background: var(--btn-main-bg);
            color: var(--btn-main-text);
          }

          .nav { display: flex; background: var(--nav-bg); border-radius: 0.5rem; padding: 0.2rem; margin-bottom: 0.75rem; overflow-x: auto;}
          .nav button { flex: 1; min-width: 4.5rem; padding: 0.75rem 0.25rem; border: none; background: transparent; cursor: pointer; font-weight: 700; font-size: 0.9rem; color: var(--nav-text); border-radius: 0.4rem; transition: 0.2s; min-height: 54px; }
          .nav button.active { background: var(--nav-active-bg); color: var(--nav-active-text); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .tab-content { display: none; }
          .tab-content.active { display: block; }

          input, select, button { 
            width: 100%; 
            padding: 0.75rem; 
            margin-top: 0.5rem; 
            border-radius: 0.5rem; 
            border: 2px solid var(--input-border); 
            font-size: 1.1rem; 
            background: var(--input-bg);
            color: var(--text-color);
            min-height: 54px; 
          }
          
          input:focus, select:focus, button:focus {
            outline: 3px solid var(--focus-ring);
            outline-offset: 2px;
          }
          button, .btn, .btn-main {
            background-color: #e8f5e9;
            color: #1b5e20;
            border: 1px solid #a5d6a7;
            padding: 10px 16px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          button:hover, .btn:hover, .btn-main:hover {
            background-color: #c8e6c9; 
            color: #0d3b0e;
          }

          button:active, .btn:active, .btn-main:active {
            background-color: #a5d6a7;
          }

          .btn-sub { background-color: var(--btn-sub-bg); color: var(--btn-sub-text); font-weight: bold; border: none; cursor: pointer; }
          .btn-danger { background-color: var(--btn-danger-bg); color: var(--btn-danger-text); font-weight: bold; border: none; cursor: pointer; }
          .card { background: var(--card-bg); border: 2px solid var(--card-border); border-radius: 0.5rem; padding: 0.75rem; margin-top: 0.75rem; }
          
          .player-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0.75rem; border-bottom: 2px solid var(--row-border); background: var(--card-bg); cursor: pointer; min-height: 54px; }
          .player-row:active { background: var(--row-hover); }
          .player-row.checked { background: var(--row-checked-bg); }
          .player-name { font-size: 1.1rem; font-weight: 600; pointer-events: none; }
          .check-icon { font-size: 1.25rem; pointer-events: none; }

          #playerList { margin-top: 0.75rem; max-height: 60vh; overflow-y: auto; border-radius: 0.5rem; border: 2px solid var(--row-border); overflow-x: hidden; }
          .court-header { font-weight: bold; background: var(--court-header-bg); color: var(--court-header-text); padding: 0.5rem 0.75rem; margin-top: 0; font-size: 1.1rem; border-bottom: 2px solid var(--row-border);}
          
          .score-grid { display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr; gap: 0.4rem; align-items: center; margin-top: 0.4rem; }
          .score-grid input { text-align: center; margin-top: 0; padding: 0.5rem; font-size: 1.1rem; min-height: 54px; }
          
          .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.9rem; font-weight: bold; }
          .status-active { background-color: var(--row-checked-bg); color: var(--text-color); border: 1px solid var(--text-color); }
          .status-inactive { background-color: #fff3bf; color: #856404; }
          .status-msg { margin-top: 0.75rem; text-align: center; font-size: 1rem; font-weight: 600; }
          
          table.data-table { width: 100%; border-collapse: collapse; font-size: 1rem; margin-top: 0.75rem; }
          table.data-table th { background: var(--header-bg); color: var(--header-text); padding: 0.5rem; text-align: left; }
          table.data-table td { padding: 0.5rem; border-bottom: 2px solid var(--row-border); }

          @media (max-width: 768px) {
            .desktop-only { display: none !important; }
          }
        </style>
      </head>
      <body>

      <h2 class="header-title" id="mainHeader" onpointerdown="handleSecretTap(event)">🥒 SCPB Ladder 🥒</h2>

        <div class="nav">
          <button id="tab1Btn" class="active" onclick="switchTab('checkin')">Check-In</button>
          <button id="tab2Btn" onclick="switchTab('phone')">Enter Scores</button>
          <button id="tab3Btn" onclick="switchTab('ranksched')">Schedule<br> & Ranks</button>
          <button id="tab4Btn" onclick="switchTab('help')">Help</button>
          <button id="tabAdminBtn" style="display:none; background:var(--btn-danger-bg); color:var(--btn-danger-text);" onclick="switchTab('admin')">Admin</button>
        </div>

        <!-- TAB 1: CHECK-IN SYSTEM -->
        <div id="checkinTab" class="tab-content active">
          <label><b>Select Group:</b></label>
          <select id="sheetSelect" onchange="onGroupChange('sheetSelect'); loadCheckInPlayers()"><option value="">-- Choose Ladder --</option></select>
          <div id="playerList"><i>Select a group above...</i></div>
          <button id="saveCheckInBtn" class="btn-main" onclick="submitCheckIns()" disabled>Save Check-Ins</button>
          <div id="checkInStatus" class="status-msg"></div>
        </div>

        <!-- TAB 2: SCORES & PHONE LOOKUP -->
        <div id="phoneTab" class="tab-content">
          <div id="phoneEntrySection">
            <label><b>Enter Phone Number:</b></label>
            <input type="tel" id="phoneInput" placeholder="e.g. 555-123-4567">
            <button class="btn-main" onclick="lookupPhone()">Find My Foursome</button>
          </div>
          
          <div id="lookupResult" style="display:none;">
            <div class="card">
              <h4 style="margin:0 0 0.25rem 0;" id="pNameDisplay"></h4>
              <p style="margin:0.25rem 0; font-size:1rem;">Group: <b id="pGroupDisplay"></b> | Court: <b id="pCourtDisplay"></b></p>
              <p style="margin:0.25rem 0 0 0; font-size:1rem;">Status: <span id="pStatusDisplay" class="status-badge"></span></p>
              <button class="btn-sub" style="margin-top:0.75rem;" onclick="toggleStatus()">Toggle Active / Inactive</button>
            </div>

            <div id="scoreEntrySection" style="margin-top: 0.75rem;">
              <h4 style="margin: 0.75rem 0 0.25rem 0;">Submit Court Scores</h4>
              <div id="scoreInputsContainer"></div>
              <button class="btn-main" onclick="saveScores()">Submit Scores</button>
            </div>
            
            <button class="btn-danger" style="margin-top:1.5rem;" onclick="clearPhoneCache()">Sign Out / Clear Saved Phone</button>
          </div>
          
          <!-- REGISTRATION FORM -->
          <div id="registrationSection" class="card" style="display:none;">
            <h4 style="margin:0 0 0.75rem 0;">New Player Registration</h4>
            <input type="text" id="regFirst" placeholder="First Name">
            <input type="text" id="regLast" placeholder="Last Name">
            <input type="tel" id="regPhone" placeholder="Phone Number">
            <input type="email" id="regEmail" placeholder="Email">
            <select id="regGroup" onchange="onGroupChange('regGroup')"><option value="">-- Select Group --</option></select>
            <button class="btn-main" onclick="submitRegistration()">Register Player</button>
            <button class="btn-sub" onclick="cancelRegistration()">Cancel</button>
          </div>
          
          <div id="phoneStatus" class="status-msg"></div>
        </div>

        <!-- TAB 3: RANKINGS & SCHEDULE VIEWER -->
        <div id="rankschedTab" class="tab-content">
          <label><b>Select Group:</b></label>
          <select id="groupViewerSelect" onchange="onGroupChange('groupViewerSelect'); loadRankingsAndSched()"><option value="">-- Choose Group --</option></select>
          <div id="viewerContent" style="margin-top: 0.75rem;"></div>
          <div id="viewerStatus" class="status-msg"></div>
        </div>

        <!-- TAB 4: HELP -->
        <div id="helpTab" class="tab-content">
          <div class="access-panel">
            <h3 style="margin-top:0;">📱 Adjust sizes / Contrast</h3>
            <button id="btn-size-normal" class="active" onclick="applyTextSize('normal')">Bold</button>
            <button id="btn-size-large" onclick="applyTextSize('large')">Large</button>
            <button id="btn-size-huge" onclick="applyTextSize('huge')">HUGE</button>
            <button id="btn-contrast-toggle" onclick="toggleContrast()">High Contrast</button>
          </div>

          <div class="card">
            <h3 style="margin-top:0;">📱 Install on Phone</h3>
            <p>You can add this app directly to your home screen for easy access!</p>
            <b>iPhone (Safari):</b>
            <ol style="margin-top:0.25rem; font-size:1rem;">
              <li>Tap the <b>Share</b> icon at the bottom of the screen (square with an up arrow).</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
            </ol>
            <b>Android (Chrome):</b>
            <ol style="margin-top:0.25rem; font-size:1rem;">
              <li>Tap the <b>3 dots</b> (menu) in the top right.</li>
              <li>Tap <b>Add to Home screen</b>.</li>
            </ol>
            <div class="help-section" style="margin-top: 20px; text-align: center;">
              <p style="font-size: 0.9em; color: #666;">Not seeing recent app updates or icons?</p>
              <button onclick="forceResetApp()" style="background-color: #d9534f; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                🔄 Reset & Hard Refresh App
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 5: ADMIN -->
        <div id="adminTab" class="tab-content">
          <div class="card">
            <h3 style="margin-top:0; color:var(--btn-danger-bg);">⚙️ Admin Controls</h3>
            
            <a id="adminSheetLink" href="#" target="_blank" class="btn-main" style="display:block; padding:0.75rem; margin-bottom:1rem; border-radius:0.5rem; text-align:center;">📝 Edit Score Data Sheet</a>

            <!-- QUICK ACTIVE / INACTIVE TOGGLE LIST -->
            <div class="card" style="margin-bottom:1rem; background: var(--bg-color);">
              <h4 style="margin:0 0 0.5rem 0;">👥 Quick Active / Inactive Manager</h4>
              
              <label><b>Select Group:</b></label>
              <select id="adminStatusGroupSelect" onchange="onGroupChange('adminStatusGroupSelect'); loadAdminPlayerStatus()" style="margin-bottom: 0.5rem;">
                <option value="">-- Choose Group --</option>
              </select>
              
              <input type="text" id="adminPlayerSearch" onkeyup="filterAdminPlayers()" placeholder="🔍 Search names..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.75rem; border-radius: 0.25rem; border: 1px solid #ccc; box-sizing: border-box;">
              
              <div id="adminPlayerStatusList" style="margin-top:0.25rem; max-height:60vh; overflow-y:auto; border-radius:0.5rem; border:2px solid var(--row-border);">
                <i>Select a group above...</i>
              </div>
            </div>
            
            <label style="font-size:1.1rem; font-weight:bold;">Reschedule Based on Check-Ins:</label>
            <select id="adminSchedSelect" onchange="onGroupChange('adminSchedSelect')"><option value="">-- Select Schedule Tab --</option></select>
            <button class="btn-main" onclick="runReschedule()">Rebuild Checked-In Courts</button>
            <hr>
            <button class="btn-sub" onclick="runAdmin('menuSortActivePlayers')">Sort Active Players (Current Tab)</button>
            <button class="btn-sub" onclick="runAdmin('menuGenerateScheduleTabs')">Generate All Schedule Tabs</button>
            <button class="btn-sub" onclick="runAdmin('menuUpdateStandingsWithShift')">End of Week (Shift Scores)</button>
            <button class="btn-sub" onclick="runAdmin('menuCorrectScoresNoShift')">Correct Scores (No Shift)</button>
            <button class="btn-sub" onclick="getAdminPdf()">Download PDF Schedules</button>

            <div class="card" style="margin-top:1.5rem; margin-bottom:1rem; background: var(--bg-color);">
              <h4 style="margin:0 0 0.5rem 0;">➕ Add New Player</h4>
              <input type="text" id="adminRegFirst" placeholder="First Name">
              <input type="text" id="adminRegLast" placeholder="Last Name">
              <input type="tel" id="adminRegPhone" placeholder="Phone Number">
              <input type="email" id="adminRegEmail" placeholder="Email">
              <select id="adminRegGroup" onchange="onGroupChange('adminRegGroup')"><option value="">-- Select Group --</option></select>
              <button class="btn-main" style="margin-top:0.75rem;" onclick="submitAdminRegistration()">Add Player</button>
            </div>
            
            <button class="btn-danger desktop-only" style="margin-top:2rem;" onclick="if(confirm('🚨 WARNING: Are you sure you want to start a new season? This will permanently wipe all current scores across ALL groups.')) runAdmin('startNewSeason')">🚨 Start New Season</button>

            <div id="adminStatus" class="status-msg"></div>
          </div>
        </div>

        <script>
        const CURRENT_APP_VERSION = "1.1.0"; 

        // --- LOCAL STORAGE CACHE HANDLERS FOR GROUP SELECTION ---
        function getSavedGroup() {
          try {
            return localStorage.getItem('scpb_selected_group') || '';
          } catch(e) { return ''; }
        }

        function setSavedGroup(groupName) {
          if (!groupName) return;
          let cleanGroup = groupName.replace(/^Sched[\s_-]*/i, '').replace(/^Score[\s_-]*/i, '').trim();
          try {
            localStorage.setItem('scpb_selected_group', cleanGroup);
          } catch(e) {}
          syncAllGroupDropdowns(cleanGroup);
        }

        function syncAllGroupDropdowns(groupName) {
          const selectIds = ['sheetSelect', 'groupViewerSelect', 'regGroup', 'adminRegGroup', 'adminStatusGroupSelect', 'adminSchedSelect'];
          selectIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            for (let i = 0; i < el.options.length; i++) {
              let optVal = el.options[i].value.replace(/^Sched[\s_-]*/i, '').replace(/^Score[\s_-]*/i, '').trim();
              if (optVal.toLowerCase() === groupName.toLowerCase()) {
                el.selectedIndex = i;
                break;
              }
            }
          });
        }

        function onGroupChange(sourceSelectId) {
          const val = document.getElementById(sourceSelectId).value;
          if (val) setSavedGroup(val);
        }

        function checkAppVersion() {
          google.script.run.withSuccessHandler(serverVersion => {
            try {
              const savedVersion = localStorage.getItem('app_installed_version');
              if (savedVersion !== serverVersion) {
                localStorage.setItem('app_installed_version', serverVersion);
                window.location.reload(true);
              }
            } catch (e) {
              console.warn("Storage blocked, skipping version check.");
            }
          }).getAppVersion();
        }

        async function forceResetApp() {
          if (confirm("This will clear cached app data and force-download the latest version. Continue?")) {
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch(e) {}
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (let registration of registrations) { await registration.unregister(); }
            }
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              for (let name of cacheNames) { await caches.delete(name); }
            }
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('reset_ts', Date.now());
            window.location.href = currentUrl.toString();
          }
        }

        window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkAppVersion();
        });

        const htmlRoot = document.documentElement;
        const isMobile = window.matchMedia("(max-width: 800px)").matches;
        const sizeRatios = { normal: '150%', large: '200%', huge: '250%' };
          
        function applyTextSize(size) {
          htmlRoot.style.fontSize = sizeRatios[size];
          try { localStorage.setItem('pwa-text-size', size); } catch(e) {}
          document.getElementById('btn-size-normal').classList.remove('active');
          document.getElementById('btn-size-large').classList.remove('active');
          document.getElementById('btn-size-huge').classList.remove('active');
          document.getElementById('btn-size-' + size).classList.add('active');
        }

        function toggleContrast() {
          const isHigh = document.body.classList.toggle('high-contrast');
          try { localStorage.setItem('pwa-contrast', isHigh ? 'high' : 'normal'); } catch(e) {}
          document.getElementById('btn-contrast-toggle').classList.toggle('active', isHigh);
        }

        function initAccessibility() {
          let savedSize = 'normal';
          let savedContrast = 'normal';
          try {
            savedSize = localStorage.getItem('pwa-text-size') || 'normal';
            savedContrast = localStorage.getItem('pwa-contrast') || 'normal';
          } catch(e) {}
          applyTextSize(savedSize);
          if (savedContrast === 'high') { document.body.classList.add('high-contrast'); document.getElementById('btn-contrast-toggle').classList.add('active'); }
        }

        let currentPlayerData = null;
        let tapCount = 0;
        let tapTimer = null;

        window.onload = function() {
          checkAppVersion();
          initAccessibility();
          
          google.script.run.withSuccessHandler(sheets => {
            populateSheets(sheets);
            autoSelectStoredGroup();
          }).getSchedTabNames();

          google.script.run.withSuccessHandler(groups => {
            populateGroups(groups);
            autoSelectStoredGroup();
          }).getAvailableGroups();

          google.script.run.withSuccessHandler(url => document.getElementById('adminSheetLink').href = url).getAdminSheetUrl();
          
          try {
            const savedPhone = localStorage.getItem('foursome_phone');
            if (savedPhone) {
              document.getElementById('phoneInput').value = savedPhone;
              lookupPhone();
            }
          } catch(e) {
            console.warn("Phone storage blocked.");
          }
        };

        function autoSelectStoredGroup() {
          const savedGroup = getSavedGroup();
          if (savedGroup) {
            syncAllGroupDropdowns(savedGroup);
            if (document.getElementById('sheetSelect').value) loadCheckInPlayers();
            if (document.getElementById('groupViewerSelect').value) loadRankingsAndSched();
            if (document.getElementById('adminStatusGroupSelect').value) loadAdminPlayerStatus();
          }
        }

        function handleSecretTap(e) {
          if (e && e.cancelable) e.preventDefault(); 
          tapCount++;
          clearTimeout(tapTimer);
          if (tapCount >= 5) {
              document.getElementById('tabAdminBtn').style.display = 'block';
              document.getElementById('adminStatus').innerText = "Admin unlocked!";
              tapCount = 0;
          }
          tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
        }          

        function switchTab(tab) {
          document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
          
          document.getElementById(tab + 'Tab').classList.add('active');
          let btnId = tab === 'ranksched' ? 'tab3Btn' : tab === 'checkin' ? 'tab1Btn' : tab === 'phone' ? 'tab2Btn' : tab === 'help' ? 'tab4Btn' : 'tabAdminBtn';
          document.getElementById(btnId).classList.add('active');
        }

        function populateSheets(sheets) {
          const sel1 = document.getElementById('sheetSelect');
          const sel2 = document.getElementById('adminSchedSelect');
          sel1.innerHTML = '<option value="">-- Choose Group --</option>';
          sel2.innerHTML = '<option value="">-- Choose Group --</option>';
          sheets.forEach(function(s) {
            var cleanName = String(s).replace(/^Sched[\s_-]*/i, '').trim();
            sel1.innerHTML += '<option value="' + s + '">' + cleanName + '</option>';
            sel2.innerHTML += '<option value="' + s + '">' + cleanName + '</option>';
          });
        }
          
        function populateGroups(groups) {
          const sel1 = document.getElementById('groupViewerSelect');
          const sel2 = document.getElementById('regGroup');
          const sel3 = document.getElementById('adminRegGroup');
          const sel4 = document.getElementById('adminStatusGroupSelect');
          
          sel1.innerHTML = '<option value="">-- Choose Group --</option>';
          if(sel2) sel2.innerHTML = '<option value="">-- Select Group --</option>';
          if(sel3) sel3.innerHTML = '<option value="">-- Select Group --</option>';
          if(sel4) sel4.innerHTML = '<option value="">-- Select Group --</option>';
          
          groups.forEach(function(g) {
            sel1.innerHTML += '<option value="' + g + '">' + g + '</option>';
            if (sel2) sel2.innerHTML += '<option value="' + g + '">' + g + '</option>';
            if (sel3) sel3.innerHTML += '<option value="' + g + '">' + g + '</option>';
            if (sel4) sel4.innerHTML += '<option value="' + g + '">' + g + '</option>';
          });
        }

        function loadAdminPlayerStatus() {
          const group = document.getElementById('adminStatusGroupSelect').value;
          if(!group) return;
          
          document.getElementById('adminStatus').innerText = "Loading players...";
          google.script.run
            .withSuccessHandler(renderAdminPlayerStatus)
            .getAdminPlayersByGroup(group);
        }

        function renderAdminPlayerStatus(players) {
          document.getElementById('adminStatus').innerText = "";
          const container = document.getElementById('adminPlayerStatusList');
          container.innerHTML = "";
          
          if(!players || players.length === 0) {
            container.innerHTML = "<p style='padding:0.75rem; text-align:center;'>No players found.</p>";
            return;
          }
          
          players.forEach(p => {
            let div = document.createElement('div');
            div.className = "player-row " + (p.status === "ACTIVE" ? "checked" : "");
            let isActive = (p.status === "ACTIVE");
            let uiColor = isActive ? '#00c853' : '#9e9e9e';
            let uiWeight = isActive ? 'bold' : 'normal';
            
            div.innerHTML = '<span class="player-name" style="color: ' + uiColor + '; font-weight: ' + uiWeight + ';">' + p.name + '</span>' +
                            '<button class="btn-sub" ' +
                            'style="min-width:auto; min-height:auto; padding:0.4rem 0.75rem; margin:0; background-color: ' + uiColor + '; border: none; color: white;" ' +
                            'onclick="toggleAdminStatus(\\'' + p.phone + '\\', this)">' + 
                            p.status + 
                            '</button>';
                            
            container.appendChild(div);
          });
        }

        function toggleAdminStatus(phone, buttonElement) {
          buttonElement.innerText = "...";
          google.script.run
            .withSuccessHandler(newStatus => {
              buttonElement.innerText = newStatus;
              const nameSpan = buttonElement.parentElement.querySelector('.player-name');
              if(newStatus === "ACTIVE") {
                buttonElement.parentElement.classList.add('checked');
                buttonElement.style.backgroundColor = '#00c853';
                if (nameSpan) { nameSpan.style.color = '#00c853'; nameSpan.style.fontWeight = 'bold'; }
              } else {
                buttonElement.parentElement.classList.remove('checked');
                buttonElement.style.backgroundColor = '#9e9e9e';
                if (nameSpan) { nameSpan.style.color = '#9e9e9e'; nameSpan.style.fontWeight = 'normal'; }
              }
            })
            .togglePlayerStatus(phone);
        }

        function submitAdminRegistration() {
          let data = {
            first: document.getElementById('adminRegFirst').value,
            last: document.getElementById('adminRegLast').value,
            phone: document.getElementById('adminRegPhone').value,
            email: document.getElementById('adminRegEmail').value,
            group: document.getElementById('adminRegGroup').value
          };
          
          document.getElementById('adminStatus').innerText = "Adding player...";
          google.script.run
            .withSuccessHandler(res => {
              document.getElementById('adminStatus').innerText = res;
              document.getElementById('adminRegFirst').value = "";
              document.getElementById('adminRegLast').value = "";
              document.getElementById('adminRegPhone').value = "";
              document.getElementById('adminRegEmail').value = "";
            })
            .addNewUser(data);
        }

        function loadCheckInPlayers() {
          const sheet = document.getElementById('sheetSelect').value;
          if (!sheet) return;
          document.getElementById('checkInStatus').innerText = "Loading players...";
          google.script.run.withSuccessHandler(renderCheckInPlayers).getPlayersForCheckIn(sheet);
        }

        function renderCheckInPlayers(data) {
          document.getElementById('checkInStatus').innerText = "";
          const container = document.getElementById('playerList');
          container.innerHTML = "";
          if (data.length === 0) {
            container.innerHTML = "<p style='text-align:center;'>No players found.</p>";
            document.getElementById('saveCheckInBtn').disabled = true;
            return;
          }

          let currentCourt = "";
          data.forEach((p) => {
            if (p.court !== currentCourt) {
              currentCourt = p.court;
              let ch = document.createElement('div');
              ch.className = "court-header";
              ch.innerText = "Court: " + currentCourt;
              container.appendChild(ch);
            }
            let div = document.createElement('div');
            div.className = p.checked ? "player-row checked" : "player-row";
            div.setAttribute('data-checked', p.checked ? "true" : "false");
            div.setAttribute('data-name', p.name);
            div.onclick = function() {
              let isChecked = this.getAttribute('data-checked') === "true";
              this.setAttribute('data-checked', !isChecked);
              this.className = !isChecked ? "player-row checked" : "player-row";
              this.querySelector('.check-icon').innerText = !isChecked ? "✅" : "❌";
            };
            
            div.innerHTML = `<span class="player-name">${p.name}</span>
                             <span class="check-icon">${p.checked ? '✅' : '❌'}</span>`;
            container.appendChild(div);
          });
          document.getElementById('saveCheckInBtn').disabled = false;
        }

        function submitCheckIns() {
          const sheetName = document.getElementById('sheetSelect').value;
          const rows = document.querySelectorAll('#playerList .player-row');
          let checkedNames = [];
          rows.forEach(r => { if (r.getAttribute('data-checked') === "true") checkedNames.push(r.getAttribute('data-name')); });
          
          document.getElementById('checkInStatus').innerText = "Saving...";
          document.getElementById('saveCheckInBtn').disabled = true;
          google.script.run.withSuccessHandler(res => {
            document.getElementById('checkInStatus').innerText = res;
            setTimeout(loadCheckInPlayers, 1000);
          }).saveCheckIns(sheetName, checkedNames);
        }

        function lookupPhone() {
          const phone = document.getElementById('phoneInput').value;
          document.getElementById('phoneStatus').innerText = "Searching player...";
          
          google.script.run
            .withSuccessHandler(res => {
              document.getElementById('phoneStatus').innerText = "";
              localStorage.setItem('foursome_phone', phone);
              document.getElementById('phoneEntrySection').style.display = "none";
              document.getElementById('lookupResult').style.display = "block";
              
              currentPlayerData = res;
              document.getElementById('pNameDisplay').innerText = res.playerName;
              document.getElementById('pGroupDisplay').innerText = res.groupName || "N/A";
              document.getElementById('pCourtDisplay').innerText = res.court || "N/A";
              
              if (res.groupName) setSavedGroup(res.groupName);
              
              const statBadge = document.getElementById('pStatusDisplay');
              statBadge.innerText = res.status;
              statBadge.className = "status-badge " + (res.status === "ACTIVE" ? "status-active" : "status-inactive");
              
              const scoreContainer = document.getElementById('scoreInputsContainer');
              scoreContainer.innerHTML = "";

              if (res.foursome && res.foursome.length > 0) {
                document.getElementById('scoreEntrySection').style.display = "block";
                scoreContainer.innerHTML = "<div class='score-grid' style='font-weight:bold; font-size:1rem;'><div>Player</div><div>G1</div><div>G2</div><div>G3</div></div>";
                res.foursome.forEach(p => {
                  scoreContainer.innerHTML += `<div class="score-grid card">
                    <div><b>${p.name}</b></div>
                    <input type="number" id="g1_${p.name}" value="${p.g1}">
                    <input type="number" id="g2_${p.name}" value="${p.g2}">
                    <input type="number" id="g3_${p.name}" value="${p.g3}">
                  </div>`;
                });
              } else {
                document.getElementById('scoreEntrySection').style.display = "none";
              }
            })
            .withFailureHandler(err => {
              document.getElementById('phoneStatus').innerText = err.message;
            })
            .findFoursomeByPhone(phone);
        }

        function clearPhoneCache() {
          localStorage.removeItem('foursome_phone');
          document.getElementById('phoneInput').value = "";
          document.getElementById('lookupResult').style.display = "none";
          document.getElementById('phoneEntrySection').style.display = "block";
          currentPlayerData = null;
        }

        function toggleStatus() {
          document.getElementById('phoneStatus').innerText = "Updating status...";
          google.script.run.withSuccessHandler(() => { lookupPhone(); }).togglePlayerStatus(document.getElementById('phoneInput').value);
        }

        function saveScores() {
          if (!currentPlayerData || !currentPlayerData.foursome) return;
          let scoresMap = {};
          currentPlayerData.foursome.forEach(p => {
            scoresMap[p.name] = {
              g1: document.getElementById('g1_' + p.name).value,
              g2: document.getElementById('g2_' + p.name).value,
              g3: document.getElementById('g3_' + p.name).value
            };
          });
          
          document.getElementById('phoneStatus').innerText = "Submitting scores...";
          google.script.run
            .withSuccessHandler(res => {
              document.getElementById('phoneStatus').innerText = res;
            })
            .submitCourtScores({
              groupName: currentPlayerData.groupName,
              court: currentPlayerData.court,
              scores: scoresMap,
              submitter: currentPlayerData.playerName
            });
        }

        function cancelRegistration() {
          document.getElementById('registrationSection').style.display = "none";
          document.getElementById('phoneEntrySection').style.display = "block";
        }

        function submitRegistration() {
          let data = {
            first: document.getElementById('regFirst').value,
            last: document.getElementById('regLast').value,
            phone: document.getElementById('regPhone').value,
            email: document.getElementById('regEmail').value,
            group: document.getElementById('regGroup').value
          };
          
          document.getElementById('phoneStatus').innerText = "Registering...";
          google.script.run
            .withSuccessHandler(res => {
              document.getElementById('phoneStatus').innerText = res;
              setTimeout(cancelRegistration, 2000);
            })
            .addNewUser(data);
        }

        function loadRankingsAndSched() {
          const group = document.getElementById('groupViewerSelect').value;
          if (!group) return;
          
          document.getElementById('viewerStatus').innerText = "Loading schedule and rankings...";
          google.script.run
            .withSuccessHandler(renderRankingsAndSched)
            .getRankingsAndSchedData(group);
        }

        function renderRankingsAndSched(data) {
          document.getElementById('viewerStatus').innerText = "";
          let html = "";
          let wLabel = data.weekNum; 
          
          if (data.sched && data.sched.length > 0) {
            html += `<h4 style='margin:1rem 0 0.5rem 0;'>🎾 Week ${wLabel} Tentative Court Assignments</h4>`;
            let currentCourt = "";
            data.sched.forEach(row => {
              if (row.court !== currentCourt) {
                if (currentCourt !== "") html += "</div>";
                currentCourt = row.court;
                html += "<div class='card'><div class='court-header'>Court " + currentCourt + "</div>";
              }
              html += "<div style='padding:0.5rem 0; font-size:1.1rem; border-bottom:2px solid var(--row-border);'>" + row.name + "</div>";
            });
            if (currentCourt !== "") html += "</div>";
          }

          if (data.rankings && data.rankings.length > 0) {
            html += `<h4 style='margin:1.5rem 0 0.5rem 0;'>📊 Week ${wLabel} Group Rankings</h4>`;
            html += "<table class='data-table'><thead><tr><th>#</th><th>Player</th><th>Win %</th><th>Pts</th></tr></thead><tbody>";
            data.rankings.forEach(r => { html += `<tr><td><b>${r.rank}</b></td><td>${r.name}</td><td>${r.pct}</td><td>${r.pts}</td></tr>`; });
            html += "</tbody></table>";
          }
          document.getElementById('viewerContent').innerHTML = html;
        }

        function runAdmin(funcName, arg) {
          document.getElementById('adminStatus').innerText = "Processing...";
          google.script.run.withSuccessHandler(res => {
            document.getElementById('adminStatus').innerText = res || "Done.";
          })[funcName](arg);
        }

        function runReschedule() {
          let tab = document.getElementById('adminSchedSelect').value;
          if (!tab) return alert("Select a schedule tab");
          runAdmin('rescheduleFromCheckIns', tab);
        }

        function getAdminPdf() {
          document.getElementById('adminStatus').innerText = "Generating PDF...";
          google.script.run.withSuccessHandler(b64 => {
            document.getElementById('adminStatus').innerHTML = 
              `<a download="Schedule.pdf" href="data:application/pdf;base64,${b64}" style="display:inline-block; margin-top:1rem; padding:0.75rem; background:var(--btn-main-bg); color:var(--btn-main-text); border-radius:0.5rem; text-decoration:none;">⬇ Download PDF Ready</a>`;
          }).webExportSchedulePdf();
        }

        function filterAdminPlayers() {
          const input = document.getElementById('adminPlayerSearch');
          const filter = input.value.toLowerCase();
          const list = document.getElementById('adminPlayerStatusList');
          const rows = list.children; 
          
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].tagName === 'I') continue; 
            const text = rows[i].textContent || rows[i].innerText;
            if (text.toLowerCase().indexOf(filter) > -1) {
              rows[i].style.display = ""; 
            } else {
              rows[i].style.display = "none"; 
            }
          }
        }
        </script>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(htmlContent).setTitle('🥒 SCPB Ladder 🥒').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAddPlayerHtmlOutput() {
  return HtmlService.createHtmlOutput(`
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
  `);
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
  
  // Note: Ladder Name is positioned at Column AF (col index 31)
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
  col.group      = getColIdx(col, ["Ladder Name", "Ladder", "Group"]); // Column AF (index 31) mapped dynamically
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

// Global wrapper to retain signature compatibility
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

// Global wrapper to retain signature compatibility
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
    
    // Sort all score tabs first
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
  const checkedSet = new Set(checkedPlayerNames);

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

  // Search across all group score tabs
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