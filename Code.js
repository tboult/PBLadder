
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

    // TB hack for now
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

      let rankIdx  = findColIdx(["Rank", "R1", "Position"]);
      let numIdx   = findColIdx(["%#", "rnum", "#", "Num"]);
      let nameIdx  = findColIdx(["Name", "Player Name", "Player", "First"]);
      let ptPctIdx = findColIdx(["Point %", "Win %", "Win%", "WinPct", "Win", "Pct", "Win Rate"]);
      let totalIdx = findColIdx(["Total Points", "Total Score", "TotalPoints", "Total", "Points", "Pts", "Tot", "Score"]);
        
      html += `<h4>Ladder Rankings. Note:  Ranking CODE/Model changed. Moved to rank as percent of active instead of absolute number since changing actives sizes often made +-4 limit impossible. Now its +- relative to % rank but even that may be ocassionally violated if you are new or if active sizes changes a lot.</h4>
               <table class="data-table">
                 <thead>
                   <tr>
                     <th>Name</th>
                     <th>Active Rank</th>
                     <th>%#</th>
                     <th>Point %</th>
                     <th>Total Points</th>
                   </tr>
                 </thead>
                 <tbody>`;

      let rankorder = 1;
      let totalPlayers = scData.length - 1;

      for (let r = 1; r < scData.length; r++) {
        let row = scData[r];
        let name = nameIdx !== undefined ? row[nameIdx] : `${row[colMap.first || 0] || ''} ${row[colMap.last || 1] || ''}`.trim();

        if (!name || name === "Player Name" || name.startsWith("---")) continue;

        let rankVal = (rankIdx !== undefined && row[rankIdx]) ? row[rankIdx] : `${rankorder}/${totalPlayers}`;
        let numVal  = (numIdx !== undefined && row[numIdx]) ? row[numIdx] : "";

        let ptPctVal = "0.0%";
        if (ptPctIdx !== undefined && row[ptPctIdx] !== "" && row[ptPctIdx] !== null) {
          let rawWinStr = String(row[ptPctIdx]).replace('%', '').trim();
          let winNum = parseFloat(rawWinStr) || 0;
          if (winNum <= 1.0 && winNum > 0 && !String(row[ptPctIdx]).includes('%')) {
            winNum = winNum * 100;
          }
          ptPctVal = winNum.toFixed(1) + "%";
        }          

        let totalVal = "";
        if (totalIdx !== undefined && row[totalIdx] !== "" && row[totalIdx] !== null) {
          totalVal = row[totalIdx];
        } else {
          // UPDATE: Included Game 4 in fallback summation
          let gameSum = 0;
          let foundGames = false;
          for (let c = 0; c < row.length; c++) {
            let hName = String(headers[c]).toLowerCase();
            if (hName.includes("game") || hName.includes("g1") || hName.includes("g2") || hName.includes("g3") || hName.includes("g4")) {
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
          <td>${numVal}</td>
          <td>${rankVal}</td>
          <td>${ptPctVal}</td>
          <td>${totalVal}</td>
        </tr>`;
        hasData = true;
        rankorder++;
      }
      html += `</tbody></table>`;
    }
  }

  if (!hasData) return { html: `<i>No published schedule or rankings found for '${cleanGroup}'.</i>` };
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
  Logger.log("=== DEBUG addNewUser START ===");
  Logger.log("Received info: " + JSON.stringify(info));

  if (!info.first || !info.last || !info.phone || !info.group) {
    return "Error: First, Last, Phone, and Group are required.";
  }
  
  const targetSheet = getScoreSheetByGroup(info.group);
  if (!targetSheet) return `Error: Target score tab for group '${info.group}' not found.`;
  
  // getDisplayValues ensures formatted text (strings) rather than raw numbers/dates
  const data = targetSheet.getDataRange().getDisplayValues();
  if (!data || data.length === 0) return "Error: Target score sheet is empty.";

  // 1. DYNAMIC HEADER SEARCH (Scans first 5 rows for column headers)
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

  // Fallback to row 0 if no explicit header matches found
  if (headerRowIdx === -1) headerRowIdx = 0;

  Logger.log(`Header Row Index: ${headerRowIdx}`);
  Logger.log(`Column Mapping -> Phone: ${phoneColIdx}, First: ${firstColIdx}, Last: ${lastColIdx}, Name: ${nameColIdx}`);

  // Clean and normalize inputs
  const inputFirst = String(info.first).trim();
  const inputLast = String(info.last).trim();
  const inputFirstLower = inputFirst.toLowerCase();
  const inputLastLower = inputLast.toLowerCase();
  const fullName = `${inputFirst} ${inputLast}`;
  
  const inputPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(info.phone) : String(info.phone);
  const inputPhoneDigits = String(info.phone).replace(/\D/g, "");
  
  const inputEmail = String(info.email || "").trim();
  const inputGroup = String(info.group).trim();
  const inputComment = String(info.comment || "").trim();

  Logger.log(`Clean Input Phone Digits: '${inputPhoneDigits}'`);

  // --- 2. ENFORCE UNIQUE PHONE NUMBER (MATCH LAST 7 DIGITS) ---
  if (phoneColIdx !== -1 && inputPhoneDigits.length >= 7) {
    const inputTail = inputPhoneDigits.slice(-7);

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const rawCellVal = String(data[r][phoneColIdx] || "");
      const existingPhoneDigits = rawCellVal.replace(/\D/g, "");

      if (existingPhoneDigits.length >= 7) {
        const existingTail = existingPhoneDigits.slice(-7);
        
        if (inputTail === existingTail) {
          // Extract existing registered player name
          const existingFirst = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
          const existingLast = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";
          let registeredName = `${existingFirst} ${existingLast}`.trim();
          
          if (!registeredName && nameColIdx !== -1) {
            registeredName = String(data[r][nameColIdx] || "").trim();
          }
          if (!registeredName) registeredName = "an existing player";

          Logger.log(`🛑 BLOCKED: Phone ${inputPhone} matched row ${r + 1} (${registeredName})`);

          return `⚠️ Notice: Phone number ${inputPhone} is already registered to '${registeredName}' in group '${inputGroup}'. If you need to update your name or information, please contact your group captain.`;
        }
      }
    }
  } else {
    Logger.log(`⚠️ WARNING: Phone check skipped! phoneColIdx = ${phoneColIdx}, inputPhoneDigits = ${inputPhoneDigits}`);
  }

  // --- 3. CHECK FOR EXACT OR POTENTIAL NAME MATCHES ---
  let exactMatchRow = -1;
  let potentialMatchRow = -1;
  let missingFields = [];

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const existingFirst = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
    const existingLast = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";

    if (existingFirst.toLowerCase() === inputFirstLower && existingLast.toLowerCase() === inputLastLower) {
      let missing = [];
      if (!existingFirst) missing.push("First Name");
      if (!existingLast) missing.push("Last Name");
      if (phoneColIdx !== -1 && !String(data[r][phoneColIdx] || "").trim()) missing.push("Phone");

      if (missing.length > 0) {
        potentialMatchRow = r + 1;
        missingFields = missing;
        break;
      } else {
        exactMatchRow = r + 1;
        break;
      }
    }
  }

  if (exactMatchRow > -1) {
    ensurePlayerOnSchedSheet(inputGroup, fullName);
    return `⚠️ Notice: User '${fullName}' is already registered in '${targetSheet.getName()}' (Row ${exactMatchRow}).`;
  }

  // --- 4. INSERT NEW PLAYER (NO PHONE OR NAME MATCH FOUND) ---
  Logger.log("No phone or name match found. Inserting new user: " + fullName);
  
  let targetRowNumber = -1;
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const firstVal = firstColIdx !== -1 ? String(data[r][firstColIdx] || "").trim() : "";
    const lastVal = lastColIdx !== -1 ? String(data[r][lastColIdx] || "").trim() : "";
    if (firstVal === "" && lastVal === "") {
      targetRowNumber = r + 1;
      break;
    }
  }

  const numCols = data[headerRowIdx].length;

  if (targetRowNumber > -1) {
    if (firstColIdx !== -1) targetSheet.getRange(targetRowNumber, firstColIdx + 1).setValue(inputFirst);
    if (lastColIdx !== -1) targetSheet.getRange(targetRowNumber, lastColIdx + 1).setValue(inputLast);
    if (phoneColIdx !== -1) targetSheet.getRange(targetRowNumber, phoneColIdx + 1).setValue(inputPhone);
    if (emailColIdx !== -1 && inputEmail) targetSheet.getRange(targetRowNumber, emailColIdx + 1).setValue(inputEmail);
    if (statusColIdx !== -1) targetSheet.getRange(targetRowNumber, statusColIdx + 1).setValue("Inactive");
    if (commentColIdx !== -1 && inputComment) targetSheet.getRange(targetRowNumber, commentColIdx + 1).setValue(inputComment);

    targetSheet.getRange(targetRowNumber, 1, 1, numCols).setBackground("#ffff00");
  } else {
    let newRow = new Array(numCols).fill("");
    if (firstColIdx !== -1) newRow[firstColIdx] = inputFirst;
    if (lastColIdx !== -1) newRow[lastColIdx] = inputLast;
    if (phoneColIdx !== -1) newRow[phoneColIdx] = inputPhone;
    if (emailColIdx !== -1) newRow[emailColIdx] = inputEmail;
    if (statusColIdx !== -1) newRow[statusColIdx] = "Inactive";
    if (commentColIdx !== -1) newRow[commentColIdx] = inputComment;

    targetSheet.appendRow(newRow);
    const lastRow = targetSheet.getLastRow();
    targetSheet.getRange(lastRow, 1, 1, numCols).setBackground("#ffff00");
  }

  ensurePlayerOnSchedSheet(inputGroup, fullName);
  ensurePlayerOnRankingsSheet(inputGroup, fullName); // ADD THIS LINE

  return `✅ Success: Added ${fullName} (Inactive) to tab '${targetSheet.getName()}'.`;
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
 * Evaluates Game 1 through Game 6 and calculates the scaled total for 4-game participants.
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

  const gIdxs = [
    schedHeaders.indexOf("game 1"),
    schedHeaders.indexOf("game 2"),
    schedHeaders.indexOf("game 3"),
    schedHeaders.indexOf("game 4"),
    schedHeaders.indexOf("game 5"),
    schedHeaders.indexOf("game 6")
  ];

  if (scoreIdx === -1) return warnings;

  let schedMapByPhoneKey = {};
  let schedMapByFirstLastKey = {};
  let schedMapByNameKey = {};
  let hasAnySchedData = false;
  let schedModified = false;

  for (let r = 1; r < schedData.length; r++) {
    let rawSchedName = schedData[r][nameIdx];
    if (!rawSchedName || String(rawSchedName).startsWith("---") || String(rawSchedName).toLowerCase().startsWith("time:")) continue;

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
      finalValToUse = (playedCount === 4) ? Math.round(computedSum * 0.75) : computedSum;

      if (isNaN(recordedTotal) || Math.abs(finalValToUse - recordedTotal) > 0.001) {
        let oldVal = isNaN(recordedTotal) ? "(blank)" : recordedTotal;
        warnings.push(`Sched Mismatch [${rawSchedName}]: Sum of games is ${computedSum} (${playedCount} played), but Total was ${oldVal}. Corrected to ${finalValToUse}.`);
        schedData[r][scoreIdx] = finalValToUse;
        schedModified = true;
      }
    } else if (!isNaN(recordedTotal)) {
      finalValToUse = recordedTotal;
    }

    let schedInfo = { score: finalValToUse, court: rawCourt };

    if (phoneDigits && phoneDigits.length >= 7) schedMapByPhoneKey[phoneDigits.slice(-7)] = schedInfo;
    if (schedFirst && schedLast) schedMapByFirstLastKey[schedFirst + "_" + schedLast] = schedInfo;
    if (normName) schedMapByNameKey[normName] = schedInfo;
    hasAnySchedData = true;
  }

  if (schedModified) {
    schedSheet.getRange(1, 1, schedData.length, schedData[0].length).setValues(schedData);
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

    if (scorePhoneDigits && scorePhoneDigits.length >= 7) schedInfo = schedMapByPhoneKey[scorePhoneDigits.slice(-7)];
    if (schedInfo === undefined && normFirst && normLast) schedInfo = schedMapByFirstLastKey[normFirst + "_" + normLast];
    if (schedInfo === undefined && normName) schedInfo = schedMapByNameKey[normName];

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

/* ---------- rank-string parser ---------------------------------------
 * Accepts:  23/49   23R49   23/49-R   23/49-r   23/49-I
 *           17.6%   17.6%-R   17.6%-r   17.6%-I   23
 * Uppercase R = upward movement was capped.
 * Lowercase r = downward movement was capped.
 * --------------------------------------------------------------------- */

function safeParseRankVal(val, defaultPrevRank, currentPopulation) {
  currentPopulation = Number(currentPopulation) || 0;

  const empty = {
    rank: defaultPrevRank,
    numPeople: 0,
    percent: null,
    restriction: "",
    isRestricted: false,
    isInactive: false,
    isPercent: false,
    hasPrior: false,
    isSuspect: false,
    rawStr: ""
  };

  if (val === null || val === undefined || val === "") return empty;

  let str = (val instanceof Date)
    ? ((val.getMonth() + 1) + "/" + val.getDate())
    : String(val).trim();

  str = str.replace(/^'/, "").trim();
  if (!str) return empty;

  const raw = str;

  /* Trailing directional suffix. Case matters: R != r. */
  let restriction = "";
  const sfx = str.match(/-\s*([RrIi])\s*$/);
  if (sfx) {
    restriction = (sfx[1] === "i") ? "I" : sfx[1];
    str = str.replace(/-\s*([RrIi])\s*$/, "").trim();
  }

  /* Percentile form: 17.6% */
  const pm = str.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pm) {
    const pct = Number(pm[1]);
    let rank = defaultPrevRank;
    if (currentPopulation > 0 && isFinite(pct)) {
      rank = Math.round((pct / 100) * currentPopulation);
      rank = Math.max(1, Math.min(currentPopulation, rank));
    }
    return {
      rank: rank,
      numPeople: currentPopulation,
      percent: pct,
      restriction: restriction,
      isRestricted: (restriction === "R" || restriction === "r"),
      isInactive: (restriction === "I"),
      isPercent: true,
      hasPrior: true,
      isSuspect: !(pct >= 0 && pct <= 100),
      rawStr: raw
    };
  }

  /* Fraction or compact form: 23/49 or 23R49 */
  const fm = str.match(/^(\d+)\s*(?:\/|[Rr])\s*(\d+)$/);
  if (fm) {
    let rank = parseInt(fm[1], 10);
    let numPeople = parseInt(fm[2], 10);
    if (!isFinite(rank) || rank <= 0) rank = defaultPrevRank;
    if (!isFinite(numPeople) || numPeople < 0) numPeople = 0;
    return {
      rank: rank,
      numPeople: numPeople,
      percent: (numPeople > 0) ? (rank / numPeople) * 100 : null,
      restriction: restriction,
      isRestricted: (restriction === "R" || restriction === "r"),
      isInactive: (restriction === "I"),
      isPercent: false,
      hasPrior: true,
      /* rank cannot exceed field size; flags corrupted history */
      isSuspect: (numPeople > 0 && rank > numPeople),
      rawStr: raw
    };
  }

  /* Bare integer */
  const nm = str.match(/^(\d+)$/);
  if (nm) {
    const rank = parseInt(nm[1], 10);
    return {
      rank: (rank > 0) ? rank : defaultPrevRank,
      numPeople: 0,
      percent: null,
      restriction: restriction,
      isRestricted: (restriction === "R" || restriction === "r"),
      isInactive: (restriction === "I"),
      isPercent: false,
      hasPrior: true,
      isSuspect: false,
      rawStr: raw
    };
  }

  const bad = Object.assign({}, empty);
  bad.rawStr = raw;
  bad.isSuspect = true;
  return bad;
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
  /* The newcomer band depends only on how many newcomers there are,
   * so it is identical on every iteration of the feasibility search. */
  let newCount = 0;
  items.forEach(function (p) { if (p.isNew) newCount++; });

  const bandStart = (NEW_PLAYER_POLICY === "BOTTOM_BAND" && newCount > 0)
    ? Math.max(1, numSlots - newCount - NEW_PLAYER_SLACK + 1)
    : 1;

  items.forEach(function (p) {
    if (p.isNew && NEW_PLAYER_POLICY === "BOTTOM_BAND") {
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

/* ---------- one complete ranking pass --------------------------------- */

function computeBoundedRanks(sourcePlayers, numActive, baseMove, isScaledMode) {
  let returnerCount = 0;
  sourcePlayers.forEach(function (p) { if (p.hasPrior) returnerCount++; });

  /* Returners compete for the slots above the newcomer band, so the
   * prior standing is scaled into that space, not the whole field. */
  const pool = (SCALE_AGAINST_RETURNER_POOL && returnerCount > 0)
    ? returnerCount
    : numActive;

  const items = sourcePlayers.map(function (p) {
    const item = {
      uid: p.rowIndex,
      name: p.name,
      sortVal: p.sortVal,
      cumPct: p.cumPct,
      hasPrior: p.hasPrior,
      priorRank: p.priorRank,
      priorNumPeople: p.priorNumPeople,
      priorPercent: p.priorPercent,
      isNew: !p.hasPrior
    };

    if (item.isNew) {
      /* Recorded for the log only; the band in applyWindows governs. */
      item.effectivePrevRank = numActive;
      return item;
    }

    let eff;
    if (isScaledMode) {
      let pct = item.priorPercent;
      if (pct === null || pct === undefined) {
        pct = (item.priorNumPeople > 0)
          ? (item.priorRank / item.priorNumPeople) * 100
          : null;
      }
      eff = (pct === null) ? item.priorRank : (pct / 100) * pool;
    } else {
      eff = item.priorRank;
    }

    item.effectivePrevRank =
      Math.max(1, Math.min(pool, Math.round(eff)));
    return item;
  });

  const windowUsed = findSmallestFeasibleWindow(items, baseMove, numActive);
  const bandStart = applyWindows(items, windowUsed, numActive);
  assignRanksWithinWindows(items, numActive);

  const seen = {};
  items.forEach(function (p) {
    if (seen[p.finalRank]) {
      throw new Error("Duplicate final rank " + p.finalRank +
        " for " + p.name + ".");
    }
    seen[p.finalRank] = true;

    if (p.finalRank < p.minAllowed || p.finalRank > p.maxAllowed) {
      throw new Error("Illegal rank " + p.finalRank + " for " + p.name +
        " (window " + p.minAllowed + "-" + p.maxAllowed + ").");
    }
  });

  items.forEach(function (p) {
    let suffix = "";

    if (p.isNew) {
      if (MARK_NEW_PLAYERS) {
        suffix = "-N";
      } else if (p.sortVal < p.minAllowed) {
        suffix = "-R";
      }
    } else if (p.sortVal < p.minAllowed) {
      suffix = "-R";              /* earned better, held back */
    } else if (p.sortVal > p.maxAllowed) {
      suffix = "-r";              /* earned worse, protected */
    }

    p.restrictionSuffix = suffix;
    p.isRestricted = (suffix !== "");
    p.percentile = (p.finalRank / numActive) * 100;

    p.outStr = isScaledMode
      ? (p.percentile.toFixed(1) + "%" + suffix)
      : (p.finalRank + "/" + numActive + suffix);
  });

  return {
    items: items,
    windowUsed: windowUsed,
    bandStart: bandStart,
    pool: pool
  };
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
 *  MAIN
 * ========================================================================= */

function processWeeklyScoresForSheet(sheet, forcedWeek, updateScores = true, useScaledRankAsPrimary = true) {
  const doUpdateScores  = (updateScores === false) ? false : true;
  const primaryIsScaled = (useScaledRankAsPrimary === false) ? false : true;

  return executeWithLock(function () {
    const ss = (typeof getDb === "function")
      ? getDb()
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!sheet) sheet = ss.getActiveSheet();
    if (typeof checkAndRunWeeklyBackup === "function") checkAndRunWeeklyBackup();

    const cleanGroupName = sheet.getName().replace(/^Score\s+/i, "").trim();
    const schedSheet =
      ss.getSheetByName("Sched " + cleanGroupName) ||
      ss.getSheetByName("Sched") ||
      ss.getSheetByName("Schedule");

    let backupScore, backupSched;
    const ts = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "HHmmss");

    function safeDeleteTemp(name) {
      try {
        const ex = ss.getSheetByName(name);
        if (ex) {
          ss.deleteSheet(ex);
          SpreadsheetApp.flush();
        }
      } catch(e) {}
    }

    if (sheet) {
      const bName = "TmpBkup_Score_" + ts;
      safeDeleteTemp(bName);
      backupScore = sheet.copyTo(ss);
      backupScore.setName(bName);
      backupScore.hideSheet();
    }
    if (schedSheet) {
      const bName = "TmpBkup_Sched_" + ts;
      safeDeleteTemp(bName);
      backupSched = schedSheet.copyTo(ss);
      backupSched.setName(bName);
      backupSched.hideSheet();
    }
    
    SpreadsheetApp.flush();

    try {
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        throw new Error("No player data on tab: " + sheet.getName());
      }

      const headerRow = data[0];
      const col = (typeof buildColMap === "function") ? buildColMap(headerRow) : {};

      if (col.first === undefined) col.first = headerRow.findIndex(h => /first/i.test(h));
      if (col.last === undefined) col.last = headerRow.findIndex(h => /last/i.test(h));

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
      } else {
        weekNum = (typeof calculateCurrentWeekNumber === "function") ? calculateCurrentWeekNumber() : 1;
      }

      const targetWeekIdx = resolveCol(col, headerRow, ["w" + weekNum, "W" + weekNum, "Week " + weekNum]);
      const currRColIdx   = resolveCol(col, headerRow, ["r" + weekNum, "R" + weekNum]);
      const prevRColIdx   = resolveCol(col, headerRow, ["r" + (weekNum - 1), "R" + (weekNum - 1)]);

      // Harvest and sync scores from Sched sheet
      if (updateScores) {
        if (typeof harvestScoresFromSchedules === "function") {
          const warnings = harvestScoresFromSchedules(ss, data, col, targetWeekIdx, schedSheet, weekNum);
          if (warnings && warnings.length > 0) {
            const warnMsg = "⚠️ Disagreements Found and Auto-Corrected:\n\n" + warnings.join("\n") + 
                            "\n\nThe Score sheet and Schedule totals have been corrected. Rankings will now be calculated using the corrected sums.";
            try { SpreadsheetApp.getUi().alert("Auto-Corrections Applied", warnMsg, SpreadsheetApp.getUi().ButtonSet.OK); } 
            catch (e) { Logger.log("Mismatches auto-corrected: " + warnMsg); }
          }
        }

        if (ptsColIdx !== undefined && targetWeekIdx !== undefined) {
          for (let i = 1; i < data.length; i++) {
            const v = data[i][ptsColIdx];
            data[i][targetWeekIdx] = (v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v))) ? parseFloat(v) : "";
          }
        }
      }

      let numActive = 0;
      for (let i = 1; i < data.length; i++) {
        const nm = (col.name !== undefined && data[i][col.name])
          ? data[i][col.name].toString().trim()
          : ((data[i][col.first] || "") + " " + (data[i][col.last] || "")).trim();
        if (!nm) continue;
        const v = (targetWeekIdx !== undefined) ? data[i][targetWeekIdx] : "";
        if (v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v))) numActive++;
      }
      if (numActive === 0) throw new Error("No active players this week.");

      const defaultPrevRank = numActive;
      const activePlayers = [];
      const inactivePlayers = [];
      const suspectHistory = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const firstName = (col.first !== undefined) ? String(row[col.first] || "").trim() : "";
        const lastName = (col.last !== undefined) ? String(row[col.last] || "").trim() : "";
        const pName = (col.name !== undefined && row[col.name]) ? row[col.name].toString().trim() : (firstName + " " + lastName).trim();
        if (!pName) continue;

        const phoneColIdx = col.phone !== undefined ? col.phone : col.mobile;
        const pPhone = phoneColIdx !== undefined ? cleanPhoneDigits(row[phoneColIdx]) : "";

        const v = (targetWeekIdx !== undefined) ? row[targetWeekIdx] : "";
        const hasScore = (v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v)));

        let cumScore = 0; let weeksPlayed = 0;
        for (let w = 1; w <= 10; w++) {
          const wCol = resolveCol(col, headerRow, ["w" + w, "W" + w]);
          if (wCol !== undefined && row[wCol] !== "" && row[wCol] !== null) {
            const val = parseFloat(row[wCol]);
            if (!isNaN(val)) { cumScore += val; if (val > 0) weeksPlayed++; }
          }
        }

        const maxPts = MAX_POINTS_PER_WEEK * weeksPlayed;
        const cumPct = (maxPts > 0) ? (cumScore / maxPts) : 0;
        const prevCell = (prevRColIdx !== undefined) ? row[prevRColIdx] : "";
        const prev = safeParseRankVal(prevCell, defaultPrevRank, numActive);

        if (prev.isSuspect && prev.rawStr) suspectHistory.push(pName + ": " + prev.rawStr);

        const rawStatus = (col.status !== undefined && row[col.status] !== undefined && row[col.status] !== "") ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";

        const obj = {
          rowIndex: i, rowRaw: row.slice(), name: pName, firstName: firstName, lastName: lastName, phone: pPhone, isActive: hasScore, status: rawStatus, 
          cumScore: cumScore, maxPtsForPlayedWeeks: maxPts, cumPct: cumPct,
          hasPrior: prev.hasPrior, priorRank: prev.rank, priorNumPeople: prev.numPeople, priorPercent: prev.percent, priorRawStr: prev.rawStr
        };

        if (hasScore) activePlayers.push(obj);
        else inactivePlayers.push(obj);
      }

      const maxMove = (typeof MAX_MOVEMENT !== "undefined") ? Number(MAX_MOVEMENT) : 4;

      activePlayers.sort(function (a, b) {
        if (Math.abs(b.cumPct - a.cumPct) > 0.0001) return b.cumPct - a.cumPct;
        const pa = a.hasPrior ? a.priorRank : defaultPrevRank;
        const pb = b.hasPrior ? b.priorRank : defaultPrevRank;
        if (pa !== pb) return pa - pb;
        return b.priorNumPeople - a.priorNumPeople;
      });
      
      activePlayers.forEach(function (p, i) { p.sortVal = i + 1; p.rawRank = i + 1; });

      const scaled   = computeBoundedRanks(activePlayers, numActive, maxMove, true);
      const absolute = computeBoundedRanks(activePlayers, numActive, maxMove, false);

      const scaledByRow = {}; scaled.items.forEach(function (r) { scaledByRow[r.uid] = r; });
      const absByRow = {}; absolute.items.forEach(function (r) { absByRow[r.uid] = r; });

      activePlayers.forEach(function (p) {
        const s = scaledByRow[p.rowIndex];
        const a = absByRow[p.rowIndex];
        if (!s || !a) throw new Error("Missing method result for row " + p.rowIndex);

        if (primaryIsScaled) {
          p.primaryStr = s.outStr; p.primaryFinalRank = s.finalRank; p.primaryIsRestr = s.isRestricted; p.method2Str = a.outStr;
        } else {
          p.primaryStr = a.outStr; p.primaryFinalRank = a.finalRank; p.primaryIsRestr = a.isRestricted; p.method2Str = s.outStr;
        }
        p.diagSortVal = p.sortVal; p.diagNewLeft = p.primaryFinalRank;
      });

      inactivePlayers.forEach(function (p) {
        p.primaryFinalRank = numActive + 1;
        p.primaryStr = formatInactiveStanding(p, primaryIsScaled);
        p.method2Str  = formatInactiveStanding(p, !primaryIsScaled);
      });

      const writeRowData = (p, statusOverride) => {
        if (col.group !== undefined) p.rowRaw[col.group] = cleanGroupName;
        if (totColIdx !== undefined) p.rowRaw[totColIdx] = p.cumScore;
        if (posColIdx !== undefined) p.rowRaw[posColIdx] = p.maxPtsForPlayedWeeks;
        if (pctColIdx !== undefined) p.rowRaw[pctColIdx] = p.cumPct;
        if (col.status !== undefined) p.rowRaw[col.status] = statusOverride || p.status;
        if (rawRankColIdx !== undefined) p.rowRaw[rawRankColIdx] = p.sortVal || "";
        if (sortValColIdx !== undefined) p.rowRaw[sortValColIdx] = p.diagSortVal || "";
        if (newLeftColIdx !== undefined) p.rowRaw[newLeftColIdx] = p.diagNewLeft || "";
        if (lastRColIdx !== undefined) p.rowRaw[lastRColIdx] = p.method2Str;
        if (currRColIdx !== undefined) p.rowRaw[currRColIdx] = String(p.primaryStr || "").replace(/^'/, "");
        if (rNumIdx !== undefined) p.rowRaw[rNumIdx] = p.isActive ? (p.primaryIsRestr ? ((p.cumPct * 100).toFixed(2) + "R") : (p.cumPct * 100).toFixed(2)) : "";
      };

      activePlayers.forEach(p => writeRowData(p, "ACTIVE"));
      inactivePlayers.forEach(p => writeRowData(p));
      
      // Sort Active by computed rank
      activePlayers.sort((a, b) => a.primaryFinalRank - b.primaryFinalRank);

      // Sort Inactive strictly by prior rank
      inactivePlayers.sort((a, b) => {
        const pa = a.hasPrior ? a.priorRank : 99999;
        const pb = b.hasPrior ? b.priorRank : 99999;
        if (pa !== pb) return pa - pb;
        return (b.priorNumPeople || 0) - (a.priorNumPeople || 0);
      });

      const finalRows = [headerRow];
      activePlayers.forEach(p => finalRows.push(p.rowRaw));
      inactivePlayers.forEach(p => finalRows.push(p.rowRaw));

      if (currRColIdx !== undefined) sheet.getRange(1, currRColIdx + 1, finalRows.length, 1).setNumberFormat('@');
      if (lastRColIdx !== undefined) sheet.getRange(1, lastRColIdx + 1, finalRows.length, 1).setNumberFormat('@');

      if (typeof updateRankingsSheetForGroup === "function") {
        updateRankingsSheetForGroup(ss, cleanGroupName, activePlayers, inactivePlayers, weekNum);
      }

      sheet.clearContents();
      sheet.getRange(1, 1, finalRows.length, finalRows[0].length).setValues(finalRows);
      SpreadsheetApp.flush();

      try {
        if (backupScore) ss.deleteSheet(backupScore);
        if (backupSched) ss.deleteSheet(backupSched);
        SpreadsheetApp.flush();
      } catch (e) {
        Logger.log("Safe ignore: Failed to delete temp backup sheet: " + e.message);
      }

      const primaryName = primaryIsScaled ? "Percentile-scaled" : "Absolute";
      let msg = "Alert: Processed '" + sheet.getName() + "'. " + numActive + " active, " + inactivePlayers.length + " inactive.";

      // Reorder Schedule sheet while keeping scores strictly coupled to player names
      if (typeof rebuildSchedSheetOrder === "function") {
        rebuildSchedSheetOrder(ss, cleanGroupName, activePlayers, inactivePlayers, weekNum);
      }

      return msg;

    } catch (error) {
      try {
        if (backupScore && sheet) {
          sheet.clear();
          backupScore.getDataRange().copyTo(sheet.getRange(1, 1));
          ss.deleteSheet(backupScore);
        }
        if (backupSched && schedSheet) {
          schedSheet.clear();
          backupSched.getDataRange().copyTo(schedSheet.getRange(1, 1));
          ss.deleteSheet(backupSched);
        }
        SpreadsheetApp.flush();
      } catch (restoreErr) {}
      return "Processing failed. Data restored. Error: " + error.message;
    }
  });
}





/**
 * Writes the Rankings tab for one group.
 *
 * Reads the new engine's properties:
 *   p.primaryStr       standing string under the primary method
 *                      ("17.9%-R" percentile, "5/28-R" absolute)
 *   p.method2Str       standing string under the secondary method
 *   p.primaryFinalRank integer 1..N, or numActive+1 for inactive rows
 *
 * p.rjStr is no longer produced and is read only as a legacy fallback.
 */
function updateRankingsSheetForGroup(ss, groupName, activePlayers,
                                     inactivePlayers, weekNum) {

  /* Set false to drop the Method 2 comparison column once the
   * percentile method is accepted by the players. */
  const SHOW_METHOD2 = false;

  const rankSheetName = "Rankings " + groupName;
  const rankSheet = ss.getSheetByName(rankSheetName)
    || ss.insertSheet(rankSheetName);

  rankSheet.clear();

  const header = ["Rank %", "#", "Name", "Point %", "Total Points"];
  if (SHOW_METHOD2) header.push("Method 2");
  const rankOut = [header];

  function standingOf(p, fallback) {
    const v = (p.primaryStr !== undefined && p.primaryStr !== null
               && p.primaryStr !== "")
      ? p.primaryStr
      : p.rjStr;                       /* legacy fallback */
    if (v === null || v === undefined || v === "") return fallback;
    return String(v).replace(/^'/, "").trim() || fallback;
  }

  function method2Of(p) {
    if (p.method2Str === undefined || p.method2Str === null) return "";
    return String(p.method2Str).replace(/^'/, "").trim();
  }

  function pushRow(p, standingFallback, numberCell) {
    const pctVal = (p.cumPct !== undefined) ? p.cumPct : (p.winPct || 0);
    const scoreVal = (p.cumScore !== undefined) ? p.cumScore : (p.total || 0);

    const row = [
      standingOf(p, standingFallback),
      numberCell,
      p.name,
      (pctVal * 100).toFixed(1) + "%",
      scoreVal
    ];
    if (SHOW_METHOD2) row.push(method2Of(p));
    rankOut.push(row);
  }

  /* Active rows ordered by the primary method, not by merit. */
  const actives = (activePlayers || []).slice().sort(function (a, b) {
    const ra = (a.primaryFinalRank !== undefined)
      ? a.primaryFinalRank : Number.MAX_SAFE_INTEGER;
    const rb = (b.primaryFinalRank !== undefined)
      ? b.primaryFinalRank : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (b.cumPct || 0) - (a.cumPct || 0);
  });

  actives.forEach(function (p) {
    pushRow(p, "", (p.primaryFinalRank !== undefined)
      ? p.primaryFinalRank : "");
  });

  /* Inactive rows keep their carried-forward standing, already "-I". */
  const inactives = (inactivePlayers || []).slice().sort(function (a, b) {
    return (b.cumPct || 0) - (a.cumPct || 0);
  });

  inactives.forEach(function (p) {
    pushRow(p, "INACTIVE", "");
  });

  const width = header.length;
  const range = rankSheet.getRange(1, 1, rankOut.length, width);

  /* Text format on the standing columns only, so "17.9%-R" and "5/28-R"
   * survive and Total Points stays numeric and sortable. */
  rankSheet.getRange(1, 1, rankOut.length, 1).setNumberFormat("@");
  rankSheet.getRange(1, 4, rankOut.length, 1).setNumberFormat("@");
  if (SHOW_METHOD2) {
    rankSheet.getRange(1, width, rankOut.length, 1).setNumberFormat("@");
  }

  range.setValues(rankOut);
  rankSheet.getRange(1, 1, 1, width).setFontWeight("bold");
  rankSheet.setFrozenRows(1);

if (weekNum !== undefined && weekNum !== null && weekNum !== "") {
    rankSheet.getRange(1, 1).setNote(
      "Week " + weekNum + " standings.\n" +
      "Rank column uses the primary method.\n" +
      "-R upward movement capped, -r drop limited,\n" +
      "-i active player (but did not play this week),\n" +
      "-I inactive roster player."
    );
  }
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

        const cleanStr = str => String(str || "").replace(/[\u00A0\s]+/g, " ").trim().toLowerCase();
        const getDigits = val => String(val || "").replace(/\D/g, "");

        // Extract full name and phone from targetPlayer input
        let targetName = "";
        let targetPhone = "";
        if (typeof targetPlayer === 'object' && targetPlayer !== null) {
          targetName = targetPlayer.name || `${targetPlayer.first || ''} ${targetPlayer.last || ''}`.trim();
          targetPhone = targetPlayer.phone || targetPlayer.cell || targetPlayer.mobile || "";
        } else {
          targetName = String(targetPlayer || "");
          targetPhone = targetName; // Might be a phone number string
        }

        const targetNorm = cleanStr(targetName);
        const targetDigits = getDigits(targetPhone);

        players = players.map(p => {
          const pName = cleanStr(p.name || `${p.first || ''} ${p.last || ''}`);
          const pPhoneDigits = getDigits(p.phone);

          // EXACT Full Name Match OR Phone Digits Match (last 7 digits)
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

  return result;
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

  // Robust Phone Digits Extractor
  const getDigits = val => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'number') return val.toFixed(0); 
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
  if (phoneIdx === -1) phoneIdx = 9;    // Default Col J (index 9)

  // Extract full name and phone number targets
  let targetFullName = "";
  let targetPhone = "";

  if (typeof targetPlayer === 'object' && targetPlayer !== null) {
    targetFullName = targetPlayer.name || `${targetPlayer.first || ''} ${targetPlayer.last || ''}`.trim();
    targetPhone = targetPlayer.phone || targetPlayer.cell || targetPlayer.mobile || "";
  } else {
    targetFullName = String(targetPlayer || "");
    targetPhone = targetFullName; // Could be phone string
  }

  const targetNorm = cleanStr(targetFullName);
  const targetDigits = getDigits(targetPhone);
  
  let found = false;
  const updateTime = timestamp || new Date();

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    let pName = cleanStr(data[r][nameIdx]);
    let pPhone = phoneIdx !== -1 && data[r][phoneIdx] ? getDigits(data[r][phoneIdx]) : "";
    
    if (!pName && !pPhone) continue;

    // EXACT Full Name Match OR Phone Digits Match (last 7 digits)
    const nameMatch = targetNorm && pName === targetNorm;
    const phoneMatch = targetDigits.length >= 7 && pPhone.length >= 7 && pPhone.endsWith(targetDigits.slice(-7));

    if (nameMatch || phoneMatch) {
      // Write Timestamp when checking in; write blank string "" when checking out
      const checkInValue = checkedState ? updateTime : "";
      schedSheet.getRange(r + 1, checkInIdx + 1).setValue(checkInValue);
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, message: `Player '${targetFullName || targetPlayer}' not found on sheet` };
  }

  // Safe execution for Score Sheet timestamp update
  if (checkedState && typeof updateScoreSheetTimestamp === 'function') {
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

    function extractLastName(fullName) {
      const str = cleanStr(fullName).toLowerCase();
      if (!str) return "";
      if (str.includes(",")) return str.split(",")[0].trim();
      const parts = str.split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : parts[0];
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
            scoreRow: r + 1,
            used: false
          });
        }
      }
    }

    const finalRoster = [];
    let syncedCount = 0;
    const newScoreRowsToAppend = [];

    if (schedSheet) {
      const schedData = schedSheet.getDataRange().getValues();
      if (schedData.length > 1) {
        const headers = schedData[0].map(h => cleanStr(h).toLowerCase());

        const matchedNameIdx = headers.findIndex(h => /name|player/i.test(h));
        const nameIdx = matchedNameIdx !== -1 ? matchedNameIdx : (schedData[0].length > 1 ? 1 : 0);
        const schedPhoneIdx = headers.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
        let checkIdx = headers.findIndex(h => /check|checked|x/i.test(h));
        const courtIdx = headers.findIndex(h => /court/i.test(h));

        let totalIdx = headers.findIndex(h => /^total$|^pts$\vert{}^score$/i.test(h));
        if (totalIdx === -1) totalIdx = 6;

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

          const schedRow = r + 1;
          const normFull = pName.toLowerCase();
          const normLast = extractLastName(pName);
          const schedPhone = schedPhoneIdx !== -1 ? cleanStr(schedData[r][schedPhoneIdx]).replace(/\D/g, "") : "";

          let rawCheck = checkIdx !== -1 ? schedData[r][checkIdx] : false;
          
          // NON-BLANK CHECK-IN EVALUATION
          let isCheckedIn = (typeof isCheckInTrue === 'function')
            ? isCheckInTrue(rawCheck)
            : (rawCheck !== null && rawCheck !== undefined && String(rawCheck).trim() !== "");

          const rawCourt = courtIdx !== -1 ? cleanStr(schedData[r][courtIdx]) : "";
          const courtVal = rawCourt || fallbackCourt;
          const schedScore = cleanScore(schedData[r][totalIdx]);

          let match = null;

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
              newRow[scorePtsIdx] = schedScore;

              newScoreRowsToAppend.push(newRow);
              syncedCount++;
            }
          }
        }
      }
    }

    scoreUpdates.forEach(u => scoreSheet.getRange(u.row, u.col).setValue(u.val));
    schedUpdates.forEach(u => schedSheet.getRange(u.row, u.col).setValue(u.val));

    if (scoreSheet && newScoreRowsToAppend.length > 0) {
      const startRow = scoreSheet.getLastRow() + 1;
      scoreSheet.getRange(startRow, 1, newScoreRowsToAppend.length, newScoreRowsToAppend[0].length).setValues(newScoreRowsToAppend);
    }

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

  const cacheKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(schedSheetName) : null;
  if (cacheKey && typeof CacheService !== 'undefined') {
    try { CacheService.getScriptCache().remove(cacheKey); } catch (e) {}
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
 * 1. PRUNES rows on Sched sheet for players who were DELETED or marked INACTIVE/QUIT on Score sheet.
 * 2. SYNCS valid players from Score sheet who are missing from Sched sheet.
 *
 * @param {Spreadsheet} ss - Active Spreadsheet object
 * @param {string} cleanGroup - Clean group name (e.g., "Mens", "Womens")
 * @param {Sheet} schedSheet - Target 'Sched [Group]' sheet object
 * @returns {Object} { addedCount, prunedCount }
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

    // 1. Locate columns on Score sheet
    let firstIdx = scoreHeaders.findIndex(h => /first|fname|f_name/i.test(h));
    let lastIdx = scoreHeaders.findIndex(h => /last|lname|l_name/i.test(h));
    let singleNameIdx = scoreHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
    let statusIdx = scoreHeaders.findIndex(h => /status|active|state/i.test(h));

    const isSeparateFirstLast = (firstIdx !== -1 && lastIdx !== -1);

    // Token normalize helper ("John Smith" === "smith john")
    const getTokensKey = (str) => {
      const tokens = String(str || "").toLowerCase().match(/[a-z0-9]+/g) || [];
      return tokens.sort().join(" ");
    };

    // 2. Build Set of valid roster full names currently on Score [Group]
    const validScoreRosterSet = new Set();
    const validScoreRosterList = [];

    for (let r = 1; r < scoreData.length; r++) {
      const row = scoreData[r];
      const statusVal = statusIdx !== -1 ? String(row[statusIdx] || '').toUpperCase().trim() : "ACTIVE";

      // Skip non-active statuses if your sheet marks them as QUIT/INACTIVE
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

      const tokenKey = getTokensKey(fullName);
      if (tokenKey) {
        validScoreRosterSet.add(tokenKey);
        validScoreRosterList.push(fullName);
      }
    }

    // 3. Read current Sched sheet rows & PRUNE deleted players
    const schedData = schedSheet.getDataRange().getValues();
    if (schedData.length <= 1) return { addedCount: 0, prunedCount: 0 };

    const schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
    let schedNameIdx = schedHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
    if (schedNameIdx === -1) schedNameIdx = 0;

    const existingSchedTokens = new Set();
    let rowsToKeep = [schedData[0]]; // Retain header row
    let prunedCount = 0;

    for (let r = 1; r < schedData.length; r++) {
      const pName = String(schedData[r][schedNameIdx] || '').trim();
      const tokenKey = getTokensKey(pName);

      if (!pName) continue;

      // Keep row ONLY if player is still present on Score sheet
      if (validScoreRosterSet.has(tokenKey)) {
        existingSchedTokens.add(tokenKey);
        rowsToKeep.push(schedData[r]);
      } else {
        prunedCount++;
        Logger.log(`✂️ Pruned deleted player '${pName}' from '${schedSheet.getName()}'.`);
      }
    }

    // Rewrite Sched sheet if any ghost rows were pruned
    if (prunedCount > 0) {
      schedSheet.clearContents();
      schedSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }

    // 4. ADD missing roster players from Score sheet to bottom of Sched sheet
    const missingPlayers = validScoreRosterList.filter(name => !existingSchedTokens.has(getTokensKey(name)));

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
    const getTokensKey = (str) => {
      const tokens = String(str || "").toLowerCase().match(/[a-z0-9]+/g) || [];
      return tokens.sort().join(" ");
    };
    const targetTokenKey = getTokensKey(cleanTarget);

    // -------------------------------------------------------------
    // 1. STRICT ROSTER VERIFICATION (Score [cleanGroup] ONLY)
    // -------------------------------------------------------------
    const scoreSheet = ss.getSheetByName(scoreSheetName);
    if (!scoreSheet) {
      return { status: "failed", success: false, message: `Score sheet '${scoreSheetName}' not found.` };
    }

    const scoreData = scoreSheet.getDataRange().getValues();
    let isRosterMember = false;
    let matchedOfficialName = "";

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

        // Ignore players marked quit/dropped/inactive
        if (/QUIT|DROPPED|REMOVED|INACTIVE/i.test(statusVal)) continue;

        let rowFirst = firstIdx !== -1 ? String(row[firstIdx] || '').trim() : '';
        let rowLast = lastIdx !== -1 ? String(row[lastIdx] || '').trim() : '';
        let rowFullName = (rowFirst || rowLast) ? `${rowFirst} ${rowLast}`.trim() : (singleNameIdx !== -1 ? String(row[singleNameIdx] || '').trim() : '');

        if (!rowFullName || /^total|^summary|^average|^rank/i.test(rowFullName)) continue;

        let rowPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').replace(/\D/g, '') : '';

        let isPhoneMatch = targetDigits.length >= 7 && rowPhone.length >= 7 && rowPhone.endsWith(targetDigits.slice(-7));
        let isNameMatch = targetTokenKey && getTokensKey(rowFullName) === targetTokenKey;

        if (isPhoneMatch || isNameMatch) {
          isRosterMember = true;
          matchedOfficialName = rowFullName;
          break;
        }
      }
    }

    // 🛑 REJECT CHECK-IN IF NOT ON THIS LADDER'S SCORE SHEET
    if (!isRosterMember) {
      Logger.log(`⛔ Check-in rejected for '${cleanTarget}': Not on '${scoreSheetName}'.`);
      return {
        status: "not_found",
        success: false,
        message: `⚠️ Player '${cleanTarget}' is not on the roster for '${cleanGroup}'. If you quit or switched ladders, please contact an administrator.`
      };
    }

    // -------------------------------------------------------------
    // 2. CHECK-IN ON SCHED SHEET
    // -------------------------------------------------------------
    const timeStamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "America/Phoenix", "HH:mm:ss");
    const schedData = schedSheet.getDataRange().getValues();

    if (schedData.length > 1) {
      const schedHeaders = schedData[0].map(h => String(h || '').trim().toLowerCase());
      let nameIdx = schedHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
      if (nameIdx === -1) nameIdx = 0;

      let checkInIdx = schedHeaders.findIndex(h => /check|x/i.test(h));
      if (checkInIdx === -1) checkInIdx = 2;

      for (let r = 1; r < schedData.length; r++) {
        const cellName = String(schedData[r][nameIdx] || '').trim();
        if (cellName && getTokensKey(cellName) === getTokensKey(matchedOfficialName)) {
          schedSheet.getRange(r + 1, checkInIdx + 1).setValue(timeStamp);

          if (typeof CacheService !== 'undefined') {
            const cacheKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(schedSheetName) : null;
            if (cacheKey) CacheService.getScriptCache().remove(cacheKey);
          }

          return {
            status: "success",
            success: true,
            message: `✅ ${matchedOfficialName} checked in successfully at ${timeStamp}.`
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 3. ROSTER MEMBER IS MISSING FROM SCHED -> APPEND & MARK CHECKED-IN
    // -------------------------------------------------------------
    const numCols = Math.max(schedSheet.getLastColumn(), 8);
    const newRow = new Array(numCols).fill("");

    newRow[0] = matchedOfficialName;
    newRow[1] = "";
    newRow[2] = timeStamp;

    schedSheet.appendRow(newRow);

    if (typeof CacheService !== 'undefined') {
      const cacheKey = typeof getCheckInCacheKey === 'function' ? getCheckInCacheKey(schedSheetName) : null;
      if (cacheKey) CacheService.getScriptCache().remove(cacheKey);
    }

    return {
      status: "success",
      success: true,
      message: `✅ ${matchedOfficialName} added to schedule and checked in at ${timeStamp}.`
    };

  } catch (err) {
    Logger.log(`❌ Error in ensurePlayerCheckedIn: ${err.message}`);
    return { status: "error", success: false, message: "Check-in failed: " + err.message };
  }
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
    let sheetWeekVal = (typeof getWeekNumber === "function") ? getWeekNumber(schedSheet) : schedSheet.getRange("I2").getValue();
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
 * Clears old Column I week metadata prior to writing new week information.
 */
function rebuildSchedSheetOrder(ss, cleanGroupName, activePlayers, inactivePlayers, prevWeekNum) {
  let schedSheet = ss.getSheetByName("Sched " + cleanGroupName);
  if (!schedSheet) return;
  
  let schedData = schedSheet.getDataRange().getValues();
  if (schedData.length <= 1) return;
  
  let headers = schedData[0].map(h => String(h || ''));
  while (headers.length < 12) {
    headers.push("");
  }
  
  // Enforce standard headers across Columns A-L
  if (!headers[0]) headers[0] = "Player Name";
  if (!headers[1]) headers[1] = "Court";
  if (!headers[2]) headers[2] = "Check-In";
  if (!headers[3]) headers[3] = "Game 1";
  if (!headers[4]) headers[4] = "Game 2";
  if (!headers[5]) headers[5] = "Game 3";
  if (!headers[6]) headers[6] = "Total";
  if (!headers[7]) headers[7] = "Entered";
  if (!headers[9]) headers[9] = "Phone";
  if (!headers[10]) headers[10] = "First Name";
  if (!headers[11]) headers[11] = "Last Name";

  let schedHeadersLower = headers.map(h => h.trim().toLowerCase());
  
  let nameIdx  = schedHeadersLower.findIndex(h => /name|player/i.test(h));
  if (nameIdx === -1) nameIdx = 0;

  let phoneIdx = schedHeadersLower.findIndex(h => /phone|cell|mobile/i.test(h));
  if (phoneIdx === -1) phoneIdx = 9; // Col J

  let firstIdx = schedHeadersLower.findIndex(h => /\bfirst\b|fname/i.test(h));
  if (firstIdx === -1) firstIdx = 10; // Col K

  let lastIdx  = schedHeadersLower.findIndex(h => /\blast\b|lname/i.test(h));
  if (lastIdx === -1) lastIdx = 11; // Col L

  // Index existing Sched sheet rows with multi-column lookup keys
  let schedRows = [];
  for (let r = 1; r < schedData.length; r++) {
    let row = schedData[r];
    while (row.length < 12) row.push("");

    let rawName = String(row[nameIdx] || "").trim();
    if (!rawName || rawName.startsWith("---") || rawName.toLowerCase().startsWith("time:") || rawName.startsWith("SCHEDULE_WEEK")) {
      continue;
    }

    let rawFirst = String(row[firstIdx] || "").trim();
    let rawLast  = String(row[lastIdx] || "").trim();
    let phoneDigits = cleanPhoneDigits(row[phoneIdx]);

    let normName = typeof normalizeName === 'function' ? normalizeName(rawName) : rawName.toLowerCase().trim();
    let normFirst = typeof normalizeName === 'function' ? normalizeName(rawFirst) : rawFirst.toLowerCase().trim();
    let normLast = typeof normalizeName === 'function' ? normalizeName(rawLast) : rawLast.toLowerCase().trim();
    let tokenKey = (normName.match(/[a-z0-9]+/g) || []).sort().join(" ");

    schedRows.push({
      rawRow: row.slice(),
      rawName: rawName,
      normName: normName,
      normFirst: normFirst,
      normLast: normLast,
      tokenKey: tokenKey,
      phoneDigits: phoneDigits,
      used: false
    });
  }

  // 5-Tier Matching Engine
  function findMatchingRow(p) {
    let pNorm = typeof normalizeName === 'function' ? normalizeName(p.name) : String(p.name || '').toLowerCase().trim();
    let pFirstNorm = typeof normalizeName === 'function' ? normalizeName(p.firstName) : String(p.firstName || '').toLowerCase().trim();
    let pLastNorm = typeof normalizeName === 'function' ? normalizeName(p.lastName) : String(p.lastName || '').toLowerCase().trim();
    let pTokens = (pNorm.match(/[a-z0-9]+/g) || []).sort().join(" ");
    let pPhone = cleanPhoneDigits(p.phone);

    let match = null;

    // Tier 1: Phone Match (Last 7 Digits)
    if (pPhone && pPhone.length >= 7) {
      let pTail = pPhone.slice(-7);
      match = schedRows.find(r => !r.used && r.phoneDigits && r.phoneDigits.endsWith(pTail));
    }

    // Tier 2: Separate First & Last Name Match (Cols K & L)
    if (!match && pFirstNorm && pLastNorm) {
      match = schedRows.find(r => !r.used && r.normFirst === pFirstNorm && r.normLast === pLastNorm);
    }

    // Tier 3: Full Normalized Name Match (Col A)
    if (!match && pNorm) {
      match = schedRows.find(r => !r.used && r.normName === pNorm);
    }

    // Tier 4: Tokenized Name Match ("Smith John" === "John Smith")
    if (!match && pTokens) {
      match = schedRows.find(r => !r.used && r.tokenKey === pTokens);
    }

    // Tier 5: Substring / Partial Name Match
    if (!match && pNorm && pNorm.length >= 3) {
      match = schedRows.find(r => !r.used && (r.normName.includes(pNorm) || pNorm.includes(r.normName)));
    }

    let matchedRow;
    if (match) {
      match.used = true;
      matchedRow = match.rawRow;
    } else {
      matchedRow = new Array(12).fill("");
    }

    while (matchedRow.length < 12) matchedRow.push("");

    // Update roster identity fields from master Score sheet
    matchedRow[nameIdx] = p.name;
    if (pPhone) matchedRow[phoneIdx] = p.phone;
    if (p.firstName) matchedRow[firstIdx] = p.firstName;
    if (p.lastName) matchedRow[lastIdx] = p.lastName;

    return matchedRow;
  }

  let newRows = [headers];

  // Reorder Active Players by Rank
  (activePlayers || []).forEach(p => {
    newRows.push(findMatchingRow(p));
  });

  // Reorder Inactive Players by Prior Rank
  (inactivePlayers || []).forEach(p => {
    newRows.push(findMatchingRow(p));
  });

  // Retain any unmatched historical rows
  schedRows.forEach(r => {
    if (!r.used) newRows.push(r.rawRow);
  });

  schedSheet.clearContents();
  schedSheet.getRange(1, 1, newRows.length, headers.length).setValues(newRows);

  // Clear all old Column I week metadata across all rows before stamping new week info
  let maxColRows = Math.max(schedSheet.getLastRow(), 20);
  if (maxColRows > 0) {
    schedSheet.getRange(1, 9, maxColRows, 1).clearContent().clearFormat();
  }

  // Stamp new week header metadata in Column I (Rows 1-4)
  let nextWeek = prevWeekNum + 1;
  if (nextWeek <= 10) {
    try {
      schedSheet.getRange("N1").setValue("SCHEDULE_WEEK").setFontWeight("bold");
      schedSheet.getRange("N2").setValue(nextWeek).setHorizontalAlignment("center");
      schedSheet.getRange("N3").setValue("Week " + nextWeek).setHorizontalAlignment("center");
      
      let tz = ss.getSpreadsheetTimeZone() || "America/Phoenix";
      let todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
      schedSheet.getRange("N4").setValue(todayStr).setHorizontalAlignment("center");
    } catch (e) {
      Logger.log("Non-fatal header stamp warning: " + e.message);
    }
  }
}



/**
 * Schedule reset routine.
 * Unconditionally clears Courts, Check-Ins, Game 1-3 scores, and Total on Sched sheet.
 * Also clears Courts and Points on the corresponding Score sheet and invalidates caches.
 */
function resetCheckInsAndSchedData(payload) {
  return executeWithLock(function() {
    const ss = getDb();

    let clearCourts = true;
    let clearCheckIns = true;
    let clearScores = true;
    let targetTabs = [];

    const hasExplicitPayload = payload !== undefined && payload !== null && 
      (typeof payload === 'boolean' || typeof payload === 'string' || (typeof payload === 'object' && Object.keys(payload).length > 0));

    if (!hasExplicitPayload) {
      // Automatic scheduled trigger behavior based on day of week
      const dayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon, 4 = Thu, 5 = Fri
      const allTabs = typeof getActiveScheduleTabs === 'function'
        ? getActiveScheduleTabs()
        : (typeof SCHEDULE_TABS !== 'undefined' ? SCHEDULE_TABS : []);

      const findMatchingTab = (pattern) => allTabs.find(t => pattern.test(t)) || "";

      if (dayOfWeek === 1) { // Monday -> Women's
        targetTabs = [findMatchingTab(/women/i) || "Sched Women"];
      } else if (dayOfWeek === 4) { // Thursday -> Men's
        targetTabs = [findMatchingTab(/(?<!wo)men/i) || "Sched Men"];
      } else if (dayOfWeek === 5) { // Friday -> Mixed
        targetTabs = [findMatchingTab(/mixed/i) || "Sched Mixed"];
      } else {
        targetTabs = allTabs;
      }
    } else {
      // Explicit payload call (e.g., menu action, boolean flag, or API call)
      let rawGroup = "";
      
      if (typeof payload === 'boolean') {
        // Boolean true passed from menu action: clear all active tabs
        clearCourts = true;
        clearCheckIns = true;
        clearScores = true;
      } else if (typeof payload === 'string') {
        rawGroup = payload;
        clearCourts = true;
        clearCheckIns = true;
        clearScores = true;
      } else if (typeof payload === 'object') {
        rawGroup = payload.group || payload.groupName || payload.schedSheetName || payload.tab || "";
        clearCourts = payload.clearCourts !== undefined ? Boolean(payload.clearCourts) : true;
        clearCheckIns = payload.clearCheckIns !== undefined ? Boolean(payload.clearCheckIns) : true;
        clearScores = payload.clearScores !== undefined ? Boolean(payload.clearScores) : true;
      }

      if (rawGroup) {
        const cleanGroup = String(rawGroup).replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
        targetTabs = ["Sched " + cleanGroup];
      } else {
        targetTabs = typeof getActiveScheduleTabs === 'function'
          ? getActiveScheduleTabs()
          : (typeof SCHEDULE_TABS !== 'undefined' ? SCHEDULE_TABS : []);
      }
    }

    let processedTabs = [];

    targetTabs.forEach(tabName => {
      let schedSheet = ss.getSheetByName(tabName);
      if (!schedSheet && !tabName.startsWith("Sched ")) {
        schedSheet = ss.getSheetByName("Sched " + tabName);
      }
      if (!schedSheet) return;

      const cleanGroup = String(tabName).replace(/^Sched\s*/i, "").trim();

      // 1. Sync missing players from Score sheet using First + Last Name
      if (typeof syncScoreSheetPlayersToSched === 'function') {
        syncScoreSheetPlayersToSched(ss, cleanGroup, schedSheet);
      }

      // 2. Clear Court, Check-In, Game 1-3 Scores, Total, and Entered By on Sched sheet
      const dataRange = schedSheet.getDataRange();
      const data = dataRange.getValues();
      if (data.length > 1) {
        const headers = data[0].map(h => String(h || '').trim().toLowerCase());

        let courtIdx = headers.findIndex(h => /court|crt/i.test(h));
        if (courtIdx === -1 && headers.length >= 2) courtIdx = 1;

        let checkInIdx = headers.findIndex(h => /check|x|status/i.test(h));
        if (checkInIdx === -1 && headers.length >= 3) checkInIdx = 2;

        let g1Idx = headers.findIndex(h => /game\s*1|\bg1\b/i.test(h));
        if (g1Idx === -1 && headers.length >= 4) g1Idx = 3;

        let g2Idx = headers.findIndex(h => /game\s*2|\bg2\b/i.test(h));
        if (g2Idx === -1 && headers.length >= 5) g2Idx = 4;

        let g3Idx = headers.findIndex(h => /game\s*3|\bg3\b/i.test(h));
        if (g3Idx === -1 && headers.length >= 6) g3Idx = 5;

        let totIdx = headers.findIndex(h => /total|tot|pts|score/i.test(h));
        if (totIdx === -1 && headers.length >= 7) totIdx = 6;

        let enteredIdx = headers.findIndex(h => /entered|submitted|by/i.test(h));
        if (enteredIdx === -1 && headers.length >= 8) enteredIdx = 7;

        for (let r = 1; r < data.length; r++) {
          if (clearCourts && courtIdx !== -1) data[r][courtIdx] = "";
          if (clearCheckIns && checkInIdx !== -1) data[r][checkInIdx] = "";
          if (clearScores) {
            if (g1Idx !== -1) data[r][g1Idx] = "";
            if (g2Idx !== -1) data[r][g2Idx] = "";
            if (g3Idx !== -1) data[r][g3Idx] = "";
            if (totIdx !== -1) data[r][totIdx] = "";
            if (enteredIdx !== -1) data[r][enteredIdx] = "";
          }
        }
        dataRange.setValues(data);
      }

      // 3. Clear Courts and Points on corresponding 'Score [Group]' sheet
      if (clearScores) {
        const scoreSheet = ss.getSheetByName("Score " + cleanGroup);
        if (scoreSheet) {
          const scoreData = scoreSheet.getDataRange().getValues();
          if (scoreData.length > 1) {
            const numScoreRows = scoreData.length - 1;
            const scoreHeaders = scoreData[0].map(h => String(h || '').trim().toLowerCase());
            
            let scrtIdx = scoreHeaders.findIndex(h => /court|crt/i.test(h));
            if (scrtIdx === -1) scrtIdx = 3; // Col D

            let ptsIdx = scoreHeaders.findIndex(h => /^pts$|^points$\vert{}^total$/i.test(h));
            if (ptsIdx === -1) ptsIdx = 4; // Col E

            scoreSheet.getRange(2, scrtIdx + 1, numScoreRows, 1).setValues(new Array(numScoreRows).fill([""]));
            scoreSheet.getRange(2, ptsIdx + 1, numScoreRows, 1).clearContent();
          }
        }
      }

      // 4. Invalidate caches
      if (typeof CacheService !== 'undefined') {
        try {
          const cache = CacheService.getScriptCache();
          cache.removeAll([
            `checkin_cache_${tabName}`,
            `checkin_cache_Sched_${cleanGroup}`,
            `SCHEDULE_${cleanGroup}`,
            `UNIFIED_ROSTER_CACHE_${cleanGroup.toUpperCase()}`,
            `APP_INIT_DATA`
          ]);
        } catch (cErr) {
          logDebug("resetCheckInsAndSchedData", "Cache clear warning", cErr.message);
        }
      }

      processedTabs.push(tabName);
    });

    const actions = [];
    if (clearCourts) actions.push("Courts");
    if (clearCheckIns) actions.push("Check-Ins");
    if (clearScores) actions.push("Game Scores & Totals");

    const msg = `Cleared [${actions.join(", ")}] & synced players for: ${processedTabs.join(", ") || "None"}.`;
    logDebug("resetCheckInsAndSchedData", msg);
    return { success: true, message: msg };
  });
}



/**
 * Generates schedule tabs on Sched sheet, supports 4, 5, and 6 player groups, clears previous weekly scores.
 * Uses 13 data columns (A-M) including Game 1 through Game 6, and places week metadata safely in Column N.
 */
function ScheduleAll(genTarget, courts) {
  return executeWithLock(function() {
    let targetGroup = genTarget;
    let payloadByeFlag = undefined;
    let integrateByes = true;

    if (typeof genTarget === 'object' && genTarget !== null) {
      courts = genTarget.courts || courts;
      payloadByeFlag = genTarget.alwaysByeBottom !== undefined ? genTarget.alwaysByeBottom : genTarget.ALWAYS_BYE_BOTTOM;
      if (genTarget.integrateByes !== undefined) integrateByes = Boolean(genTarget.integrateByes);
      targetGroup = genTarget.group || genTarget.sheet || genTarget.schedSheetName || genTarget.genTarget || genTarget.target || "";
    }

    const alwaysByeBottom = (payloadByeFlag !== undefined) 
      ? Boolean(payloadByeFlag) : (typeof ALWAYS_BYE_BOTTOM !== 'undefined' ? Boolean(ALWAYS_BYE_BOTTOM) : true);

    logDebug("ScheduleAll", "Generating schedule tabs and clearing active scores", { genTarget: targetGroup, courts, alwaysByeBottom, integrateByes });

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
        summary.push(`⚠ Score tab for '${groupName}' not found.`);
        return;
      }

      sortActivePlayersForSheet(scoreSheet);
      const data = scoreSheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const col = buildColMap(data[0]);
      let activePlayers = [];
      let activePlayerObjects = [];
      let inactivePlayers = [];
      let inactivePlayerObjects = [];

      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let status = (col.status !== undefined && row[col.status]) ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";
        
        let firstVal = (col.first !== undefined && row[col.first]) ? String(row[col.first]).trim() : '';
        let lastVal = (col.last !== undefined && row[col.last]) ? String(row[col.last]).trim() : '';
        let name = (firstVal || lastVal) ? `${firstVal} ${lastVal}`.trim() : (col.name !== undefined ? String(row[col.name]).trim() : '');
        
        let rawPhone = col.phone !== undefined ? row[col.phone] : (col.cell !== undefined ? row[col.cell] : (col.mobile !== undefined ? row[col.mobile] : ""));

        if (name) {
          let pObj = { name: name, phone: cleanP(rawPhone) };
          if (status === "ACTIVE") {
            activePlayers.push(name); activePlayerObjects.push(pObj);
          } else {
            inactivePlayers.push(name); inactivePlayerObjects.push(pObj);
          }
        }
      }

      let availableCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
      let schedSheetName = "Sched " + groupName;
      let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);

      schedSheet.clear();

      // 13 Data Columns matching rescheduleFromCheckIns (A - M)
      let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered", "", "Phone"];
      let rows = [headers];

      let numPlayers = activePlayers.length;
      let courtWarning = "";
      
      let playingIndices = [];
      let byeIndices = new Set();
      let playerCourtMap = {};

      if (integrateByes && numPlayers >= 4) {
        let indicesCopy = Array.from({ length: numPlayers }, (_, i) => i);
        let chunkSizes = [];
        let len = numPlayers;

        if (len === 6) {
          chunkSizes = [6];
        } else if (len === 11) {
          chunkSizes = [6, 5];
        } else {
          let remainder = len % 4;
          if (remainder === 0) {
            for (let i = 0; i < len / 4; i++) chunkSizes.push(4);
          } else if (remainder === 1) { // 5, 9, 13, 17... -> One 5, rest 4s
            chunkSizes.push(5);
            for (let i = 0; i < (len - 5) / 4; i++) chunkSizes.push(4);
          } else if (remainder === 2) { // 10, 14, 18... -> Two 5s, rest 4s
            chunkSizes.push(5, 5);
            for (let i = 0; i < (len - 10) / 4; i++) chunkSizes.push(4);
          } else if (remainder === 3) { // 15, 19... -> Three 5s, rest 4s
            if (len === 7) {
              chunkSizes.push(4);
            } else {
              chunkSizes.push(5, 5, 5);
              for (let i = 0; i < (len - 15) / 4; i++) chunkSizes.push(4);
            }
          }
        }

        if (chunkSizes.length > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";

        let courtNum = 0;
        for (let size of chunkSizes) {
           if (courtNum < availableCourts.length && indicesCopy.length >= size) {
              let chunk = indicesCopy.splice(0, size);
              let cName = availableCourts[courtNum++];
              chunk.forEach(idx => playerCourtMap[idx] = cName);
           } else {
              break;
           }
        }
        indicesCopy.forEach(idx => byeIndices.add(idx));
      } else {
        // Standard 4-player Assignment
        let foursomesCount = Math.floor(numPlayers / 4);
        if (foursomesCount > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";
        
        let assignedCourtsCount = Math.min(foursomesCount, availableCourts.length);
        let totalPlayingCount = assignedCourtsCount * 4;
        let byeCount = numPlayers - totalPlayingCount;

        if (byeCount > 0) {
          if (alwaysByeBottom) {
            for (let i = 0; i < totalPlayingCount; i++) playingIndices.push(i);
            for (let i = totalPlayingCount; i < numPlayers; i++) byeIndices.add(i);
          } else {
            let availableIndices = Array.from({ length: numPlayers }, (_, idx) => idx);
            while (byeIndices.size < byeCount) {
              byeIndices.add(availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0]);
            }
            playingIndices = availableIndices;
          }
        } else {
          for (let i

/**
 * Generates schedule tabs on Sched sheet, supports 4, 5, and 6 player groups, clears previous weekly scores.
 * Includes headers and data cells for Game 1 through Game 6.
 */
function ScheduleAll(genTarget, courts) {
  return executeWithLock(function() {
    let targetGroup = genTarget;
    let payloadByeFlag = undefined;
    let integrateByes = true;

    if (typeof genTarget === 'object' && genTarget !== null) {
      courts = genTarget.courts || courts;
      payloadByeFlag = genTarget.alwaysByeBottom !== undefined ? genTarget.alwaysByeBottom : genTarget.ALWAYS_BYE_BOTTOM;
      if (genTarget.integrateByes !== undefined) integrateByes = Boolean(genTarget.integrateByes);
      targetGroup = genTarget.group || genTarget.sheet || genTarget.schedSheetName || genTarget.genTarget || genTarget.target || "";
    }

    const alwaysByeBottom = (payloadByeFlag !== undefined) 
      ? Boolean(payloadByeFlag) : (typeof ALWAYS_BYE_BOTTOM !== 'undefined' ? Boolean(ALWAYS_BYE_BOTTOM) : true);

    logDebug("ScheduleAll", "Generating schedule tabs and clearing active scores", { genTarget: targetGroup, courts, alwaysByeBottom, integrateByes });

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
        summary.push(`⚠ Score tab for '${groupName}' not found.`);
        return;
      }

      sortActivePlayersForSheet(scoreSheet);
      const data = scoreSheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const col = buildColMap(data[0]);
      let activePlayers = [];
      let activePlayerObjects = [];
      let inactivePlayers = [];
      let inactivePlayerObjects = [];

      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let status = (col.status !== undefined && row[col.status]) ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";
        
        let firstVal = (col.first !== undefined && row[col.first]) ? String(row[col.first]).trim() : '';
        let lastVal = (col.last !== undefined && row[col.last]) ? String(row[col.last]).trim() : '';
        let name = (firstVal || lastVal) ? `${firstVal} ${lastVal}`.trim() : (col.name !== undefined ? String(row[col.name]).trim() : '');
        
        let rawPhone = col.phone !== undefined ? row[col.phone] : (col.cell !== undefined ? row[col.cell] : (col.mobile !== undefined ? row[col.mobile] : ""));

        if (name) {
          let pObj = { name: name, phone: cleanP(rawPhone) };
          if (status === "ACTIVE") {
            activePlayers.push(name); activePlayerObjects.push(pObj);
          } else {
            inactivePlayers.push(name); inactivePlayerObjects.push(pObj);
          }
        }
      }

      let availableCourts = courts ? parseAndSortCourts(courts) : getCourtsForGroup(groupName);
      let schedSheetName = "Sched " + groupName;
      let schedSheet = ss.getSheetByName(schedSheetName) || ss.insertSheet(schedSheetName);

      schedSheet.clear();

      // Updated Headers: Explicitly includes Game 5 and Game 6
      let headers = ["Player Name", "Court", "Check-In", "Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Total", "Entered"];
      let rows = [headers];

      let numPlayers = activePlayers.length;
      let courtWarning = "";
      
      let playingIndices = [];
      let byeIndices = new Set();
      let playerCourtMap = {};

      if (integrateByes && numPlayers >= 4) {
        let indicesCopy = Array.from({ length: numPlayers }, (_, i) => i);
        let chunkSizes = [];
        let len = numPlayers;

        if (len === 6) {
          chunkSizes = [6];
        } else if (len === 11) {
          chunkSizes = [6, 5];
        } else {
          let remainder = len % 4;
          if (remainder === 0) {
            for (let i = 0; i < len / 4; i++) chunkSizes.push(4);
          } else if (remainder === 1) { // 5, 9, 13, 17... -> One 5, rest 4s
            chunkSizes.push(5);
            for (let i = 0; i < (len - 5) / 4; i++) chunkSizes.push(4);
          } else if (remainder === 2) { // 10, 14, 18... -> Two 5s, rest 4s
            chunkSizes.push(5, 5);
            for (let i = 0; i < (len - 10) / 4; i++) chunkSizes.push(4);
          } else if (remainder === 3) { // 15, 19... -> Three 5s, rest 4s
            if (len === 7) {
              chunkSizes.push(4);
            } else {
              chunkSizes.push(5, 5, 5);
              for (let i = 0; i < (len - 15) / 4; i++) chunkSizes.push(4);
            }
          }
        }

        if (chunkSizes.length > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";

        let courtNum = 0;
        for (let size of chunkSizes) {
           if (courtNum < availableCourts.length && indicesCopy.length >= size) {
              let chunk = indicesCopy.splice(0, size);
              let cName = availableCourts[courtNum++];
              chunk.forEach(idx => playerCourtMap[idx] = cName);
           } else {
              break;
           }
        }
        indicesCopy.forEach(idx => byeIndices.add(idx));
      } else {
        // Standard 4-player Assignment
        let foursomesCount = Math.floor(numPlayers / 4);
        if (foursomesCount > availableCourts.length) courtWarning = " ⚠️ Error: Insufficient courts!";
        
        let assignedCourtsCount = Math.min(foursomesCount, availableCourts.length);
        let totalPlayingCount = assignedCourtsCount * 4;
        let byeCount = numPlayers - totalPlayingCount;

        if (byeCount > 0) {
          if (alwaysByeBottom) {
            for (let i = 0; i < totalPlayingCount; i++) playingIndices.push(i);
            for (let i = totalPlayingCount; i < numPlayers; i++) byeIndices.add(i);
          } else {
            let availableIndices = Array.from({ length: numPlayers }, (_, idx) => idx);
            while (byeIndices.size < byeCount) {
              byeIndices.add(availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0]);
            }
            playingIndices = availableIndices;
          }
        } else {
          for (let i = 0; i < numPlayers; i++) playingIndices.push(i);
        }

        playingIndices.forEach((playerIdx, orderIdx) => {
          let courtNumIdx = Math.floor(orderIdx / 4);
          playerCourtMap[playerIdx] = availableCourts[courtNumIdx];
        });
      }

      const courtLookup = {};
      const registerLookupKey = (pName, pPhone, assignedCourt) => {
        if (!pName) return;
        const cleanFull = cleanStr(pName);
        courtLookup[cleanFull] = assignedCourt;
        const tokens = cleanFull.match(/[a-z0-9]+/g) || [];
        if (tokens.length > 0) courtLookup[tokens.sort().join(" ")] = assignedCourt;
        if (pPhone) courtLookup[pPhone] = assignedCourt;
      };

      for (let i = 0; i < numPlayers; i++) {
        let pName = activePlayers[i];
        let pPhone = activePlayerObjects[i] ? activePlayerObjects[i].phone : "";
        let assignedCourt = byeIndices.has(i) ? "BYE" : (playerCourtMap[i] || "BYE");

        registerLookupKey(pName, pPhone, assignedCourt);
        rows.push([pName, assignedCourt, "", "", "", "", "", "", "", "", ""]);
      }

      for (let i = 0; i < inactivePlayers.length; i++) {
        let pName = inactivePlayers[i];
        let pPhone = inactivePlayerObjects[i] ? inactivePlayerObjects[i].phone : "";
        registerLookupKey(pName, pPhone, "");
        rows.push([pName, "", "", "", "", "", "", "", "", "", ""]);
      }

      schedSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      schedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      schedSheet.getRange("N1").setValue("SCHEDULE_WEEK").setFontWeight("bold");
      schedSheet.getRange("N2").setValue(currentWeek).setHorizontalAlignment("center");
      schedSheet.getRange("N3").setValue("Week " + currentWeek).setHorizontalAlignment("center");
      schedSheet.getRange("N4").setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd")).setHorizontalAlignment("center");

      // Score Sheet Sync
      let scoreHeaders = data[0].map(h => String(h || '').trim().toLowerCase());
      let phoneIdx = scoreHeaders.findIndex(h => /phone|cell|mobile|contact|tel/i.test(h));
      let firstIdx = scoreHeaders.findIndex(h => /first|fname|f_name/i.test(h));
      let lastIdx = scoreHeaders.findIndex(h => /last|lname|l_name/i.test(h));
      let nameIdx = scoreHeaders.findIndex(h => /player|full\s*name|^name$/i.test(h));
      let courtIdx = scoreHeaders.findIndex(h => /court|crt/i.test(h));
      if (courtIdx === -1) courtIdx = 3; 

      let ptsIdx = scoreHeaders.findIndex(h => /^pts$|^points$|^total$/i.test(h));
      if (ptsIdx === -1) ptsIdx = 4;

      if (data.length > 1) scoreSheet.getRange(2, ptsIdx + 1, data.length - 1, 1).clearContent();

      let scoreCourtValues = [];
      for (let r = 1; r < data.length; r++) {
        let row = data[r];
        let rowPhone = phoneIdx !== -1 ? cleanP(row[phoneIdx]) : "";
        let rowFirst = firstIdx !== -1 ? String(row[firstIdx] || '').trim() : '';
        let rowLast = lastIdx !== -1 ? String(row[lastIdx] || '').trim() : '';
        let rowFullName = (rowFirst || rowLast) ? `${rowFirst} ${rowLast}`.trim() : (nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '');
        let cleanRowName = cleanStr(rowFullName);
        let tokensKey = (cleanRowName.match(/[a-z0-9]+/g) || []).sort().join(" ");
        let rowStatus = (col.status !== undefined && row[col.status]) ? String(row[col.status]).toUpperCase().trim() : "ACTIVE";

        let matchedCourt = "";
        let foundInLookup = false;

        if (rowPhone) {
          for (let k in courtLookup) {
            if (k.length >= 7 && rowPhone.endsWith(k.slice(-7))) {
              matchedCourt = courtLookup[k]; foundInLookup = true; break;
            }
          }
        }
        if (!foundInLookup) {
          if (cleanRowName && courtLookup[cleanRowName] !== undefined) {
            matchedCourt = courtLookup[cleanRowName]; foundInLookup = true;
          } else if (tokensKey && courtLookup[tokensKey] !== undefined) {
            matchedCourt = courtLookup[tokensKey]; foundInLookup = true;
          }
        }
        if (rowStatus !== "ACTIVE") matchedCourt = "";
        else if (!matchedCourt) matchedCourt = "BYE";

        scoreCourtValues.push([matchedCourt]);
      }

      if (scoreCourtValues.length > 0) scoreSheet.getRange(2, courtIdx + 1, scoreCourtValues.length, 1).setValues(scoreCourtValues);

      const cacheKey = getCheckInCacheKey(schedSheetName);
      if (typeof CacheService !== 'undefined' && cacheKey) CacheService.getScriptCache().remove(cacheKey);
      if (typeof clearUnifiedCache === 'function') clearUnifiedCache(schedSheetName);
      if (typeof CacheService !== 'undefined') CacheService.getScriptCache().remove("UNIFIED_ROSTER_CACHE_" + groupName.toUpperCase());

      summary.push(`Generated schedule for '${groupName}'.${courtWarning}`);
    });

    return "✅ " + summary.join("\n");
  });
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
      if (submitterIdx === -1) submitterIdx = 10; // Default to Column K (Entered), NOT Col H (Index 7)

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

          // Compute total score from all played games
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
              // Scale to 0.75 if 4 games played (5- or 6-player courts)
              data[r][totIdx] = (playedCount === 4) ? Math.round(sum * 0.75) : sum;
            }
          }

          if (submitterIdx !== -1 && submitterName) data[r][submitterIdx] = submitterName;
          dataModified = true;
        }
      }

      if (dataModified) dataRange.setValues(data);
      if (typeof CacheService !== 'undefined') {
        try { CacheService.getScriptCache().removeAll([`checkin_cache_Sched_${cleanGroup}`, `SCHEDULE_${cleanGroup}`, `APP_INIT_DATA`]); } catch (e) {}
      }

      return { success: true, message: `Successfully updated scores.` };
    } catch (err) {
      return { success: false, message: "Server Error submitting scores: " + err.message };
    }
  });
}
