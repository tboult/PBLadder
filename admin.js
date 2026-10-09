// --- ADMIN CONFIGURATION ---
  const ADMIN_PHONES = ['7199630573', '7196490138','8055506356',"6025701430"]; 
  // --- ADMIN ROSTER CACHE SYSTEM ---
  let adminPlayersCache = null;
  let adminCacheTimestamp = 0;
  const ADMIN_CACHE_TTL_MS = 60 * 60 * 1000; // 60-minute cache TTL


function isUserAdmin(phone) {
  if (!phone) return false;
  return ADMIN_PHONES.includes(String(phone).replace(/\D/g, ''));
}


function filterAdminPlayers() {
  const query = (document.getElementById('adminPlayerSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('adminPlayerStatusList');
  if (!container) return;

  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) {
    container.innerHTML = '<i style="color:#666;">No player data loaded for this group. Select a group above.</i>';
    return;
  }

  const filtered = adminPlayersCache.filter(p => {
    const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).toLowerCase();
    const pPhone = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '');
    return pName.includes(query) || pPhone.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<i style="color:#666;">No matching players found.</i>';
    return;
  }

  container.innerHTML = filtered.map(player => {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const attrName = escapeHtmlAttr(rawName);
    const attrPhone = escapeHtmlAttr(cleanPhone);

    // Active status evaluation
    const isActive = player.active === true 
      || String(player.active).toLowerCase() === 'true' 
      || String(player.status).toLowerCase() === 'active';

    // Comprehensive Check-In evaluation (handles 'X', true, timestamps, and multiple property names)
    const checkInVal = player.checkedIn ?? player.isCheckedIn ?? player.checked ?? player.checkIn;
    const isCheckedIn = checkInVal === true 
      || String(checkInVal).toLowerCase() === 'true' 
      || String(checkInVal).toUpperCase() === 'X' 
      || (typeof checkInVal === 'string' && checkInVal.trim().length > 0 && checkInVal.trim().toLowerCase() !== 'false')
      || String(player.status).toLowerCase() === 'checked in';
    
    const rawScore = (player.score !== undefined && player.score !== null) 
      ? player.score 
      : (player.points ?? player.total ?? '');
    const playerScore = (rawScore === 0) ? 0 : (rawScore || '');

    return `
<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem; border-bottom:1px solid #eee; gap:0.75rem; flex-wrap:wrap;">
  <!-- Player Details (Left) -->
  <div style="font-weight:bold; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; min-width:180px;">
    ${attrName}${player.court ? `, ${escapeHtmlAttr(player.court)}` : ''}, ${cleanPhone || 'No phone'}
  </div>

  <!-- Controls (Right) -->
  <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-left:auto;">
    <!-- Score Input -->
    <div style="display:flex; align-items:center; gap:0.3rem; white-space:nowrap;">
      <span style="font-size:0.85rem; font-weight:bold;">Total:</span>
      <input type="number" id="admin_score_${attrPhone}" value="${playerScore}" placeholder="--" style="width: 55px; padding: 0.2rem; border: 1px solid #ccc; border-radius: 4px;">
    </div>

    <!-- Check-In Button -->
    <button type="button" class="btn-main" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isCheckedIn ? '#2e7d32' : '#757575'}; color:white; white-space:nowrap;" onclick="toggleAdminCheckIn(this, '${attrName}', '${attrPhone}', ${isCheckedIn})">
      ${isCheckedIn ? '✅ Checked In' : '⬜ Check In'}
    </button>

    <!-- Active/Inactive Button -->
    <button type="button" class="btn-sub" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isActive ? '#1976d2' : '#d32f2f'}; color:white; white-space:nowrap;" onclick="toggleAdminPlayerActive(this, '${attrName}', '${attrPhone}', ${isActive})">
      ${isActive ? 'Active' : 'Inactive'}
    </button>
  </div>
</div>    `;
  }).join('');
}


