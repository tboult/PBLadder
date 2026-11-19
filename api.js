

// Initialize group-specific cache dictionary
window.groupRosterCache = window.groupRosterCache || {};


// Add at top of your JS file
window.inFlightRosterRequests = {}; 

async function apiCall(action, payload = {}) {
  if (!action) {
    console.error("❌ [API Error] Action cannot be empty.");
    return Promise.reject(new Error("API action cannot be empty"));
  }

  // --- GROUP-AWARE ROSTER DEDUPLICATION & CACHING ---
  if (action === 'getUnifiedRoster') {
    const targetGroup = payload?.group;
    const isForceRefresh = Boolean(payload?.forceRefresh);
    const groupCache = (targetGroup && window.groupRosterCache && window.groupRosterCache[targetGroup]) || null;

    // 1. Return memory cache immediately if available and not forcing a refresh
    if (!isForceRefresh && Array.isArray(groupCache) && groupCache.length > 0) {
      logDebug(`⚡ [API Cache Hit] Returning cached roster for group: "${targetGroup}"`);
      return Promise.resolve({ success: true, registered: true, players: groupCache, source: 'memory_cache' });
    }

    // 2. IF ALREADY IN-FLIGHT: Attach to the existing promise instead of returning empty players []
    if (window.inFlightRosterRequests[targetGroup]) {
      console.warn(`⏳ [API Request In-Flight] Reusing existing promise for group: "${targetGroup}"`);
      return window.inFlightRosterRequests[targetGroup];
    }
  }

  logDebug(`🚀 [API Call Initiated] "${action}"`, {
    payload,
    time: new Date().toLocaleTimeString()
  });

  // Create the request promise
  const requestPromise = new Promise((resolve, reject) => {
    if (typeof apiQueue !== 'undefined') {
      apiQueue.push({ action, payload, resolve, reject });
      if (typeof isProcessingQueue !== 'undefined' && !isProcessingQueue && typeof processApiQueue === 'function') {
        processApiQueue();
      }
    } else {
      resolve({ success: false, error: 'apiQueue not initialized' });
    }
  });

  // Store in-flight promise if it's a roster fetch
  if (action === 'getUnifiedRoster' && payload?.group) {
    window.inFlightRosterRequests[payload.group] = requestPromise;
  }

  const result = await requestPromise;

  // Clean up in-flight promise tracker
  if (action === 'getUnifiedRoster' && payload?.group) {
    delete window.inFlightRosterRequests[payload.group];
  }

  // Store successful roster responses in memory cache
  if (action === 'getUnifiedRoster' && result && result.success && Array.isArray(result.players) && payload?.group) {
    if (!window.groupRosterCache) window.groupRosterCache = {};
    window.groupRosterCache[payload.group] = result.players;
  }

  logDebug(`✅ [API result] "${action}"`, {
    result,
    time: new Date().toLocaleTimeString()
  });

  return result;
}



let currentRosterFetchPromise = null;
let lastFetchedGroup = null;

/**
 * Shared roster loader with group-aware memory caching and in-flight request deduplication.
 */
async function loadUnifiedRosterData(groupName, forceRefresh = false) {
  if (!groupName) return [];

  // 1. Deduplicate: Return active in-flight Promise if currently fetching for this exact group
  if (currentRosterFetchPromise && lastFetchedGroup === groupName) {
    logDebug(`⏳ [Roster] Reusing in-flight network request for group: "${groupName}"`);
    return currentRosterFetchPromise;
  }

  // 2. Memory Cache: Return cached group roster if available and not forcing a refresh
  if (!forceRefresh && Array.isArray(window.groupRosterCache[groupName]) && window.groupRosterCache[groupName].length > 0) {
    logDebug(`⚡ [Roster Memory Hit] Returning cached roster for group: "${groupName}"`);
    window.cachedRoster = window.groupRosterCache[groupName];
    window.unifiedRoster = window.groupRosterCache[groupName];
    window.appPlayersCache = window.groupRosterCache[groupName];
    return window.groupRosterCache[groupName];
  }

  lastFetchedGroup = groupName;
  const saveBtn = document.getElementById("btnSaveAllScores");

  // 3. UI Loading State
  if (saveBtn) {
    saveBtn.innerText = "⏳ Loading data...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";
  }

  try {
    currentRosterFetchPromise = (async () => {
      try {
        logDebug(`📡 Fetching fresh roster for group: "${groupName}"...`);
        const res = await apiCall('getUnifiedRoster', { group: groupName, forceRefresh: forceRefresh });

        const playersList = (res && res.success) 
          ? (Array.isArray(res.players) ? res.players : (Array.isArray(res.data) ? res.data : null)) 
          : null;

        if (playersList) {
          window.groupRosterCache[groupName] = playersList;
          window.cachedRoster = playersList;
          window.unifiedRoster = playersList;
          window.appPlayersCache = playersList;
          return playersList;
        }
        return window.groupRosterCache[groupName] || window.cachedRoster || [];
      } catch (err) {
        console.error("Error fetching roster:", err);
        return window.groupRosterCache[groupName] || [];
      } finally {
        if (lastFetchedGroup === groupName) {
          currentRosterFetchPromise = null;
        }
      }
    })();

    return await currentRosterFetchPromise;

  } catch (error) {
    console.error("Error in loadUnifiedRosterData:", error);
    return window.groupRosterCache[groupName] || [];
  } finally {
    if (saveBtn) {
      saveBtn.innerText = "💾 Save All Scores";
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
    }
  }
}





async function onGroupRadioChange(selectedGroup) {
  logDebug(`onGroupRadioChange ${selectedGroup}`);
  const cleanGroup = String(selectedGroup).replace(/^(Sched|Score)\s*/i, '').trim() ;

  // 1. Force DOM elements directly to show loading immediately
  const statusDisplay = document.getElementById("frontStatusDisplay");
  const statusBadge = document.getElementById("frontStatusBadge") || document.getElementById("statusBadge");

  if (statusDisplay) {
    statusDisplay.textContent = "⏳ LOOKING UP...";
    statusDisplay.className = "badge bg-warning text-dark";
    statusDisplay.style.setProperty("background-color", "#ffc107", "important");
    statusDisplay.style.setProperty("color", "#000000", "important");
  }
  if (statusBadge) statusBadge.textContent = "LOOKING UP...";
  if (typeof showStatusLoading === 'function') {
    showStatusLoading("⏳ LOOKING UP...");
  }

  // Check-in Tab Elements
  const checkinBadge = document.getElementById("checkinPlayerStatusBadge");
  const checkinStatus = document.getElementById("checkInStatus");
  const checkinName = document.getElementById("checkinPlayerName");
  const userCheckinBtn = document.getElementById("userCheckinBtn");

  if (checkinBadge) {
    checkinBadge.innerText = "⏳ LOOKING UP...";
    checkinBadge.className = "status-badge status-warning";
    checkinBadge.style.backgroundColor = "#ffc107";
    checkinBadge.style.color = "#000000";
  }
  if (checkinStatus) {
    checkinStatus.innerText = `⏳ Loading status for group "${cleanGroup}"...`;
  }
  if (checkinName) {
    checkinName.innerText = `⏳ Loading ${cleanGroup}...`;
  }
  if (userCheckinBtn) {
    userCheckinBtn.innerText = "⏳ Loading...";
    userCheckinBtn.disabled = true;
  }

  await new Promise(resolve => setTimeout(resolve, 50));

  // 2. Sync group selection across storage
  if (typeof setSelectedGroup === 'function') {
    setSelectedGroup(cleanGroup);
  } else {
    localStorage.setItem('scpb_selected_group', cleanGroup);
    localStorage.setItem('scpb_saved_group', cleanGroup);
  }

  // 3. Clear ALL existing group caches & active player references
  window.appPlayersCache = [];
  window.cachedRoster = [];
  window.unifiedRoster = [];
  window.unifiedRosterCache = { data: null, group: null, timestamp: 0 };
  window.activeLookupPlayer = null;
  window.activeLookupFoursome = null;

  // FIX: 4. Replaced duplicate radio code with unified sync function
  syncGroupRadioUI(cleanGroup);
  if (typeof syncAllGroupDropdowns === 'function') syncAllGroupDropdowns(cleanGroup);
  if (typeof updateAllGroupDisplays === 'function') updateAllGroupDisplays(cleanGroup);

  // 5. Fetch fresh roster FIRST before attempting lookup or tab renders
  if (typeof loadUnifiedRosterData === 'function') {
    await loadUnifiedRosterData(cleanGroup, true);
  }

  // 6. Run lookup with newly updated roster populated in memory
  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : (localStorage.getItem('scpb_saved_phone') || '');
  if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
    await loadPlayerStatusFromCache(savedPhone);
  } else if (typeof setAppViewState === 'function') {
    setAppViewState(false, '');
  }

  // 7. Refresh active tab UI elements using cached data
  if (typeof refreshActiveTabData === 'function') {
    await refreshActiveTabData(false);
  }
    
  if (checkinStatus && checkinStatus.innerText.includes("Loading status")) {
    checkinStatus.innerText = "";
  }    
}

async function loadPlayerStatusFromCache(phone) {
  const statusCard = document.getElementById("frontStatusCard");
  const statusDisplay = document.getElementById("frontStatusDisplay");

  if (!statusCard || !statusDisplay) return;

  if (typeof showStatusLoading === "function") {
    showStatusLoading("⏳ LOOKING UP...");
  }

  const selectedGroup = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || 
                        document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked')?.value || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    setAppViewState(false, phone);
    return;
  }

  if (typeof checkAndUnlockAdmin === "function" && phone) {
    checkAndUnlockAdmin(phone);
  }

  let roster = window.appPlayersCache;
  const isRosterForGroup = Array.isArray(roster) && roster.length > 0 && 
    (roster[0]?.group === selectedGroup || roster[0]?.groupName === selectedGroup);

  if (!isRosterForGroup && selectedGroup && typeof loadUnifiedRosterData === "function") {
    roster = await loadUnifiedRosterData(selectedGroup, false);
  }

  const cleanDigits = String(cleanPhone || "").replace(/\D/g, "");
  const savedNameLower = (typeof getSavedName === 'function' ? getSavedName() : '').trim().toLowerCase();

  const phoneMatches = Array.isArray(roster) ? roster.filter(p => {
    const rawValue = p.phone || p.cell || p.mobile || p.phoneNumber || p.id || "";
    const pDigits = String(rawValue).replace(/\D/g, "");
    return pDigits.length >= 7 && cleanDigits.length >= 7 && pDigits.endsWith(cleanDigits.slice(-7));
  }) : [];

  const found = (phoneMatches.length > 1 && savedNameLower)
    ? (phoneMatches.find(p => String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase() === savedNameLower) || phoneMatches[0])
    : (phoneMatches[0] || null);

  if (found) {
    const rawName = found.name || `${found.first || ''} ${found.last || ''}`.trim();
    const isActive = found.active === true || 
                     String(found.active).toLowerCase() === 'true' || 
                     String(found.status).toUpperCase() === 'ACTIVE';

    window.activeLookupPlayer = {
      ...found,
      name: rawName,
      phone: phone,
      group: selectedGroup,
      status: isActive ? "ACTIVE" : "INACTIVE",
      active: isActive,
      existsOnRoster: true,
      checkedIn: found.checkedIn || found.isCheckedIn || false
    };

    if (found.first) localStorage.setItem('scpb_saved_first_name', found.first);
    if (rawName) {
      localStorage.setItem('scpb_saved_player_name', rawName);
      localStorage.setItem('scpb_saved_name', rawName);
    }

    setAppViewState(true, window.activeLookupPlayer);
    updateFrontStatusBadge(isActive ? "ACTIVE" : "INACTIVE");

    if (rawName && document.getElementById("welcomeName")) {
      document.getElementById("welcomeName").textContent = rawName;
      const welcomeBanner = document.getElementById("welcomeBanner");
      if (welcomeBanner) welcomeBanner.style.display = "block";
    }

  } else {
    window.activeLookupPlayer = {
      phone: phone,
      group: selectedGroup,
      status: "UNREGISTERED",
      existsOnRoster: false
    };

    setAppViewState(false, phone);
    redirectToRegistrationTab(phone, selectedGroup);
  }
}


