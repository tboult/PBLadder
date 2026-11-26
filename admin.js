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
    if (!container) return [5,6,7,8];
  const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  const courts = Array.from(checkboxes).map(cb => parseInt(cb.value, 10)).filter(num => !isNaN(num));
    return courts.length > 0 ? courts : [5,6,7,8];
}








// --- admin.js ---
function filterAdminPlayers() {
  const query = (document.getElementById('adminPlayerSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('adminPlayerStatusList');
  if (!container) return;

  const unsavedScores = new Map();
  container.querySelectorAll('input[id^="admin_score_"]').forEach(input => {
    unsavedScores.set(input.id, input.value);
  });

  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) {
    container.innerHTML = '<i style="color:#666;">No player data loaded for this group. Select a group above.</i>';
    updateAdminDashboard();
    return;
  }

  const isUnknown = (p) => Boolean(p && p.isUnknown) || /^unknown(\s*\d+|\s+player(\s*\d+)?)?$/i.test(String(p?.name || '').trim());

  const filtered = adminPlayersCache
    .map((player, cacheIdx) => ({ player, cacheIdx }))
    .filter(({ player }) => {
      if (isUnknown(player)) return false;
      const pName = String(player.name || `${player.first || ''} ${player.last || ''}`).toLowerCase();
      const pPhone = String(player.phone || player.cell || player.mobile || '').replace(/\D/g, '');
      return pName.includes(query) || pPhone.includes(query);
    });

  if (filtered.length === 0) {
    container.innerHTML = '<i style="color:#666;">No matching players found.</i>';
    updateAdminDashboard();
    return;
  }

  container.innerHTML = filtered.map(({ player, cacheIdx }) => {
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const attrName = escapeHtml(rawName);
    const attrPhone = escapeHtml(cleanPhone);

    const isActive = player.active === true
      || String(player.active).toLowerCase() === 'true'
      || String(player.status).toLowerCase() === 'active';

    const checkInVal = player.checkedIn ?? player.isCheckedIn ?? player.checked ?? player.checkIn;
    const checkInStr = String(checkInVal ?? '').trim().toLowerCase();
    const isCheckedIn = checkInVal === true
      || checkInStr === 'true'
      || checkInStr === 'x'
      || checkInStr === 'yes'
      || checkInStr === 'checked in'
      || (typeof checkInVal === 'string' && checkInStr.length > 0 && !['false', 'no', '0', 'unchecked', 'none'].includes(checkInStr))
      || String(player.status).toLowerCase() === 'checked in';

    const rawScore = (player.score !== undefined && player.score !== null)
      ? player.score
      : (player.points ?? player.total ?? '');
    const inputId = `admin_score_${cacheIdx}`;
    const defaultScore = (rawScore === 0) ? 0 : (rawScore || '');
    const playerScore = unsavedScores.has(inputId) ? unsavedScores.get(inputId) : defaultScore;

    return `
<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem; border-bottom:1px solid #eee; gap:0.75rem; flex-wrap:wrap;">
  <div style="font-weight:bold; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; min-width:180px;">
    ${attrName}${player.court ? `, ${escapeHtml(player.court)}` : ''}, ${cleanPhone || 'No phone'}
  </div>
  <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-left:auto;">
    <div style="display:flex; align-items:center; gap:0.3rem; white-space:nowrap;">
      <span style="font-size:0.85rem; font-weight:bold;">Total:</span>
      <input type="number" id="${inputId}" data-phone="${attrPhone}" data-name="${attrName}" value="${escapeHtml(String(playerScore))}" placeholder="--" style="width: 55px; padding: 0.2rem; border: 1px solid #ccc; border-radius: 4px;">
    </div>
    <button type="button" class="btn-main" data-name="${attrName}" data-phone="${attrPhone}" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isCheckedIn ? '#2e7d32' : '#757575'}; color:white; white-space:nowrap;" onclick="toggleAdminCheckIn(this, this.dataset.name, this.dataset.phone, ${isCheckedIn})">
      ${isCheckedIn ? '✅ Checked In' : '⬜ Check In'}
    </button>
    <button type="button" class="btn-sub" data-name="${attrName}" data-phone="${attrPhone}" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isActive ? '#1976d2' : '#d32f2f'}; color:white; white-space:nowrap;" onclick="toggleAdminPlayerActive(this, this.dataset.name, this.dataset.phone, ${isActive})">
      ${isActive ? 'Active' : 'Inactive'}
    </button>
  </div>
</div>`;
  }).join('');

  updateAdminDashboard();
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
      groupName: groupName,
      group: groupName,
      playerName: playerName || phone,
      phone: phone || playerName,
      isCheckedIn: newState
    });

    if (res && res.success !== false && !res.error) {
      const syncCheckInFields = (list) => {
        if (!Array.isArray(list)) return;
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const cleanName = String(playerName || '').trim().toLowerCase();

        const pObj = (cleanName && list.find(p => String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase() === cleanName))
          || (cleanPhone && list.find(p => String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '') === cleanPhone));

        if (pObj) {
          pObj.checkedIn = newState;
          pObj.isCheckedIn = newState;
          pObj.checked = newState;
          pObj.checkIn = newState;
          if (!newState && String(pObj.status || '').toLowerCase() === 'checked in') {
            pObj.status = pObj.active ? 'Active' : 'Inactive';
          }
        }
      };

      syncCheckInFields(adminPlayersCache);
      if (window.groupRosterCache && window.groupRosterCache[groupName]) {
        syncCheckInFields(window.groupRosterCache[groupName]);
      }
      if (Array.isArray(adminPlayersCache)) {
        localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
      }
      filterAdminPlayers();
    } else {
      alert('Failed to update check-in status: ' + (res?.message || res?.error || 'Server error'));
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
    groupName: groupName,
    group: groupName,
    sheet: "Score " + groupName,
    targetState: !currentActiveState
  };

  try {
    const res = await apiCall('toggleUnifiedActiveStatus', payload);
    if (res && res.success === true) {
      const newActiveState = res.newStatus
        ? (String(res.newStatus).toLowerCase() === 'active')
        : !currentActiveState;

      const syncActiveFields = (list) => {
        if (!Array.isArray(list)) return;
        const targetNameLower = cleanName.toLowerCase();
        const pObj = (targetNameLower && list.find(p => String(p.name || `${p.first || ''} ${p.last || ''}`).trim().toLowerCase() === targetNameLower))
          || list.find(p => {
               const pPhone = String(p.phone || p.cell || p.mobile || '').replace(/\D/g, '');
               return cleanPhone.length >= 7 && pPhone.length >= 7 &&
                 (pPhone === cleanPhone || pPhone.endsWith(cleanPhone.slice(-10)) || pPhone.endsWith(cleanPhone.slice(-7)));
             });

        if (pObj) {
          pObj.active = newActiveState;
          pObj.status = newActiveState ? 'Active' : 'Inactive';
        }
      };

      syncActiveFields(adminPlayersCache);
      if (window.groupRosterCache && window.groupRosterCache[groupName]) {
        syncActiveFields(window.groupRosterCache[groupName]);
      }
      if (Array.isArray(adminPlayersCache)) {
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

async function loadAdminPlayerStatusCache(groupName, forceRefresh = false) {
  if (!groupName) return [];
  const data = await loadUnifiedRosterData(groupName, forceRefresh);
  if (Array.isArray(data)) {
    adminPlayersCache = data;
    adminCacheTimestamp = Date.now();
    filterAdminPlayers();
  }
  return data || [];
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
    if (Array.isArray(players)) {
      adminPlayersCache = players;
      adminCacheTimestamp = Date.now();
      filterAdminPlayers();
    } else {
      if (container) container.innerHTML = '<i style="color:red;">Failed to load player roster.</i>';
    }
    return players || [];
  } catch (err) {
    console.error("Error in loadAdminRoster:", err);
    if (container) container.innerHTML = '<i style="color:red;">Error connecting to server.</i>';
    return [];
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function initAdminView() {
  const savedPhone = (typeof getSavedPhone === 'function' ? getSavedPhone() : '')
    || localStorage.getItem('scpb_saved_phone')
    || localStorage.getItem('userPhone')
    || '';

  if (!isUserAdmin(savedPhone) && localStorage.getItem('activeTab') !== 'admin') {
    return;
  }

  loadAdminPlayerData(null, false);
  if (typeof adminPollingInterval !== 'undefined' && adminPollingInterval) {
    clearInterval(adminPollingInterval);
  }
  adminPollingInterval = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (localStorage.getItem('activeTab') !== 'admin') return;

    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();

    if (hrs === 10 && mins <= 55) {
      loadAdminPlayerData(null, true);
    }
  }, 120000);
}

async function loadAdminPlayerData(group, isBackgroundPoll = false) {
  if (localStorage.getItem('activeTab') != 'admin') return;
  const targetgroup = group || getAdminSelectedGroup();

  if (isBackgroundPoll && document.activeElement && String(document.activeElement.id || '').startsWith('admin_score_')) {
    return adminPlayersCache || [];
  }

  return await loadAdminPlayerStatusCache(targetgroup, Boolean(isBackgroundPoll));
}

async function saveAllAdminScores() {
  const groupName = getAdminSelectedGroup();
  if (!groupName) return alert('Please select a target group first.');
  if (!Array.isArray(adminPlayersCache) || adminPlayersCache.length === 0) return;

  const updatesToPerform = [];

  for (let cacheIdx = 0; cacheIdx < adminPlayersCache.length; cacheIdx++) {
    const player = adminPlayersCache[cacheIdx];
    const rawName = player.name || `${player.first || ''} ${player.last || ''}`.trim() || 'Unknown Player';
    const rawPhone = player.phone || player.cell || player.mobile || player.phoneNumber || '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');

    const scoreInput = document.getElementById(`admin_score_${cacheIdx}`);
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

  const currentAdminPhone = (typeof getSavedPhone === 'function' ? getSavedPhone() : '')
    || localStorage.getItem('scpb_admin_phone')
    || localStorage.getItem('scpb_saved_phone')
    || localStorage.getItem('userPhone')
    || localStorage.getItem('user_phone')
    || localStorage.getItem('saved_phone')
    || '';

  const saveBtn = document.getElementById('btnSaveAllScores');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ Saving Scores...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName,
      groupName: groupName,
      adminPhone: currentAdminPhone,
      updates: updatesToPerform.map(u => ({ playerName: u.playerName, phone: u.phone, score: u.score }))
    });

    if (res && res.success !== false && !res.error) {
      updatesToPerform.forEach(u => {
        u.playerRef.score = u.score;
        u.playerRef.points = u.score;
        u.playerRef.total = u.score;
      });
      if (window.groupRosterCache && groupName) {
        delete window.groupRosterCache[groupName];
      }
      localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
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

  const currentAdminPhone = (typeof getSavedPhone === 'function' ? getSavedPhone() : '')
    || localStorage.getItem('scpb_admin_phone')
    || localStorage.getItem('scpb_saved_phone')
    || localStorage.getItem('userPhone')
    || localStorage.getItem('user_phone')
    || localStorage.getItem('saved_phone')
    || '';

  const clearBtn = document.getElementById('btnClearAllScores');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.innerText = '⏳ Clearing...';
  }

  try {
    const res = await apiCall('batchUpdatePlayerScores', {
      group: groupName,
      groupName: groupName,
      adminPhone: currentAdminPhone,
      option: 'clear_all'
    });

    if (res && res.success !== false && !res.error) {
      if (Array.isArray(adminPlayersCache)) {
        adminPlayersCache.forEach((player, cacheIdx) => {
          player.score = '';
          player.points = '';
          player.total = '';

          const scoreInput = document.getElementById(`admin_score_${cacheIdx}`);
          if (scoreInput) scoreInput.value = '';
        });
        localStorage.setItem(`admin_cache_${groupName}`, JSON.stringify(adminPlayersCache));
      }
      if (window.groupRosterCache && groupName) {
        delete window.groupRosterCache[groupName];
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

let isSubmittingAdminReg = false;

async function submitAdminRegistration() {
  if (isSubmittingAdminReg) return;

  const first = (document.getElementById('adminRegFirst')?.value || document.getElementById('regFirst')?.value || '').trim();
  const last = (document.getElementById('adminRegLast')?.value || document.getElementById('regLast')?.value || '').trim();
  const rawPhone = (document.getElementById('adminRegPhone')?.value || document.getElementById('regPhone')?.value || '').trim();
  const email = (document.getElementById('adminRegEmail')?.value || document.getElementById('regEmail')?.value || '').trim();
  const group = document.getElementById('regGroup')?.value
    || document.getElementById('adminRegGroup')?.value
    || getAdminSelectedGroup();
  const statusEl = document.getElementById('adminStatus') || document.getElementById('adminRegStatus');

  if (!first || !last || !rawPhone || !group) {
    alert('Please enter First Name, Last Name, Phone, and Group.');
    return;
  }

  const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);
  if (cleanDigits.length !== 10) {
    alert('Please enter a valid 10-digit phone number.');
    return;
  }

  const fullName = `${first} ${last}`.trim();
  isSubmittingAdminReg = true;
  if (statusEl) statusEl.innerText = `⏳ Registering ${fullName} in ${group}...`;

  try {
    const res = await apiCall('addNewUser', {
      first,
      last,
      name: fullName,
      phone: cleanDigits,
      email,
      group
    });

    const responseMsg = typeof res === 'string'
      ? res
      : (res?.data || res?.message || res?.result || '');

    if (/^error\b/i.test(responseMsg) || Boolean(res?.error) || res?.success === false) {
      if (statusEl) statusEl.innerText = `❌ ${responseMsg || 'Registration failed.'}`;
      alert(responseMsg || 'Registration failed.');
      return;
    }

    if (statusEl) statusEl.innerText = responseMsg || `✅ ${fullName} registered in ${group}!`;
    alert(responseMsg || `✅ ${fullName} registered in ${group}!`);

    ['adminRegFirst', 'adminRegLast', 'adminRegPhone', 'adminRegEmail', 'regFirst', 'regLast', 'regPhone', 'regEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    if (window.groupRosterCache) delete window.groupRosterCache[group];
    await loadAdminPlayerStatusCache(group, true);
  } catch (err) {
    console.error('submitAdminRegistration error:', err);
    if (statusEl) statusEl.innerText = '❌ Error registering player: ' + (err.message || err);
    alert('Error registering player: ' + (err.message || err));
  } finally {
    isSubmittingAdminReg = false;
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


async function loadAdminTabData(groupName, forceRefresh = false) {
  await loadAdminPlayerStatusCache(groupName, forceRefresh);
  if (typeof renderAdminCourts === 'function') {
    renderAdminCourts(groupName);
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








let adminPollingInterval;



function teardownAdminView() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
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









/**
 * Global handler for the Distribute Byes checkbox toggle.
 */
window.onByeCheckboxToggle = function(el) {
  const checkbox = el || document.getElementById('optimize-byes-checkbox');
  const isChecked = Boolean(checkbox && checkbox.checked);
  const debugEl = document.getElementById('debug-bye-status');
  
  if (debugEl) {
    debugEl.innerHTML = isChecked
      ? `🔍 Checkbox Detected: <b style="color:green;">CHECKED (True)</b> | Mode: <b>5/6-Player Integration Active</b>`
      : `🔍 Checkbox Detected: <b style="color:red;">UNCHECKED (False)</b> | Mode: <b>Strict 4-Player Courts Only</b>`;
  }
  
  console.log(`[DEBUG] Checkbox Toggled -> checked: ${isChecked} (${typeof isChecked})`);
  
  if (typeof updateAdminDashboard === 'function') {
    updateAdminDashboard();
  }
};

// Delegated Event Listener: Works even if HTML is loaded or modified dynamically
document.addEventListener('change', function(e) {
  if (e.target && (e.target.id === 'optimize-byes-checkbox' || e.target.name === 'optimizeByes')) {
    window.onByeCheckboxToggle(e.target);
  }
});

// Initializer: Run once DOM is ready to sync initial state
document.addEventListener('DOMContentLoaded', function() {
  const optCb = document.getElementById('optimize-byes-checkbox');
  if (optCb) {
    window.onByeCheckboxToggle(optCb);
  }
});


function resolveAdminCourtsPayload() {
  const courtContainer = document.getElementById('admin-court-list');
  if (courtContainer && typeof getSelectedCourts === 'function') {
    const checked = courtContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length > 0) {
      return Array.from(checked).map(cb => parseInt(cb.value, 10)).filter(n => !isNaN(n));
    }
  }
  const courtInput = Number(document.getElementById('adminCourtCount')?.value) || 0;
  return courtInput > 0 ? courtInput : null;
}

async function runRescheduleCheckedIn(mode) {
  const group = (typeof getAdminSelectedGroup === 'function')
    ? getAdminSelectedGroup()
    : (document.querySelector('input[name="adminGroupRadio"]:checked')?.value || 'Womens');

  const isOptimized = mode
    ? mode === 'optimized'
    : Boolean(document.getElementById('optimize-byes-checkbox')?.checked);

  const effectiveMode = isOptimized ? 'optimized' : 'strict';
  const courts = resolveAdminCourtsPayload();
  const statusEl = document.getElementById('adminStatus');

  const action = isOptimized
    ? 'rescheduleCheckedInOptimized'
    : 'rescheduleCheckedInStrict';

  if (statusEl) {
    statusEl.textContent = `Rescheduling checked-in players (${effectiveMode}) for ${group}...`;
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiCall(action, { group, courts });
    const msg = typeof res === 'string'
      ? res
      : (res?.data || res?.message || `✅ Checked-in schedule (${effectiveMode}) generated for ${group}.`);

    const hasWarning = /insufficient courts|warning|⚠️|error/i.test(msg);

    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = hasWarning ? 'status-warning' : 'status-success';
    } else {
      alert(msg);
    }

    if (typeof reloadAdminScores === 'function') {
      await reloadAdminScores();
    }
    if (typeof refreshAdminScheduleView === 'function') {
      await refreshAdminScheduleView(group);
    }
  } catch (err) {
    const errMsg = 'Error: ' + (err.message || err);
    if (statusEl) {
      statusEl.textContent = errMsg;
      statusEl.className = 'status-error';
    } else {
      alert(errMsg);
    }
  }
}

async function runRescheduleActive(mode) {
  const group = (typeof getAdminSelectedGroup === 'function')
    ? getAdminSelectedGroup()
    : (document.querySelector('input[name="adminGroupRadio"]:checked')?.value || 'Womens');

  const isOptimized = mode
    ? mode === 'optimized'
    : Boolean(document.getElementById('optimize-byes-checkbox')?.checked);

  const effectiveMode = isOptimized ? 'optimized' : 'strict';
  const courts = resolveAdminCourtsPayload();
  const statusEl = document.getElementById('adminStatus');

  const action = isOptimized
    ? 'rescheduleActiveOptimized'
    : 'rescheduleActiveStrict';

  if (statusEl) {
    statusEl.textContent = `Rescheduling active players (${effectiveMode}) for ${group}...`;
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiCall(action, { group, courts });
    const msg = typeof res === 'string'
      ? res
      : (res?.data || res?.message || `✅ Active schedule (${effectiveMode}) generated for ${group}.`);

    const hasWarning = /insufficient courts|warning|⚠️|error/i.test(msg);

    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = hasWarning ? 'status-warning' : 'status-success';
    } else {
      alert(msg);
    }

    if (typeof reloadAdminScores === 'function') {
      await reloadAdminScores();
    }
    if (typeof refreshAdminScheduleView === 'function') {
      await refreshAdminScheduleView(group);
    }
  } catch (err) {
    const errMsg = 'Error: ' + (err.message || err);
    if (statusEl) {
      statusEl.textContent = errMsg;
      statusEl.className = 'status-error';
    } else {
      alert(errMsg);
    }
  }
}




/**
 * Triggers a full Google Drive backup from the Admin UI.
 */
async function runAdminDriveBackup() {
  const statusEl = document.getElementById('adminStatus');
  const backupBtn = document.getElementById('btnAdminBackup');
  
  if (!confirm('Are you sure you want to create a manual Google Drive backup of the entire spreadsheet now?')) return;

  if (statusEl) statusEl.innerText = '⌛ Creating full Drive backup...';
  if (backupBtn) {
    backupBtn.disabled = true;
    backupBtn.innerText = '⏳ Backing up...';
  }

  try {
    const res = await apiCall('apiCreateDriveBackup', {});
    if (res && (res.success || !res.error)) {
      const backupName = res.backupName || res.name || res.message || 'Backup created successfully!';
      if (statusEl) statusEl.innerText = `✅ Backup saved: ${backupName}`;
      alert(`✅ Backup Created Successfully!\n\nSaved: ${backupName}`);
    } else {
      const errMsg = res?.message || res?.error || 'Error creating backup.';
      if (statusEl) statusEl.innerText = `❌ ${errMsg}`;
      alert(`Failed to create backup: ${errMsg}`);
    }
  } catch (err) {
    console.error("runAdminDriveBackup error:", err);
    if (statusEl) statusEl.innerText = '❌ Network error creating backup.';
    alert('Network error creating Drive backup.');
  } finally {
    if (backupBtn) {
      backupBtn.disabled = false;
      backupBtn.innerText = '💾 Create Full Drive Backup';
    }
  }
}


/**
 * Triggers a full sheet restore from backup from the Admin UI.
 */
async function runAdminRestoreSheet() {
  const statusEl = document.getElementById('adminStatus');
  const restoreBtn = document.getElementById('btnAdminRestore');

  const confirmMsg = "⚠️ WARNING: Restoring will overwrite current spreadsheet data with the latest backup!\n\nAre you sure you want to restore?";
  if (!confirm(confirmMsg)) return;

  if (statusEl) statusEl.innerText = '⌛ Restoring sheet from backup...';
  if (restoreBtn) {
    restoreBtn.disabled = true;
    restoreBtn.innerText = '⏳ Restoring...';
  }

  try {
    const res = await apiCall('apiRestoreSheetFromBackup', {});
    if (res && (res.success || !res.error)) {
      const msg = res.message || 'Sheet restored successfully!';
      if (statusEl) statusEl.innerText = `✅ ${msg}`;
      alert(`✅ ${msg}`);
      if (typeof reloadAdminScores === 'function') {
        reloadAdminScores();
      }
    } else {
      const errMsg = res?.message || res?.error || 'Error restoring sheet.';
      if (statusEl) statusEl.innerText = `❌ ${errMsg}`;
      alert(`Failed to restore sheet: ${errMsg}`);
    }
  } catch (err) {
    console.error("runAdminRestoreSheet error:", err);
    if (statusEl) statusEl.innerText = '❌ Error attempting sheet restore.';
    alert('Network error attempting sheet restore.');
  } finally {
    if (restoreBtn) {
      restoreBtn.disabled = false;
      restoreBtn.innerText = '⏮️ Restore Sheet From Backup';
    }
  }
}


function updateAdminDashboard(forceRefresh = false) {
  const group = getAdminSelectedGroup();

  if (forceRefresh) {
    loadAdminPlayerStatusCache(group, true);
    return;
  }

  const roster = Array.isArray(adminPlayersCache) ? adminPlayersCache : [];
  const isUnknown = (p) => Boolean(p && p.isUnknown) || /^unknown(\s*\d+|\s+player(\s*\d+)?)?$/i.test(String(p?.name || '').trim());
  const realPlayers = roster.filter(p => !isUnknown(p));

  let activeCount = 0;
  let checkedInCount = 0;

  realPlayers.forEach(player => {
    const isActive = player.active === true
      || String(player.active).toLowerCase() === 'true'
      || String(player.status).toLowerCase() === 'active';

    const checkInVal = player.checkedIn ?? player.isCheckedIn ?? player.checked ?? player.checkIn;
    const checkInStr = String(checkInVal ?? '').trim().toLowerCase();
    const isCheckedIn = checkInVal === true
      || checkInStr === 'true'
      || checkInStr === 'x'
      || checkInStr === 'yes'
      || checkInStr === 'checked in'
      || (typeof checkInVal === 'string' && checkInStr.length > 0 && !['false', 'no', '0', 'unchecked', 'none', 'n/a'].includes(checkInStr))
      || String(player.status).toLowerCase() === 'checked in';

    if (isActive) activeCount++;
    if (isCheckedIn) checkedInCount++;
  });

  const inactiveCount = Math.max(0, realPlayers.length - activeCount);
  const optimizeByes = Boolean(document.getElementById('optimize-byes-checkbox')?.checked);

  let projectedCourts = 0;
  let projectedByes = 0;

  if (checkedInCount >= 4) {
    if (optimizeByes) {
      if (checkedInCount === 7) {
        projectedCourts = 1;
        projectedByes = 1; // 6-player court + 1 bye
      } else {
        projectedCourts = Math.floor(checkedInCount / 4);
        projectedByes = 0;
      }
    } else {
      projectedCourts = Math.floor(checkedInCount / 4);
      projectedByes = checkedInCount % 4;
    }
  } else {
    projectedCourts = 0;
    projectedByes = checkedInCount;
  }

  const setStat = (ids, val) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  };

  setStat(['adminTotalPlayers', 'admin-total-players', 'statTotalPlayers'], realPlayers.length);
  setStat(['adminActivePlayers', 'admin-active-count', 'statActivePlayers'], activeCount);
  setStat(['adminInactivePlayers', 'admin-inactive-count', 'statInactivePlayers'], inactiveCount);
  setStat(['adminCheckedInCount', 'admin-checked-in-count', 'statCheckedIn'], checkedInCount);
  setStat(['adminProjectedCourts', 'admin-projected-courts', 'statProjectedCourts'], projectedCourts);
  setStat(['adminProjectedByes', 'admin-projected-byes', 'statProjectedByes'], projectedByes);
}



