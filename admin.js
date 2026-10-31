// --- ADMIN CONFIGURATION ---
const ADMIN_PHONES = ['7199630573', '7196490138', '8055506356', '6025701430'];
// --- ADMIN ROSTER CACHE SYSTEM ---
let adminPlayersCache = null;
let adminCacheTimestamp = 0;
const ADMIN_CACHE_TTL_MS = 60 * 60 * 1000; // 60-minute cache TTL

function isUserAdmin(phone) {
  if (!phone) return false;
  return ADMIN_PHONES.includes(String(phone).replace(/\D/g, ''));
}

/**
 * Helper to reliably resolve the active group selected in the Admin UI or app cache.
 */
function getAdminSelectedGroup() {
  const groupRadio = document.querySelector('input[name="adminGroupRadio"]:checked')
                  || document.querySelector('input[name="helpGroupRadio"]:checked')
                  || document.querySelector('input[name="checkinGroupRadio"]:checked');
  if (groupRadio && groupRadio.value) return groupRadio.value;
  
  const selectEl = document.getElementById('adminGroupSelect') || document.getElementById('adminGlobalGroupSelect');
  if (selectEl && selectEl.value) return selectEl.value;

  if (typeof getSavedGroup === 'function') {
    const saved = getSavedGroup();
    if (saved) return saved;
  }
  return localStorage.getItem('adminSelectedGroup') || localStorage.getItem('scpb_selected_group') || 'Womens';
}

/**
 * Extracts array of checked court numbers from the Admin Court list UI.
 */
function getSelectedCourts() {
  const container = document.getElementById('admin-court-list');
  if (!container) return [1, 2, 3, 4];
  const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  const courts = Array.from(checkboxes).map(cb => parseInt(cb.value, 10)).filter(num => !isNaN(num));
  return courts.length > 0 ? courts : [1, 2, 3, 4];
}