async function triggerAutoCheckIn(options = {}) {
  const { skipGeofence = false } = options;
  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : '';
  const savedName = typeof getSavedName === 'function' ? getSavedName() : '';
  const targetPhoneDigits = String(savedPhone || '').replace(/\D/g, '').slice(-10);
  const normalizedTargetName = String(savedName || '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (!targetPhoneDigits && !normalizedTargetName) {
    return { success: false, skipped: true, message: 'No saved player credentials.' };
  }

  const activeGroup = (typeof getSavedGroup === 'function' && getSavedGroup())
    || document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked')?.value
    || localStorage.getItem('scpb_saved_group')
    || localStorage.getItem('scpb_selected_group')
    || '';

  if (!activeGroup) {
    return { success: false, skipped: true, message: 'No active group selected.' };
  }

  let roster = (window.groupRosterCache && Array.isArray(window.groupRosterCache[activeGroup]))
    ? window.groupRosterCache[activeGroup]
    : (Array.isArray(window.appPlayersCache) && window.appPlayersCache.length > 0
        ? window.appPlayersCache
        : (Array.isArray(window.unifiedRoster) ? window.unifiedRoster : []));

  if (!roster.length && typeof loadUnifiedRosterData === 'function') {
    roster = await loadUnifiedRosterData(activeGroup, false);
  }
  if (!Array.isArray(roster) || !roster.length) {
    return { success: false, skipped: true, message: `No roster loaded for ${activeGroup}.` };
  }

  // 1. Prioritize exact normalized name match (for shared family phone numbers)
  let matchedPlayer = null;
  if (normalizedTargetName) {
    matchedPlayer = roster.find(p =>
      String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase().replace(/\s+/g, ' ') === normalizedTargetName
    );
  }

  // 2. Fall back to 10-digit phone match
  if (!matchedPlayer && targetPhoneDigits) {
    matchedPlayer = roster.find(p =>
      String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '').slice(-10) === targetPhoneDigits
    );
  }

  if (!matchedPlayer) {
    return { success: false, skipped: true, message: `Player not found in ${activeGroup}.` };
  }

  const rawCheck = matchedPlayer.checkedIn ?? matchedPlayer.isCheckedIn ?? '';
  const currentStatus = String(rawCheck).trim().toLowerCase();
  const alreadyCheckedIn = rawCheck === true
    || currentStatus === 'yes'
    || currentStatus === 'checked in'
    || currentStatus === 'true'
    || (typeof rawCheck === 'string' && rawCheck.trim().length > 0 && currentStatus !== 'false' && currentStatus !== 'no');

  if (alreadyCheckedIn) {
    return { success: true, alreadyCheckedIn: true, player: matchedPlayer, message: `✅ ${matchedPlayer.name} is already checked in for ${activeGroup}.` };
  }

  // Enforce geofence for non-admin players
  if (!skipGeofence && typeof checkGeofence === 'function') {
    const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin(savedPhone);
    if (!isAdmin) {
      const allowed = await checkGeofence(savedPhone);
      if (!allowed) {
        return { success: false, blockedByGeofence: true, message: 'Check-in blocked: not at courts.' };
      }
    }
  }

  try {
    const res = await apiCall('checkInPlayer', {
      group: activeGroup,
      groupName: activeGroup,
      sheet: 'Sched ' + activeGroup,
      name: matchedPlayer.name,
      playerName: matchedPlayer.name,
      phone: matchedPlayer.phone || savedPhone,
      status: 'Yes'
    });

    if (res && res.success !== false && !res.error) {
      if (window.groupRosterCache) {
        delete window.groupRosterCache[activeGroup];
      }
      if (typeof loadUnifiedRosterData === 'function') {
        await loadUnifiedRosterData(activeGroup, true);
      }
      return {
        success: true,
        player: matchedPlayer,
        message: res.message || `✅ Auto-checked in ${matchedPlayer.name} for ${activeGroup}!`
      };
    }

    return {
      success: false,
      message: res?.message || res?.error || 'Auto check-in rejected by server.'
    };
  } catch (err) {
    console.error('Auto check-in failed:', err);
    return { success: false, message: err.message || 'Auto check-in network error.' };
  }
}




// Single Consolidated Tab Refresh Handler
async function refreshActiveTabData(forceRefresh = false) {
  const activeTab = localStorage.getItem('activeTab') || 'help';
  const currentGroup = getSavedGroup();

  if (typeof renderHelpGroupRadios === 'function') {
    renderHelpGroupRadios();
  }

  // Ensure radio buttons reflect stored group
  if (currentGroup) {
    setSavedGroup(currentGroup);
  }

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  try {
    // FIX: Always ensure roster is fetched FIRST before attempting child tab updates
    if (currentGroup && typeof loadUnifiedRosterData === 'function') {
      await loadUnifiedRosterData(currentGroup, forceRefresh);
    }

   if (activeTab === 'checkin') {
          if (typeof triggerAutoCheckIn === 'function') {
              await triggerAutoCheckIn();
          }
      const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : '';
      if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
        await loadPlayerStatusFromCache(savedPhone);
      }
   }
      
    if (activeTab === 'checkin') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
    } else if (activeTab === 'admin') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
      if (typeof renderAdminCourts === 'function') await renderAdminCourts(currentGroup);
      if (typeof loadAdminTabData === 'function') await loadAdminTabData(currentGroup);
      if (typeof loadAdminPlayerStatusCache === 'function') await loadAdminPlayerStatusCache(currentGroup);
    } else if (activeTab === 'ranksched' || activeTab === 'schedule') {
      if (typeof loadRankingsAndSched === 'function') {
        await loadRankingsAndSched(currentGroup);
      }
    } else if (activeTab === 'scoreTab' || activeTab === 'score' || activeTab === 'phone') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
      if (typeof lookupPhone === 'function') {
        await lookupPhone();
      }
    } else if (activeTab === 'help') {
      const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : '';
      if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
        await loadPlayerStatusFromCache(savedPhone);
      }
    }
  } catch (err) {
    console.error(`💥 [Tab Refresh Error] Failed rendering tab "${activeTab}":`, err);
  } finally {
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();
  }
}


let checkInPlayersCache = [];


// Replace renderCheckInPlayers to display just the auto-checked user
function renderCheckInPlayers(players) {
  const container = document.getElementById('checkInList');
  if (!container) return;

  const savedPhoneDigits = String((typeof getSavedPhone === 'function' ? getSavedPhone() : '') || '')
    .replace(/\D/g, '')
    .slice(-10);
  const normalizedSavedName = String((typeof getSavedName === 'function' ? getSavedName() : '') || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Match by name first so shared family phones highlight the right player
  let selfPlayer = null;
  if (normalizedSavedName) {
    selfPlayer = (players || []).find(p =>
      String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === normalizedSavedName
    );
  }
  if (!selfPlayer && savedPhoneDigits) {
    selfPlayer = (players || []).find(p =>
      String(p.phone || '').replace(/\D/g, '').slice(-10) === savedPhoneDigits
    );
  }

  container.innerHTML = '';

  (players || []).forEach(player => {
    const isSelf = selfPlayer && player.name === selfPlayer.name;
    const isCheckedIn = ['yes', 'checked in', 'true'].includes(
      String(player.checkedIn || '').trim().toLowerCase()
    );

    const row = document.createElement('div');
    row.className = 'checkin-row' + (isSelf ? ' highlight-self' : '');

    const label = document.createElement('span');
    label.className = 'player-name';
    label.textContent = player.name + (isSelf ? ' (You)' : '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isCheckedIn ? 'btn-checked-in' : 'btn-check-in';
    btn.textContent = isCheckedIn ? 'Checked In ✓' : 'Check In';
    btn.onclick = () => togglePlayerCheckIn(player.name, player.phone, !isCheckedIn);

    row.appendChild(label);
    row.appendChild(btn);
    container.appendChild(row);
  });
}


// Add the new check-in functionality handler for the single user view
async function toggleUserCheckin() {
   const btnEl = document.getElementById('userCheckinBtn');
   if (!btnEl) return;
   
   const phone = btnEl.getAttribute('data-phone');
   const name = btnEl.getAttribute('data-name');
   const curState = btnEl.getAttribute('data-checked') === 'true';
   const newState = !curState;

   // Enforce geofencing if turning ON checkin
   if (newState) {
      const savedPhone = getSavedPhone();
      const allowed = (typeof isUserAdmin === 'function' && isUserAdmin(savedPhone)) ? true : await checkGeofence();
      if (!allowed) return;
   }

   const groupName = getSavedGroup();
   
   btnEl.innerText = "⏳ Updating...";
   btnEl.disabled = true;

   try {
     const res = await apiCall('toggleSingleCheckIn', { 
       sheet: "Sched " + groupName,
       groupName: groupName,
       group: groupName,
       playerName: name, 
       phone: phone, 
       isCheckedIn: newState 
     });
     if (res && (res.success || !res.error)) {
        loadCheckInPlayers(groupName, true); // Refresh local status cache
     } else {
        alert('Failed to update check-in state.');
        btnEl.innerText = curState ? 'Cancel Check-In' : 'Check In';
     }
   } catch (err) {
     alert('Network error toggling check-in state.');
     btnEl.innerText = curState ? 'Cancel Check-In' : 'Check In';
   } finally {
     btnEl.disabled = false;
   }
}

















/**
 * Automatically re-enables the game submit button if a score input is changed.
 */
document.addEventListener('input', function(e) {
  if (e.target && e.target.id && e.target.id.startsWith('sc')) {
    // Extract game number from input ID (e.g., 'sc1_p1' -> '1')
    const match = e.target.id.match(/^sc(\d+)_/);
    if (match) {
      const gameNum = match[1];
      const btn = document.querySelector(`button[onclick*="submitSingleGameScore(${gameNum}"]`);
      if (btn && btn.disabled) {
        btn.innerText = `📤 Update G${gameNum}`;
        btn.style.background = "#0d6efd"; // Blue
        btn.disabled = false;
      }
    }
  }
});

/**
 * Utility feedback caller (toast or alert fallback)
 */
function showFeedback(msg, type) {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    alert(msg.replace(/<[^>]*>/g, ''));
  }
}

/**
 * Standalone, lightweight Toast Notification system.
 * Creates floating, animated notification cards dynamically in the DOM.
 */
function showToast(message, type = 'info') {
  // Ensure container exists
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 90%;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  // Theme mapping
  const themes = {
    success: { bg: '#198754', color: '#ffffff', icon: '✅' },
    warning: { bg: '#ffc107', color: '#000000', icon: '⚠️' },
    danger:  { bg: '#dc3545', color: '#ffffff', icon: '❌' },
    error:   { bg: '#dc3545', color: '#ffffff', icon: '❌' },
    info:    { bg: '#0d6efd', color: '#ffffff', icon: 'ℹ️' }
  };

  const theme = themes[type] || themes.info;

  // Build toast card
  const toast = document.createElement('div');
  toast.style.cssText = `
    background-color: ${theme.bg};
    color: ${theme.color};
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;
    pointer-events: auto;
  `;

  // Strip raw HTML tags if any exist
  const cleanMsg = String(message || '').replace(/<[^>]*>/g, '');
  toast.innerHTML = `<span style="font-size: 1.2rem;">${theme.icon}</span><span>${cleanMsg}</span>`;

  container.appendChild(toast);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Fade out & auto-remove after 3.5s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3500);
}








