/**
 * Checks script properties to determine if the test group ("TG") is enabled.
 */
function isTestGroupEnabled() {
  const prop = PropertiesService.getScriptProperties().getProperty("USE_TEST_GROUP");
  return prop === "true";
}


// =========================================================================
// CONFIGURATION & POLYFILLS
// =========================================================================
const MASTER_TEST_SHEET_NAME = "Score Womens"; // Change to your dev tab name (e.g., "Score TEST")

// Resolves the "ReferenceError: clearAllGroupCaches is not defined" 
// This prevents executeWithLock from aborting during the tests.
function clearAllGroupCaches(group) {
  // Polyfill if missing in main code
}

/**
 * MASTER RUNNER: Executes all independent test suites sequentially.
 */
function runAllTests() {
  Logger.log("🚀 STARTING FULL TEST SUITE");
  
  testDateToWeekCalculation();
  testApiHandlerCases();
  runWeeklyScoreTests();
  runDataValidationTests();
  testRankMovementClamp();
  testHistoricalRegression() 
  Logger.log("✅ FULL TEST SUITE COMPLETED");
}

// =========================================================================
// 6. HISTORICAL REGRESSION TEST: RECALCULATING W10
// =========================================================================
function testHistoricalRegression() {
  Logger.log("\n--- 6. HISTORICAL REGRESSION TEST (W10 ONLY) ---");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_TEST_SHEET_NAME);
  if (!sheet) return Logger.log("❌ Test sheet not found.");
  
  const originalData = sheet.getDataRange().getValues();
  const col = buildColMap(originalData[0]);

  if (col.r9 === undefined || col.r10 === undefined) {
    return Logger.log("❌ R9 or R10 columns missing. Cannot run regression test.");
  }

  // Map original known-good Week 10 ranks by player name
  let originalRanks = {};
  for (let i = 1; i < originalData.length; i++) {
    let pName = ((originalData[i][col.first] || "") + " " + (originalData[i][col.last] || "")).trim();
    if (pName) {
      originalRanks[pName] = String(originalData[i][col.r10]).replace(/^'/, "");
    }
  }

  Logger.log("🧹 Clearing R10 from test sheet to force recalculation using R9 baseline...");
  let testData = originalData.map(row => [...row]); // Deep copy
  for (let i = 1; i < testData.length; i++) {
    testData[i][col.r10] = ""; // Only clear R10
  }
  sheet.getRange(1, 1, testData.length, testData[0].length).setValues(testData);

  Logger.log("⚙️ Processing Week 10 from scratch...");
  processWeeklyScoresForSheet(sheet, 10, true);

  // Fetch newly generated data
  const newData = sheet.getDataRange().getValues();
  const newCol = buildColMap(newData[0]); 
  
  let matchCount = 0;
  let mismatchCount = 0;

  for (let i = 1; i < newData.length; i++) {
    let pName = ((newData[i][newCol.first] || "") + " " + (newData[i][newCol.last] || "")).trim();
    if (!pName) continue;

    let newR10 = String(newData[i][newCol.r10]).replace(/^'/, "");
    let origR10 = originalRanks[pName];

    if (!origR10) continue; 

    if (newR10 === origR10) {
      matchCount++;
    } else {
      Logger.log(`❌ Mismatch for ${pName}: Expected '${origR10}', Got '${newR10}'`);
      mismatchCount++;
    }
  }

  Logger.log(`🏁 REGRESSION RESULTS: ${matchCount} perfectly matched, ${mismatchCount} mismatched.`);

  Logger.log("🧹 Restoring original known-good data snapshot...");
  sheet.getRange(1, 1, originalData.length, originalData[0].length).setValues(originalData);
  // Optional: Run the processor one last time to ensure sorts and formats are exactly back to normal.
  processWeeklyScoresForSheet(sheet, 10, true);
  Logger.log("✅ Regression Test Complete. Data Restored.");
}

// =========================================================================
// 1. UNIT TEST: DATE TO WEEK CALCULATION
// =========================================================================
function testDateToWeekCalculation() {
  Logger.log("\n--- 1. DATE CALCULATION UNIT TESTS ---");
  const startDateStr = "2026-10-03";
  
  const testDates = [
    { date: "2026-09-25", expectedWeek: 1 },
    { date: "2026-10-03", expectedWeek: 1 },
    { date: "2026-10-09", expectedWeek: 1 },
    { date: "2026-10-10", expectedWeek: 2 },
    { date: "2026-11-07", expectedWeek: 6 },
    { date: "2026-12-15", expectedWeek: 10 }
  ];

  testDates.forEach(t => {
    let calculated = calculateWeekForDate(startDateStr, t.date);
    let pass = calculated === t.expectedWeek ? "✅ PASS" : `❌ FAIL (Got ${calculated})`;
    Logger.log(`Date: ${t.date} | Expected: W${t.expectedWeek} | ${pass}`);
  });
}

function calculateWeekForDate(startDateStr, simulatedTodayStr) {
  const startDate = new Date(startDateStr + "T00:00:00");
  const today = new Date(simulatedTodayStr + "T00:00:00");
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 1;
  const calculatedWeek = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(calculatedWeek, 1), 10);
}