function filterAdminPlayers() {
  const query = (document.getElementById('adminPlayerSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('adminPlayerStatusList');
  if (!container) return;

  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) {
    container.innerHTML = '<i style="color:#666;">No player data loaded for this group. Select a group above.</i>';
    updateAdminDashboard();
    return;
  }

  const filtered = adminPlayersCache.filter(p => {
    const pName = String(p.name || `${p.first || ''} ${p.last || ''}`).toLowerCase();
    const pPhone = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '');
    return pName.includes(query) || pPhone.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<i style="color:#666;">No matching players found.</i>';
    updateAdminDashboard();
    return;
  }

  container.innerHTML = filtered.map(player => {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const attrName = escapeHtmlAttr(rawName);
    const attrPhone = escapeHtmlAttr(cleanPhone);

    const isActive = player.active === true 
      || String(player.active).toLowerCase() === 'true' 
      || String(player.status).toLowerCase() === 'active';

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
  <div style="font-weight:bold; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; min-width:180px;">
    ${attrName}${player.court ? `, ${escapeHtmlAttr(player.court)}` : ''}, ${cleanPhone || 'No phone'}
  </div>
  <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-left:auto;">
    <div style="display:flex; align-items:center; gap:0.3rem; white-space:nowrap;">
      <span style="font-size:0.85rem; font-weight:bold;">Total:</span>
      <input type="number" id="admin_score_${attrPhone}" value="${playerScore}" placeholder="--" style="width: 55px; padding: 0.2rem; border: 1px solid #ccc; border-radius: 4px;">
    </div>
    <button type="button" class="btn-main" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isCheckedIn ? '#2e7d32' : '#757575'}; color:white; white-space:nowrap;" onclick="toggleAdminCheckIn(this, '${attrName}', '${attrPhone}', ${isCheckedIn})">
      ${isCheckedIn ? '✅ Checked In' : '⬜ Check In'}
    </button>
    <button type="button" class="btn-sub" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isActive ? '#1976d2' : '#d32f2f'}; color:white; white-space:nowrap;" onclick="toggleAdminPlayerActive(this, '${attrName}', '${attrPhone}', ${isActive})">
      ${isActive ? 'Active' : 'Inactive'}
    </button>
  </div>
</div>`;
  }).join('');

  updateAdminDashboard();
}

async function submitAdminRegistration() {
  const first = document.getElementById('adminRegFirst')?.value.trim() || '';
  const last = document.getElementById('adminRegLast')?.value.trim() || '';
  const phone = document.getElementById('adminRegPhone')?.value.trim() || '';
  const email = document.getElementById('adminRegEmail')?.value.trim() || '';
  const group = getAdminSelectedGroup();

  if (!first || !last || !phone) {
    alert('Please provide first name, last name, and phone number.');
    return;
  }

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Adding pending player...';

  try {
    const res = await apiCall('addNewUser', { 
        first, last, phone, email, 
        group: group, groupName: group,
        sheet: "Sched " + group
    });
    
    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Player added successfully!';
      if (document.getElementById('adminRegFirst')) document.getElementById('adminRegFirst').value = '';
      if (document.getElementById('adminRegLast')) document.getElementById('adminRegLast').value = '';
      if (document.getElementById('adminRegPhone')) document.getElementById('adminRegPhone').value = '';
      if (document.getElementById('adminRegEmail')) document.getElementById('adminRegEmail').value = '';
      await loadAdminPlayerStatusCache(group, true);
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Network error adding player.';
  }
}

async function runAdmin(actionName, extraPayload = {}) {
  const statusEl = document.getElementById('adminStatus');
  const groupName = extraPayload.groupName || extraPayload.group || getAdminSelectedGroup();

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
      if (statusEl) statusEl.innerText = `✅ Command ${actionName} completed: ${res.message || 'Success'}`;
      return res;
    } else {
      const errMsg = res ? (res.message || res.error || 'Error') : 'Error';
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
  const groupName = getAdminSelectedGroup();
  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Generating PDF schedule...';

  try {
    const res = await apiCall('webExportSchedulePdf', { 
        groupName: groupName, group: groupName, sheet: "Sched " + groupName
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

async function loadAdminPlayerStatusCache(groupName, forceRefresh = false) {
  if (!groupName) return [];
  const data = await loadUnifiedRosterData(groupName, forceRefresh);
  if (Array.isArray(data) && data.length > 0) {
    adminPlayersCache = data;
    adminCacheTimestamp = Date.now();
    filterAdminPlayers();
  }
  return data;
}

async function loadAdminTabData(groupName, forceRefresh = false) {
  await loadAdminPlayerStatusCache(groupName, forceRefresh);
  if (typeof renderAdminCourts === 'function') {
    renderAdminCourts(groupName);
  }
}

async function loadAdminRoster(groupName, forceRefresh = false) {
  const container = document.getElementById('adminPlayerStatusList');
  const saveBtn = document.getElementById('btnSaveAllScores');

  if (container) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">⏳ Loading roster and scores...</div>';
  }
  if (saveBtn) saveBtn.disabled = true;

  try {
    const players = await loadUnifiedRosterData(groupName, forceRefresh);
    if (Array.isArray(players) && players.length > 0) {
      adminPlayersCache = players;
      filterAdminPlayers();
    } else {
      if (container) container.innerHTML = '<i style="color:red;">Failed to load player roster.</i>';
    }
    return players;
  } catch (err) {
    console.error("Error in loadAdminRoster:", err);
    if (container) container.innerHTML = '<i style="color:red;">Error connecting to server.</i>';
    return [];
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function loadCheckInPlayers(groupName, forceRefresh = true) {
  return loadUnifiedRosterData(groupName, forceRefresh);
}

function invalidateAdminCache(groupName = null) {
  const group = groupName || getAdminSelectedGroup();
  const cleanGroup = String(group || "").replace(/^(Score|Sched)\s*/i, "").trim();
  adminPlayersCache = null;
  adminCacheTimestamp = 0;

  if (cleanGroup) {
    const storageKey = `admin_cache_${cleanGroup}`;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}_time`);
  }
}