async function submitUserRegistration(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById('regName');
  const phoneInput = document.getElementById('regPhone');
  const groupInput = document.getElementById('regGroup');
  const statusEl = document.getElementById('regStatus');

  const name = (nameInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();
  const group = groupInput?.value || window.currentGroup || 'Tuesday';

  if (!name || !phone) {
    if (statusEl) {
      statusEl.textContent = 'Please enter both your full name and phone number.';
      statusEl.className = 'status-error';
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = 'Submitting registration...';
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiCall('addNewUser', { name, phone, group });
    const responseMsg = typeof res === 'string'
      ? res
      : (res?.data || res?.message || res?.result || '');

    const isError = /^error\b/i.test(responseMsg) || Boolean(res?.error);
    const isNotice = /^⚠️|^notice\b/i.test(responseMsg) || Boolean(res?.notice);

    if (isError) {
      if (statusEl) {
        statusEl.textContent = responseMsg || 'Registration failed.';
        statusEl.className = 'status-error';
      }
      return;
    }

    if (isNotice) {
      if (statusEl) {
        statusEl.textContent = responseMsg;
        statusEl.className = 'status-warning';
      }
      return;
    }

    if (typeof saveUserCredentials === 'function') {
      saveUserCredentials(name, phone);
    }

    if (statusEl) {
      statusEl.textContent = responseMsg || '✅ Registration complete!';
      statusEl.className = 'status-success';
    }

    const regSection = document.getElementById('registrationSection');
    if (regSection) regSection.style.display = 'none';

    if (typeof loadUnifiedRoster === 'function') {
      await loadUnifiedRoster(true);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + (err.message || err);
      statusEl.className = 'status-error';
    }
  }
}


async function toggleStatus() {
  logDebug(`In togglestatus...`);
  if (!activeLookupPlayer) return;
  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Updating status...';
  logDebug(`In togglestatus with activeLookupPlayer...`);
  try {
    const res = await apiCall('toggleUnifiedActiveStatus', {
      phone: activeLookupPlayer.phone,
      playerName: activeLookupPlayer.name || (typeof getSavedName === 'function' ? getSavedName() : ''),
      groupName: activeLookupPlayer.group,
      group: activeLookupPlayer.group,
      sheet: "Sched " + activeLookupPlayer.group
    });
    if (res && res.success) {
      activeLookupPlayer.status = res.newStatus;
      renderLookupResult(activeLookupPlayer, null);
      if (statusEl) statusEl.innerText = '✅ Status updated to ' + res.newStatus;
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed to update status.';
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error updating status.';
  }
}





function cancelRegistration() {
  const scoreRegSection = document.getElementById('registrationSection');
  if (scoreRegSection) scoreRegSection.style.display = 'none';

  ['regFirst', 'regLast', 'regPhone', 'regEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // --- Tab 1 (Register & Help) Form ---
  const helpAccordion = document.getElementById('registrationAccordion');
  if (helpAccordion) helpAccordion.open = false; // Close accordion

  ['frontRegFirst', 'frontRegLast', 'frontRegPhone', 'frontRegEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Clear any active status messages
  const phoneStatus = document.getElementById('phoneStatus');
  if (phoneStatus) phoneStatus.innerText = '';
}





/*
let checkInRefreshTimer = null;
let checkincnt=0                                      

function startCheckInAutoRefresh() {
   stopCheckInAutoRefresh();
   checkincnt= checkincnt+1;                                                                             
  checkInRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && document.getElementById('checkinTab').classList.contains('active')) {
      loadCheckInPlayers();
    }
  }, 600000);
}

function stopCheckInAutoRefresh() {
  if (checkInRefreshTimer) {
    clearInterval(checkInRefreshTimer);
    checkInRefreshTimer = null;
  }
}
*/

function setSelectedGroup(groupName) {
  const cleanGroup = String(groupName).replace(/^(Sched|Score)\s*/i, '').trim();
  localStorage.setItem('scpb_selected_group', cleanGroup);
  localStorage.setItem('scpb_saved_group', cleanGroup);
  if (typeof setSavedGroup === 'function') {
    setSavedGroup(cleanGroup);
  }
}






// 1. Sync UI state across all radio groups on all tabs
function syncGroupRadioUI(explicitGroup) {
  // Read from parameter OR localStorage, 
  const rawGroup = explicitGroup 
    || localStorage.getItem('scpb_selected_group') 
    || localStorage.getItem('scpb_saved_group') ;

  const cleanGroup = String(rawGroup).replace(/^(Sched|Score)\s*/i, '').trim();

  // FIX: Added 'adminGroupRadio' so all 3 tab radio sets are selected!
  const allGroupRadios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"], input[name="adminGroupRadio"]'
  );

  allGroupRadios.forEach(radio => {
    radio.checked = (radio.value.toLowerCase() === cleanGroup.toLowerCase());
  });

  // Update text badges across all tabs
  document.querySelectorAll('.active-group-label').forEach(el => {
    el.textContent = cleanGroup;
  });
}


// 3. Manual Retry Check-In Action
async function retryCheckinProcess() {
  const statusMsg = document.getElementById('checkInStatus');
  const retryBtn = document.getElementById('retryCheckinBtn');

  if (retryBtn) retryBtn.disabled = true;
  if (statusMsg) statusMsg.textContent = 'Rechecking status...';

  try {
    if (typeof triggerAutoCheckIn === 'function') {
      await triggerAutoCheckIn();
    } else if (typeof refreshActiveTabData === 'function') {
      await refreshActiveTabData();
    }
  } catch (err) {
    console.error('Error retrying check-in:', err);
    if (statusMsg) statusMsg.textContent = 'Error rechecking check-in status.';
  } finally {
    if (retryBtn) retryBtn.disabled = false;
  }
}








function loadSavedPhone() {
  const savedPhone = localStorage.getItem('scpb_saved_phone') || localStorage.getItem('saved_phone') || '';
  const phoneInput = document.getElementById('phoneInput');
  const phoneEntry = document.getElementById('phoneEntrySection');
  
  if (phoneEntry) phoneEntry.style.display = 'block';
  if (phoneInput && savedPhone) {
    phoneInput.value = savedPhone;
  }
  
  if (savedPhone && typeof checkAndUnlockAdmin === 'function') {
    checkAndUnlockAdmin(savedPhone);
  }
}







function onGroupContextUpdated(groupName) {
  // Clear player lookup cache if switching to a different group
  if (activeLookupPlayer && activeLookupPlayer.group !== groupName) {
    activeLookupPlayer = null;
    activeLookupFoursome = null;
    const phoneEntry = document.getElementById('phoneEntrySection');
    if (phoneEntry) phoneEntry.style.display = 'block';
  }

  updateWelcomeBanner();

  const activeTab = document.querySelector('.tab-content.active');
  if (!activeTab) return;

  if (activeTab.id === 'checkinTab') {
    loadCheckInPlayers();
  } else if (activeTab.id === 'rankschedTab') {
    loadRankingsAndSched();
  } else if (activeTab.id === 'adminTab') {
    loadAdminTabData(groupName);
  }
}








/**
 * Helper: Escapes strings safely for placement inside HTML attribute strings
 */
function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}



  
// ====================================================
// UNIFIED ROSTER CACHE & PLAYER STATUS HELPERS
// ====================================================



// Single source of truth for group player roster
window.appPlayersCache = window.appPlayersCache || [];

// Helper to normalize phone numbers (strip non-digits)
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}



/**
 * 1. TAB SWITCHING (Fixed Scoping & Fallback)
 */
async function switchTab(tabId, skipHashUpdate = false) {
  // Define maps outside try/catch so they remain accessible in the catch block
  const tabMap = {
    'help': 'helpTab',
    'checkin': 'checkinTab',
    'score': 'scoreTab',
    'phone': 'scoreTab',
    'enterscore': 'scoreTab',
    'ranksched': 'rankschedTab',
    'admin': 'adminTab'
  };

  const btnMap = {
    'help': 'tabHelpBtn',
    'checkin': 'tabCheckinBtn',
    'score': 'tabScoreBtn',
    'phone': 'tabScoreBtn',
    'enterscore': 'tabScoreBtn',
    'ranksched': 'tabRankschedBtn',
    'admin': 'tabAdminBtn'
  };

  try {
    let currentGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : null;

    // Fallback: If getSavedGroup() wasn't initialized yet, check localStorage directly
    if (!currentGroup) {
      currentGroup = localStorage.getItem('scpb_selected_group') || localStorage.getItem('scpb_saved_group');
    }

    // Require group selection for all tabs except 'help'
    if (!currentGroup && tabId !== 'help') {
      alert('Please select a group in "Config & Setup" before proceeding.');
      tabId = 'help';
    }

    if (typeof updateAllGroupDisplays === 'function') {
      updateAllGroupDisplays(currentGroup);
    }

    // 1. Save to localStorage (PWA persistence)
    localStorage.setItem('activeTab', tabId);

    // 2. Sync URL Hash (Browser Back/Forward support without breaking standalone PWA)
    if (!skipHashUpdate && window.location.hash.replace('#', '') !== tabId) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${tabId}`);
      } else {
        window.location.hash = tabId;
      }
    }

    // Hide all tab views
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.remove('active');
      el.style.display = 'none';
    });

    document.querySelectorAll('.nav button').forEach(el => el.classList.remove('active'));

    // Activate target tab
    const targetId = tabMap[tabId] || (tabId + 'Tab');
    const activeContent = document.getElementById(targetId);
    if (activeContent) {
      activeContent.classList.add('active');
      activeContent.style.display = 'block';
    } else {
      console.warn(`⚠️ [switchTab] Target element #${targetId} not found.`);
    }

    const btnId = btnMap[tabId];
    if (btnId) {
      const activeBtn = document.getElementById(btnId);
      if (activeBtn) activeBtn.classList.add('active');
    }

    // Trigger tab-specific refresh
    if (typeof refreshActiveTabData === 'function') {
      await refreshActiveTabData();
    }

  } catch (err) {
    console.error(`❌ [switchTab Error] Exception during transition to "${tabId}":`, err);
    const fallbackId = tabMap[tabId] || 'helpTab';
    const fallbackEl = document.getElementById(fallbackId);
    if (fallbackEl) {
      fallbackEl.classList.add('active');
      fallbackEl.style.display = 'block';
    }
  }
}





async function handleVersionCheck(serverVersion) {
  if (typeof CURRENT_APP_VERSION !== 'undefined' && serverVersion !== CURRENT_APP_VERSION) {
    const errorMsg = `Version Mismatch!\nClient: v${CURRENT_APP_VERSION}\nServer: v${serverVersion}`;
    console.error(errorMsg);

    const loader = document.getElementById("loader") || document.getElementById("loading-spinner");
    if (loader) loader.style.display = "none";

    const appContainer = document.getElementById("app") || document.body;
    appContainer.innerHTML = `
      <div style="padding: 20px; margin: 40px auto; max-width: 500px; border: 2px solid #d9534f; background-color: #fdf7f7; border-radius: 8px; text-align: center;">
        <h3 style="color: #d9534f; margin-top: 0;">App Version Mismatch</h3>
        <p style="color: #333;">Client (v${CURRENT_APP_VERSION}) does not match server (v${serverVersion}).</p>
        <button onclick="window.location.reload(true)" style="padding: 8px 16px; background-color: #d9534f; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Force Reload Page
        </button>
      </div>
    `;

    throw new Error(`Execution halted: Version mismatch`);
  }
}


async function fetchGroupRoster(group, forceRefresh = false) {
  const cachedGroup = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') ||
                      localStorage.getItem("scpb_saved_group") || 
                      localStorage.getItem("scpb_selected_group");
  const targetGroup = group || cachedGroup;

  if (!targetGroup) return [];

  // Verify memory cache actually matches the target group
  const isCacheForTargetGroup = Array.isArray(window.appPlayersCache) && 
    window.appPlayersCache.length > 0 && 
    window.appPlayersCache[0] && 
    (window.appPlayersCache[0].group === targetGroup || window.appPlayersCache[0].groupName === targetGroup);

  if (!forceRefresh && isCacheForTargetGroup) {
    return window.appPlayersCache;
  }

  const freshPlayers = await loadUnifiedRosterData(targetGroup, forceRefresh) || [];

  if (Array.isArray(freshPlayers) && freshPlayers.length > 0) {
    window.appPlayersCache = freshPlayers;
    return freshPlayers;
  }

  if (window.unifiedRosterCache?.group === targetGroup && Array.isArray(window.unifiedRosterCache?.data) && window.unifiedRosterCache.data.length > 0) {
    window.appPlayersCache = window.unifiedRosterCache.data;
    return window.appPlayersCache;
  }

  return [];
}











/**
 * Checks if a player exists in the roster cache for the given group.
 * @param {string} phone - The phone number entered by the user.
 * @param {string} selectedGroup - The group name to search within.
 * @returns {{exists: boolean, player: object|null}} Result object.
 */
/**
 * Safely checks if a player exists in the active group's roster in frontend memory.
 */
function checkPlayerExists(phone, group) {
  const cleanInput = String(phone || '').replace(/\D/g, '');
  if (!cleanInput || cleanInput.length < 7) {
    return { exists: false, player: null };
  }

  // 1. Safely locate the player array from whatever cache structure exists
  let rosterList = [];

  if (Array.isArray(window.cachedRoster)) {
    rosterList = window.cachedRoster;
  } else if (window.cachedRoster && Array.isArray(window.cachedRoster.players)) {
    rosterList = window.cachedRoster.players;
  } else if (Array.isArray(window.unifiedRoster)) {
    rosterList = window.unifiedRoster;
  } else if (window.unifiedRoster && Array.isArray(window.unifiedRoster.players)) {
    rosterList = window.unifiedRoster.players;
  }

  // Guard against empty or invalid roster data
  if (!Array.isArray(rosterList) || rosterList.length === 0) {
    return { exists: false, player: null };
  }

  // 2. Perform safe search matching last 7 digits of phone
  const targetLast7 = cleanInput.slice(-7);
  let matchedPlayer = null;

  for (let i = 0; i < rosterList.length; i++) {
    const p = rosterList[i];
    if (!p) continue;

    const pPhone = String(p.phone || p.Phone || p.cell || '').replace(/\D/g, '');
    if (pPhone && pPhone.length >= 7 && pPhone.endsWith(targetLast7)) {
      matchedPlayer = p;
      break;
    }
  }

  return {
    exists: !!matchedPlayer,
    player: matchedPlayer
  };
}





// Helper to fill pre-populated values and switch tabs
function redirectToRegistrationTab(phone, group) {
  // 1. Populate values into inputs
  const regPhoneInput = document.getElementById("frontRegPhone") || document.getElementById("regPhone");
  if (regPhoneInput) regPhoneInput.value = phone;

  const regGroupInput = document.getElementById("frontRegGroup") || document.getElementById("regGroup");
  if (regGroupInput && group) regGroupInput.value = group;

  // 2. Ensure parent section (if wrapped in one) is visible
  const regSection = document.getElementById("registrationSection");
  if (regSection) regSection.style.display = "block";

  // 3. Open the <details> accordion programmatically
  const regAccordion = document.getElementById("registrationAccordion") || 
                       (regSection ? regSection.querySelector("details") : document.querySelector("details.card"));

  if (regAccordion) {
    regAccordion.open = true; // Opens the native HTML accordion
    regAccordion.scrollIntoView({ behavior: "smooth", block: "center" }); // Focuses screen on the form
  }
}







  
// ==========================================
// 1. ACCESSIBILITY / TEXT SIZING HANDLER
// ==========================================
const sizeRatios = { 
  normal: '100%',   // Baseline (~16px)
  large:  '125%',   // Medium scale (~20px)
  huge:   '150%'    // Accessibility scale (~24px)
};

function applyTextSize(size) {
  // 1. Fall back to 'large' if size is missing or unrecognized
  const validSize = sizeRatios[size] ? size : 'large';
  const targetSize = sizeRatios[validSize];

  // 2. Set root element font-size for rem scaling cascade
  document.documentElement.style.fontSize = targetSize; 

  // 3. Update active state on button indicators (btn-size-normal, btn-size-large, btn-size-huge)
  ['normal', 'large', 'huge'].forEach(s => {
    const btn = document.getElementById(`btn-size-${s}`);
    if (btn) {
      btn.classList.toggle('active', s === validSize);
    }
  });

  // 4. Persist in localStorage (matches initAccessibility)
  localStorage.setItem('scpb_text_size', validSize);
}

// ==========================================
// 2. MASTER VIEW STATE MANAGER
// ==========================================
function setAppViewState(isFound, playerData) {
  const checkinStatus = document.getElementById("checkInStatus");
  const checkinName = document.getElementById("checkinPlayerName");
  const checkinBadge = document.getElementById("checkinPlayerStatusBadge");
  const userCheckinBtn = document.getElementById("userCheckinBtn");

  if (isFound && playerData && typeof playerData === 'object') {
    // Player found in current group
    const displayName = playerData.name || playerData.playerName || `${playerData.first || ''} ${playerData.last || ''}`.trim();
    if (checkinName) checkinName.innerText = displayName;
    if (checkinStatus) checkinStatus.innerText = ""; // Reset/clear status text
    if (userCheckinBtn) {
      userCheckinBtn.disabled = false;
      const isChecked = playerData.checkedIn || playerData.isCheckedIn;
      userCheckinBtn.innerText = isChecked ? "Cancel Check-in" : "Check In";
    }
  } else {
    // Player NOT found in current group
    if (checkinName) checkinName.innerText = "No player found for this group";
    if (checkinStatus) checkinStatus.innerText = "Please select a valid player or switch groups.";
    if (checkinBadge) {
      checkinBadge.innerText = "NOT FOUND";
      checkinBadge.className = "status-badge status-secondary";
    }
    if (userCheckinBtn) {
      userCheckinBtn.disabled = true;
      userCheckinBtn.innerText = "Check In";
    }
  }
}


// ==========================================
// 3. UI BADGE & BUTTON HELPERS
// ==========================================
function setSaveButtonState(isSaved) {
  const saveBtn = document.getElementById("savePhoneBtn");
  if (!saveBtn) return;

  if (isSaved) {
    saveBtn.style.backgroundColor = "#2d6a4f";
    saveBtn.style.color = "#ffffff";
    saveBtn.innerHTML = "✓ Registered";
    const savedPhone = localStorage.getItem("userPhone") || localStorage.getItem("scpb_saved_phone") || localStorage.getItem("saved_phone") || "";      
    const isAdmin = (typeof isUserAdmin === 'function') && isUserAdmin(savedPhone);
    if (isAdmin) {
      if (typeof checkAndUnlockAdmin === 'function') checkAndUnlockAdmin(savedPhone);
      saveBtn.textContent = "Admin Reg. ✓";
    }
  } else {
    saveBtn.style.backgroundColor = "#ffc107";
    saveBtn.style.color = "#000000";
    saveBtn.innerHTML = "Register";
  }
}

function updateFrontStatusBadge(status) {
  const badge = document.getElementById("frontStatusDisplay");
  if (!badge) return;

  const isActive = String(status).trim().toUpperCase() === "ACTIVE";

  badge.textContent = isActive ? "Active" : "Inactive";
  badge.className = isActive ? "badge bg-success" : "badge bg-danger";
  badge.style.setProperty("background-color", isActive ? "#198754" : "#dc3545", "important");
  badge.style.setProperty("color", "#ffffff", "important");
  badge.style.border = "none";
}

function showStatusLoading(message) {
  const badge = document.getElementById("frontStatusDisplay");
  if (!badge) return;

  badge.textContent = message || "⏳ UPDATING...";
  badge.className = "badge bg-warning text-dark";
  badge.style.setProperty("background-color", "#ffc107", "important");
  badge.style.setProperty("color", "#000000", "important");
  badge.style.border = "none";
}







// ==========================================
// 5. TOGGLE PLAYER STATUS (Direct API & Sheet Sync)
// ==========================================
async function toggleStatusFromSetup() {
  const phone = localStorage.getItem("userPhone") || 
                localStorage.getItem("scpb_saved_phone") || 
                document.getElementById("phoneInput")?.value.trim() || "";
  const selectedGroup = document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked')?.value || 
                        localStorage.getItem('scpb_saved_group') || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");
  const playerName = window.activeLookupPlayer?.name || (typeof getSavedName === 'function' ? getSavedName() : '');

  logDebug(`In togglestatus from Setup 2842...`);
    
  if (!cleanPhone || cleanPhone.length < 7) {
    alert("Please enter a valid phone number first.");
    return;
  }

  if (!selectedGroup) {
    alert("Please select a group first.");
    return;
  }

  showStatusLoading("⏳ UPDATING...");

  try {
    const res = await apiCall('toggleUnifiedActiveStatus', {
      phone: cleanPhone,
      playerName: playerName,
      groupName: selectedGroup,
      group: selectedGroup,
      sheet: "Sched " + selectedGroup
    });

    if (res && res.success) {
      const newStatus = res.newStatus || "ACTIVE";
      const isActive = String(newStatus).toUpperCase() === "ACTIVE";

      if (!window.activeLookupPlayer) window.activeLookupPlayer = {};
      window.activeLookupPlayer.phone = cleanPhone;
      window.activeLookupPlayer.group = selectedGroup;
      window.activeLookupPlayer.status = newStatus;
      window.activeLookupPlayer.active = isActive;

      if (Array.isArray(window.appPlayersCache)) {
        const cachedPlayer = window.appPlayersCache.find(p => {
          const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase();
          if (playerName && pName === playerName.trim().toLowerCase()) return true;
          const pPhone = typeof normalizePhone === "function" 
            ? normalizePhone(p.phone || p.cell || p.mobile || "") 
            : (p.phone || "").replace(/\D/g, "");
          return !playerName && pPhone.length >= 7 && pPhone.endsWith(cleanPhone.slice(-7));
        });

        if (cachedPlayer) {
          cachedPlayer.status = newStatus;
          cachedPlayer.active = isActive;
        }
      }

      updateFrontStatusBadge(newStatus);

      if (typeof filterAdminPlayers === "function" && document.getElementById("adminPlayerStatusList")) {
        filterAdminPlayers();
      }
    } else {
      throw new Error(res?.message || "Server returned failure response");
    }

  } catch (err) {
    console.error("Failed to toggle status on Sheet:", err);
    alert("Failed to update status on Google Sheet. Please try again.");

    const prevStatus = window.activeLookupPlayer?.status || "INACTIVE";
    updateFrontStatusBadge(prevStatus);
  }
}




// ==========================================
// FRONT PAGE REGISTRATION SUBMISSION
// ==========================================
// ==========================================
// 1. VALIDATION HELPERS
// ==========================================

// Requires 10 digits (or 11 starting with 1)
function isValidPhone(phoneStr) {
  if (!phoneStr) return false;
  const digits = phoneStr.replace(/\D/g, ''); // Strip non-numeric chars
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

// Optional field, but if filled must match user@domain.ext
function isValidEmail(emailStr) {
  if (!emailStr || emailStr.trim() === '') return true; 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr.trim());
}








(function loadTheme() {
  const themeLink = document.getElementById('theme-stylesheet');
  const hostname = window.location.hostname;

  // Check if domain is local or explicitly a dev environment
  const isDev = hostname === 'localhost' || 
                hostname === '127.0.0.1' || 
                hostname.includes('dev') || 
                hostname.includes('staging');

  const targetTheme = isDev ? 'devtheme.css' : 'prodtheme.css';

  logDebug(`[Theme Switcher] Host: "${hostname}" | Loading: ${targetTheme}`);
  
  if (themeLink) {
    themeLink.href = targetTheme;
  }
})();      

/**
 * Loads schedule and rankings data for the active group and renders into viewerContent
 */
/**
 * Loads schedule and rankings data for the active group and renders into viewerContent
 */
/**
 * Loads schedule and rankings data for the active group and renders into viewerContent
 */
async function loadRankingsAndSched(targetGroup = null) {
  const checkedRadio = document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked, input[name="adminGroupRadio"]:checked');
  const group = targetGroup
    || (checkedRadio ? checkedRadio.value : '')
    || (typeof getSavedGroup === 'function' ? getSavedGroup() : '');

  const statusEl = document.getElementById('viewerStatus');
  const contentEl = document.getElementById('viewerContent');

  if (!contentEl) {
    console.error('💥 [Rankings Error] Target element "#viewerContent" not found in DOM.');
    return;
  }

  if (statusEl) statusEl.style.display = 'block';
  contentEl.style.display = 'block';

  let parent = contentEl.parentElement;
  while (parent && parent !== document.body) {
    if (window.getComputedStyle(parent).display === 'none') {
      parent.style.display = 'block';
      parent.classList.add('active', 'show');
      parent.classList.remove('hidden', 'd-none');
    }
    parent = parent.parentElement;
  }

  if (!group) {
    if (statusEl) statusEl.innerText = 'Please select a group.';
    return;
  }

  if (statusEl) statusEl.innerHTML = '<span class="loading-spinner"></span>Loading schedule & standings...';

  try {
    logDebug(`📊 [Rankings & Sched] Requesting fresh data for group: "${group}"`);
    const res = await apiCall('getRankingsAndSchedData', {
      group: group,
      nocache: true,
      _t: Date.now()
    });

    if (statusEl) statusEl.innerText = '';

    if (!res || (res.success === false && !Array.isArray(res.rankings) && typeof res.html !== 'string')) {
      const errMsg = (res && (res.message || res.error)) || `No renderable data returned for group "${group}".`;
      contentEl.innerHTML = `<i>${errMsg}</i>`;
      return;
    }

    renderRankingsAndSchedule(res);
  } catch (e) {
    console.error("💥 Error loading schedule & standings:", e);
    if (statusEl) statusEl.innerText = e.message || "Network error loading data.";
  }
}




// ==========================================
// GEOFENCE & ADMIN CONFIGURATION
// ==========================================
const GEOFENCE_RADIUS_METERS = 300;

const ALLOWED_GEOFENCE_LOCATIONS = [
  { lat: 33.65362909476011, lng: -112.27699205631843, name: "Marinette Pickleball Courts" },
  { lat: 33.612973981080074, lng: -112.27032707707161, name: "Boult House" }     
];


// Helper: Strip non-digits from phone numbers for exact comparison
function cleanPhoneNumber(phone) {
  return String(phone || '').replace(/\D/g, '');
}

// Helper: Get user phone from storage or DOM inputs
function getCurrentUserPhone() {
  const stored = localStorage.getItem('userPhone') || 
                 localStorage.getItem('phone') || 
                 localStorage.getItem('userPhoneNum') || '';
  if (stored) return stored;

  const phoneEl = document.getElementById('userPhone') || 
                  document.getElementById('checkInPhone') || 
                  document.getElementById('phone');
  return phoneEl ? phoneEl.value : '';
}

// ==========================================
// HAVERSINE DISTANCE CALCULATOR
// ==========================================
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==========================================
// GEOFENCE CHECK WITH ADMIN BYPASS
// ==========================================
function checkGeofence(userPhoneOverride) {
  return new Promise((resolve) => {
    const statusElement = document.getElementById('checkInStatus');

    // 1. ADMIN BYPASS CHECK
    const rawUserPhone = userPhoneOverride || getCurrentUserPhone();
    const cleanUser = cleanPhoneNumber(rawUserPhone);

    if (cleanUser && typeof ADMIN_PHONES !== 'undefined' && Array.isArray(ADMIN_PHONES)) {
      const isAdmin = ADMIN_PHONES.some(adminPhone => {
        const cleanAdmin = cleanPhoneNumber(adminPhone);
        return cleanAdmin && (cleanUser === cleanAdmin || cleanUser.endsWith(cleanAdmin));
      });

      if (isAdmin) {
        logDebug("⚡ Admin phone detected (" + cleanUser + "). Bypassing geofence restriction.");
        if (statusElement) {
          statusElement.innerHTML = '';
        }
        resolve(true);
        return;
      }
    }

    // 2. GEOLOCATION AVAILABILITY CHECK
    if (!navigator.geolocation) {
      const errMsg = "❌ Geolocation Error: Location services are not supported by your browser or device.";
      if (statusElement) {
        statusElement.innerHTML = '<div style="color: var(--btn-danger-bg, #dc3545); background: #ffe6e6; border: 1px solid var(--btn-danger-bg, #dc3545); padding: 0.75rem; border-radius: 0.5rem; text-align: left;">' + errMsg + '</div>';
      }
      alert("Geolocation is not supported by your browser/device.");
      resolve(false);
      return;
    }

    if (statusElement) {
      statusElement.innerHTML = '<span class="loading-spinner"></span> Verifying your location at the courts...';
    }

    // 3. GET POSITION & CALCULATE DISTANCE
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        let isWithinFence = false;
        let minDistanceMeters = Infinity;
        let nearestLocName = "";

        for (const loc of ALLOWED_GEOFENCE_LOCATIONS) {
          const dist = haversineDistanceMeters(userLat, userLng, loc.lat, loc.lng);
          if (dist < minDistanceMeters) {
            minDistanceMeters = dist;
            nearestLocName = loc.name || "Pickleball Courts";
          }
          if (dist <= GEOFENCE_RADIUS_METERS) {
            isWithinFence = true;
            break;
          }
        }

        if (!isWithinFence) {
          const distMeters = Math.round(minDistanceMeters);
          const distFeet = Math.round(minDistanceMeters * 3.28084);
          const distMiles = (minDistanceMeters / 1609.34).toFixed(2);
          const maxMeters = GEOFENCE_RADIUS_METERS;
          const maxFeet = Math.round(GEOFENCE_RADIUS_METERS * 3.28084);

          const userNotice = '📍 <b>Check-In Location Restriction</b><br>' +
            'You must be physically at the Sun City Pickleball Courts to check in.<br><br>' +
            '• <b>Nearest Venue:</b> ' + nearestLocName + '<br>' +
            '• <b>Your Current Distance:</b> ~' + distMeters + ' meters (~' + distFeet + ' ft / ' + distMiles + ' miles) away<br>' +
            '• <b>Allowed Check-In Distance:</b> Within ' + maxMeters + ' meters (~' + maxFeet + ' ft)<br><br>' +
            '<i>Please move closer to the pickleball courts and try again once you arrive at the courts.</i>';

          if (statusElement) {
            statusElement.innerHTML = '<div style="color: #721c24; background-color: #f8d7da; border: 2px solid #f5c6cb; padding: 0.85rem; border-radius: 0.5rem; text-align: left; font-size: 0.95rem; line-height: 1.4;">' + userNotice + '</div>';
          }

          alert('📍 Check-In Blocked: Not At Courts\n\nYou must be within ' + maxMeters + ' meters (~' + maxFeet + ' ft) of the pickleball courts to check in.\n\nYour current distance is ~' + distMeters + ' meters (' + distMiles + ' miles) away from ' + nearestLocName + '.\n\nPlease check in once you arrive at the courts!');
          
          resolve(false);
        } else {
          if (statusElement) {
            statusElement.innerHTML = '';
          }
          resolve(true);
        }
      },
      (error) => {
        let errorDetail = "Could not verify location.";
        let detailedInstruction = "";

        if (error.code === error.PERMISSION_DENIED) {
          errorDetail = "Location permission denied.";
          detailedInstruction = "To check in, please enable Location / GPS permissions for this app or browser in your mobile device settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorDetail = "Location position unavailable.";
          detailedInstruction = "Your device could not get a GPS fix. Ensure GPS / Location services are enabled and you have a clear view of the sky.";
        } else if (error.code === error.TIMEOUT) {
          errorDetail = "Location request timed out.";
          detailedInstruction = "GPS location request timed out. Please try tapping check-in again.";
        }

        const fullErrorMsg = '⚠️ <b>Location Access Needed</b><br>' + errorDetail + '<br><br>' + detailedInstruction;

        if (statusElement) {
          statusElement.innerHTML = '<div style="color: #856404; background-color: #fff3bf; border: 2px solid #ffeba0; padding: 0.85rem; border-radius: 0.5rem; text-align: left; font-size: 0.95rem; line-height: 1.4;">' + fullErrorMsg + '</div>';
        }

        alert('Geofence Location Error:\n\n' + errorDetail + '\n\n' + detailedInstruction);
        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}      

  





// Global Roster Cache with Timestamp
window.unifiedRosterCache = {
  data: null,
  group: null,
  timestamp: 0
};





/**
 * Updates status banner display at top of Enter Scores tab
 */
function updateAutoCheckinBanner(message, type = 'success') {
  const banner = document.getElementById('scoreAutoCheckinBanner') || document.getElementById('autoCheckinStatusBanner');
    if (!banner) return;

  banner.style.display = 'block';
  if (type === 'success') {
    banner.style.backgroundColor = '#d1e7dd';
    banner.style.color = '#0f5132';
    banner.style.border = '1px solid #badbcc';
  } else {
    banner.style.backgroundColor = '#fff3cd';
    banner.style.color = '#664d03';
    banner.style.border = '1px solid #ffecb5';
  }
  banner.innerHTML = message;
}





function submitFrontPageRegistration() {
  if (typeof submitUserRegistration === 'function') submitUserRegistration();
}




async function processApiQueue() {
  if ((typeof isProcessingQueue !== 'undefined' && isProcessingQueue) || typeof apiQueue === 'undefined' || apiQueue.length === 0) return;
  isProcessingQueue = true;

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  const { action, payload, resolve, reject } = apiQueue.shift();
  const endpoint = window.API_URL || (typeof API_URL !== 'undefined' ? API_URL : null);

  const targetSheet = payload.sheet || payload.sheetName || payload.scoreSheetName || "N/A";
  const targetGroup = payload.groupName || payload.group || "N/A";

  logDebug(`📡 [API Dispatch] Sending "${action}" to server...`, {
    action,
    group: targetGroup,
    sheet: targetSheet,
    payload
  });

  if (!endpoint) {
    const errMessage = "API_URL is not configured.";
    console.error(`❌ [API Error] ${errMessage}`);
    resolve({ success: false, registered: false, error: errMessage });

    // [CHANGE]: Safely unlock queue state and re-trigger queue processing if API_URL is missing.
    isProcessingQueue = false;
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();
    if (apiQueue.length > 0) processApiQueue();
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const rawText = await response.text();
    clearTimeout(timeoutId);
      
  
    const rawText = await response.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // [CHANGE]: Intercept HTML responses from Google Apps Script (which occur on unhandled script exceptions).
      // Returning standard JSON prevents UI parsing exceptions from stalling future requests.
      if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
        console.warn(`⚠️ [API Intercepted HTML Error] Action "${action}" returned HTML.`);
        resolve({
          success: false,
          registered: false,
          htmlError: true,
          message: `Unregistered or server error on "${action}"`
        });
        return;
      }

      console.error(`💥 [API Parse Error] Action "${action}" returned non-JSON text:`, rawText);
      resolve({
        success: false,
        registered: false,
        error: `Invalid JSON response: ${rawText.substring(0, 80)}...`
      });
      return;
    }

    // [CHANGE]: Standardize response unwrapping logic.
    // If the backend returns 'data.data', unwrap it while explicitly injecting 'success: true' and 'registered: true' 
    // to guarantee properties exist on caller functions.
    if (data && (data.status === "success" || data.success === true)) {
      logDebug(`✅ [API Success] "${action}":`, data.data || data);
      let unwrapped = (data.data !== undefined) ? data.data : data;

      if (typeof unwrapped === 'object' && unwrapped !== null && !Array.isArray(unwrapped)) {
        if (unwrapped.success === undefined) unwrapped.success = true;
        if (unwrapped.registered === undefined) unwrapped.registered = true;
        resolve(unwrapped);
      } else if (Array.isArray(unwrapped)) {
        // [CHANGE]: If the backend returned a plain array, wrap it into a standardized object format.
        resolve({ success: true, registered: true, players: unwrapped, data: unwrapped });
      } else {
        resolve({ success: true, registered: true, data: unwrapped });
      }
    } else if (data && (data.status === "error" || data.registered === false)) {
      console.warn(`⚠️ [API Backend Unregistered/Error] "${action}":`, data.message || 'Not registered', data);
      resolve({
        success: false,
        registered: false,
        message: data.message || 'User not found/registered'
      });
    } else {
      clearTimeout(timeoutId);
      logDebug(`✅ [API Response] Raw data returned for "${action}":`, data);
      resolve(data);
    }
  } catch (err) {
    console.error(`❌ [API Request Failed] Action "${action}" failed:`, err);
    resolve({ success: false, registered: false, error: err.message });
  } finally {
    // [CHANGE]: Guarantees that processing flags are reset and loader state is updated regardless of network outcomes.
    isProcessingQueue = false;
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();
    if (typeof apiQueue !== 'undefined' && apiQueue.length > 0) {
      processApiQueue();
    }
  }
}






/**
 * Unified storage helpers for player session data.
 */
function getSavedPhone() {
  // Migrate legacy 'cachedPhone' if present
  const legacyPhone = localStorage.getItem('cachedPhone');
  if (legacyPhone) {
    localStorage.setItem('scpb_saved_phone', legacyPhone);
    localStorage.removeItem('cachedPhone'); // Clean up redundant key
    return legacyPhone;
  }
  return localStorage.getItem('scpb_saved_phone') || localStorage.getItem('saved_phone') || '';
}

/**
 * Retrieves the saved player name from localStorage.
 * If missing, attempts to resolve it using the saved phone and cached roster array,
 * automatically saving it to localStorage once found.
 */
function getSavedName() {
  // 1. Direct check in localStorage
  let savedName = localStorage.getItem('scpb_saved_name') || localStorage.getItem('scpb_saved_player_name') || '';
  if (savedName) {
    return savedName;
  }

  // 2. Fallback: Resolve via saved phone and cached roster array
  const savedPhone = typeof getSavedPhone === 'function' 
    ? getSavedPhone() 
    : (localStorage.getItem('scpb_saved_phone') || '');
    
  const cleanPhone = String(savedPhone).replace(/\D/g, '');

  if (cleanPhone.length === 10) {
    // Check available cached player arrays
    const roster = (typeof checkInPlayersCache !== 'undefined' && Array.isArray(checkInPlayersCache))
      ? checkInPlayersCache
      : (typeof playersCache !== 'undefined' && Array.isArray(playersCache) ? playersCache : []);

    if (roster.length > 0) {
      const match = roster.find(p => {
        const pPhone = String(p.phone || p.id || p.cell || p.playerId || '').replace(/\D/g, '');
        return pPhone === cleanPhone;
      });

      if (match) {
        savedName = `${match.first || ''} ${match.last || ''}`.trim() || match.name || match.playerName || '';

        // 3. Cache retrieved name to localStorage for instant subsequent loads
        if (savedName && savedName !== 'Unknown' && savedName !== 'Player') {
          localStorage.setItem('scpb_saved_name', savedName);
          return savedName;
        }
      }
    }
  }

  return '';
}

function savePlayerCredentials(phone, name) {
  logDebug(` in SavePlayerCredential:`, phone, name);                  
  if (phone) {
    logDebug(` caching phone:`, phone, phone.length);                      
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      localStorage.setItem('scpb_saved_phone', cleanPhone);
      localStorage.setItem('saved_phone', cleanPhone);
      logDebug(` caching phone:`, cleanPhone);              
    }
  }
  if (name && typeof name === 'string') {
    localStorage.setItem('scpb_saved_name', name.trim());
    logDebug(` caching name:`, name);      
  }
}  