async function saveAllAdminScores() {
  const groupRadio = document.querySelector('input[name="adminGroupRadio"]:checked')
                  || document.querySelector('input[name="helpGroupRadio"]:checked');
  const groupName = groupRadio ? groupRadio.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : localStorage.getItem('scpb_selected_group'));

  if (!groupName) return alert('Please select a target group first.');
  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) return;

  const updatesToPerform = [];

  // 1. Scan and validate input fields
  for (const player of adminPlayersCache) {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');

    const scoreInput = document.getElementById(`admin_score_${cleanPhone}`);
    if (!scoreInput) continue;

    const rawInputVal = scoreInput.value.trim();

    // Skip blank fields so existing scores are untouched
    if (rawInputVal === '') continue;

    const newScore = isNaN(Number(rawInputVal)) ? rawInputVal : Number(rawInputVal);

    // ⛔ VALIDATION: Check score boundaries
    if (typeof newScore === 'number') {
      if (newScore < 0 || newScore > MAX_TOTAL_SCORE) {
        alert(`Invalid score (${newScore}) for ${rawName}.\n\nScores must be between 0 and ${MAX_TOTAL_SCORE}.`);
        scoreInput.focus();
        return; // Stop saving immediately
      }
    }

    const cachedRaw = (player.score !== undefined && player.score !== null) 
      ? player.score 
      : (player.points ?? player.total ?? '');
    const cachedScore = (cachedRaw === 0) ? 0 : (cachedRaw || '');

    if (String(newScore) !== String(cachedScore)) {
      updatesToPerform.push({
        playerName: rawName,
        phone: cleanPhone,
        score: newScore,
        playerRef: player
      });
    }
  }

  if (updatesToPerform.length === 0) {
    alert('No new valid score entries detected.');
    return;
  }

  const saveBtn = document.getElementById('btnSaveAllScores');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ Saving Scores...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName,
      groupName: groupName,
      updates: updatesToPerform.map(u => ({
        playerName: u.playerName,
        phone: u.phone,
        score: u.score
      }))
    });

    if (res && (res.success || !res.error)) {
      updatesToPerform.forEach(u => {
        u.playerRef.score = u.score;
        u.playerRef.points = u.score;
        u.playerRef.total = u.score;
      });

      alert(`Successfully saved ${updatesToPerform.length} score change(s).`);
    } else {
      alert('Failed to update scores: ' + (res?.message || res?.error || 'Server Error'));
    }

  } catch (err) {
    console.error("Error saving scores:", err);
    alert('Network error saving score changes.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 Save All Scores';
    }
  }
}