async function toggleAdminCheckIn(btnEl, playerName, phone, currentCheckedInState) {
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');

  const newState = !currentCheckedInState;
  const originalText = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerText = '⏳ Updating...';

  try {
    const res = await apiCall('toggleSingleCheckIn', { 
      sheet: "Sched " + groupName,
      groupName: groupName, group: groupName,
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

async function toggleAdminPlayerActive(btnEl, playerName, phone, currentActiveState) {
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');

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
    groupName: groupName, group: groupName,
    sheet: "Score " + groupName,
    targetState: !currentActiveState
  };

  try {
    const res = await apiCall('toggleUnifiedActiveStatus', payload);
    if (res && res.success === true) {
      const newActiveState = res.newStatus 
        ? (String(res.newStatus).toLowerCase() === 'active') 
        : !currentActiveState;

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
        localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
      }
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
  if (typeof adminPollingInterval !== 'undefined' && adminPollingInterval) {
    clearInterval(adminPollingInterval);
  }
  adminPollingInterval = setInterval(() => {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();

    if (hrs === 10 && mins <= 55) {
      loadAdminPlayerData(null, true); 
    }
  }, 120000);
}

function teardownAdminView() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
}

async function loadAdminPlayerData(group, isBackgroundPoll = false) {
  if (localStorage.getItem('activeTab') != 'admin') return;
  const targetgroup = group || getAdminSelectedGroup();
  return await loadAdminPlayerStatusCache(targetgroup);
}

function checkAndUnlockAdmin(phone) {
  if (isUserAdmin(phone)) {
    const adminBtn = document.getElementById('tabAdminBtn');
    if (adminBtn) adminBtn.style.display = 'inline-block';
    const savePhoneBtn = document.getElementById("savePhoneBtn");      
    if (savePhoneBtn) {
      savePhoneBtn.style.backgroundColor = "#006a4f";
      savePhoneBtn.style.color = "#ffffff";
      savePhoneBtn.textContent = "Admin Reg. ✓";
      savePhoneBtn.onclick = savePhoneToCache;
    }
  }
}

function renderAdminCourts(groupName) {
  const targetGroup = groupName || getAdminSelectedGroup();
  const list = document.getElementById('admin-court-list');
  if (!list) return;
  list.innerHTML = '';

  if (!targetGroup) {
    list.innerHTML = '<i style="grid-column: 1 / -1; text-align: center; color: #666;">Select a group above to load courts...</i>';
    return;
  }

  const courtMap = typeof GROUP_COURT_MAP !== 'undefined' ? GROUP_COURT_MAP : {};
  const defaultCourts = courtMap[targetGroup] || courtMap["Default"] || [1, 2, 3, 4];
  
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

/**
 * Reschedules checked-in players with exact optimizeByes boolean flag.
 */
async function runRescheduleCheckedIn() {
  const groupName = getAdminSelectedGroup();
  const selectedCourts = getSelectedCourts();
  const optimizeCheckbox = document.getElementById('optimize-byes-checkbox');
  const optimizeByes = optimizeCheckbox ? Boolean(optimizeCheckbox.checked) : false;

  if (!groupName) return alert('Please select a target group.');
  if (selectedCourts.length === 0) return alert('Please select at least one court checkbox.');

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Rescheduling checked-in players...';

  try {
    const res = await apiCall('rescheduleFromCheckIns', {
      reschedTarget: groupName,
      groupName: groupName, group: groupName,
      sheet: "Sched " + groupName,
      courts: selectedCourts,
      checkedInOnly: true,
      optimizeByes: optimizeByes,
      integrateByes: optimizeByes
    });

    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Rescheduled checked-in players successfully!';
      await loadAdminPlayerStatusCache(groupName, true);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res?.message || res?.error || 'Error');
    }
  } catch (err) {
    console.error("runRescheduleCheckedIn error:", err);
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule: ' + (err.message || String(err));
  }
}

/**
 * Generates full schedule for all active players with exact optimizeByes boolean flag.
 */
async function runRescheduleActive() {
  const groupName = getAdminSelectedGroup();
  const selectedCourts = getSelectedCourts();
  const optimizeCheckbox = document.getElementById('optimize-byes-checkbox');
  const optimizeByes = optimizeCheckbox ? Boolean(optimizeCheckbox.checked) : false;

  if (!groupName) return alert('Please select a target group.');
  if (selectedCourts.length === 0) return alert('Please select at least one court checkbox.');

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Rescheduling all active players...';

  try {
    const res = await apiCall('ScheduleAll', {
      genTarget: groupName,
      groupName: groupName, group: groupName,
      sheet: "Sched " + groupName,
      courts: selectedCourts,
      checkedInOnly: false,
      optimizeByes: optimizeByes,
      integrateByes: optimizeByes
    });

    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Rescheduled all active players successfully!';
      await loadAdminPlayerStatusCache(groupName, true);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res?.message || res?.error || 'Error');
    }
  } catch (err) {
    console.error("runRescheduleActive error:", err);
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule: ' + (err.message || String(err));
  }
}