function handleRadioClick(event) {
  if (event.target && event.target.value) {
    onGroupRadioChange(event.target.value);
  }
}



// Listen for browser forward/back button navigation (if running in standard browser)
window.addEventListener('hashchange', () => {
  const hashTab = window.location.hash.replace('#', '').trim();
  if (hashTab) {
    switchTab(hashTab, true);
  }
});


async function handlePlayerNotFoundInCurrentGroup(searchedPhone, currentGroup) {
  logDebug("handlePlayerNotFoundInCurrentGroup:", searchedPhone, currentGroup);
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');

  try {
    // 1. Search all other groups for this phone number
//    const crossRes = await apiCall('findPlayerAcrossGroups', { phone: searchedPhone });
      const crossRes = null;
    if (crossRes && crossRes.found && crossRes.player) {
      const p = crossRes.player;

      // 2. Auto-fill registration input fields on active tab
      const firstInput = document.getElementById('frontRegFirst') || document.getElementById('regFirst');
      const lastInput = document.getElementById('frontRegLast') || document.getElementById('regLast');
      const phoneInput = document.getElementById('frontRegPhone') || document.getElementById('regPhone');
      const emailInput = document.getElementById('frontRegEmail') || document.getElementById('regEmail');

      if (firstInput) firstInput.value = p.firstName;
      if (lastInput) lastInput.value = p.lastName;
      if (phoneInput) phoneInput.value = p.phone || searchedPhone;
      if (emailInput) emailInput.value = p.email || '';

      // 3. Reveal and expand registration form
      const helpAccordion = document.getElementById('registrationAccordion');
      if (helpAccordion) helpAccordion.open = true;

      const regSection = document.getElementById('registrationSection');
      if (regSection) regSection.style.display = 'block';

      // 4. Prompt user with auto-fill notification
      if (statusMsg) {
        statusMsg.innerHTML = `ℹ️ Found profile in group <strong>"${p.foundInGroup}"</strong>! Details filled below. Click <strong>Register</strong> to join <strong>"${currentGroup}"</strong>.`;
        statusMsg.style.color = "#0d6efd"; // Info blue
      }
    } else {
      // Standard new player registration prompt
      if (statusMsg) {
        statusMsg.innerText = `Phone number not registered. Please complete registration below for ${currentGroup}.`;
        statusMsg.style.color = "#dc3545";
      }

      const helpAccordion = document.getElementById('registrationAccordion');
      if (helpAccordion) helpAccordion.open = true;

      const regSection = document.getElementById('registrationSection');
      if (regSection) regSection.style.display = 'block';
    }
  } catch (err) {
    console.error("Error during cross-group lookup:", err);
  }
}

