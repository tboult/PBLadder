

// Initialize group-specific cache dictionary
window.groupRosterCache = window.groupRosterCache || {};


// Add at top of your JS file
window.inFlightRosterRequests = {}; 

async function apiCall(action, payload = {}) {
  if (!action) {
    console.error("❌ [API Error] Action cannot be empty.");
    return Promise.reject(new Error("API action cannot be empty"));
  }

  const isRosterFetch = action === 'getUnifiedRoster';
  const targetGroup = payload?.group ? String(payload.group).trim() : '';
  const isForceRefresh = Boolean(payload?.forceRefresh);

  if (isRosterFetch && targetGroup) {
    const groupCache = (window.groupRosterCache && window.groupRosterCache[targetGroup]) || null;

    if (!isForceRefresh && Array.isArray(groupCache) && groupCache.length > 0) {
      logDebug(`⚡ [API Cache Hit] Returning cached roster for group: "${targetGroup}"`);
      return Promise.resolve({ success: true, registered: true, players: groupCache, source: 'memory_cache' });
    }

    const inFlight = window.inFlightRosterRequests[targetGroup];
    if (inFlight && (!isForceRefresh || inFlight.isForceRefresh)) {
      console.warn(`⏳ [API Request In-Flight] Reusing existing promise for group: "${targetGroup}"`);
      return inFlight.promise;
    }
  }

  logDebug(`🚀 [API Call Initiated] "${action}"`, {
    payload,
    time: new Date().toLocaleTimeString()
  });

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

  const inFlightEntry = (isRosterFetch && targetGroup)
    ? { promise: requestPromise, isForceRefresh }
    : null;

  if (inFlightEntry) {
    window.inFlightRosterRequests[targetGroup] = inFlightEntry;
  }

  let result;
  try {
    result = await requestPromise;
  } finally {
    if (inFlightEntry && window.inFlightRosterRequests[targetGroup] === inFlightEntry) {
      delete window.inFlightRosterRequests[targetGroup];
    }
  }

  if (isRosterFetch && result && result.success && Array.isArray(result.players) && targetGroup) {
    if (!window.groupRosterCache) window.groupRosterCache = {};
    window.groupRosterCache[targetGroup] = result.players;
  }

  logDebug(`✅ [API result] "${action}"`, {
    result,
    time: new Date().toLocaleTimeString()
  });

  return result;
}



const rosterFetchPromises = {};
let activeRosterRequestGroup = null;

async function loadUnifiedRosterData(groupName, forceRefresh = false) {
  if (!groupName) return [];

  activeRosterRequestGroup = groupName;

  const existing = rosterFetchPromises[groupName];
  if (existing && (!forceRefresh || existing.forceRefresh)) {
    logDebug(`⏳ [Roster] Reusing in-flight network request for group: "${groupName}"`);
    return existing.promise;
  }

  if (!forceRefresh && Array.isArray(window.groupRosterCache[groupName]) && window.groupRosterCache[groupName].length > 0) {
    logDebug(`⚡ [Roster Memory Hit] Returning cached roster for group: "${groupName}"`);
    window.cachedRoster = window.groupRosterCache[groupName];
    window.unifiedRoster = window.groupRosterCache[groupName];
    window.appPlayersCache = window.groupRosterCache[groupName];
    return window.groupRosterCache[groupName];
  }

  const saveBtn = document.getElementById("btnSaveAllScores");
  if (saveBtn) {
    saveBtn.innerText = "⏳ Loading data...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";
  }

  const fetchPromise = (async () => {
    try {
      logDebug(`📡 Fetching fresh roster for group: "${groupName}"...`);
      const res = await apiCall('getUnifiedRoster', { group: groupName, forceRefresh: forceRefresh });

      const playersList = (res && res.success)
        ? (Array.isArray(res.players) ? res.players : (Array.isArray(res.data) ? res.data : null))
        : null;

      if (playersList) {
        window.groupRosterCache[groupName] = playersList;
        if (activeRosterRequestGroup === groupName) {
          window.cachedRoster = playersList;
          window.unifiedRoster = playersList;
          window.appPlayersCache = playersList;
        }
        return playersList;
      }
      return window.groupRosterCache[groupName] || (activeRosterRequestGroup === groupName ? window.cachedRoster : []) || [];
    } catch (err) {
      console.error("Error fetching roster:", err);
      return window.groupRosterCache[groupName] || [];
    } finally {
      if (rosterFetchPromises[groupName]?.promise === fetchPromise) {
        delete rosterFetchPromises[groupName];
      }
      if (saveBtn && Object.keys(rosterFetchPromises).length === 0) {
        saveBtn.innerText = "💾 Save All Scores";
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
      }
    }
  })();

  rosterFetchPromises[groupName] = { promise: fetchPromise, forceRefresh: Boolean(forceRefresh) };
  return await fetchPromise;
}

let groupRadioChangeSeq = 0;