/**
 * Clears current schedule on Sched sheet.
 */
async function runClearSchedule() {
  const groupName = getAdminSelectedGroup();
  if (!confirm(`Are you sure you want to clear the active schedule for "${groupName}"?`)) return;

  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Clearing schedule...';

  try {
    const res = await apiCall('resetCheckInsAndSchedData', {
      group: groupName, groupName: groupName, sheet: "Sched " + groupName
    });

    if (res && (res.success || !res.error)) {
      if (statusEl) statusEl.innerText = '✅ Schedule cleared successfully!';
      await loadAdminPlayerStatusCache(groupName, true);
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed to clear schedule: ' + (res?.message || res?.error || 'Error');
    }
  } catch (err) {
    console.error("runClearSchedule error:", err);
    if (statusEl) statusEl.innerText = '❌ Error clearing schedule.';
  }
}

function getTargetGroup() {
  return getAdminSelectedGroup();
}

function setTargetGroup(newGroup) {
  window.currentGroup = newGroup;
  localStorage.setItem('adminSelectedGroup', newGroup);

  const labels = document.querySelectorAll('#active-group-label, .active-group-label');
  labels.forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      el.value = newGroup;
    } else {
      el.textContent = newGroup;
    }
  });

  adminPlayersCache = null;
  adminCacheTimestamp = 0;
}

async function generateTestGroupSheets() {
  const statusEl = document.getElementById('adminStatus');
  if (statusEl) statusEl.innerText = 'Copying Mens sheets to TG test sheets...';

  try {
    const res = await apiCall('createTestGroupSheets', {});
    if (res && (res.success || (res.data && res.data.success))) {
      if (statusEl) statusEl.innerText = '✅ Test sheets created from Mens!';
    } else {
      if (statusEl) statusEl.innerText = '❌ Failed to create test sheets.';
    }
    return res;
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error copying test sheets.';
    throw err;
  }
}

async function loadAdminGroupSelector() {
  const selectEl = document.getElementById('adminGroupSelect');
  if (!selectEl) return;

  try {
    const res = await apiCall('getActiveGroups', {});
    const groups = (res && res.groups && res.groups.length > 0) ? res.groups : ["Womens", "Mens", "Mixed"];
    const savedGroup = getAdminSelectedGroup();

    selectEl.innerHTML = '';
    groups.forEach(group => {
      const opt = document.createElement('option');
      opt.value = group;
      opt.textContent = group === 'TG' ? '🧪 Test Group (TG)' : group;
      selectEl.appendChild(opt);
    });

    if (groups.includes(savedGroup)) selectEl.value = savedGroup;
    else selectEl.value = groups[0];
  } catch (err) {
    console.error('Failed to populate admin group selector:', err);
  }
}

async function onAdminGroupChange(newGroup) {
  setTargetGroup(newGroup);
  await loadAdminPlayerData(newGroup, true);
}

async function setTestGroup(enabled) {
  try {
    return await apiCall('setTestGroupState', { enabled: enabled });
  } catch (err) {
    console.error('Error in setTestGroup:', err);
    throw err;
  }
}