async function checkRegistrationStatus(phone) {
  logDebug("checkregistrationstatus:", phone);
  const cleanPhoneInput = String(phone || '').replace(/\D/g, '');
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');

  localStorage.removeItem('scpb_saved_phone'); // Clean up old key as they start typine

  if (!cleanPhoneInput || cleanPhoneInput.length < 10) {
    if (statusMsg) {
      statusMsg.innerText = "Please enter a valid 10 digit phone number.";
      statusMsg.style.color = "#dc3545";
    }
    return;
  }

  // 1. Check current group roster in frontend memory
  const roster = window.cachedRoster || window.unifiedRoster || [];
  const foundInCurrent = roster.find(p => {
    const pPhone = String(p.phone || '').replace(/\D/g, '');
    return pPhone && pPhone.endsWith(cleanPhoneInput.slice(-7));
  });

  if (foundInCurrent) {
    // Found in current group -> Load Dashboard
    localStorage.setItem('registered_' + cleanPhoneInput, 'true');
    localStorage.setItem('scpb_saved_phone', cleanPhoneInput);
    if (typeof loadActivePlayerDashboard === 'function') loadActivePlayerDashboard();
    return;
  }

  // 2. NOT in current group -> Call handlePlayerNotFoundInCurrentGroup
  await handlePlayerNotFoundInCurrentGroup(cleanPhoneInput);
}


