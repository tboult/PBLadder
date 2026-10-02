/**
 * Updates a player's score in Column E of the Score sheet and Column G (Total) of the Sched sheet.
 * 
 * @param {Object} payload - API payload containing group, phone, playerName, and score
 * @return {Object} Success/failure status message
 */
function updatePlayerScore(payload) {
  return executeWithLock(function() {
    try {
      if (!payload) return { success: false, message: "Missing payload." };

      const rawGroup = payload.groupName || payload.group || payload.sheet || "";
      const cleanGroup = String(rawGroup).replace(/^(Score|Sched)\s*/i, "").trim();
      if (!cleanGroup) {
        return { success: false, message: "Invalid or missing group name." };
      }

      const cleanPhone = String(payload.phone || "").replace(/\D/g, "");
      const searchName = String(payload.playerName || payload.name || "").trim().toLowerCase();
      const scoreVal = payload.score !== undefined ? payload.score : payload.newScore;

      if (!cleanPhone && !searchName) {
        return { success: false, message: "Either player name or phone number is required to locate the player." };
      }

      const ss = getDb();
      const scoreSheetName = "Score " + cleanGroup;
      const schedSheetName = "Sched " + cleanGroup;

      const scoreSheet = ss.getSheetByName(scoreSheetName);
      const schedSheet = ss.getSheetByName(schedSheetName);

      if (!scoreSheet) {
        return { success: false, message: `Score sheet '${scoreSheetName}' not found.` };
      }

      let scoreUpdated = false;
      let schedUpdated = false;
      let matchedPlayerName = searchName;

      // 1. UPDATE SCORE SHEET (Column E = 5th Column)
      const scoreData = scoreSheet.getDataRange().getValues();
      if (scoreData.length > 1) {
        const headers = scoreData[0].map(h => String(h || "").toLowerCase().replace(/[\s\-_]/g, "").trim());
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
        const firstIdx = headers.findIndex(h => h === "first" || h === "firstname");
        const lastIdx = headers.findIndex(h => h === "last" || h === "lastname");
        const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("cell") || h.includes("mobile"));

        for (let r = 1; r < scoreData.length; r++) {
          const row = scoreData[r];
          const pPhone = phoneIdx !== -1 ? String(row[phoneIdx] || "").replace(/\D/g, "") : "";
          
          let pName = "";
          if (firstIdx !== -1 || lastIdx !== -1) {
            const f = firstIdx !== -1 ? String(row[firstIdx] || "").trim() : "";
            const l = lastIdx !== -1 ? String(row[lastIdx] || "").trim() : "";
            pName = `${f} ${l}`.trim();
          }
          if (!pName && nameIdx !== -1) {
            pName = String(row[nameIdx] || "").trim();
          }

          const isPhoneMatch = cleanPhone.length >= 7 && pPhone.length >= 7 && 
            (pPhone.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(pPhone.slice(-7)));
          const isNameMatch = searchName.length >= 2 && pName.toLowerCase().includes(searchName);

          if (isPhoneMatch || isNameMatch) {
            scoreSheet.getRange(r + 1, 5).setValue(scoreVal); // Column E = 5
            scoreUpdated = true;
            if (pName) matchedPlayerName = pName;
            break;
          }
        }
      }

      // 2. UPDATE SCHED SHEET (Column G = 7th Column / Total)
      if (schedSheet) {
        const schedData = schedSheet.getDataRange().getValues();
        if (schedData.length > 1) {
          const headers = schedData[0].map(h => String(h || "").toLowerCase().replace(/[\s\-_]/g, "").trim());
          let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("player"));
          if (nameIdx === -1) nameIdx = 0;
          let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("cell") || h.includes("mobile"));
          let totalColIdx = headers.indexOf("total");
          if (totalColIdx === -1) totalColIdx = 6; // Column G index = 6 (1-based: 7)

          for (let r = 1; r < schedData.length; r++) {
            const row = schedData[r];
            const pName = String(row[nameIdx] || "").trim();
            const pPhone = phoneIdx !== -1 ? String(row[phoneIdx] || "").replace(/\D/g, "") : "";

            const isPhoneMatch = cleanPhone.length >= 7 && pPhone.length >= 7 && 
              (pPhone.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(pPhone.slice(-7)));
            const isNameMatch = searchName.length >= 2 && pName.toLowerCase().includes(searchName);

            if (isPhoneMatch || isNameMatch) {
              schedSheet.getRange(r + 1, totalColIdx + 1).setValue(scoreVal); // Column G = 7
              schedUpdated = true;
              break;
            }
          }
        }
      }

      if (!scoreUpdated && !schedUpdated) {
        return { success: false, message: `Player '${payload.playerName || payload.phone}' was not found in ${cleanGroup} sheets.` };
      }

      // 3. CLEAR SYSTEM CACHE FOR REAL-TIME UPDATES
      if (typeof CacheService !== 'undefined') {
        try {
          const cache = CacheService.getScriptCache();
          cache.removeAll([
            `UNIFIED_ROSTER_CACHE_${cleanGroup.toUpperCase()}`,
            `checkin_cache_Sched_${cleanGroup}`,
            `SCHEDULE_${cleanGroup}`,
            `APP_INIT_DATA`
          ]);
        } catch (e) {
          logDebug("updatePlayerScore", "Cache clear warning", e.message);
        }
      }

      return {
        success: true,
        message: `Updated score for ${matchedPlayerName} to ${scoreVal} (Score Col E: ${scoreUpdated ? '✓' : '✗'}, Sched Col G: ${schedUpdated ? '✓' : '✗'}).`
      };

    } catch (err) {
      logDebug("updatePlayerScore Error", err.toString(), err.stack);
      return { success: false, message: "Error updating player score: " + err.message };
    }
  });
}