async function onGroupRadioChange(selectedGroup) {
  const mySeq = ++groupRadioChangeSeq;
  logDebug(`onGroupRadioChange ${selectedGroup}`);
  const cleanGroup = String(selectedGroup).replace(/^(Sched|Score)\s*/i, '').trim();

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

  await new Promise(resolve => requestAnimationFrame(resolve));
  if (mySeq !== groupRadioChangeSeq) return;

  if (typeof setSelectedGroup === 'function') {
    setSelectedGroup(cleanGroup);
  } else {
    localStorage.setItem('scpb_selected_group', cleanGroup);
    localStorage.setItem('scpb_saved_group', cleanGroup);
  }

  window.appPlayersCache = [];
  window.cachedRoster = [];
  window.unifiedRoster = [];
  window.unifiedRosterCache = { data: null, group: null, timestamp: 0 };
  window.activeLookupPlayer = null;
  window.activeLookupFoursome = null;

  syncGroupRadioUI(cleanGroup);
  if (typeof syncAllGroupDropdowns === 'function') syncAllGroupDropdowns(cleanGroup);
  if (typeof updateAllGroupDisplays === 'function') updateAllGroupDisplays(cleanGroup);

  if (typeof loadUnifiedRosterData === 'function') {
    await loadUnifiedRosterData(cleanGroup, true);
  }
  if (mySeq !== groupRadioChangeSeq) return;

  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : (localStorage.getItem('scpb_saved_phone') || '');
  if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
    await loadPlayerStatusFromCache(savedPhone);
  } else if (typeof setAppViewState === 'function') {
    setAppViewState(false, '');
  }
  if (mySeq !== groupRadioChangeSeq) return;

  if (typeof refreshActiveTabData === 'function') {
    await refreshActiveTabData(false);
  }

  if (mySeq === groupRadioChangeSeq && checkinStatus && checkinStatus.innerText.includes("Loading status")) {
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
                        document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked, input[name="adminGroupRadio"]:checked')?.value || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    setAppViewState(false, phone);
    return;
  }

  if (typeof checkAndUnlockAdmin === "function" && phone) {
    checkAndUnlockAdmin(phone);
  }

  let roster = (window.groupRosterCache && Array.isArray(window.groupRosterCache[selectedGroup]))
    ? window.groupRosterCache[selectedGroup]
    : window.appPlayersCache;

  const isRosterForGroup = Array.isArray(roster) && roster.length > 0 && (
    (window.groupRosterCache && roster === window.groupRosterCache[selectedGroup]) ||
    roster[0]?.group === selectedGroup ||
    roster[0]?.groupName === selectedGroup
  );

  if (!isRosterForGroup && selectedGroup && typeof loadUnifiedRosterData === "function") {
    roster = await loadUnifiedRosterData(selectedGroup, false);
  }

  const cleanDigits = String(cleanPhone || "").replace(/\D/g, "");
  const clean10 = cleanDigits.slice(-10);
  const savedNameLower = (typeof getSavedName === 'function' ? getSavedName() : '').trim().toLowerCase();

  let phoneMatches = [];
  if (Array.isArray(roster)) {
    if (clean10.length === 10) {
      phoneMatches = roster.filter(p => {
        const pDigits = String(p.phone || p.cell || p.mobile || p.phoneNumber || p.id || "").replace(/\D/g, "");
        return pDigits.length >= 10 && pDigits.slice(-10) === clean10;
      });
    }
    if (phoneMatches.length === 0 && cleanDigits.length >= 7) {
      const clean7 = cleanDigits.slice(-7);
      phoneMatches = roster.filter(p => {
        const pDigits = String(p.phone || p.cell || p.mobile || p.phoneNumber || p.id || "").replace(/\D/g, "");
        return pDigits.length >= 7 && pDigits.endsWith(clean7);
      });
    }
  }

  const found = (phoneMatches.length > 1 && savedNameLower)
    ? (phoneMatches.find(p => String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase() === savedNameLower) || phoneMatches[0])
    : (phoneMatches[0] || null);

  if (found) {
    const rawName = found.name || `${found.first || ''} ${found.last || ''}`.trim();
    const isActive = found.active === true ||
                     String(found.active).toLowerCase() === 'true' ||
                     String(found.status).toUpperCase() === 'ACTIVE';
    const checkedInBool = isPlayerCheckedIn(found);

    window.activeLookupPlayer = {
      ...found,
      name: rawName,
      phone: phone,
      group: selectedGroup,
      status: isActive ? "ACTIVE" : "INACTIVE",
      active: isActive,
      existsOnRoster: true,
      checkedIn: checkedInBool
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






let checkInPlayersCache = [];





async function toggleUserCheckin() {
  const btnEl = document.getElementById('userCheckinBtn');
  if (!btnEl) return;

  const phone = btnEl.getAttribute('data-phone');
  const name = btnEl.getAttribute('data-name');
  const curState = btnEl.getAttribute('data-checked') === 'true';
  const newState = !curState;
  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : phone;

  if (newState && typeof checkGeofence === 'function') {
    const allowed = (typeof isUserAdmin === 'function' && isUserAdmin(savedPhone))
      ? true
      : await checkGeofence(savedPhone);
    if (!allowed) return;
  }

  const groupName = getSavedGroup();
  const originalText = btnEl.innerText;

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

    if (res && res.success !== false && !res.error) {
      if (window.groupRosterCache && groupName) {
        delete window.groupRosterCache[groupName];
      }
      if (typeof loadCheckInPlayers === 'function') {
        await loadCheckInPlayers(groupName, true);
      }

      btnEl.setAttribute('data-checked', String(newState));
      btnEl.innerText = newState ? 'Cancel Check-In' : 'Check In';

      if (window.activeLookupPlayer) {
        window.activeLookupPlayer.checkedIn = newState;
      }
      if (typeof refreshActiveTabData === 'function') {
        await refreshActiveTabData(false);
      }
    } else {
      alert('Failed to update check-in state: ' + (res?.message || res?.error || 'Server error'));
      btnEl.innerText = originalText || (curState ? 'Cancel Check-In' : 'Check In');
    }
  } catch (err) {
    console.error('toggleUserCheckin error:', err);
    alert('Network error toggling check-in state.');
    btnEl.innerText = originalText || (curState ? 'Cancel Check-In' : 'Check In');
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

  const first = (document.getElementById('frontRegFirst')?.value || document.getElementById('regFirst')?.value || '').trim();
  const last = (document.getElementById('frontRegLast')?.value || document.getElementById('regLast')?.value || '').trim();
  const rawPhone = (document.getElementById('frontRegPhone')?.value || document.getElementById('regPhone')?.value || '').trim();
  const email = (document.getElementById('frontRegEmail')?.value || document.getElementById('regEmail')?.value || '').trim();
  const comment = (document.getElementById('frontRegComment')?.value || '').trim();
  const group = (typeof getSavedGroup === 'function' ? getSavedGroup() : '')
    || document.getElementById('regGroup')?.value
    || '';

  if (!first || !last || !rawPhone || !group) {
    showFeedback('⚠️ First name, Last name, Phone, and Group are required.', 'warning');
    return;
  }

  if (typeof isValidPhone === 'function' && !isValidPhone(rawPhone)) {
    showFeedback('⚠️ Please enter a valid 10-digit phone number.', 'warning');
    return;
  }

  if (typeof isValidEmail === 'function' && !isValidEmail(email)) {
    showFeedback('⚠️ Please enter a valid email address.', 'warning');
    return;
  }

  const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);
  const fullName = `${first} ${last}`.trim();

  try {
    const res = await apiCall('addNewUser', {
      first,
      last,
      name: fullName,
      phone: cleanDigits,
      email,
      comment,
      group
    });

    const responseMsg = typeof res === 'string'
      ? res
      : (res?.data || res?.message || res?.result || '');

    if (/^error\b/i.test(responseMsg) || Boolean(res?.error)) {
      showFeedback(responseMsg || 'Registration failed.', 'danger');
      return;
    }

    if (/^⚠️|^notice\b/i.test(responseMsg) || Boolean(res?.notice)) {
      showFeedback(responseMsg, 'warning');
      return;
    }

    if (typeof savePlayerCredentials === 'function') {
      savePlayerCredentials(cleanDigits, fullName);
    }
    const phoneInput = document.getElementById('phoneInput');
    if (phoneInput) phoneInput.value = cleanDigits;

    showFeedback(responseMsg || '✅ Registration complete!', 'success');

    const regAccordion = document.getElementById('registrationAccordion');
    if (regAccordion) regAccordion.open = false;

    if (window.groupRosterCache) delete window.groupRosterCache[group];
    await loadUnifiedRosterData(group, true);
    await loadPlayerStatusFromCache(cleanDigits);
  } catch (err) {
    showFeedback('Error: ' + (err.message || err), 'danger');
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






function isUnknownPlayerName(name) {
  if (name === null || name === undefined) return false;
  return /^unknown(\s*\d+|\s+player(\s*\d+)?)?$/i.test(String(name).trim());
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsAttr(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
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
    'scoreTab': 'scoreTab',
    'phone': 'scoreTab',
    'enterscore': 'scoreTab',
    'ranksched': 'rankschedTab',
    'admin': 'adminTab'
  };

  const btnMap = {
    'help': 'tabHelpBtn',
    'checkin': 'tabCheckinBtn',
    'score': 'tabScoreBtn',
    'scoreTab': 'tabScoreBtn',
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

  if (!forceRefresh && window.groupRosterCache && Array.isArray(window.groupRosterCache[targetGroup]) && window.groupRosterCache[targetGroup].length > 0) {
    window.appPlayersCache = window.groupRosterCache[targetGroup];
    return window.appPlayersCache;
  }

  const freshPlayers = await loadUnifiedRosterData(targetGroup, forceRefresh) || [];
  if (Array.isArray(freshPlayers) && freshPlayers.length > 0) {
    window.appPlayersCache = freshPlayers;
    return freshPlayers;
  }

  return [];
}

function checkPlayerExists(phone, group) {
  const cleanInput = String(phone || '').replace(/\D/g, '');
  if (!cleanInput || cleanInput.length < 7) {
    return { exists: false, player: null };
  }

  let rosterList = [];
  if (group && window.groupRosterCache && Array.isArray(window.groupRosterCache[group])) {
    rosterList = window.groupRosterCache[group];
  } else if (Array.isArray(window.cachedRoster)) {
    rosterList = window.cachedRoster;
  } else if (window.cachedRoster && Array.isArray(window.cachedRoster.players)) {
    rosterList = window.cachedRoster.players;
  } else if (Array.isArray(window.unifiedRoster)) {
    rosterList = window.unifiedRoster;
  } else if (window.unifiedRoster && Array.isArray(window.unifiedRoster.players)) {
    rosterList = window.unifiedRoster.players;
  }

  if (!Array.isArray(rosterList) || rosterList.length === 0) {
    return { exists: false, player: null };
  }

  const target10 = cleanInput.slice(-10);
  const target7 = cleanInput.slice(-7);
  let matchedPlayer = null;

  if (target10.length === 10) {
    matchedPlayer = rosterList.find(p => {
      if (!p) return false;
      const pPhone = String(p.phone || p.Phone || p.cell || p.mobile || '').replace(/\D/g, '');
      return pPhone.length >= 10 && pPhone.slice(-10) === target10;
    }) || null;
  }

  if (!matchedPlayer && target7.length === 7) {
    matchedPlayer = rosterList.find(p => {
      if (!p) return false;
      const pPhone = String(p.phone || p.Phone || p.cell || p.mobile || '').replace(/\D/g, '');
      return pPhone.length >= 7 && pPhone.endsWith(target7);
    }) || null;
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


function setAppViewState(isFound, playerData) {
  const checkinStatus = document.getElementById("checkInStatus");
  const checkinName = document.getElementById("checkinPlayerName");
  const checkinBadge = document.getElementById("checkinPlayerStatusBadge");
  const userCheckinBtn = document.getElementById("userCheckinBtn");

  const resolvedObj = (playerData && typeof playerData === 'object')
    ? playerData
    : (window.activeLookupPlayer && window.activeLookupPlayer.existsOnRoster ? window.activeLookupPlayer : null);

  if (isFound && resolvedObj) {
    const displayName = resolvedObj.name || resolvedObj.playerName || `${resolvedObj.first || ''} ${resolvedObj.last || ''}`.trim() || 'Player';
    const isChecked = isPlayerCheckedIn(resolvedObj);

    if (checkinName) checkinName.innerText = displayName;
    if (checkinStatus) checkinStatus.innerText = "";
    if (checkinBadge) {
      checkinBadge.innerText = isChecked ? "Checked In ✓" : "Not Checked In";
      checkinBadge.style.backgroundColor = isChecked ? "#198754" : "#6c757d";
      checkinBadge.style.color = "#ffffff";
    }
    if (userCheckinBtn) {
      userCheckinBtn.disabled = false;
      userCheckinBtn.setAttribute('data-phone', resolvedObj.phone || (typeof playerData === 'string' ? playerData : '') || '');
      userCheckinBtn.setAttribute('data-name', displayName);
      userCheckinBtn.setAttribute('data-checked', String(isChecked));
      userCheckinBtn.innerText = isChecked ? "Cancel Check-In" : "Check In";
    }
  } else {
    if (checkinName) checkinName.innerText = "No player found for this group";
    if (checkinStatus) checkinStatus.innerText = "Please select a valid player or switch groups.";
    if (checkinBadge) {
      checkinBadge.innerText = "NOT FOUND";
      checkinBadge.style.backgroundColor = "#6c757d";
      checkinBadge.style.color = "#ffffff";
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





async function toggleStatus() {
  logDebug(`In togglestatus...`);
  const player = window.activeLookupPlayer || (typeof activeLookupPlayer !== 'undefined' ? activeLookupPlayer : null);
  if (!player) return;

  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Updating status...';

  const groupName = player.group || (typeof getSavedGroup === 'function' ? getSavedGroup() : '');
  const cleanPhone = String(player.phone || '').replace(/\D/g, '');
  const playerName = player.name || (typeof getSavedName === 'function' ? getSavedName() : '');

  try {
    const res = await apiCall('toggleUnifiedActiveStatus', {
      phone: cleanPhone,
      playerName: playerName,
      groupName: groupName,
      group: groupName,
      sheet: "Score " + groupName
    });

    if (res && res.success !== false && !res.error) {
      const newStatus = res.newStatus || (String(player.status || '').toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      const isActive = String(newStatus).toUpperCase() === 'ACTIVE';

      player.status = newStatus;
      player.active = isActive;
      window.activeLookupPlayer = player;

      if (groupName && window.groupRosterCache && Array.isArray(window.groupRosterCache[groupName])) {
        const match = window.groupRosterCache[groupName].find(p =>
          (playerName && String(p.name || '').trim().toLowerCase() === playerName.trim().toLowerCase()) ||
          (cleanPhone && String(p.phone || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-10)))
        );
        if (match) {
          match.status = newStatus;
          match.active = isActive;
        }
      }

      if (typeof updateFrontStatusBadge === 'function') {
        updateFrontStatusBadge(newStatus);
      }
      renderLookupResult(player, null);
      if (statusEl) statusEl.innerText = '✅ Status updated to ' + newStatus;
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed to update status: ' + (res?.message || res?.error || 'Server error');
    }
  } catch (err) {
    console.error('toggleStatus error:', err);
    if (statusEl) statusEl.innerText = '❌ Error updating status.';
  }
}



async function toggleStatusFromSetup() {
  const phone = localStorage.getItem("userPhone") ||
                localStorage.getItem("scpb_saved_phone") ||
                document.getElementById("phoneInput")?.value.trim() || "";
  const selectedGroup = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') ||
                        document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked, input[name="adminGroupRadio"]:checked')?.value ||
                        localStorage.getItem('scpb_saved_group') || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");
  const playerName = window.activeLookupPlayer?.name || (typeof getSavedName === 'function' ? getSavedName() : '');

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
      sheet: "Score " + selectedGroup
    });

    if (res && res.success) {
      const newStatus = res.newStatus || "ACTIVE";
      const isActive = String(newStatus).toUpperCase() === "ACTIVE";

      if (!window.activeLookupPlayer) window.activeLookupPlayer = {};
      window.activeLookupPlayer.phone = cleanPhone;
      window.activeLookupPlayer.group = selectedGroup;
      window.activeLookupPlayer.status = newStatus;
      window.activeLookupPlayer.active = isActive;

      const updateCachedList = (list) => {
        if (!Array.isArray(list)) return;
        const cachedPlayer = list.find(p => {
          const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase();
          if (playerName && pName === playerName.trim().toLowerCase()) return true;
          const pPhone = String(p.phone || p.cell || p.mobile || "").replace(/\D/g, "");
          return pPhone.length >= 10 && pPhone.slice(-10) === cleanPhone.slice(-10);
        });
        if (cachedPlayer) {
          cachedPlayer.status = newStatus;
          cachedPlayer.active = isActive;
        }
      };

      updateCachedList(window.appPlayersCache);
      if (window.groupRosterCache && window.groupRosterCache[selectedGroup]) {
        updateCachedList(window.groupRosterCache[selectedGroup]);
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




// ==========================================
// GEOFENCE & ADMIN CONFIGURATION
// ==========================================
const GEOFENCE_RADIUS_METERS = 250;

const ALLOWED_GEOFENCE_LOCATIONS = [
  { lat: 33.65362909476011, lng: -112.27699205631843, name: "Marinette Pickleball Courts" },
  { lat: 33.612973981080074, lng: -112.27032707707161, name: "Boult House" }     
];


// Helper: Strip non-digits from phone numbers for exact comparison
function cleanPhoneNumber(phone) {
  return String(phone || '').replace(/\D/g, '');
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
  const isBatchAction = ["processWeeklyScoresForSheet", "testWomensRankingsWeeks1To10"].includes(action);
  const timeoutMs = isBatchAction ? 45000 : 15000;
  const timeoutId = setTimeout(() => controller.abort(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
    

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const rawText = await response.text();
    clearTimeout(timeoutId);
      
  
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


function getCurrentUserPhone() {
  const stored = (typeof getSavedPhone === 'function' ? getSavedPhone() : '')
    || localStorage.getItem('scpb_saved_phone')
    || localStorage.getItem('saved_phone')
    || localStorage.getItem('userPhone')
    || localStorage.getItem('phone')
    || localStorage.getItem('userPhoneNum')
    || '';
  if (stored) return stored;

  const phoneEl = document.getElementById('phoneInput')
    || document.getElementById('userPhone')
    || document.getElementById('checkInPhone')
    || document.getElementById('phone');
  return phoneEl ? phoneEl.value.trim() : '';
}

function getSavedName() {
  let savedName = localStorage.getItem('scpb_saved_name') || localStorage.getItem('scpb_saved_player_name') || '';
  if (savedName) {
    return savedName;
  }

  const savedPhone = typeof getSavedPhone === 'function'
    ? getSavedPhone()
    : (localStorage.getItem('scpb_saved_phone') || '');

  const cleanDigits = String(savedPhone).replace(/\D/g, '');
  const clean10 = cleanDigits.slice(-10);

  if (clean10.length === 10) {
    const activeGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : '';
    const roster = (activeGroup && window.groupRosterCache && Array.isArray(window.groupRosterCache[activeGroup]))
      ? window.groupRosterCache[activeGroup]
      : (Array.isArray(window.appPlayersCache) ? window.appPlayersCache : (Array.isArray(window.cachedRoster) ? window.cachedRoster : []));

    if (roster.length > 0) {
      const match = roster.find(p => {
        const pDigits = String(p.phone || p.id || p.cell || p.mobile || p.playerId || '').replace(/\D/g, '');
        return pDigits.length >= 10 && pDigits.slice(-10) === clean10;
      });

      if (match) {
        savedName = `${match.first || ''} ${match.last || ''}`.trim() || match.name || match.playerName || '';
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
  const targetGroup = currentGroup || (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || 'this group';
  logDebug("handlePlayerNotFoundInCurrentGroup:", searchedPhone, targetGroup);
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');

  try {
    const crossRes = await apiCall('findPlayerAcrossGroups', { phone: searchedPhone });
    const foundPlayer = crossRes && (crossRes.player || (crossRes.found ? crossRes : null));

    if (foundPlayer && (foundPlayer.firstName || foundPlayer.first || foundPlayer.name)) {
      const firstInput = document.getElementById('frontRegFirst') || document.getElementById('regFirst');
      const lastInput = document.getElementById('frontRegLast') || document.getElementById('regLast');
      const phoneInput = document.getElementById('frontRegPhone') || document.getElementById('regPhone');
      const emailInput = document.getElementById('frontRegEmail') || document.getElementById('regEmail');

      const nameParts = String(foundPlayer.name || '').trim().split(/\s+/);
      const firstName = foundPlayer.firstName || foundPlayer.first || nameParts[0] || '';
      const lastName = foundPlayer.lastName || foundPlayer.last || nameParts.slice(1).join(' ') || '';

      if (firstInput) firstInput.value = firstName;
      if (lastInput) lastInput.value = lastName;
      if (phoneInput) phoneInput.value = foundPlayer.phone || searchedPhone;
      if (emailInput) emailInput.value = foundPlayer.email || '';

      const helpAccordion = document.getElementById('registrationAccordion');
      if (helpAccordion) helpAccordion.open = true;

      const regSection = document.getElementById('registrationSection');
      if (regSection) regSection.style.display = 'block';

      if (statusMsg) {
        const sourceGroup = foundPlayer.foundInGroup || foundPlayer.group || 'another group';
        statusMsg.innerHTML = `ℹ️ Found profile in group <strong>"${escapeHtml(sourceGroup)}"</strong>! Details filled below. Click <strong>Register</strong> to join <strong>"${escapeHtml(targetGroup)}"</strong>.`;
        statusMsg.style.color = "#0d6efd";
      }
    } else {
      const phoneInput = document.getElementById('frontRegPhone') || document.getElementById('regPhone');
      if (phoneInput && !phoneInput.value) phoneInput.value = searchedPhone;

      if (statusMsg) {
        statusMsg.innerText = `Phone number not registered. Please complete registration below for ${targetGroup}.`;
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
  logDebug("checkRegistrationStatus:", phone);
  const cleanPhoneInput = String(phone || '').replace(/\D/g, '');
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');
  const currentGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : '';

  if (!cleanPhoneInput || cleanPhoneInput.length < 10) {
    if (statusMsg) {
      statusMsg.innerText = "Please enter a valid 10 digit phone number.";
      statusMsg.style.color = "#dc3545";
    }
    return;
  }

  const target10 = cleanPhoneInput.slice(-10);
  const roster = (currentGroup && window.groupRosterCache && window.groupRosterCache[currentGroup])
    || window.cachedRoster
    || window.unifiedRoster
    || [];

  const foundInCurrent = roster.find(p => {
    const pPhone = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '');
    return pPhone.length >= 10 && pPhone.slice(-10) === target10;
  });

  if (foundInCurrent) {
    const pName = foundInCurrent.name || `${foundInCurrent.first || ''} ${foundInCurrent.last || ''}`.trim();
    localStorage.setItem('registered_' + target10, 'true');
    if (typeof savePlayerCredentials === 'function') {
      savePlayerCredentials(target10, pName);
    } else {
      localStorage.setItem('scpb_saved_phone', target10);
    }
    if (typeof loadPlayerStatusFromCache === 'function') {
      await loadPlayerStatusFromCache(target10);
    }
    return;
  }

  await handlePlayerNotFoundInCurrentGroup(target10, currentGroup);
}


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
    const roster = await loadUnifiedRosterData(currentGroup, false) || [];
    const target10 = phone.slice(-10);
    const target7 = phone.slice(-7);

    let matchedPlayer = roster.find(p => {
      const pPhone = String(p.phone || p.cell || p.mobile || p.id || p.playerId || '').replace(/\D/g, '');
      return pPhone.length >= 10 && pPhone.slice(-10) === target10;
    });

    if (!matchedPlayer) {
      matchedPlayer = roster.find(p => {
        const pPhone = String(p.phone || p.cell || p.mobile || p.id || p.playerId || '').replace(/\D/g, '');
        return pPhone.length >= 7 && pPhone.endsWith(target7);
      });
    }

    const regAccordion = document.getElementById('registrationAccordion');

    if (matchedPlayer) {
      isRegisteredMatch = true;
      if (regAccordion) regAccordion.open = false;

      const pName = `${matchedPlayer.first || ''} ${matchedPlayer.last || ''}`.trim()
        || matchedPlayer.name
        || matchedPlayer.playerName
        || '';
      savePlayerCredentials(phone, pName);

      if (typeof loadPlayerStatusFromCache === 'function') {
        await loadPlayerStatusFromCache(phone);
      }

      const checkinResult = await triggerAutoCheckIn();

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


function syncGroupRadioUI(explicitGroup) {
  const rawGroup = explicitGroup
    || localStorage.getItem('scpb_selected_group')
    || localStorage.getItem('scpb_saved_group')
    || '';

  const cleanGroup = String(rawGroup).replace(/^(Sched|Score)\s*/i, '').trim();

  const allGroupRadios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"], input[name="adminGroupRadio"]'
  );

  allGroupRadios.forEach(radio => {
    radio.checked = Boolean(cleanGroup) && (radio.value.toLowerCase() === cleanGroup.toLowerCase());
  });

  document.querySelectorAll('.active-group-label').forEach(el => {
    el.textContent = cleanGroup || '--';
  });
}

function getSavedGroup() {
  const selectedRadio = document.querySelector(
    'input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked, input[name="adminGroupRadio"]:checked'
  );
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

  const radios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"], input[name="adminGroupRadio"]'
  );
  radios.forEach(radio => {
    radio.checked = (radio.value.toLowerCase() === cleanGroup.toLowerCase());
  });
}

document.addEventListener('change', (e) => {
  if (e.target && ['helpGroupRadio', 'checkinGroupRadio', 'adminGroupRadio'].includes(e.target.name)) {
    setSavedGroup(e.target.value);
  }
});


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



// Global listener: Persist group selection immediately when clicked on any tab
document.addEventListener('change', (e) => {
  if (e.target && (e.target.name === 'helpGroupRadio' || e.target.name === 'checkinGroupRadio')) {
    setSavedGroup(e.target.value);
    // Note: onGroupRadioChange handles full roster fetch, status check, and tab refresh cleanly
  }
});













function forceRefreshData(groupName) {
  const cleanGroup = String(groupName || '').replace(/^(Score|Sched|Rankings)\s*/i, "").trim();
  if (cleanGroup && window.groupRosterCache) {
    delete window.groupRosterCache[cleanGroup];
  }
  return typeof loadUnifiedRosterData === 'function' ? loadUnifiedRosterData(cleanGroup, true) : Promise.resolve([]);
}


async function handleManualRefresh() {
  const btn = document.getElementById("refreshDataBtn") || document.getElementById("forceRefreshBtn");
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = "⏳ Refreshing...";
    btn.disabled = true;
  }

  try {
    const currentGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : '';
    if (currentGroup) {
      await forceRefreshData(currentGroup);
    }
    if (typeof refreshActiveTabData === 'function') {
      await refreshActiveTabData(true);
    }
  } catch (err) {
    console.error("Manual refresh failed:", err);
    alert("Failed to refresh: " + (err.message || err));
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}









/**
 * Loads rankings and schedule data for the active group and renders into #viewerContent.
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

  if (statusEl) statusEl.innerHTML = '<span class="loading-spinner"></span>Loading rankings & schedule...';

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
    console.error("💥 Error loading rankings & schedule:", e);
    if (statusEl) statusEl.innerText = e.message || "Network error loading data.";
  }
}

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

  const rankingsList = data && (data.rankings || data.ranks || data.standings || data.players);

  if (!Array.isArray(rankingsList)) {
    viewerContent.innerHTML = `<pre style="white-space:pre-wrap; word-break:break-word;">${esc(JSON.stringify(data, null, 2))}</pre>`;
    return;
  }

  const groupLabel = data.group ? `${esc(data.group)} ` : '';
  const rawRankWeek = data.rankingsWeek !== undefined ? data.rankingsWeek : data.week;
  const rankWeekNum = Number(rawRankWeek);
  const throughWeekLabel = rankWeekNum > 0 ? ` — Through Week ${esc(rankWeekNum)}` : '';

  const tableStyle = 'width:100%; border-collapse:collapse; margin-bottom:1.25rem; font-size:0.95rem;';
  const thStyle = 'padding:8px 6px; border-bottom:2px solid #dee2e6; background:#f8f9fa; font-weight:600;';
  const tdStyle = 'padding:7px 6px; border-bottom:1px solid #e9ecef;';

  // ==========================================
  // 1. RANKINGS SECTION (EXACT SHEET ORDER, NO WEEKS COLUMN)
  // ==========================================
  let html = `
    <div style="margin-bottom:0.75rem;">
      <h4 style="margin:0 0 0.4rem 0;">🏆 ${groupLabel}Rankings${throughWeekLabel}</h4>
    </div>
  `;

  if (rankingsList.length === 0) {
    html += `<p style="color:#666; font-style:italic;">No rankings recorded yet for ${esc(data.group || 'this group')}.</p>`;
  } else {
    html += `
      <table class="rankings-static-table" style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle} text-align:center;">Rank</th>
            <th style="${thStyle} text-align:left;">Name</th>
            <th style="${thStyle} text-align:right;">Pt %</th>
            <th style="${thStyle} text-align:right;">Pts</th>
          </tr>
        </thead>
        <tbody>
    `;

    rankingsList.forEach((r, idx) => {
      if (typeof r === 'string') {
        html += `<tr><td colspan="4" style="${tdStyle}">${esc(r)}</td></tr>`;
        return;
      }

      const rawRankStr = String(r.rank ?? '').trim();
      const statusStr = String(r.status || 'ACTIVE').trim().toUpperCase();
      const isInactive = statusStr === 'INACTIVE' || rawRankStr.toUpperCase() === 'INACTIVE';

      const rankDisplay = isInactive
        ? '<span style="display:inline-block; padding:2px 6px; border-radius:4px; background:#6c757d; color:#fff; font-size:0.8rem; font-weight:bold;">INACTIVE</span>'
        : `<b>${esc(rawRankStr || (idx + 1))}</b>`;

      const name = esc(r.name || `${r.first || ''} ${r.last || ''}`.trim());
      const totalPts = Number(r.total ?? r.points ?? r.score ?? 0);
      const pctNum = typeof r.pct === 'number' ? r.pct : parseFloat(r.pct);
      const pctDisplay = !isNaN(pctNum) ? `${pctNum.toFixed(1)}%` : '';

      html += `
        <tr style="${isInactive ? 'opacity:0.75; background-color:#f8f9fa;' : ''}">
          <td style="${tdStyle} text-align:center; white-space:nowrap;">${rankDisplay}</td>
          <td style="${tdStyle}">${name}</td>
          <td style="${tdStyle} text-align:right; font-weight:600;">${esc(pctDisplay)}</td>
          <td style="${tdStyle} text-align:right;">${esc(totalPts)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;
  }

  // ==========================================
  // 2. SCHEDULE SECTION (IF ONE EXISTS)
  // ==========================================
  const schedList = Array.isArray(data.schedule) ? data.schedule : [];
  const hasSchedule = data.hasSchedule !== false && schedList.length > 0;

  if (hasSchedule) {
    const schedWeekNum = Number(data.scheduleWeek);
    const schedWeekLabel = schedWeekNum > 0 ? ` (Week ${esc(schedWeekNum)})` : '';
    const dateBadge = data.scheduleDate ? ` — ${esc(data.scheduleDate)}` : '';

    const courtOrder = [];
    const courtGroups = {};
    const byePlayers = [];

    schedList.forEach((item) => {
      let pName = '';
      let court = '';
      let total = '';
      let games = [];

      if (Array.isArray(item)) {
        pName = String(item[0] || '').trim();
        court = String(item[1] || '').trim();
        games = [item[3], item[4], item[5], item[6], item[7], item[8]]
          .filter(v => v !== '' && v !== null && v !== undefined);
        total = (item[9] !== '' && item[9] !== null && item[9] !== undefined) ? item[9] : '';
      } else if (item && typeof item === 'object') {
        pName = String(item.name || '').trim();
        court = String(item.court || '').trim();
        games = [item.g1, item.g2, item.g3, item.g4, item.g5, item.g6]
          .filter(v => v !== '' && v !== null && v !== undefined);
        total = (item.total !== '' && item.total !== null && item.total !== undefined) ? item.total : '';
      }

      if (!pName || !court) return;

      const playerEntry = { name: pName, games, total };
      if (court.toUpperCase() === 'BYE') {
        byePlayers.push(playerEntry);
      } else {
        if (!courtGroups[court]) {
          courtGroups[court] = [];
          courtOrder.push(court);
        }
        courtGroups[court].push(playerEntry);
      }
    });

    if (courtOrder.length > 0 || byePlayers.length > 0) {
      html += `
        <div style="margin-top:1.25rem; padding-top:0.75rem; border-top:2px solid #dee2e6;">
          <h4 style="margin:0 0 0.6rem 0;">📅 ${groupLabel}Schedule${schedWeekLabel}${dateBadge}</h4>
          <table class="rankings-static-table" style="${tableStyle}">
            <thead>
              <tr>
                <th style="${thStyle} text-align:center; width:90px;">Court</th>
                <th style="${thStyle} text-align:left;">Players</th>
              </tr>
            </thead>
            <tbody>
      `;

      courtOrder.forEach((court) => {
        const label = /^\d+$/.test(court) ? `Court ${esc(court)}` : esc(court);
        const playersHtml = courtGroups[court].map(p => {
          const scoreBadge = (p.total !== '' || p.games.length > 0)
            ? ` <span style="font-size:0.85rem; color:#495057;">(${p.games.length ? p.games.join(', ') : ''}${p.total !== '' ? `${p.games.length ? ' | ' : ''}Tot: <b>${esc(p.total)}</b>` : ''})</span>`
            : '';
          return `<div>${esc(p.name)}${scoreBadge}</div>`;
        }).join('');

        html += `
          <tr>
            <td style="${tdStyle} text-align:center; font-weight:bold; vertical-align:top; color:#0d6efd;">${label}</td>
            <td style="${tdStyle}">${playersHtml}</td>
          </tr>
        `;
      });

      if (byePlayers.length > 0) {
        const byeHtml = byePlayers.map(p => esc(p.name)).join(', ');
        html += `
          <tr style="background-color:#f8f9fa;">
            <td style="${tdStyle} text-align:center; font-weight:bold; color:#6c757d;">BYE</td>
            <td style="${tdStyle}">${byeHtml}</td>
          </tr>
        `;
      }

      html += `
            </tbody>
          </table>
        </div>
      `;
    }
  }

  viewerContent.innerHTML = html;
}








async function lookupPhone(forceRefreshOrPhone = false) {
  const explicitPhone = typeof forceRefreshOrPhone === 'string' ? forceRefreshOrPhone.trim() : '';
  const forceRefresh = typeof forceRefreshOrPhone === 'boolean' ? forceRefreshOrPhone : false;

  const phoneInput = document.getElementById('phoneInput') || document.getElementById('lookupPhoneInput');
  const rawPhone = explicitPhone || (typeof getSavedPhone === 'function' ? getSavedPhone() : '') || (phoneInput?.value || '').trim();
  const phoneDigits = String(rawPhone).replace(/\D/g, '').slice(-10);
  const group = (typeof getSavedGroup === 'function' ? getSavedGroup() : '')
    || document.querySelector('input[name="helpGroupRadio"]:checked, input[name="checkinGroupRadio"]:checked, input[name="adminGroupRadio"]:checked')?.value
    || '';
  const savedName = typeof getSavedName === 'function' ? getSavedName() : '';

  if (!group) {
    renderLookupResult({ found: false, message: '⚠️ Please select a group on the Register & Help tab first.' });
    return;
  }

  if (phoneDigits.length < 7 && !savedName) {
    renderLookupResult({ found: false, message: '⚠️ Please enter and save your phone number on the Register & Help tab to view your court.' });
    return;
  }

  try {
    const res = await apiCall('findFoursomeByPhone', {
      phone: phoneDigits,
      group: group,
      sheet: 'Sched ' + group,
      name: savedName,
      forceRefresh: forceRefresh
    });

    const data = (res && res.data && typeof res.data === 'object') ? res.data : res;

    if (data && data.found) {
      const playerObj = data.player || window.activeLookupPlayer || {
        name: data.playerName || savedName || 'Player',
        phone: phoneDigits,
        group: group,
        court: data.court || '',
        status: 'ACTIVE'
      };
      playerObj.group = group;
      if (data.court) playerObj.court = data.court;

      const foursomeList = data.foursome || data.teammates || data.players || [];
      renderLookupResult(playerObj, foursomeList, data.courtScores || null);
      return;
    }

    // Always force a fresh roster fetch on fallback so newly generated courts aren't missed
    const roster = await loadUnifiedRosterData(group, true);
    const me = Array.isArray(roster) ? (
      roster.find(p => {
        const pDigits = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '').slice(-10);
        return pDigits && phoneDigits && pDigits === phoneDigits;
      }) || (savedName ? roster.find(p => String(p.name || '').trim().toLowerCase() === savedName.trim().toLowerCase()) : null)
    ) : null;

    if (me) {
      const courtStr = String(me.court || '').trim();
      const courtGroup = (courtStr && courtStr.toUpperCase() !== 'BYE' && courtStr !== 'NoSchedYet')
        ? roster.filter(p => String(p.court || '').trim() === courtStr)
        : [];
      renderLookupResult({
        ...me,
        group: group,
        court: courtStr || 'Unassigned',
        status: me.active === false ? 'INACTIVE' : 'ACTIVE'
      }, courtGroup, null);
    } else {
      renderLookupResult({
        found: false,
        message: (data && data.message) || `No schedule entry found for your number in ${group}.`
      });
    }
  } catch (err) {
    console.error('Lookup error:', err);
    renderLookupResult({ found: false, message: 'Error checking court assignment: ' + (err.message || err) });
  }
}

function renderLookupResult(dataOrPlayer, foursomeOrPhone, courtScores) {
  const regEl = document.getElementById('registrationSection');
  const container = document.getElementById('lookupResult') || document.getElementById('courtLookupResult');
  const scoreContainer = document.getElementById('scoreInputsContainer');
  if (regEl) regEl.style.display = 'none';
  if (!container) return;
  container.style.display = 'block';

  let data = dataOrPlayer;
  if (dataOrPlayer && typeof dataOrPlayer === 'object' && Array.isArray(foursomeOrPhone)) {
    const pName = dataOrPlayer.name || `${dataOrPlayer.first || ''} ${dataOrPlayer.last || ''}`.trim();
    data = {
      found: true,
      playerName: pName,
      court: dataOrPlayer.court || '',
      group: dataOrPlayer.group || (typeof getSavedGroup === 'function' ? getSavedGroup() : ''),
      teammates: foursomeOrPhone,
      courtScores: courtScores || null,
      player: dataOrPlayer
    };
  } else if (dataOrPlayer && typeof dataOrPlayer === 'object' && foursomeOrPhone === null && dataOrPlayer.name) {
    data = {
      found: true,
      playerName: dataOrPlayer.name,
      court: dataOrPlayer.court || '',
      group: dataOrPlayer.group || (typeof getSavedGroup === 'function' ? getSavedGroup() : ''),
      teammates: window.activeLookupFoursome || [],
      player: dataOrPlayer
    };
  }

  if (!data || !data.found) {
    const msg = escapeHtml((data && data.message) || 'No court assignment found.');
    if (scoreContainer) {
      scoreContainer.innerHTML = `<div class="notice">${msg}</div>`;
    } else {
      container.innerHTML = `<div class="notice">${msg}</div>`;
    }
    return;
  }

  const players = Array.isArray(data.teammates) ? data.teammates : (Array.isArray(data.foursome) ? data.foursome : []);
  const playerObj = data.player || window.activeLookupPlayer || {
    name: data.playerName || '',
    group: data.group || '',
    court: data.court || '',
    status: 'ACTIVE'
  };
  if (data.group) playerObj.group = data.group;
  if (data.court) playerObj.court = data.court;

  window.activeLookupPlayer = playerObj;
  window.activeLookupFoursome = players;
  window.currentCourtPlayers = players;
  window.currentLookupGroup = data.group || playerObj.group || '';

  const nameDisp = document.getElementById('pNameDisplay');
  const groupDisp = document.getElementById('pGroupDisplay');
  const courtDisp = document.getElementById('pCourtDisplay');
  const badge = document.getElementById('pStatusDisplay');

  const assignedCourt = String(data.court || playerObj.court || '').trim();

  if (nameDisp) nameDisp.innerText = data.playerName || playerObj.name || 'Player';
  if (groupDisp) groupDisp.innerText = window.currentLookupGroup;
  if (courtDisp) courtDisp.innerText = assignedCourt || 'Unassigned';
  if (badge) {
    const isActive = String(playerObj.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    badge.innerText = isActive ? 'Active' : 'Inactive';
    badge.className = isActive ? 'status-badge status-active' : 'status-badge status-inactive';
  }

  const isUnknown = (p) => !p || p.isUnknown || isUnknownPlayerName(p.name);
  const displayName = (p) => (p && p.name ? String(p.name).trim() : 'Unnamed Player');
  const maxScore = typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 25;

  const matchups = getCourtMatchups(players.length);
  let gamesHtml = '';

  if (assignedCourt.toUpperCase() === 'BYE') {
    gamesHtml = `<div class="notice">⏸️ You have a <strong>BYE</strong> this week — no match scores to enter.</div>`;
  } else if (!assignedCourt || assignedCourt === 'Unassigned' || assignedCourt === 'NoSchedYet') {
    gamesHtml = `<div class="notice">⏳ Courts have not been assigned yet for <strong>${escapeHtml(window.currentLookupGroup)}</strong>. Tap <b>Recheck Court Assignment</b> once check-in closes.</div>`;
  } else if (!matchups.length) {
    gamesHtml = `<div class="notice">⚠️ Active 4, 5, or 6-player court assignment required (${escapeHtml(assignedCourt)}).</div>`;
  } else {
    matchups.forEach((match, idx) => {
      const g = idx + 1;
      const t1 = match.t1.map(i => players[i]).filter(Boolean);
      const t2 = match.t2.map(i => players[i]).filter(Boolean);

      const t1AllUnknown = t1.length > 0 && t1.every(isUnknown);
      const t2AllUnknown = t2.length > 0 && t2.every(isUnknown);

      const t1Real = t1.find(p => !isUnknown(p));
      const t2Real = t2.find(p => !isUnknown(p));

      const g_a = t1Real ? String(t1Real[`g${g}`] ?? '').trim() : '';
      const g_b = t2Real ? String(t2Real[`g${g}`] ?? '').trim() : '';

      const hasG = (g_a !== '' && g_b !== '')
                || (g_a !== '' && t2AllUnknown)
                || (g_b !== '' && t1AllUnknown);

      const t1Names = t1.map(displayName).join(' & ');
      const t2Names = t2.map(displayName).join(' & ');
      const outHtml = match.out && match.out.length > 0
        ? `<div style="font-size:0.9rem; color:#dc3545; font-weight:600; margin-bottom:6px;">Sitting out: ${escapeHtml(match.out.map(i => displayName(players[i])).join(', '))}</div>`
        : '';

      gamesHtml += `
        <div class="game-card" data-game="${g}" data-t1-unknown="${t1AllUnknown}" data-t2-unknown="${t2AllUnknown}">
          <div class="game-header">Game ${g}</div>
          ${outHtml}
          <div class="team-row">
            <span class="team-names">${escapeHtml(t1Names)}</span>
            <input type="number" id="sc${g}_p1" class="score-input" min="0" max="${maxScore}" inputmode="numeric"
                   oninput="validateGameScoreInput(this)"
                   value="${t1AllUnknown ? '' : escapeHtml(g_a)}"
                   placeholder="${t1AllUnknown ? 'N/A' : 'Pts'}"
                   ${t1AllUnknown ? 'disabled' : ''}>
          </div>
          <div class="team-row">
            <span class="team-names">${escapeHtml(t2Names)}</span>
            <input type="number" id="sc${g}_p2" class="score-input" min="0" max="${maxScore}" inputmode="numeric"
                   oninput="validateGameScoreInput(this)"
                   value="${t2AllUnknown ? '' : escapeHtml(g_b)}"
                   placeholder="${t2AllUnknown ? 'N/A' : 'Pts'}"
                   ${t2AllUnknown ? 'disabled' : ''}>
          </div>
          <button type="button" id="submitG${g}Btn" class="submit-game-btn"
                  style="background:${hasG ? '#198754' : '#0d6efd'}; color:#ffffff;"
                  onclick="submitSingleGameScore(${g}, this)" ${hasG ? 'disabled' : ''}>
            ${hasG ? `✅ G${g} Submitted` : `Submit Game ${g}`}
          </button>
        </div>
      `;
    });
  }

  if (scoreContainer) {
    scoreContainer.innerHTML = gamesHtml;
  } else {
    container.innerHTML = `
      <div class="court-banner">
        <strong>${escapeHtml(data.playerName || 'Player')}</strong> — ${escapeHtml(assignedCourt)} (${escapeHtml(window.currentLookupGroup)})
      </div>
      ${gamesHtml}
    `;
  }
}

async function submitSingleGameScore(gameNum, btnElement) {
  const btn = btnElement
    || document.getElementById(`submitG${gameNum}Btn`)
    || document.querySelector(`button[onclick*="submitSingleGameScore(${gameNum}"]`);

  if (btn && btn.dataset.submitting === 'true') return;

  const players = Array.isArray(window.currentCourtPlayers) ? window.currentCourtPlayers : (window.activeLookupFoursome || []);
  const matchups = getCourtMatchups(players.length);
  const match = matchups[gameNum - 1];

  if (!match) {
    showFeedback('⚠️ Active 4, 5, or 6-player court match assignment required.', 'warning');
    return;
  }

  const rawCourt = String(
    window.activeLookupPlayer?.court
    || document.getElementById('pCourtDisplay')?.innerText
    || ''
  ).replace(/\D/g, '');
  const courtNum = rawCourt ? Number(rawCourt) : null;

  if (!courtNum) {
    showFeedback('⚠️ Valid court number not found. Tap "Recheck Court Assignment" and try again.', 'warning');
    return;
  }

  const card = btn ? btn.closest('.game-card') : null;
  const t1Unknown = card?.getAttribute('data-t1-unknown') === 'true';
  const t2Unknown = card?.getAttribute('data-t2-unknown') === 'true';

  const scAInput = document.getElementById(`sc${gameNum}_p1`);
  const scBInput = document.getElementById(`sc${gameNum}_p2`);
  const scoreAVal = scAInput ? scAInput.value.trim() : '';
  const scoreBVal = scBInput ? scBInput.value.trim() : '';

  if ((!t1Unknown && scoreAVal === '') || (!t2Unknown && scoreBVal === '')) {
    showFeedback(`⚠️ Please enter scores for active teams in Game ${gameNum}.`, 'warning');
    return;
  }

  if ((!t1Unknown && !validateGameScoreInput(scAInput, { allowEmpty: false })) ||
      (!t2Unknown && !validateGameScoreInput(scBInput, { allowEmpty: false }))) {
    showFeedback(`⚠️ Scores must be whole numbers between 0 and ${typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 25}.`, 'warning');
    return;
  }

  const scoreA = t1Unknown ? null : parseInt(scoreAVal, 10);
  const scoreB = t2Unknown ? null : parseInt(scoreBVal, 10);

  const isUnknown = (p) => !p || p.isUnknown || isUnknownPlayerName(p.name);
  const scoresPayload = [];

  if (!t1Unknown) {
    match.t1.forEach(idx => {
      const p = players[idx];
      if (p && !isUnknown(p)) scoresPayload.push({ name: p.name, [`g${gameNum}`]: scoreA });
    });
  }
  if (!t2Unknown) {
    match.t2.forEach(idx => {
      const p = players[idx];
      if (p && !isUnknown(p)) scoresPayload.push({ name: p.name, [`g${gameNum}`]: scoreB });
    });
  }

  const groupName = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || window.currentLookupGroup || '';
  const submitterName = (typeof getSavedName === 'function' ? getSavedName() : '') || (typeof getSavedPhone === 'function' ? getSavedPhone() : '');
  const origText = btn ? btn.innerText : `Submit Game ${gameNum}`;

  if (btn) {
    btn.dataset.submitting = 'true';
    btn.innerText = '⏳ Submitting...';
    btn.style.background = '#6c757d';
    btn.disabled = true;
  }

  try {
    const res = await apiCall('submitCourtScores', {
      group: groupName,
      court: courtNum,
      submittedByName: submitterName,
      scores: scoresPayload
    });

    const isSuccess = Boolean(res && res.success === true && !res.error);
    showFeedback((res && res.message) || (isSuccess ? `✅ Game ${gameNum} saved!` : 'Error submitting scores.'), isSuccess ? 'success' : 'danger');

    if (isSuccess) {
      if (groupName && window.groupRosterCache) delete window.groupRosterCache[groupName];
      if (btn) {
        btn.innerText = `✅ G${gameNum} Submitted`;
        btn.style.background = '#198754';
        btn.style.color = '#ffffff';
      }
    } else if (btn) {
      btn.innerText = origText;
      btn.style.background = '#0d6efd';
      btn.disabled = false;
    }
  } catch (err) {
    showFeedback('Execution error: ' + err.message, 'danger');
    if (btn) {
      btn.innerText = origText;
      btn.style.background = '#0d6efd';
      btn.disabled = false;
    }
  } finally {
    if (btn) {
      delete btn.dataset.submitting;
    }
  }
}


function validateGameScoreInput(input, options = {}) {
  const min = options.min !== undefined ? options.min : 0;
  const max = options.max !== undefined ? options.max : (typeof MAX_GAME_SCORE !== 'undefined' ? MAX_GAME_SCORE : 25);
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

function renderCheckInPlayers(players) {
  const container = document.getElementById('checkInPlayersList')
    || document.getElementById('checkInList')
    || document.getElementById('checkinList');
  if (!container) return;

  const realPlayers = (players || []).filter(p => {
    if (!p) return false;
    const name = String(p.name || `${p.first || ''} ${p.last || ''}`.trim()).trim();
    if (!name) return false;
    if (p.isUnknown || (typeof isUnknownPlayerName === 'function' && isUnknownPlayerName(name))) return false;
    return true;
  });

  if (realPlayers.length === 0) {
    container.innerHTML = '<div class="empty-msg">No players found for this group.</div>';
    return;
  }

  container.innerHTML = realPlayers.map(player => {
    const pName = String(player.name || `${player.first || ''} ${player.last || ''}`.trim()).trim();
    const rawCheck = player.checkedIn ?? player.checked ?? false;
    const checkStr = String(rawCheck).trim().toLowerCase();
    const isChecked = rawCheck === true || (checkStr !== '' && checkStr !== 'false' && checkStr !== 'no' && checkStr !== '0');
    const btnClass = isChecked ? 'checkin-btn checked' : 'checkin-btn';
    const btnLabel = isChecked ? '✅ Checked In' : 'Check In';

    return `
      <div class="checkin-row ${isChecked ? 'is-checked' : ''}">
        <span class="checkin-name">${escapeHtml(pName)}</span>
        <button type="button" class="${btnClass}" onclick="toggleCheckInPlayer('${escapeJsAttr(pName)}', ${!isChecked}, this)">
          ${btnLabel}
        </button>
      </div>
    `;
  }).join('');
}

async function toggleCheckInPlayer(playerName, newState, btnEl) {
  const groupName = typeof getSavedGroup === 'function' ? getSavedGroup() : '';
  if (!groupName || !playerName) return;

  if (newState && typeof checkGeofence === 'function') {
    const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : '';
    const allowed = (typeof isUserAdmin === 'function' && isUserAdmin(savedPhone)) ? true : await checkGeofence(savedPhone);
    if (!allowed) return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = '⏳...';
  }

  try {
    const res = await apiCall('toggleSingleCheckIn', {
      sheet: 'Sched ' + groupName,
      groupName: groupName,
      group: groupName,
      playerName: playerName,
      isCheckedIn: Boolean(newState)
    });

    if (res && res.success) {
      if (window.groupRosterCache) delete window.groupRosterCache[groupName];
      const fresh = await loadUnifiedRosterData(groupName, true);
      renderCheckInPlayers(fresh);
    } else {
      showFeedback((res && res.message) || 'Failed to update check-in.', 'danger');
    }
  } catch (err) {
    showFeedback('Network error updating check-in.', 'danger');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}


async function refreshActiveTabData(forceRefresh = false) {
  const activeTab = localStorage.getItem('activeTab') || 'help';
  const currentGroup = getSavedGroup();

  if (typeof renderHelpGroupRadios === 'function') {
    renderHelpGroupRadios();
  }

  if (currentGroup) {
    setSavedGroup(currentGroup);
  }

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  try {
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
    } else if (activeTab === 'admin') {
      if (typeof renderAdminCourts === 'function') await renderAdminCourts(currentGroup);
      if (typeof loadAdminTabData === 'function') {
        await loadAdminTabData(currentGroup);
      } else if (typeof loadAdminPlayerStatusCache === 'function') {
        await loadAdminPlayerStatusCache(currentGroup, forceRefresh);
      }
    } else if (activeTab === 'ranksched' || activeTab === 'schedule') {
      if (typeof loadRankingsAndSched === 'function') {
        await loadRankingsAndSched(currentGroup);
      }
    } else if (activeTab === 'scoreTab' || activeTab === 'score' || activeTab === 'phone') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
      if (typeof lookupPhone === 'function') {
        await lookupPhone(forceRefresh);
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

/**
 * Helper to define matchups and sit-outs dynamically based on court size.
 * Players are ordered by rank ascending (index 0 = highest-ranked player on court).
 * - 4 players: 3 games (everyone plays 3)
 * - 5 players: 4 games (Player 0 plays 4; Players 1-4 play 3)
 * - 6 players: 5 games (Players 0 & 1 play 4; Players 2-5 play 3)
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
      { t1: [0, 2], t2: [3, 4], out: [1] }
    ];
  } else if (numPlayers === 6) {
    return [
      { t1: [0, 1], t2: [2, 3], out: [4, 5] },
      { t1: [0, 4], t2: [2, 5], out: [1, 3] },
      { t1: [1, 4], t2: [3, 5], out: [0, 2] },
      { t1: [0, 3], t2: [1, 2], out: [4, 5] },
      { t1: [0, 5], t2: [1, 4], out: [2, 3] }
    ];
  }
  return [];
}

function isPlayerCheckedIn(player) {
  if (!player) return false;
  const raw = player.checkedIn ?? player.isCheckedIn ?? player.checked ?? player.checkIn;
  if (raw === true) return true;
  if (!raw) return false;
  const str = String(raw).trim().toLowerCase();
  return str.length > 0 && !['false', 'no', '0', 'unchecked', 'none', 'n/a'].includes(str);
}