/**
 * Handles checking registration and auto-checking in based on user role
 */
/**
 * Handles checking registration and auto-checking in based on user role
 */
async function savePhoneToCache(explicitPhone) {
  const phoneInput = document.getElementById('phoneInput');
  let rawPhone = (typeof explicitPhone === 'string' && explicitPhone.trim())
    ? explicitPhone
    : ((phoneInput ? phoneInput.value : '') || getSavedPhone());

  let phone = String(rawPhone).replace(/\D/g, '');
  if (phone.length === 11 && phone.startsWith('1')) {
    phone = phone.slice(1);
  }

  if (phone.length !== 10) {
    alert('Please enter a valid 10-digit phone number.');
    return;
  }

  savePlayerCredentials(phone);
  const currentGroup = getSavedGroup();

  if (!currentGroup) {
    alert('Please select a group first.');
    return;
  }

  const saveBtn = document.getElementById('savePhoneBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Checking...';
  }

  let isRegisteredMatch = false;

  try {
    // 1. Fetch current roster to check registration (matching last 7 digits)
    const roster = await loadUnifiedRosterData(currentGroup, false) || [];
    const targetTail = phone.slice(-7);

    const matchedPlayer = roster.find(p => {
      const pPhone = String(p.phone || p.cell || p.mobile || p.id || p.playerId || '').replace(/\D/g, '');
      return pPhone.length >= 7 && pPhone.endsWith(targetTail);
    });

    const regAccordion = document.getElementById('registrationAccordion');

    if (matchedPlayer) {
      isRegisteredMatch = true;

      // A. Keep "New Player" detail box collapsed
      if (regAccordion) regAccordion.open = false;

      const pName = `${matchedPlayer.first || ''} ${matchedPlayer.last || ''}`.trim()
        || matchedPlayer.name
        || matchedPlayer.playerName
        || '';
      savePlayerCredentials(phone, pName);

      // Sync front status badge & welcome banner
      if (typeof loadPlayerStatusFromCache === 'function') {
        await loadPlayerStatusFromCache(phone);
      }

      // B. Auto Check-In
      const checkinResult = await triggerAutoCheckIn();

      // C. Routing logic based on Admin status
      const isAdmin = (typeof isUserAdmin === 'function') && isUserAdmin(phone);
      if (isAdmin) {
        if (typeof checkAndUnlockAdmin === 'function') checkAndUnlockAdmin(phone);
        switchTab('admin');
      } else {
        switchTab('score');
        const bannerType = (checkinResult && checkinResult.success === false) ? 'warning' : 'success';
        const statusMsg = checkinResult?.message || '✅ Auto-checked in successfully!';
        if (typeof updateAutoCheckinBanner === 'function') {
          updateAutoCheckinBanner(statusMsg, bannerType);
        }
      }
    } else {
      // --- UNREGISTERED PLAYER ---
      // Expand detail box so they can register
      if (regAccordion) regAccordion.open = true;
      alert(`⚠️ Phone number not registered in ${currentGroup}. Please complete registration in the box below.`);
    }
  } catch (err) {
    console.error('Error checking registration:', err);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
    }
    if (typeof setSaveButtonState === 'function') {
      setSaveButtonState(isRegisteredMatch);
    }
  }
}


/**
 * Synchronizes group state between localStorage and UI radio inputs across all tabs
 */
function getSavedGroup() {
  const selectedRadio = document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked');
  if (selectedRadio && selectedRadio.value) {
    const cleanGroup = String(selectedRadio.value).replace(/^(Sched|Score)\s*/i, '').trim();
    localStorage.setItem('scpb_saved_group', cleanGroup);
    localStorage.setItem('scpb_selected_group', cleanGroup);
    return cleanGroup;
  }
  return localStorage.getItem('scpb_saved_group') || localStorage.getItem('scpb_selected_group') || '';
}

function setSavedGroup(groupName) {
  if (!groupName) return;
  const cleanGroup = String(groupName).replace(/^(Sched|Score)\s*/i, '').trim();
  localStorage.setItem('scpb_saved_group', cleanGroup);
  localStorage.setItem('scpb_selected_group', cleanGroup);
  
  // Sync all radio elements matching this group name across all tabs
  const radios = document.querySelectorAll('input[name="helpGroupRadio"], input[name="checkinGroupRadio"]');
  radios.forEach(radio => {
    radio.checked = (radio.value.toLowerCase() === cleanGroup.toLowerCase());
  });
}