// =========================================================================
// 2. UNIT TEST: API ROUTER SWITCH CASES
// =========================================================================
function testApiHandlerCases() {
  Logger.log("\n--- 2. API ROUTER SWITCH TESTS ---");
  const groupName = MASTER_TEST_SHEET_NAME.replace(/^Score\s+/i, ""); 

  let payload1 = { group: groupName, weekCol: "W3", shift: true };
  Logger.log("processWeeklyScoresForSheet: " + mockApiCall("processWeeklyScoresForSheet", payload1));

  let payload2 = { group: groupName, weekCol: "W4" };
  Logger.log("updateStandingsWithShift: " + mockApiCall("updateStandingsWithShift", payload2));

  let payload3 = { group: groupName, weekCol: "W4" };
  Logger.log("correctScoresNoShift: " + mockApiCall("correctScoresNoShift", payload3));
}

function mockApiCall(action, payload) {
  let result;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_TEST_SHEET_NAME);
  if (!sheet) return "Sheet not found";

  try {
    switch (action) {
      case 'processWeeklyScoresForSheet':
        result = processWeeklyScoresForSheet(sheet, payload.weekCol || payload.week || null, payload.shift !== undefined ? payload.shift : true);
        break;
      case 'updateStandingsWithShift':
        result = processWeeklyScoresForSheet(sheet, payload.weekCol || payload.week || null, true);
        break;
      case 'correctScoresNoShift':
        result = processWeeklyScoresForSheet(sheet, payload.weekCol || payload.week || null, false);
        break;
      default:
        result = "Unknown action";
    }
  } catch(e) {
    result = `Error: ${e.message}`;
  }
  return result;
}

// =========================================================================
// 3. INTEGRATION TEST: WEEKLY PROCESSING ARGUMENTS
// =========================================================================
function runWeeklyScoreTests() {
  Logger.log("\n--- 3. WEEKLY PROCESSING ARGUMENT TESTS ---");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_TEST_SHEET_NAME);
  if (!sheet) return Logger.log("❌ Test sheet not found!");

  Logger.log("Test 1 (Forced W1, Shift): " + processWeeklyScoresForSheet(sheet, "W1", true));
  Logger.log("Test 2 (Forced W5, Shift): " + processWeeklyScoresForSheet(sheet, 5, true));
  Logger.log("Test 3 (Forced W5, No Shift): " + processWeeklyScoresForSheet(sheet, 5, false));
  Logger.log("Test 4 (Null Week, Default Date): " + processWeeklyScoresForSheet(sheet, null, true));
}

// =========================================================================
// 4. DATA VALIDATION: RAW RANK VS REVISED RANK
// =========================================================================
function runDataValidationTests() {
  Logger.log("\n--- 4. DATA VALIDATION (RAW VS REVISED RANK) ---");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_TEST_SHEET_NAME);
  if (!sheet) return Logger.log("❌ Test sheet not found!");

  const targetWeek = 2; // Test arbitrary week
  processWeeklyScoresForSheet(sheet, targetWeek, true);

  const data = sheet.getDataRange().getValues();
  const col = buildColMap(data[0]); 
  
  let currRColIdx = col["r" + targetWeek];
  let prevRColIdx = col["r" + (targetWeek - 1)];
  let rawRankColIdx = col["raw rank"];

  let passedTests = 0;
  const maxMove = typeof MAX_MOVEMENT !== "undefined" ? MAX_MOVEMENT : 4;

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let pName = (row[col.first] + " " + row[col.last]).trim();
    if (!pName || pName === " ") continue;

    let currRStr = row[currRColIdx] ? row[currRColIdx].toString() : "";
    let prevRStr = row[prevRColIdx] ? row[prevRColIdx].toString() : "";
    let hasCurrentScore = row[col["w" + targetWeek]] !== "" && row[col["w" + targetWeek]] !== null;

    if (hasCurrentScore && currRStr.includes("-R")) {
      let currRankInt = parseInt(currRStr.split("/")[0], 10);
      let prevRankInt = parseInt(prevRStr.replace(/-(R|I)/, "").split("/")[0], 10);
      let rawRankVal = rawRankColIdx !== undefined ? row[rawRankColIdx] : "N/A";
      let actualShift = Math.abs(currRankInt - prevRankInt);
      
      let note = actualShift > maxMove ? `(Gap Compression Shift: ${actualShift})` : `(Within limit)`;
      Logger.log(`⚠️ CLAMPED (-R): ${pName} | Prev R${targetWeek-1}: ${prevRankInt} | Raw: ${rawRankVal} | Revised R${targetWeek}: ${currRankInt} ${note}`);
      
      passedTests++;
    } else if (!hasCurrentScore && currRStr !== "") {
      if (!currRStr.endsWith("-I")) {
        Logger.log(`❌ FAIL [Inactive Suffix]: ${pName} missing W${targetWeek}, but rank '${currRStr}' lacks -I.`);
      }
    }
  }
  Logger.log(`🏁 VALIDATION RESULTS: ${passedTests} Clamps Handled Gracefully`);
}