async function reloadAdminScores() {
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');

  const reloadBtn = document.getElementById('btnReloadScores');
  if (reloadBtn) {
    reloadBtn.disabled = true;
    reloadBtn.innerText = '⏳ Reloading...';
  }

  try {
    await loadAdminPlayerStatusCache(groupName, true);
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
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');
  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) return;

  const updatesToPerform = [];

  for (const player of adminPlayersCache) {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');

    const scoreInput = document.getElementById(`admin_score_${cleanPhone}`);
    if (!scoreInput) continue;

    const rawInputVal = scoreInput.value.trim();
    if (rawInputVal === '') continue;

    const newScore = isNaN(Number(rawInputVal)) ? rawInputVal : Number(rawInputVal);

    if (typeof newScore === 'number') {
      const maxLimit = typeof MAX_TOTAL_SCORE !== 'undefined' ? MAX_TOTAL_SCORE : 60;
      if (newScore < 0 || newScore > maxLimit) {
        alert(`Invalid score (${newScore}) for ${rawName}.\n\nScores must be between 0 and ${maxLimit}.`);
        scoreInput.focus();
        return;
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

  if (updatesToPerform.length === 0) return alert('No new valid score entries detected.');

  const currentAdminPhone = localStorage.getItem('scpb_admin_phone') || localStorage.getItem('user_phone') || '';
  const saveBtn = document.getElementById('btnSaveAllScores');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ Saving Scores...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName, groupName: groupName,
      adminPhone: currentAdminPhone,
      updates: updatesToPerform.map(u => ({ playerName: u.playerName, phone: u.phone, score: u.score }))
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
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');

  if (!confirm(`Are you sure you want to CLEAR ALL game scores and totals for group "${groupName}"?`)) return;

  const currentAdminPhone = localStorage.getItem('scpb_admin_phone') || localStorage.getItem('user_phone') || '';
  const clearBtn = document.getElementById('btnClearAllScores');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.innerText = '⏳ Clearing...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName, groupName: groupName,
      adminPhone: currentAdminPhone,
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
          if (scoreInput) scoreInput.value = '';
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

async function runSkipWeek(weekTarget = 'current') {
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');

  const isPrev = (weekTarget === 'previous' || weekTarget === 'prev');
  const btnId = isPrev ? 'skipPrevWeekBtn' : 'skipCurrWeekBtn';
  const btn = document.getElementById(btnId) || document.getElementById('skipWeekBtn');
  const originalText = btn ? btn.innerText : '';
  
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⌛ Fetching week info...';
  }

  try {
    const weekInfo = await apiCall('getWeekInfo', { group: groupName });
    let activeWeekNum = (weekInfo && weekInfo.currentWeek) ? weekInfo.currentWeek : 1;
    let targetWeekNum = isPrev ? activeWeekNum - 1 : activeWeekNum;
    let scheduleDate = (weekInfo && weekInfo.scheduleDate) ? weekInfo.scheduleDate : '';

    if (isPrev && targetWeekNum < 1) {
      alert(`Cannot skip Previous Week because active week is Week ${activeWeekNum}.`);
      return;
    }

    const labelText = isPrev ? `Previous Week (W${targetWeekNum})` : `Current Week (W${targetWeekNum})`;
    const dateText = scheduleDate ? ` [Date: ${scheduleDate}]` : '';

    const confirmMsg = `Are you sure you want to skip ${labelText}${dateText} for group '${groupName}'?\n\n` +
                       `This will:\n` +
                       `1. Run an automatic full Drive backup.\n` +
                       `2. Copy ranks into Week ${targetWeekNum} (R${targetWeekNum}) column.\n` +
                       `3. Clear scores for Week ${targetWeekNum}.`;

    if (!confirm(confirmMsg)) return;
    if (btn) btn.innerText = '⌛ Skipping...';

    const res = await apiCall('skipWeek', { group: groupName, week: targetWeekNum });
    let msg = typeof res === 'string' ? res : (res && res.message) ? res.message : `✅ Week ${targetWeekNum} skipped for group '${groupName}'.`;

    alert(msg);
    reloadAdminScores();
  } catch (err) {
    console.error("Error skipping week:", err);
    alert('Error attempting to skip week: ' + (err.message || String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

function updateAdminDashboard() {
  if (!Array.isArray(adminPlayersCache)) return;

  const checkedInCount = adminPlayersCache.filter(player => {
    const checkInVal = player.checkedIn ?? player.isCheckedIn ?? player.checked ?? player.checkIn;
    return checkInVal === true 
      || String(checkInVal).toLowerCase() === 'true' 
      || String(checkInVal).toUpperCase() === 'X' 
      || (typeof checkInVal === 'string' && checkInVal.trim().length > 0 && checkInVal.trim().toLowerCase() !== 'false')
      || String(player.status).toLowerCase() === 'checked in';
  }).length;

  const isOptimized = Boolean(document.getElementById('optimize-byes-checkbox')?.checked);
  let projectedByes = 0;

  if (isOptimized) {
    if (checkedInCount < 4) projectedByes = checkedInCount;
    else if (checkedInCount === 7) projectedByes = 3;
    else projectedByes = 0;
  } else {
    projectedByes = checkedInCount % 4;
  }

  const liveCountElem = document.getElementById('live-player-count');
  if (liveCountElem) liveCountElem.textContent = checkedInCount;

  const byesElem = document.getElementById('projected-byes');
  if (byesElem) byesElem.textContent = projectedByes;
}