// 1. Update restoreActiveTabOnLoad to ensure saved group is loaded into memory first
function restoreActiveTabOnLoad() {
  const hashTab = window.location.hash.replace('#', '').trim();
  const savedTab = localStorage.getItem('activeTab');
  const initialTab = hashTab || savedTab || 'help';

  // Restore saved group into memory before evaluating switchTab guards
  const savedGroup = localStorage.getItem('scpb_selected_group') || localStorage.getItem('scpb_saved_group');
  if (savedGroup && typeof setSavedGroup === 'function') {
    setSavedGroup(savedGroup);
  }

  switchTab(initialTab, true);
}


let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
});  

// Global listener: Persist group selection immediately when clicked on any tab
document.addEventListener('change', (e) => {
  if (e.target && (e.target.name === 'helpGroupRadio' || e.target.name === 'checkinGroupRadio')) {
    setSavedGroup(e.target.value);
    // Note: onGroupRadioChange handles full roster fetch, status check, and tab refresh cleanly
  }
});





/**
 * Helper to define matchups and sit-outs dynamically based on court size.
 */
function getCourtMatchups(numPlayers) {
  if (numPlayers === 4) {
    return [
      { t1: [0, 1], t2: [2, 3], out: [] },
      { t1: [0, 2], t2: [1, 3], out: [] },
      { t1: [0, 3], t2: [1, 2], out: [] }
    ];
  } else if (numPlayers === 5) {
    return [
      { t1: [0, 1], t2: [2, 3], out: [4] },
      { t1: [0, 4], t2: [1, 2], out: [3] },
      { t1: [0, 3], t2: [4, 1], out: [2] },
      { t1: [0, 2], t2: [3, 4], out: [1] },
      { t1: [1, 3], t2: [2, 4], out: [0] }
    ];
  } else if (numPlayers === 6) {
    return [
      { t1: [0, 1], t2: [2, 3], out: [4, 5] },
      { t1: [0, 4], t2: [1, 5], out: [2, 3] },
      { t1: [2, 4], t2: [3, 5], out: [0, 1] },
      { t1: [0, 2], t2: [1, 3], out: [4, 5] },
      { t1: [0, 5], t2: [1, 4], out: [2, 3] },
      { t1: [3, 4], t2: [2, 5], out: [0, 1] }
    ];
  }
  return [];
}

function submitSingleGameScore(gameNum, btnElement) {
  const btn = btnElement || (typeof event !== 'undefined' ? event.target : null);
  const numPlayers = activeLookupFoursome ? activeLookupFoursome.length : 0;

  if (numPlayers < 4 || numPlayers > 6) {
    showFeedback("⚠️ Active 4, 5, or 6-player court match assignment required.", "warning");
    return;
  }

  const scAInput = document.getElementById(`sc${gameNum}_p1`);
  const scBInput = document.getElementById(`sc${gameNum}_p2`);

  if (!scAInput || !scBInput) return;

  const scoreAVal = scAInput.value.trim();
  const scoreBVal = scBInput.value.trim();

  if (scoreAVal === "" || scoreBVal === "") {
    showFeedback(`⚠️ Please enter scores for both teams in Game ${gameNum}.`, "warning");
    return;
  }

  const scoreA = parseInt(scoreAVal, 10);
  const scoreB = parseInt(scoreBVal, 10);

  if (isNaN(scoreA) || isNaN(scoreB)) {
    showFeedback("⚠️ Scores must be valid numbers.", "warning");
    return;
  }

  const getPName = p => (typeof p === 'object' && p !== null ? (p.name || `${p.first || ''} ${p.last || ''}`.trim()) : String(p || ''));
  const matchups = getCourtMatchups(numPlayers);
  const match = matchups[gameNum - 1];
  let scoresPayload = [];

  match.t1.forEach(idx => {
    scoresPayload.push({ name: getPName(activeLookupFoursome[idx]), [`g${gameNum}`]: scoreA });
  });
  
  match.t2.forEach(idx => {
    scoresPayload.push({ name: getPName(activeLookupFoursome[idx]), [`g${gameNum}`]: scoreB });
  });

  const groupName = (activeLookupPlayer && activeLookupPlayer.group) || 
                    (typeof getSavedGroup === 'function' ? getSavedGroup() : '');
  
  const submitterName = getPName(activeLookupPlayer) || 
                        (activeLookupPlayer && activeLookupPlayer.phone) || '';

  const originalText = btn ? btn.innerText : `📤 Submit G${gameNum}`;
  const originalBg = btn ? btn.style.background : "#0d6efd";

  if (btn) {
    btn.innerText = "⏳ Submitting...";
    btn.disabled = true;
    btn.style.background = "#6c757d";
  }

  let handled = false;

  const handleResponse = (rawRes) => {
    if (handled) return; 
    handled = true;

    try {
      const res = (rawRes && rawRes.result) ? rawRes.result : ((rawRes && rawRes.data) ? rawRes.data : rawRes);
      let isSuccess = false;
      let msg = "";

      if (typeof res === 'string') {
        isSuccess = res.includes("Successfully") || res.includes("✅");
        msg = res;
      } else if (res && typeof res === 'object') {
        isSuccess = Boolean(res.success);
        msg = res.message || (isSuccess ? `✅ Game ${gameNum} scores saved!` : "Error submitting scores.");
      }

      if (isSuccess && groupName && window.groupRosterCache) {
        delete window.groupRosterCache[groupName];
      }

      showFeedback(msg, isSuccess ? "success" : "danger");

      if (btn) {
        if (isSuccess) {
          btn.innerText = `✅ G${gameNum} Submitted`;
          btn.style.background = "#198754";
          btn.style.color = "#ffffff";
          btn.disabled = true;
        } else {
          btn.innerText = originalText;
          btn.style.background = originalBg;
          btn.disabled = false;
        }
      }        

    } catch (err) {
      console.error("Response handling error:", err);
      if (btn) {
        btn.innerText = originalText;
        btn.style.background = originalBg;
        btn.disabled = false;
      }
    }
  };

  const payload = {
    group: groupName,
    submittedByName: submitterName,
    scores: scoresPayload
  };

  try {
    if (typeof apiCall === 'function') {
      const promiseOrResult = apiCall('submitCourtScores', payload);
      if (promiseOrResult && typeof promiseOrResult.then === 'function') {
        promiseOrResult
          .then(handleResponse)
          .catch(err => handleResponse({ success: false, message: (err && err.message) || String(err) }));
      }
    } else if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(handleResponse)
        .withFailureHandler(err => handleResponse({ success: false, message: (err && err.message) || String(err) }))
        .submitCourtScores(payload);
    } else {
      handleResponse({ success: false, message: "Backend communication interface unavailable." });
    }
  } catch (err) {
    handleResponse({ success: false, message: "Execution error: " + err.message });
  }
}





/**
 * Renders rankings and omits schedule as requested.
 */
/**
 * Renders rankings JSON (or legacy HTML string) into #viewerContent.
 */
/**
 * Renders rankings JSON (or legacy HTML string) into #viewerContent.
 * Columns: Rank | Name | Pt % | Pts | Weeks
 */
/**
 * Renders rankings JSON (or legacy HTML string) into #viewerContent.
 * Preserves the unified mixed 1..N ranking order returned by the backend.
 * Columns: Rank | Name | Pt % | Pts | Weeks
 */
function renderRankingsAndSchedule(rawData) {
  const viewerContent = document.getElementById('viewerContent');
  if (!viewerContent) return;

  const esc = (val) => String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const data = (rawData && typeof rawData === 'object' && rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data))
    ? rawData.data
    : rawData;

  if (typeof data === 'string') {
    viewerContent.innerHTML = data;
    return;
  }

  if (data && typeof data.html === 'string') {
    viewerContent.innerHTML = data.html;
    return;
  }

  if (data && typeof data.rankingsHtml === 'string') {
    viewerContent.innerHTML = data.rankingsHtml;
    return;
  }

  const rawList = data && (data.rankings || data.ranks || data.standings || data.players);

  if (!Array.isArray(rawList)) {
    viewerContent.innerHTML = `<pre style="white-space:pre-wrap; word-break:break-word;">${esc(JSON.stringify(data, null, 2))}</pre>`;
    return;
  }

  // Keep active players in the exact unified mixed rank order from the backend, with INACTIVE rows at the bottom
  const activeRows = [];
  const inactiveRows = [];

  rawList.forEach((r) => {
    if (!r || typeof r !== 'object') {
      activeRows.push(r);
      return;
    }
    const statusStr = String(r.status || 'ACTIVE').trim().toUpperCase();
    if (statusStr === 'INACTIVE') {
      inactiveRows.push(r);
    } else {
      activeRows.push(r);
    }
  });

  activeRows.sort((a, b) => (Number(a?.rank) || 9999) - (Number(b?.rank) || 9999));
  const rankingsList = [...activeRows, ...inactiveRows];

  const groupLabel = data.group ? `${esc(data.group)} ` : '';
  const weekLabel = data.week ? ` (Through Week ${esc(data.week)})` : '';
  const ruleNote = data.note
    || 'Players with > 4 weeks (> 180 possible points) are ranked by Pt %; players with ≤ 4 weeks have bounded weekly movement, mixed into one unified list.';

  let html = `
    <div style="margin-bottom:0.75rem;">
      <h4 style="margin:0 0 0.4rem 0;">${groupLabel}Standings${weekLabel}</h4>
      <div style="font-size:0.9rem; color:#495057; background:#f8f9fa; border-left:4px solid #0d6efd; padding:0.5rem 0.75rem; border-radius:4px;">
        ${esc(ruleNote)}
      </div>
    </div>
  `;

  if (rankingsList.length === 0) {
    html += `<p style="color:#666; font-style:italic;">No active rankings recorded yet for ${esc(data.group || 'this group')}.</p>`;
    viewerContent.innerHTML = html;
    return;
  }

  html += `
    <table class="data-table" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:center;">Rank</th>
          <th style="text-align:left;">Name</th>
          <th style="text-align:right;">Pt %</th>
          <th style="text-align:right;">Pts</th>
          <th style="text-align:center;">Weeks</th>
        </tr>
      </thead>
      <tbody>
  `;

  rankingsList.forEach((r, idx) => {
    if (typeof r === 'string') {
      html += `<tr><td colspan="5">${esc(r)}</td></tr>`;
      return;
    }

    const statusStr = String(r.status || 'ACTIVE').trim().toUpperCase();
    const isInactive = statusStr === 'INACTIVE';
    const rankNum = r.rank ?? (idx + 1);
    const rankDisplay = isInactive
      ? '<span style="display:inline-block; padding:2px 6px; border-radius:4px; background:#6c757d; color:#fff; font-size:0.8rem; font-weight:bold;">INACTIVE</span>'
      : `<b>${esc(rankNum)}</b>`;

    const name = esc(r.name || `${r.first || ''} ${r.last || ''}`.trim());
    const weeks = Number(r.weeks ?? 0);
    const totalPts = Number(r.total ?? r.points ?? r.score ?? 0);
    const pctNum = typeof r.pct === 'number' ? r.pct : parseFloat(r.pct);
    const pctDisplay = !isNaN(pctNum) ? `${pctNum.toFixed(1)}%` : '';
    const isBounded = !isInactive && (r.isPctRanked === false || weeks <= 4);
    const boundedTag = isBounded
      ? ' <span title="≤ 4 weeks played (bounded weekly movement)" style="font-size:0.75rem; color:#6c757d;">*</span>'
      : '';

    html += `
      <tr style="${isInactive ? 'opacity:0.75; background-color:#f8f9fa;' : ''}">
        <td style="text-align:center; white-space:nowrap;">${rankDisplay}</td>
        <td>${name}${boundedTag}</td>
        <td style="text-align:right; font-weight:600;">${esc(pctDisplay)}</td>
        <td style="text-align:right;">${esc(totalPts)}</td>
        <td style="text-align:center;">${esc(weeks)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top:0.5rem; font-size:0.8rem; color:#6c757d;">
      * ≤ 4 weeks played (bounded weekly movement rule applied within unified standings)
    </div>
  `;

  viewerContent.innerHTML = html;
}











/**
 * Validates a single game score input (Game 1 through Game 6).
 * Highlights invalid input fields in real time and strips invalid characters.
 *
 * @param {HTMLInputElement|string|number} input - The input DOM element or raw value.
 * @param {object} [options] - Validation options (min, max, allowEmpty).
 * @return {boolean} True if the score value is valid.
 */
function validateGameScoreInput(input, options = {}) {
  const min = options.min !== undefined ? options.min : 0;
  const max = options.max !== undefined ? options.max : (typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 15);
  const allowEmpty = options.allowEmpty !== undefined ? options.allowEmpty : true;

  const element = (input && typeof input === 'object' && 'value' in input) ? input : null;
  const rawVal = element ? element.value : input;
  const cleanVal = String(rawVal ?? '').trim();

  if (cleanVal === "") {
    if (element) {
      element.classList.remove('is-invalid', 'score-error');
      element.style.borderColor = "";
      element.style.backgroundColor = "";
    }
    return allowEmpty;
  }

  const parsedNum = Number(cleanVal);
  const isValid = !isNaN(parsedNum) && Number.isInteger(parsedNum) && parsedNum >= min && parsedNum <= max;

  if (element) {
    if (!isValid) {
      element.classList.add('is-invalid', 'score-error');
      element.style.borderColor = "#dc3545";
      element.style.backgroundColor = "#f8d7da";
    } else {
      element.classList.remove('is-invalid', 'score-error');
      element.style.borderColor = "#28a745";
      element.style.backgroundColor = "";
    }
  }

  return isValid;
}

function forceRefreshData(groupName) {
  const cleanGroup = String(groupName || '').replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  if (cleanGroup && window.groupRosterCache) {
    delete window.groupRosterCache[cleanGroup];
  }
  return typeof loadUnifiedRosterData === 'function' ? loadUnifiedRosterData(cleanGroup, true) : Promise.resolve([]);
}



function handleManualRefresh() {
  const btn = document.getElementById("refreshDataBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ Refreshing...";
  btn.disabled = true;

  // Assumes 'currentGroup' is stored globally in your front-end JS
  google.script.run
    .withSuccessHandler(function(freshData) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      // Call your existing front-end render function here
      // renderRosterUI(freshData); 
    })
    .withFailureHandler(function(err) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      alert("Failed to refresh: " + err.message);
    })
    .forceRefreshData(currentGroup);
}
/**
 * Handles phone lookup execution and mapping to UI.
 * Supports passing either boolean (forceRefresh) or string (phone number).
 */