async function loadAdminRoster(groupName) {
  const container = document.getElementById('adminPlayerStatusList');
  const saveBtn = document.getElementById('btnSaveAllScores');

  if (container) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">⏳ Loading roster and scores...</div>';
  }
  if (saveBtn) saveBtn.disabled = true;

  try {
    const res = await apiCall('getUnifiedRoster', { group: groupName });

    if (res && res.success && Array.isArray(res.players)) {
      adminPlayersCache = res.players;
      filterAdminPlayers(); // Render populated data
    } else {
      if (container) {
        container.innerHTML = '<i style="color:red;">Failed to load player roster.</i>';
      }
    }
  } catch (err) {
    if (container) {
      container.innerHTML = '<i style="color:red;">Error connecting to server.</i>';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}





async function submitAdminRegistration() {
  const first = document.getElementById('adminRegFirst')?.value.trim() || '';
  const last = document.getElementById('adminRegLast')?.value.trim() || '';
  const phone = document.getElementById('adminRegPhone')?.value.trim() || '';
  const email = document.getElementById('adminRegEmail')?.value.trim() || '';
  const group = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();

  if (!first || !last || !phone) {
    alert('Please provide first name, last name, and phone number.');
    return;
  }

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Adding pending player...';

  try {
    const res = await apiCall('addNewUser', { 
        first, 
        last, 
        phone, 
        email, 
        group: group,
        groupName: group,
        sheet: "Sched " + group
    });
    
    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Player added successfully!';
      if (document.getElementById('adminRegFirst')) document.getElementById('adminRegFirst').value = '';
      if (document.getElementById('adminRegLast')) document.getElementById('adminRegLast').value = '';
      if (document.getElementById('adminRegPhone')) document.getElementById('adminRegPhone').value = '';
      if (document.getElementById('adminRegEmail')) document.getElementById('adminRegEmail').value = '';
      await loadAdminPlayerStatusCache(group);
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Network error adding player.';
  }
}
async function runAdmin(actionName, extraPayload = {}) {
  const statusEl = document.getElementById('adminStatus');
  
  const groupName = extraPayload.groupName || extraPayload.group || 
                    (document.getElementById('adminGlobalGroupSelect') ? document.getElementById('adminGlobalGroupSelect').value : null) || 
                    getSavedGroup();

  if (statusEl) statusEl.innerText = `Executing ${actionName}...`;

  const payload = {
    group: groupName,
    groupName: groupName,
    scoreSheetName: "Score " + groupName.replace(/^(Score|Sched)\s*/i, ""),
    sheet: "Sched " + groupName.replace(/^(Score|Sched)\s*/i, ""),
    ...extraPayload
  };

  try {
    const res = await apiCall(actionName, payload);

    if (res && (res.success !== false && !res.error)) {
        if (statusEl) statusEl.innerText = `✅ Command ${actionName} completed successfully with message: ${res.message}`;
      return res;
    } else {
      const errMsg = (res && (res.message || res.error)) ? (res.message || res.error) : 'Error';
      if (statusEl) statusEl.innerText = `❌ Command failed: ${errMsg}`;
      return res;
    }
  } catch (err) {
    console.error(`runAdmin error [${actionName}]:`, err);
    if (statusEl) statusEl.innerText = `❌ Network error executing ${actionName}.`;
    throw err;
  }
}

async function getAdminPdf() {
  const groupName = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Generating PDF schedule...';

  try {
    const res = await apiCall('webExportSchedulePdf', { 
        groupName: groupName,
        group: groupName,
        sheet: "Sched " + groupName
    });
    if (res && res.pdfUrl) {
      window.open(res.pdfUrl, '_blank');
      if (statusEl) statusEl.innerText = '✅ PDF generated!';
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed to generate PDF.';
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error requesting PDF.';
  }
}
async function loadAdminTabData(groupName) {
    await loadAdminPlayerStatusCache(groupName);
    renderAdminCourts(groupName);    
}

async function loadAdminPlayerStatusCache(groupName) {
  const data = await loadUnifiedRosterData(groupName, true);
  if (Array.isArray(data)) {
    adminPlayersCache = data;
    adminCacheTimestamp = Date.now();
    filterAdminPlayers();
  }
  return data;
}
function loadCheckInPlayers(groupName, forceRefresh = true) {
  return loadUnifiedRosterData(groupName, forceRefresh);
}


// Invalidate Cache Helper (Call after toggling status or adding a player)
function invalidateAdminCache(groupName = null) {
  const group = groupName || document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
  const cleanGroup = String(group || "").replace(/^(Score|Sched)\s*/i, "").trim();
  
  adminPlayersCache = null;
  adminCacheTimestamp = 0;

  if (cleanGroup) {
    const storageKey = `admin_cache_${cleanGroup}`;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}_time`);
  }
}

// 1. TOGGLE ADMIN CHECK-IN

async function toggleAdminCheckIn(btnEl, playerName, phone, currentCheckedInState) {
  const groupName = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
  if (!groupName) {
    alert('Please select a target group first.');
    return;
  }

  const newState = !currentCheckedInState;
  const originalText = btnEl.innerHTML;
  
  btnEl.disabled = true;
  btnEl.innerText = '⏳ Updating...';

  try {
    const res = await apiCall('toggleSingleCheckIn', { 
      sheet: "Sched " + groupName,
      groupName: groupName,
      group: groupName,
      playerName: playerName || phone, 
      phone: phone || playerName, 
      isCheckedIn: newState 
    });

    if (res && (res.success || !res.error)) {
      if (Array.isArray(adminPlayersCache)) {
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const cleanName = String(playerName || '').trim().toLowerCase();

        const pObj = adminPlayersCache.find(p => {
          const pPhone = String(p.phone || '').replace(/\D/g, '');
          const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase();
          return (cleanPhone && pPhone === cleanPhone) || (cleanName && pName === cleanName);
        });

        if (pObj) {
          pObj.checkedIn = newState;
          pObj.isCheckedIn = newState;
        }

        localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
      }

      filterAdminPlayers();
    } else {
      alert('Failed to update check-in status: ' + (res?.message || 'Server error'));
      btnEl.disabled = false;
      btnEl.innerHTML = originalText;
    }
  } catch (err) {
    console.error('toggleAdminCheckIn error:', err);
    alert('Network error updating check-in status.');
    btnEl.disabled = false;
    btnEl.innerHTML = originalText;
  }
}

/**
 * Toggles player active state and updates backend and local cache
 */
async function toggleAdminPlayerActive(btnEl, playerName, phone, currentActiveState) {
  const groupName = document.getElementById('adminGlobalGroupSelect')?.value || (typeof getSavedGroup === 'function' ? getSavedGroup() : '');
  if (!groupName) {
    alert('Please select a target group first.');
    return;
  }

  // Sanitize incoming identifiers
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanName = String(playerName || '').trim();

  if (!cleanName && cleanPhone.length < 7) {
    alert('Missing player name or valid phone number.');
    return;
  }

  const originalText = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = '⏳ Updating...';
  }

  const payload = {
    phone: cleanPhone,
    playerName: cleanName,
    groupName: groupName,
    group: groupName,
    sheet: "Score " + groupName,
    targetState: !currentActiveState
  };

  console.log('📡 Sending toggleUnifiedActiveStatus payload:', payload);

  try {
    const res = await apiCall('toggleUnifiedActiveStatus', payload);
    console.log('✅ Server response for toggleUnifiedActiveStatus:', res);

    if (res && res.success === true) {
      const newActiveState = res.newStatus 
        ? (String(res.newStatus).toLowerCase() === 'active') 
        : !currentActiveState;

      // Update local cache safely
      if (Array.isArray(adminPlayersCache)) {
        const targetNameLower = cleanName.toLowerCase();

        const pObj = adminPlayersCache.find(p => {
          const pPhone = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '');
          const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase();
          
          const phoneMatch = cleanPhone.length >= 7 && pPhone.length >= 7 && 
                            (pPhone.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(pPhone.slice(-7)));
          const nameMatch = targetNameLower.length > 0 && (pName === targetNameLower || pName.includes(targetNameLower) || targetNameLower.includes(pName));

          return phoneMatch || nameMatch;
        });

        if (pObj) {
          pObj.active = newActiveState;
          pObj.status = newActiveState ? 'Active' : 'Inactive';
        }

        try {
          localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
        } catch (e) {
          console.warn('Failed to save updated cache to localStorage:', e);
        }
      }

      // Re-render UI list
      filterAdminPlayers();
    } else {
      alert('Failed to toggle active status: ' + (res?.error || res?.message || 'Server error'));
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalText;
      }
    }
  } catch (err) {
    console.error('toggleAdminPlayerActive error:', err);
    alert('Network error updating active status.');
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalText;
    }
  }
}

let adminPollingInterval;

function initAdminView() {
  loadAdminPlayerData();
  
  // Clear any existing intervals
  if (typeof adminPollingInterval !== 'undefined' && adminPollingInterval) {
    clearInterval(adminPollingInterval);
  }
  
  // Poll every 2 minutes (120,000 ms), strictly between 10:00 AM and 10:55 AM
  adminPollingInterval = setInterval(() => {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();

    if (hrs === 10 && mins <= 55) {
      loadAdminPlayerData(null, true); 
    }
  }, 120000);
}


// Call this when the Admin UI is closed or hidden
function teardownAdminView() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
}

async function loadAdminPlayerData(group, isBackgroundPoll = false) {
    if(localStorage.getItem('activeTab') != 'admin') return;
    const cachedGroup = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') ||
          localStorage.getItem("scpb_saved_group") || 
          localStorage.getItem("scpb_selected_group");
    const targetgroup = group || cachedGroup;
    console.log("loadAdminPlayerData",targetgroup, isBackgroundPoll)
  return await loadAdminPlayerStatusCache(targetgroup);
}


function checkAndUnlockAdmin(phone) {
  if (isUserAdmin(phone)) {
      const adminBtn = document.getElementById('tabAdminBtn');
      if (adminBtn) adminBtn.style.display = 'inline-block';
      const savePhoneBtn = document.getElementById("savePhoneBtn");      
      if (savePhoneBtn) {
          savePhoneBtn.style.backgroundColor = "#006a4f"; // Green
          savePhoneBtn.style.color = "#ffffff";
          savePhoneBtn.textContent = "Admin Reg. ✓";
          savePhoneBtn.onclick = savePhoneToCache;
    }
      
  }
}

  function renderAdminCourts(groupName) {
      const cachedGroup = localStorage.getItem("scpb_saved_group") || localStorage.getItem("scpb_selected_group");
      if(!groupName) groupName =cachedGroup;
    console.log("🔍 renderAdminCourts:", {  groupName });      
    const list = document.getElementById('admin-court-list');
    if (!list) return;
    list.innerHTML = '';
      if (!groupName) {
          groupName=  cachedGroup
      }
    if (!groupName) {
      list.innerHTML = '<i style="grid-column: 1 / -1; text-align: center; color: #666;">Select a group above to load courts...</i>';
      return;
    }

    const courtMap = typeof GROUP_COURT_MAP !== 'undefined' ? GROUP_COURT_MAP : {};
    const defaultCourts = courtMap[groupName] || courtMap["Default"] || [];
    
    for (let i = 1; i <= 20; i++) {
      const div = document.createElement('div');
      div.className = 'court-item';
      
      const isChecked = defaultCourts.includes(i) ? 'checked' : '';
      
      div.innerHTML = `
        <input type="checkbox" id="admin_court_${i}" value="${i}" ${isChecked} data-court-num="${i}">
        <label for="admin_court_${i}">Ct ${i}</label>
      `;
      list.appendChild(div);
    }
  }

async function runRescheduleCheckedIn() {
  const groupName = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
  const selectedCourts = getSelectedCourts();

  if (!groupName) {
    alert('Please select a target group.');
    return;
  }

  if (selectedCourts.length === 0) {
    alert('Please select at least one court checkbox.');
    return;
  }

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Rescheduling checked-in players...';

  try {
    const res = await apiCall('rescheduleFromCheckIns', {
      groupName: groupName,
      group: groupName,
      sheet: "Sched " + groupName,
      courts: selectedCourts,
      checkedInOnly: true
    });
    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Rescheduled checked-in players successfully!';
      await loadAdminPlayerStatusCache(groupName);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule.';
  }
}

async function runRescheduleActive() {
  const groupName = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
  const selectedCourts = getSelectedCourts();

  if (!groupName) {
    alert('Please select a target group.');
    return;
  }

  if (selectedCourts.length === 0) {
    alert('Please select at least one court checkbox.');
    return;
  }

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Rescheduling all active players...';

  try {
    const res = await apiCall('generateScheduleTabs', {
      groupName: groupName,
      group: groupName,
      sheet: "Sched " + groupName,
      courts: selectedCourts,
      checkedInOnly: false
    });
    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Rescheduled all active players successfully!';
      await loadAdminPlayerStatusCache(groupName);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule.';
  }
}


/**
 * Retrieves the currently targeted group by checking 'active-group-label'.
 */
function getTargetGroup() {
  // 1. Check DOM element with ID or class 'active-group-label'
  const labelEl = document.getElementById('active-group-label') || document.querySelector('.active-group-label');
  
  if (labelEl) {
    const rawText = (labelEl.value || labelEl.textContent || labelEl.innerText || '').trim();
    
    // Extract exact group match if text contains extra prefix (e.g. "Group: Mens")
    if (rawText.includes('TG')) return 'TG';
    if (rawText.includes('Womens')) return 'Womens';
    if (rawText.includes('Mixed')) return 'Mixed';
    if (rawText.includes('Mens')) return 'Mens';
    if (rawText) return rawText;
  }

  // 2. Fallbacks: Global memory variable or localStorage
  if (window.currentGroup) return window.currentGroup;
  return localStorage.getItem('adminSelectedGroup') || 'Mens';
}

/**
 * Sets the active group and updates all 'active-group-label' elements in the DOM.
 */
function setTargetGroup(newGroup) {
  console.log(`🎯 Setting target group to: ${newGroup}`);

  // 1. Save state in memory and localStorage
  window.currentGroup = newGroup;
  localStorage.setItem('adminSelectedGroup', newGroup);

  // 2. Update all matching active-group-label elements in DOM
  const labels = document.querySelectorAll('#active-group-label, .active-group-label');
  labels.forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      el.value = newGroup;
    } else {
      el.textContent = newGroup;
    }
  });

  // 3. Invalidate local admin player cache
  if (typeof adminPlayersCache !== 'undefined') adminPlayersCache = null;
  if (typeof adminCacheTimestamp !== 'undefined') adminCacheTimestamp = 0;
}


/**
 * Copies the Mens sheets ("Score Mens", "Sched Mens", "Rankings Mens") to 
 * create the "TG" sheets, retaining all existing data, styling, and formulas.
 * 
 * Usage in Console:
 *   generateTestGroupSheets()
 */
async function generateTestGroupSheets() {
  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Copying Mens sheets to TG test sheets...';

  try {
    const res = await apiCall('createTestGroupSheets', {});
    
    if (res && (res.success || (res.data && res.data.success))) {
      console.log('✅ Test sheets created successfully:', res);
      if (statusEl) statusEl.innerText = '✅ Test sheets created from Mens!';
    } else {
      console.error('❌ Failed to create test sheets:', res);
      if (statusEl) statusEl.innerText = '❌ Failed to create test sheets.';
    }
    return res;
  } catch (err) {
    console.error('generateTestGroupSheets error:', err);
    if (statusEl) statusEl.innerText = '❌ Error copying test sheets.';
    throw err;
  }
}

/**
 * Fetches the active groups from the backend and populates all group dropdown selectors on the page.
 */
/**
 * Fetches current active groups from backend and populates the Admin Group Selector dropdown.
 * Will include "TG" whenever test mode is enabled.
 */
async function loadAdminGroupSelector() {
  const selectEl = document.getElementById('adminGroupSelect');
  if (!selectEl) return;

  try {
    // Call backend API to get active groups (returns TG if property is true)
    const res = await apiCall('getActiveGroups', {});
    const groups = (res && res.groups && res.groups.length > 0) 
      ? res.groups 
      : ["Womens", "Mens", "Mixed"];

    // Preserve current selection if valid, otherwise default to window.currentGroup or first group
    const savedGroup = localStorage.getItem('adminSelectedGroup') || window.currentGroup || groups[0];

    // Clear existing options
    selectEl.innerHTML = '';

    // Populate dropdown options
    groups.forEach(group => {
      const opt = document.createElement('option');
      opt.value = group;
      opt.textContent = group === 'TG' ? '🧪 Test Group (TG)' : group;
      selectEl.appendChild(opt);
    });

    // Set selected value
    if (groups.includes(savedGroup)) {
      selectEl.value = savedGroup;
      window.currentGroup = savedGroup;
    } else {
      selectEl.value = groups[0];
      window.currentGroup = groups[0];
    }

    console.log(`✅ Admin selector loaded with groups: [${groups.join(', ')}]. Currently selected: '${selectEl.value}'`);
  } catch (err) {
    console.error('Failed to populate admin group selector:', err);
  }
}

/**
 * Handles when the admin changes the selected group in the dropdown.
 */
async function onAdminGroupChange(newGroup) {
  console.log(`🔄 Admin switched group to: ${newGroup}`);
  
  // 1. Store selection in global state & local storage
  window.currentGroup = newGroup;
  localStorage.setItem('adminSelectedGroup', newGroup);

  // 2. Clear local cache so stale data isn't rendered
  if (typeof adminPlayersCache !== 'undefined') adminPlayersCache = null;
  if (typeof adminCacheTimestamp !== 'undefined') adminCacheTimestamp = 0;

  // 3. Trigger reload of admin table/roster for the newly selected group
  if (typeof loadAdminData === 'function') {
    await loadAdminData(newGroup);
  } else if (typeof loadRoster === 'function') {
    await loadRoster(newGroup);
  } else if (typeof refreshAdminView === 'function') {
    await refreshAdminView(newGroup);
  } else {
    // Fallback if no specific refresh function exists
    console.log('No specific reload function found, reloading active tab...');
  }
}

// Automatically populate group options when page DOM loads



async function setTestGroup(enabled) {
  console.log(`Setting Test Group state to: ${enabled}...`);
  try {
    const res = await apiCall('setTestGroupState', { enabled: enabled });
    if (res && res.success) {
      console.log(`✅ Success: ${res.message}`);
    } else {
      console.error('❌ Failed to set Test Group state:', res);
    }
    return res;
  } catch (err) {
    console.error('Error in setTestGroup:', err);
    throw err;
  }
}




async function reloadAdminScores() {
  const groupRadio = document.querySelector('input[name="adminGroupRadio"]:checked')
                  || document.querySelector('input[name="helpGroupRadio"]:checked')
                  || document.querySelector('input[name="checkinGroupRadio"]:checked');
  const groupName = groupRadio ? groupRadio.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : localStorage.getItem('scpb_selected_group'));

  if (!groupName) return alert('Please select a target group first.');

  const reloadBtn = document.getElementById('btnReloadScores');
  if (reloadBtn) {
    reloadBtn.disabled = true;
    reloadBtn.innerText = '⏳ Reloading...';
  }

try {
    // Fetch fresh data from server
    
        await loadAdminPlayerStatusCache(groupName);
  } catch (err) {
    console.error("Error reloading scores:", err);
  } finally {
    if (reloadBtn) {
      reloadBtn.disabled = false;
      reloadBtn.innerText = '🔄 Reload Scores';
    }
  }
}


async function saveAllAdminScores() {
  const groupRadio = document.querySelector('input[name="adminGroupRadio"]:checked')
                  || document.querySelector('input[name="helpGroupRadio"]:checked');
  const groupName = groupRadio ? groupRadio.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : localStorage.getItem('scpb_selected_group'));

  if (!groupName) return alert('Please select a target group first.');
  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) return;

  const updatesToPerform = [];

  // 1. Scan and validate input fields
  for (const player of adminPlayersCache) {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');

    const scoreInput = document.getElementById(`admin_score_${cleanPhone}`);
    if (!scoreInput) continue;

    const rawInputVal = scoreInput.value.trim();

    // Skip blank fields so existing scores are untouched
    if (rawInputVal === '') continue;

    const newScore = isNaN(Number(rawInputVal)) ? rawInputVal : Number(rawInputVal);

    // ⛔ VALIDATION: Check score boundaries
    if (typeof newScore === 'number') {
      const maxLimit = typeof MAX_TOTAL_SCORE !== 'undefined' ? MAX_TOTAL_SCORE : 60;
      if (newScore < 0 || newScore > maxLimit) {
        alert(`Invalid score (${newScore}) for ${rawName}.\n\nScores must be between 0 and ${maxLimit}.`);
        scoreInput.focus();
        return; // Stop saving immediately
      }
    }

    const cachedRaw = (player.score !== undefined && player.score !== null) 
      ? player.score 
      : (player.points ?? player.total ?? '');
    const cachedScore = (cachedRaw === 0) ? 0 : (cachedRaw || '');

    if (String(newScore) !== String(cachedScore)) {
      updatesToPerform.push({
        playerName: rawName,
        phone: cleanPhone,
        score: newScore,
        playerRef: player
      });
    }
  }

  if (updatesToPerform.length === 0) {
    alert('No new valid score entries detected.');
    return;
  }

  // Retrieve admin phone to log into the sheet's 'Entered' column
  const currentAdminPhone = localStorage.getItem('scpb_admin_phone') || localStorage.getItem('user_phone') || '';

  const saveBtn = document.getElementById('btnSaveAllScores');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ Saving Scores...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName,
      groupName: groupName,
      adminPhone: currentAdminPhone, // Stamped into 'Entered' column on Sched sheet
      updates: updatesToPerform.map(u => ({
        playerName: u.playerName,
        phone: u.phone,
        score: u.score
      }))
    });

    if (res && (res.success || !res.error)) {
      updatesToPerform.forEach(u => {
        u.playerRef.score = u.score;
        u.playerRef.points = u.score;
        u.playerRef.total = u.score;
      });

      alert(`Successfully saved ${updatesToPerform.length} score change(s).`);
    } else {
      alert('Failed to update scores: ' + (res?.message || res?.error || 'Server Error'));
    }

  } catch (err) {
    console.error("Error saving scores:", err);
    alert('Network error saving score changes.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 Save All Scores';
    }
  }
}

async function clearAllAdminScores() {
  const groupRadio = document.querySelector('input[name="adminGroupRadio"]:checked')
                    || document.querySelector('input[name="helpGroupRadio"]:checked');
  const groupName = groupRadio ? groupRadio.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : localStorage.getItem('scpb_selected_group'));

  if (!groupName) return alert('Please select a target group first.');

  const confirmClear = confirm(`Are you sure you want to CLEAR ALL game scores and totals for group "${groupName}"?`);
  if (!confirmClear) return;

  const currentAdminPhone = localStorage.getItem('scpb_admin_phone') || localStorage.getItem('user_phone') || '';

  const clearBtn = document.getElementById('btnClearAllScores');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.innerText = '⏳ Clearing...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName,
      groupName: groupName,
      adminPhone: currentAdminPhone, // 👈 Passes admin phone for 'Entered' audit column
      option: 'clear_all'
    });

    if (res && (res.success || !res.error)) {
      if (Array.isArray(adminPlayersCache)) {
        adminPlayersCache.forEach(player => {
          player.score = '';
          player.points = '';
          player.total = '';

          const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
          const cleanPhone = String(rawPhone).replace(/\D/g, '');
          const scoreInput = document.getElementById(`admin_score_${cleanPhone}`);

          if (scoreInput) {
            scoreInput.value = '';
            scoreInput.classList.remove('is-invalid', 'is-valid');
          }
        });
      }

      alert(`Successfully cleared all game scores and totals for group "${groupName}".`);
    } else {
      alert('Failed to clear scores: ' + (res?.message || res?.error || 'Server Error'));
    }

  } catch (err) {
    console.error("Error clearing scores:", err);
    alert('Network error attempting to clear scores.');
  } finally {
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.innerText = '🧹 Clear All Scores';
    }
  }
}
