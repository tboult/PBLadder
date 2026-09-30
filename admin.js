// --- ADMIN CONFIGURATION ---
  const ADMIN_PHONES = ['7199630573', '7196490138','8055506356','4147586069',"6025701430"]; 
  // --- ADMIN ROSTER CACHE SYSTEM ---
  let adminPlayersCache = null;
  let adminCacheTimestamp = 0;
  const ADMIN_CACHE_TTL_MS = 60 * 60 * 1000; // 60-minute cache TTL


function isUserAdmin(phone) {
  if (!phone) return false;
  return ADMIN_PHONES.includes(String(phone).replace(/\D/g, ''));
}
// Overwrite filterAdminPlayers to include inline score inputs
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

    const isActive = player.active === true || String(player.active).toLowerCase() === 'true' || String(player.status).toLowerCase() === 'active';
    const isCheckedIn = player.checkedIn === true || player.isCheckedIn === true || String(player.checkedIn).toLowerCase() === 'true' || String(player.status).toLowerCase() === 'checked in';
    const playerScore = player.points ?? player.score ?? player.total ?? 0;

    return `
<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem; border-bottom:1px solid #eee; gap:0.75rem; flex-wrap:wrap;">
  <!-- Player Details (Left) -->
  <div style="font-weight:bold; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; min-width:180px;">
    ${attrName}${player.court ? `, ${escapeHtmlAttr(player.court)}` : ''},${cleanPhone || 'No phone'}
  </div>

  <!-- Score & Action Controls (Right - All on same line) -->
  <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-left:auto;">
    <!-- Score Input & Save -->
    <div style="display:flex; align-items:center; gap:0.3rem; white-space:nowrap;">
      <span style="font-size:0.85rem; font-weight:bold;">Total:</span>
      <input type="number" id="admin_score_${attrPhone}" value="${playerScore}" style="width: 55px; padding: 0.2rem; border: 1px solid #ccc; border-radius: 4px;">
      <button type="button" class="btn-sub" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; background-color:#6c757d; color:#fff;" onclick="updateAdminPlayerScore('${attrName}', '${attrPhone}')">Save</button>
    </div>

    <!-- Check-In Button -->
    <button type="button" class="btn-main" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isCheckedIn ? '#2e7d32' : '#757575'}; color:white; white-space:nowrap;" onclick="toggleAdminCheckIn(this, '${attrName}', '${attrPhone}',${isCheckedIn})">
      ${isCheckedIn ? '✅ Checked In' : '⬜ Check In'}
    </button>

    <!-- Active/Inactive Button -->
    <button type="button" class="btn-sub" style="padding:0.35rem 0.6rem; font-size:0.8rem; background-color:${isActive ? '#1976d2' : '#d32f2f'}; color:white; white-space:nowrap;" onclick="toggleAdminPlayerActive(this, '${attrName}', '${attrPhone}',${isActive})">
      ${isActive ? 'Active' : 'Inactive'}
    </button>
  </div>
</div>    `;
  }).join('');
}

// Add the new admin score submission function
async function updateAdminPlayerScore(playerName, phone) {
   const groupName = document.getElementById('adminGlobalGroupSelect')?.value || getSavedGroup();
   const scoreInput = document.getElementById(`admin_score_${phone}`);
   const newScore = scoreInput ? parseInt(scoreInput.value, 10) : 0;
   
   if (!groupName) return alert('Please select a target group first.');
   
   try {
     const res = await apiCall('updatePlayerScore', {
        group: groupName,
        groupName: groupName,
        sheet: "Score " + groupName.replace(/^(Score|Sched)\s*/i, ""),
        phone: phone,
        playerName: playerName,
        score: newScore
     });
     if (res && (res.success || !res.error)) {
        alert(`Score successfully updated for ${playerName}.`);
        if (Array.isArray(adminPlayersCache)) {
           const p = adminPlayersCache.find(p => String(p.phone).replace(/\D/g, '') === phone);
           if (p) {
               p.points = newScore;
               p.score = newScore;
               p.total = newScore;
           }
        }
     } else {
        alert('Failed to update score: ' + (res?.message || 'Server Error'));
     }
   } catch (err) {
     alert('Network error updating score.');
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
      if (statusEl) statusEl.innerText = `✅ Command ${actionName} completed successfully!`;
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

// Call this when the Admin UI view is opened
function initAdminView(currentGroup) {
  loadAdminPlayerData(currentGroup);
  
  // Clear any existing intervals
  if (adminPollingInterval) clearInterval(adminPollingInterval);
  
  // Set polling for every 60 seconds
  adminPollingInterval = setInterval(() => {
    loadAdminPlayerData(currentGroup, true); 
  }, 60000);
}

// Call this when the Admin UI is closed or hidden
function teardownAdminView() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
}

async function loadAdminPlayerData(group, isBackgroundPoll = false) {
  return await loadAdminPlayerStatusCache(group);
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