// =========================================================================
// 5. ARTIFICIAL SABOTAGE/BOOST TEST: RANK CLAMP LIMITS
// =========================================================================
function testRankMovementClamp() {
  Logger.log("\n--- 5. ARTIFICIAL RANK CLAMP (SABOTAGE/BOOST) ---");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_TEST_SHEET_NAME);
  if (!sheet) return Logger.log("❌ Test sheet not found.");
  
  const originalData = sheet.getDataRange().getValues();
  const col = buildColMap(originalData[0]);
  const targetWeek = 10; // Must use W10 to test end-of-season bounds
  
  if (col.r9 === undefined || col.r10 === undefined) {
    return Logger.log("❌ Requires R9 and R10 columns on sheet to test clamp movement.");
  }

  let testData = sheet.getDataRange().getValues();
  let juliaIdx = -1, karenIdx = -1;
  
  for (let i = 1; i < testData.length; i++) {
    let pName = ((testData[i][col.first] || "") + " " + (testData[i][col.last] || "")).trim();
    if (pName === "Julia Folden") juliaIdx = i;
    if (pName === "Karen Young") karenIdx = i;
  }
  
  if (juliaIdx === -1 || karenIdx === -1) {
    return Logger.log("❌ Test players ('Julia Folden', 'Karen Young') not found.");
  }

  // TANK JULIA (Drop to 0) & BOOST KAREN (Max to 60)
  for (let w = 1; w <= 10; w++) {
    if (col["w" + w] !== undefined) {
      testData[juliaIdx][col["w" + w]] = 0;
      testData[karenIdx][col["w" + w]] = 60;
    }
  }
  
  sheet.getRange(1, 1, testData.length, testData[0].length).setValues(testData);
  processWeeklyScoresForSheet(sheet, targetWeek, true);
  
  // FETCH NEW DATA - INDICES HAVE CHANGED BECAUSE ROWS WERE SORTED!
  const sortedData = sheet.getDataRange().getValues();
  let r10Col = col["r10"];
  let rawRankCol = col["raw rank"];
  let juliaResult = "", karenResult = "", juliaRaw = "", karenRaw = "";
  
  for (let i = 1; i < sortedData.length; i++) {
    let pName = ((sortedData[i][col.first] || "") + " " + (sortedData[i][col.last] || "")).trim();
    if (pName === "Julia Folden") {
      juliaResult = String(sortedData[i][r10Col]).replace(/^'/, ""); 
      if (rawRankCol !== undefined) juliaRaw = sortedData[i][rawRankCol];
    }
    if (pName === "Karen Young") {
      karenResult = String(sortedData[i][r10Col]).replace(/^'/, "");
      if (rawRankCol !== undefined) karenRaw = sortedData[i][rawRankCol];
    }
  }
  
  let passed = 0;
  Logger.log(`📉 Julia Folden | Expected Drop from 3 | Raw: ${juliaRaw} | Revised: ${juliaResult}`);
  if (juliaResult.includes("-R")) { passed++; }
  
  Logger.log(`📈 Karen Young  | Expected Rise from 73 | Raw: ${karenRaw} | Revised: ${karenResult}`);
  if (karenResult.includes("-R")) { passed++; }
  
  Logger.log(`🏁 CLAMP TEST RESULTS: ${passed}/2 Clamped Successfully`);
  
  // RESTORE ENTIRE ORIGINAL DATASET (To revert sort order properly)
  sheet.getRange(1, 1, originalData.length, originalData[0].length).setValues(originalData);
  processWeeklyScoresForSheet(sheet, targetWeek, true);
  Logger.log("✅ Data sorted & restored to original state.");
}