async function lookupPhone() {
  const phoneInput = document.getElementById('lookupPhoneInput');
  const statusEl = document.getElementById('lookupStatus');
  const regSection = document.getElementById('registrationSection');
  const foursomeContainer = document.getElementById('foursomeResult');

  const rawPhone = (phoneInput?.value || '').trim();
  const phoneDigits = rawPhone.replace(/\D/g, '').slice(-10);
  const group = window.currentGroup || document.getElementById('groupSelect')?.value || 'Tuesday';
  const savedName = typeof getSavedName === 'function' ? getSavedName() : '';

  if (phoneDigits.length < 10) {
    if (statusEl) {
      statusEl.textContent = 'Please enter a valid 10-digit phone number.';
      statusEl.className = 'status-error';
    }
    return;
  }

  if (typeof saveUserCredentials === 'function' && savedName) {
    saveUserCredentials(savedName, rawPhone);
  }

  if (statusEl) {
    statusEl.textContent = 'Looking up assignment...';
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiCall('lookupPhone', { phone: rawPhone, group, name: savedName });
    const data = res?.data && typeof res.data === 'object' ? res.data : res;

    if (data?.found) {
      if (regSection) regSection.style.display = 'none';
      if (statusEl) statusEl.textContent = '';
      if (typeof renderFoursomeAssignment === 'function') {
        renderFoursomeAssignment(data);
      }
      return;
    }

    // Check if player exists on roster (e.g., on BYE or schedule not yet posted)
    const roster = (window.unifiedRoster && window.unifiedRoster[group]) || [];
    const rosterMatch = roster.find(p =>
      String(p.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits
    );
    const isRegistered = Boolean(
      window.activeLookupPlayer?.existsOnRoster || data?.registered || data?.onBye || rosterMatch
    );

    if (isRegistered) {
      const playerName = data?.name || rosterMatch?.name || savedName || 'Player';
      if (regSection) regSection.style.display = 'none';
      if (foursomeContainer) foursomeContainer.innerHTML = '';
      if (statusEl) {
        statusEl.textContent = `${playerName} is registered for ${group}, but has no court assignment yet (on BYE or schedule pending).`;
        statusEl.className = 'status-info';
      }
      return;
    }

    // Truly unregistered phone number
    if (foursomeContainer) foursomeContainer.innerHTML = '';
    if (statusEl) {
      statusEl.textContent = 'Phone number not registered. Please complete registration below.';
      statusEl.className = 'status-warning';
    }
    if (regSection) {
      regSection.style.display = 'block';
      const regPhone = document.getElementById('regPhone');
      if (regPhone) regPhone.value = rawPhone;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Lookup error: ' + (err.message || err);
      statusEl.className = 'status-error';
    }
  }
}



/**
 * Dynamically creates the UI for 4, 5, or 6 players based on assignment length and score data.
 */
function renderLookupResult(player, foursome, courtScores) { 
  activeLookupPlayer = player || {};
  activeLookupFoursome = foursome || [];

  const regEl = document.getElementById('registrationSection');
  const resultEl = document.getElementById('lookupResult');
  if (regEl) regEl.style.display = 'none';
  if (resultEl) resultEl.style.display = 'block';

  let displayName = typeof player === 'string' ? player : 
                    (player ? `${player.first || ''} ${player.last || ''}`.trim() || player.name || 'Unknown' : 'Unknown');

  const nameDisp = document.getElementById('pNameDisplay');
  const groupDisp = document.getElementById('pGroupDisplay');
  const courtDisp = document.getElementById('pCourtDisplay');

  if (nameDisp) nameDisp.innerText = displayName;
  if (groupDisp) groupDisp.innerText = (player && player.group) || (typeof getSavedGroup === 'function' ? getSavedGroup() : '');
  if (courtDisp) courtDisp.innerText = (player && player.court) || '';

  const badge = document.getElementById('pStatusDisplay');
  if (badge) {
    const isActive = ((player && player.status) || 'active').toLowerCase() === 'active';
    badge.innerText = isActive ? 'Active' : 'Inactive';
    badge.className = isActive ? 'status-badge status-active' : 'status-badge status-inactive';
  }

  const scoreContainer = document.getElementById('scoreInputsContainer');
  if (!scoreContainer) return;
  scoreContainer.innerHTML = '';

  const numPlayers = activeLookupFoursome.length;
  if (numPlayers >= 4 && numPlayers <= 6) {
    const getPName = (p) => (typeof p === 'object' && p !== null ? (p.name || `${p.first || ''} ${p.last || ''}`.trim()) : String(p || ''));
    
    let summaryHtml = `
      <div style="margin-bottom: 1.25rem; padding: 1rem; background-color: #f8f9fa; border: 2px solid #0d6efd; border-radius: 10px;">
        <p style="margin: 0 0 0.5rem 0; font-size: 1.2rem; color: #0d6efd;"><b>🎾 Assigned Court (${numPlayers} Players):</b></p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 1.15rem; font-weight: 600; color: #212529;">
    `;
    activeLookupFoursome.forEach((pObj, idx) => {
      summaryHtml += `<div>P${idx + 1}: ${getPName(pObj)}</div>`;
    });
    summaryHtml += `</div></div>`;

    const getVal = (p, gNum) => {
      if (!p || typeof p !== 'object') return '';
      const v = p[`g${gNum}`] ?? p[`game${gNum}`] ?? p[`game ${gNum}`] ?? p[`G${gNum}`] ?? p[`Game${gNum}`] ?? p[`Game ${gNum}`] ?? p[`score${gNum}`] ?? p[`s${gNum}`] ?? '';
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
      if (Array.isArray(p.scores) && p.scores[gNum - 1] !== undefined && p.scores[gNum - 1] !== null) return String(p.scores[gNum - 1]).trim();
      if (Array.isArray(p.games) && p.games[gNum - 1] !== undefined && p.games[gNum - 1] !== null) return String(p.games[gNum - 1]).trim();
      return '';
    };

    let gamesHtml = "";
    const matchups = getCourtMatchups(numPlayers);

    matchups.forEach((match, idx) => {
      const gNum = idx + 1;
      const t1Names = match.t1.map(i => getPName(activeLookupFoursome[i])).join(' & ');
      const t2Names = match.t2.map(i => getPName(activeLookupFoursome[i])).join(' & ');
      const outHtml = match.out.length > 0 ? 
        `<div style="font-size: 0.95rem; color: #dc3545; font-weight: bold; margin-bottom: 12px;">Sitting out: ${match.out.map(i => getPName(activeLookupFoursome[i])).join(', ')}</div>` : "";

      let g_a = getVal(activeLookupFoursome[match.t1[0]], gNum) || getVal(activeLookupFoursome[match.t1[1]], gNum);
      let g_b = getVal(activeLookupFoursome[match.t2[0]], gNum) || getVal(activeLookupFoursome[match.t2[1]], gNum);

      if ((g_a === '' || g_b === '') && courtScores) {
        if (Array.isArray(courtScores) && courtScores[idx]) {
          const cs = courtScores[idx];
          g_a = g_a || String(cs.teamA ?? cs.scoreA ?? cs.t1 ?? cs.score1 ?? cs[0] ?? '').trim();
          g_b = g_b || String(cs.teamB ?? cs.scoreB ?? cs.t2 ?? cs.score2 ?? cs[1] ?? '').trim();
        } else if (typeof courtScores === 'object') {
          g_a = g_a || String(courtScores[`g${gNum}_t1`] ?? courtScores[`g${gNum}_a`] ?? courtScores[`game${gNum}_t1`] ?? '').trim();
          g_b = g_b || String(courtScores[`g${gNum}_t2`] ?? courtScores[`g${gNum}_b`] ?? courtScores[`game${gNum}_t2`] ?? '').trim();
        }
      }

      const hasG = g_a !== '' && g_b !== '';

      gamesHtml += `
        <div style="background: #ffffff; border: 2px solid #0d6efd; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
          <div style="font-size: 1.3rem; font-weight: bold; color: #0d6efd; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 8px;">
            🏆 Game ${gNum}
          </div>
          ${outHtml}
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px;">
            <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
              <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${t1Names}</div>
              <input type="number" min="0" max="${typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 30}" inputmode="numeric" id="sc${gNum}_p1" placeholder="Score" value="${g_a}"
                     oninput="validateGameScoreInput(this)"
                     style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
            </div>

            <div style="font-size: 1.3rem; font-weight: bold; color: #6c757d;">VS</div>

            <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
              <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${t2Names}</div>
              <input type="number" min="0" max="${typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 30}" inputmode="numeric" id="sc${gNum}_p2" placeholder="Score" value="${g_b}"
                     oninput="validateGameScoreInput(this)"
                     style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
            </div>
          </div>
          <button type="button" onclick="submitSingleGameScore(${gNum}, this)" ${hasG ? 'disabled' : ''}
                  style="width: 100%; background: ${hasG ? '#198754' : '#0d6efd'}; color: #ffffff; border: none; padding: 12px; font-size: 1.15rem; font-weight: bold; border-radius: 8px; cursor: pointer;">
            ${hasG ? `✅ G${gNum} Submitted` : `📤 Submit G${gNum}`}
          </button>
        </div>
      `;
    });

    scoreContainer.innerHTML = summaryHtml + gamesHtml;
  } else {
    scoreContainer.innerHTML = `
      <div style="background-color: #fff3cd; color: #664d03; border: 1px solid #ffe69c; font-size: 1.15rem; padding: 15px; border-radius: 8px; margin-top: 1rem;">
        ⚠️ No active 4, 5, or 6-player court match assignment found.
      </div>
    `;
  }
}
