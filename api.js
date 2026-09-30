
// Global cache variables (ensure these exist in your script)


//  window.API_URL = "https://script.google.com/macros/s/AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ/exec";
  window.API_URL =CONFIG.apiUrl
  const API_URL = window.API_URL;
  const CURRENT_APP_VERSION = "0.9.6";

  const GROUP_COURT_MAP = {
      "Womens": [3,4,5,6,7,8,15,16,17,18,19,20],
      "Mens": [5,6,9,10,13,14,15,16],
      "Mixed": [3,4,5,6,7,8,15,16,17,18,19,20],
      "Default": [5,6,9,10,13,14,15,16]
  };

    console.log('window.API_URL:', window.API_URL);  
  

  let apiQueue = [];
  let isProcessingQueue = false;
  let isInitialLoading = true;
  

  let activeLookupPlayer =  null;
  let activeLookupFoursome = null;


function renderHelpGroupRadios(cleanGroupArray) {

  const container = document.getElementById('helpGroupRadioContainer');
  const checkinContainer = document.getElementById('checkinGroupRadioContainer');

  // Fallback to localStorage cache if array is empty/undefined
  if (!Array.isArray(cleanGroupArray) || cleanGroupArray.length === 0) {
    try {
      cleanGroupArray = JSON.parse(localStorage.getItem('cached_sheets') || '[]');
    } catch (e) {
      cleanGroupArray = [];
    }
  }

  if (!cleanGroupArray || cleanGroupArray.length === 0) return;

  const currentGroup = getSavedGroup() || cleanGroupArray[0];
  let html = '';
  let checkinHtml = '';

  cleanGroupArray.forEach(g => {
    const isChecked = (g === currentGroup) ? 'checked' : '';
    
    if (container) {
      html += `
        <label style="display:flex; align-items:center; gap:0.5rem; font-size:1.1rem; padding:0.5rem 0.75rem; border:2px solid var(--input-border); border-radius:0.5rem; background:var(--input-bg); cursor:pointer;">
          <input type="radio" name="helpGroupRadio" value="${g}" ${isChecked} onchange="onGroupRadioChange(this.value)" style="width:20px; height:20px; margin:0; cursor:pointer;">
          <b>${g}</b>
        </label>
      `;
    }

    if (checkinContainer) {
      checkinHtml += `
        <label style="display:flex; align-items:center; gap:0.5rem; font-size:1.1rem; padding:0.5rem 0.75rem; border:2px solid var(--input-border); border-radius:0.5rem; background:var(--input-bg); cursor:pointer;">
          <input type="radio" name="checkinGroupRadio" value="${g}" ${isChecked} onchange="onGroupRadioChange(this.value)" style="width:20px; height:20px; margin:0; cursor:pointer;">
          <b>${g}</b>
        </label>
      `;
    }
  });

  if (container) container.innerHTML = html;
  if (checkinContainer) checkinContainer.innerHTML = checkinHtml;

  localStorage.setItem('cached_sheets', JSON.stringify(cleanGroupArray));
  syncAllGroupDropdowns(currentGroup);
}

function syncAllGroupDropdowns(groupName) {
  if (!groupName) return;
  const cleanGroup = String(groupName).replace(/^(Sched|Score)\s*/i, '').trim();
  const ids = ['sheetSelect', 'regGroup', 'groupViewerSelect', 'adminGlobalGroupSelect'];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const match = Array.from(el.options).find(opt => 
      opt.value === cleanGroup || opt.value.replace(/^(Sched|Score)\s*/i, '') === cleanGroup
    );
    if (match) {
      el.value = match.value;
    }
  });

  const radios = document.querySelectorAll('input[name="helpGroupRadio"], input[name="checkinGroupRadio"]');
  radios.forEach(r => {
    r.checked = (r.value === cleanGroup);
  });

  const sheetLink = document.getElementById('adminSheetLink');
  if (sheetLink) {
    sheetLink.href = `${API_URL}?action=editSheet&group=${encodeURIComponent(cleanGroup)}`;
  }

  renderAdminCourts(cleanGroup);
}

function getSavedGroup() {
  const cached = localStorage.getItem('scpb_selected_group') || localStorage.getItem('scpb_saved_group');
  if (cached) return cached;

  const selectedHelp = document.querySelector('input[name="helpGroupRadio"]:checked');
  if (selectedHelp) return selectedHelp.value;
  
  const selectedCheckin = document.querySelector('input[name="checkinGroupRadio"]:checked');
  return selectedCheckin ? selectedCheckin.value : '';
}






function populateSheets(sheets) {
  const sourceList = (Array.isArray(sheets) && sheets.length > 0) ? sheets : HARDCODED_GROUPS;
  const select = document.getElementById('sheetSelect');

  const uniqueGroups = new Set();
  sourceList.forEach(s => {
    const cleanGroup = String(s).replace(/^(Sched|Score)\s*/i, '').trim();
    if (cleanGroup) uniqueGroups.add(cleanGroup);
  });

  const cleanGroupArray = Array.from(uniqueGroups);

  if (select) {
    select.innerHTML = '<option value="">-- Choose Group --</option>';
    cleanGroupArray.forEach(cleanGroup => {
      const opt = document.createElement('option');
      opt.value = cleanGroup; 
      opt.textContent = cleanGroup; 
      select.appendChild(opt);
    });
  }
}
  

        
function populateGroups(groups) {
  const sourceList = (Array.isArray(groups) && groups.length > 0) ? groups : HARDCODED_GROUPS;
  const ids = ['regGroup', 'groupViewerSelect', 'adminGlobalGroupSelect'];
  
  const uniqueGroups = new Set();
  sourceList.forEach(g => {
    const cleanGroup = String(g).replace(/^(Sched|Score)\s*/i, '').trim();
    if (cleanGroup) uniqueGroups.add(cleanGroup);
  });
  const cleanGroupArray = Array.from(uniqueGroups);
  
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.value;
    el.innerHTML = id === 'regGroup' ? '<option value="">-- Select Group --</option>' : '<option value="">-- Choose Group --</option>';
    
    cleanGroupArray.forEach(cleanGroup => {
      const opt = document.createElement('option');
      opt.value = cleanGroup;
      opt.textContent = cleanGroup;
      el.appendChild(opt);
    });

    if (currentVal && cleanGroupArray.includes(currentVal)) {
      el.value = currentVal;
    }
  });
}


/**
 * Updates all read-only group badges (.active-group-label) across all tabs.
 */
function updateAllGroupDisplays(groupName) {
  const displayGroup = groupName || getSavedGroup() || '--';
  document.querySelectorAll('.active-group-label').forEach(el => {
    el.textContent = displayGroup;
  });
}


/**
 * Optional: Sync radio button check state & labels when app loads.
 */
document.addEventListener('DOMContentLoaded', () => {
  const savedGroup = getSavedGroup();
  if (savedGroup) {
    const radio = document.querySelector(`input[name="helpGroupRadio"][value="${savedGroup}"]`);
    if (radio) radio.checked = true;
    updateAllGroupDisplays(savedGroup);
  }
  });

  
  async function checkAppVersion() {
      console.log(`Checking Version ...`);      
  try {
      const res = await apiCall('getAppVersion');
    if (res && res.version && res.version !== CURRENT_APP_VERSION) {
      console.log(`New app version detected (${res.version}). Consider Force resetting caches...`);
      //forceResetApp();
    }
  } catch (err) {
    console.warn('Version check skipped or failed:', err);
  }
}

function forceResetApp() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(names => {
      for (let name of names) caches.delete(name);
    });
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload(true);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAppVersion();
  }
});


function toggleContrast() {
  document.body.classList.toggle('high-contrast');
  const isHC = document.body.classList.contains('high-contrast');
  localStorage.setItem('scpb_high_contrast', isHC ? 'true' : 'false');
  
  const btn = document.getElementById('btn-contrast-toggle');
  if (btn) {
    btn.innerText = isHC ? 'Standard Contrast' : 'High Contrast';
  }
}

function initAccessibility() {
  const savedSize = localStorage.getItem('scpb_text_size') || 'large';
  applyTextSize(savedSize);

  const savedHC = localStorage.getItem('scpb_high_contrast');
  if (savedHC === 'true') {
    document.body.classList.add('high-contrast');
    const btn = document.getElementById('btn-contrast-toggle');
    if (btn) btn.innerText = 'Standard Contrast';
  }
}

let secretTapCount = 0;
let secretTapTimer = null;

function handleSecretTap(e) {
  secretTapCount++;
  if (secretTapCount === 1) {
    secretTapTimer = setTimeout(() => {
      secretTapCount = 0;
    }, 2000);
  }
  if (secretTapCount >= 5) {
    clearTimeout(secretTapTimer);
    secretTapCount = 0;
    const adminBtn = document.getElementById('tabAdminBtn');
    if (adminBtn) {
      adminBtn.style.display = 'inline-block';
      alert('🔓 Admin Mode Unlocked!');
      switchTab('admin');
    }
  }
}






let checkInPlayersCache = [];



// Replace renderCheckInPlayers to display just the auto-checked user
function renderCheckInPlayers(players) {
  console.log(`📡 rendercheckinplayers : "${players}"...`);
  const nameEl = document.getElementById('checkinPlayerName');
  const badgeEl = document.getElementById('checkinPlayerStatusBadge');
  const btnEl = document.getElementById('userCheckinBtn');
  
  if (!nameEl || !badgeEl || !btnEl) return;

  const savedPhone = getSavedPhone();
  const cleanPhone = savedPhone.replace(/\D/g, '');

  let currentUser = null;
  if (players && players.length > 0) {
     currentUser = players.find(p => String(p.phone || p.cell || p.playerId || '').replace(/\D/g, '') === cleanPhone);
  }

  if (!currentUser) {
     nameEl.innerText = 'Player not found in this group.';
     badgeEl.innerText = 'N/A';
     badgeEl.className = 'status-badge';
     btnEl.style.display = 'none';
     return;
  }

  const displayName = currentUser.name || `${currentUser.first || ''} ${currentUser.last || ''}`.trim();
  nameEl.innerText = displayName;

  const isChecked = currentUser.checkedIn === true || currentUser.checkedIn === 'true' || currentUser.checked === true;
  badgeEl.innerText = isChecked ? 'Checked In' : 'Not Checked In';
  badgeEl.className = isChecked ? 'status-badge status-active' : 'status-badge status-inactive';

  btnEl.style.display = 'inline-block';
  btnEl.innerText = isChecked ? 'Cancel Check-In' : 'Check In';
  
  btnEl.setAttribute('data-phone', currentUser.phone || savedPhone);
  btnEl.setAttribute('data-name', displayName);
  btnEl.setAttribute('data-checked', isChecked);
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
      const allowed = isUserAdmin(savedPhone) ? true : await checkGeofence();
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







async function lookupPhone(cachedPhone) {
  const phoneInput = document.getElementById('phoneInput') || document.getElementById('scorePhoneInput');
  const phoneBtn = document.getElementById('savePhoneBtn');
  const findBtn = document.getElementById('findFoursomeBtn');

  let phone = cachedPhone || (phoneInput ? phoneInput.value : '') || getSavedPhone();
  phone = String(phone).replace(/\D/g, '');

  if (phone.length !== 10) return;

  if (phoneInput) phoneInput.value = phone;

  document.body.style.cursor = 'wait';
  if (findBtn) {
    findBtn.disabled = true;
    findBtn.innerHTML = '⏳ Checking...';
  }
  if (phoneBtn) {
    phoneBtn.disabled = true;
    phoneBtn.innerHTML = '⏳ Checking...';
  }

  try {
    const currentGroup = getSavedGroup();
    const result = await apiCall('findFoursomeByPhone', { 
      groupName: currentGroup, 
      phone: phone 
    });

    if (result && (result.success || result.found)) {
      let playerObj = null;

      if (Array.isArray(result.foursome) && result.foursome.length > 0) {
        playerObj = (typeof result.player === 'object' && result.player !== null) 
          ? result.player 
          : { 
              name: result.player || result.name || 'Player', 
              court: result.court || 'Unassigned', 
              group: result.group || currentGroup 
            };
      } else if (result.player || result.name) {
        playerObj = (typeof result.player === 'object' && result.player !== null)
          ? result.player
          : { name: result.player || result.name || 'Player', group: currentGroup };
      }

      // Extract full name
      const resolvedName = playerObj 
        ? (`${playerObj.first || ''} ${playerObj.last || ''}`.trim() || playerObj.name || playerObj.playerName || '') 
        : '';

      // Cache BOTH name and phone in single storage keys
      savePlayerCredentials(phone, resolvedName);

      if (findBtn) {
        findBtn.disabled = true;
        findBtn.innerHTML = ' Found...';
      }

      renderLookupResult(playerObj, result.foursome || []);
      if (typeof updateWelcomeBanner === 'function') updateWelcomeBanner();
    } else {
      if (phoneBtn) {
         phoneBtn.innerHTML = 'Register New Player';
      }
        const statusMsg = document.getElementById('phoneStatus');
        if (statusMsg) {
            statusMsg.innerText = "Phone number not registered. Please complete registration below.";
            statusMsg.style.color = "#dc3545";
        }        
        const scoreRegSection = document.getElementById('registrationSection');
          if (scoreRegSection) {
              scoreRegSection.style.display = 'block';
          }

          const helpRegAccordion = document.getElementById('registrationAccordion');
          if (helpRegAccordion) {
              helpRegAccordion.open = true; // Automatically expands <details> on Tab 1
          }
         //phoneBtn.onclick =       showRegistrationFields(); // show name, email, etc.
        renderLookupResult(null, []);
    }
  } catch (err) {
    console.error("Error during lookup:", err);
    renderLookupResult(null, []);
  } finally {
    document.body.style.cursor = 'default';
    if (phoneBtn && phoneBtn.innerHTML !== 'Register New Player') {
      phoneBtn.disabled = false;
      phoneBtn.innerHTML = 'Recheck Assignment';
    }
  }
}





function renderLookupResult(player, foursome) { 
  activeLookupPlayer = player || {};
  activeLookupFoursome = foursome || [];

  const regEl = document.getElementById('registrationSection');
  const resultEl = document.getElementById('lookupResult');
  if (regEl) regEl.style.display = 'none';
  if (resultEl) resultEl.style.display = 'block';

  // Construct display name
  let displayName = '';
  if (typeof player === 'string') {
    displayName = player;
  } else if (player) {
    displayName = `${player.first || ''} ${player.last || ''}`.trim() || player.name || 'Unknown';
  } else {
    displayName = 'Unknown';
  }

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

  if (activeLookupFoursome.length === 4) {
    const getPName = (p) => (typeof p === 'object' && p !== null ? (p.name || `${p.first || ''} ${p.last || ''}`.trim()) : String(p || ''));
    
    const p1 = getPName(activeLookupFoursome[0]);
    const p2 = getPName(activeLookupFoursome[1]);
    const p3 = getPName(activeLookupFoursome[2]);
    const p4 = getPName(activeLookupFoursome[3]);

    scoreContainer.innerHTML = `
      <!-- FOURSOME ROSTER SUMMARY CARD -->
      <div style="margin-bottom: 1.25rem; padding: 1rem; background-color: #f8f9fa; border: 2px solid #0d6efd; border-radius: 10px;">
        <p style="margin: 0 0 0.5rem 0; font-size: 1.2rem; color: #0d6efd;"><b>🎾 Assigned Foursome:</b></p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 1.15rem; font-weight: 600; color: #212529;">
          <div>P1: ${p1}</div>
          <div>P2: ${p2}</div>
          <div>P3: ${p3}</div>
          <div>P4: ${p4}</div>
        </div>
      </div>

      <!-- GAME 1 CARD -->
      <div style="background: #ffffff; border: 2px solid #0d6efd; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
        <div style="font-size: 1.3rem; font-weight: bold; color: #0d6efd; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 12px;">
          🏆 Game 1
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
          <!-- Team A -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p1} & ${p4}</div>
            <input type="number" min="0" max="15" id="sc1_p1" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>

          <div style="font-size: 1.3rem; font-weight: bold; color: #6c757d;">VS</div>

          <!-- Team B -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p2} & ${p3}</div>
            <input type="number" min="0" max="15" id="sc1_p2" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>
        </div>
      </div>

      <!-- GAME 2 CARD -->
      <div style="background: #ffffff; border: 2px solid #0d6efd; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
        <div style="font-size: 1.3rem; font-weight: bold; color: #0d6efd; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 12px;">
          🏆 Game 2
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
          <!-- Team A -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p1} & ${p3}</div>
            <input type="number" min="0" max="15" id="sc2_p1" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>

          <div style="font-size: 1.3rem; font-weight: bold; color: #6c757d;">VS</div>

          <!-- Team B -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p2} & ${p4}</div>
            <input type="number" min="0" max="15" id="sc2_p2" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>
        </div>
      </div>

      <!-- GAME 3 CARD -->
      <div style="background: #ffffff; border: 2px solid #0d6efd; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
        <div style="font-size: 1.3rem; font-weight: bold; color: #0d6efd; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 12px;">
          🏆 Game 3
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
          <!-- Team A -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p1} & ${p2}</div>
            <input type="number" min="0" max="15" id="sc3_p1" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>

          <div style="font-size: 1.3rem; font-weight: bold; color: #6c757d;">VS</div>

          <!-- Team B -->
          <div style="flex: 1; min-width: 140px; text-align: center; background: #e7f1ff; padding: 12px; border-radius: 8px; border: 1px solid #b6d4fe;">
            <div style="font-size: 1.15rem; font-weight: bold; color: #084298; margin-bottom: 8px;">${p3} & ${p4}</div>
            <input type="number" min="0" max="15" id="sc3_p2" placeholder="Score" 
                   style="font-size: 1.6rem; font-weight: bold; text-align: center; width: 100%; max-width: 110px; height: 52px; border: 2px solid #0d6efd; border-radius: 8px; background: #ffffff;">
          </div>
        </div>
      </div>
    `;
  } else {
    scoreContainer.innerHTML = `
      <div style="background-color: #fff3cd; color: #664d03; border: 1px solid #ffe69c; font-size: 1.15rem; padding: 15px; border-radius: 8px; margin-top: 1rem;">
        ⚠️ No active 4-player court match assignment found.
      </div>
    `;
  }
}

async function saveScores() {
  if (!activeLookupPlayer || activeLookupFoursome.length < 4) {
    alert('Active court match assignment not found.');
    return;
  }

  // Helper to parse score inputs: returns undefined for empty fields, 'INVALID' for negative/bad numbers
  const parseScore = (id) => {
    const val = document.getElementById(id)?.value?.trim();
    if (val === '' || val === undefined || val === null) return undefined;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 0 ? 'INVALID' : parsed;
  };

  const v1_1 = parseScore('sc1_p1');
  const v1_2 = parseScore('sc1_p2');
  const v2_1 = parseScore('sc2_p1');
  const v2_2 = parseScore('sc2_p2');
  const v3_1 = parseScore('sc3_p1');
  const v3_2 = parseScore('sc3_p2');

  const allScores = [v1_1, v1_2, v2_1, v2_2, v3_1, v3_2];

  if (allScores.includes('INVALID')) {
    alert('Please enter valid non-negative numbers for all filled score fields.');
    return;
  }

  // Ensure at least one score field is filled
  if (allScores.every(v => v === undefined)) {
    alert('Please enter at least one game score before submitting.');
    return;
  }

  const p1 = activeLookupFoursome[0].name;
  const p2 = activeLookupFoursome[1].name;
  const p3 = activeLookupFoursome[2].name;
  const p4 = activeLookupFoursome[3].name;

   // Frontend maps game rotation to individual player objects (leaving empty games as undefined)
  const scoresPayload = [
    { name: p1, g1: v1_1, g2: v2_1, g3: v3_1 },
    { name: p2, g1: v1_2, g2: v2_2, g3: v3_1 },
    { name: p3, g1: v1_2, g2: v2_1, g3: v3_2 },
    { name: p4, g1: v1_1, g2: v2_2, g3: v3_2 }
  ];

  const submitterPhone = activeLookupPlayer.phone || localStorage.getItem('scpb_saved_phone') || '';
  const cleanGroup = String(activeLookupPlayer.group || '').replace(/^(Sched|Score)\s*/i, '').trim();
  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Submitting scores...';

  try {
    const res = await apiCall('submitCourtScores', {
      group: cleanGroup,
      scores: scoresPayload,
      submittedBy: submitterPhone
    });

    if (res && res.success) {
      if (statusEl) statusEl.innerText = '✅ Scores submitted successfully!';
    } else {
      if (statusEl) statusEl.innerText = '❌ Submission failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error submitting scores: ' + err.message;
  }
}






async function submitUserRegistration() {
  // Helper to find the active non-empty value across duplicate input IDs
  const getInputValue = (...ids) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.value && el.value.trim() !== '') {
        return el.value.trim();
      }
    }
    return '';
  };

  // 1. READ FIELD VALUES (Checks frontReg IDs first)
  const first = getInputValue('frontRegFirst', 'regFirst');
  const last = getInputValue('frontRegLast', 'regLast');
  const phone = getInputValue('frontRegPhone', 'regPhone');
  const email = getInputValue('frontRegEmail', 'regEmail');

  // 2. READ GROUP FROM TOP SELECTOR OR SAVED LOCAL STORAGE
  const topGroupSelect = document.getElementById('groupSelect') || 
                         document.getElementById('groupDropdown') || 
                         document.getElementById('adminGroupSelect');

  const group = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || 
                (topGroupSelect ? topGroupSelect.value : '');

  // LOG VALUES TO CONSOLE FOR EASY DEBUGGING
  console.log("🔍 Registration Attempt Values:", { first, last, phone, email, group });

  // 3. VALIDATE GROUP SELECTION
  if (!group) {
    alert('⚠️ Please choose a Group at the top of the page before submitting registration.');
    return;
  }

  // 4. VALIDATE REQUIRED USER FIELDS
  if (!first || !last || !phone) {
    let missing = [];
    if (!first) missing.push("First Name");
    if (!last) missing.push("Last Name");
    if (!phone) missing.push("Phone Number");

    alert(`⚠️ Please fill out: ${missing.join(', ')}`);
    return;
  }

  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Submitting registration...';

  try {
    document.body.style.cursor = 'wait';

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
      alert(`✅ Registration submitted for ${first} ${last}! You are registered as Pending in group '${group}'.`);

      // Clear input fields
      ['frontRegFirst', 'regFirst', 'frontRegLast', 'regLast', 'frontRegPhone', 'regPhone', 'frontRegEmail', 'regEmail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      if (typeof cancelRegistration === 'function') cancelRegistration();
      if (statusEl) statusEl.innerText = '✅ Registration complete!';
    } else {
      const errMsg = (typeof res === 'string' ? res : res.message) || 'Error submitting registration';
      alert('❌ Registration failed: ' + errMsg);
      if (statusEl) statusEl.innerText = '❌ Registration failed: ' + errMsg;
    }
  } catch (err) {
    console.error("Error submitting registration:", err);
    alert('❌ Error submitting registration. Please check your network connection.');
    if (statusEl) statusEl.innerText = '❌ Error submitting registration.';
  } finally {
    document.body.style.cursor = 'default';
  }
}

async function toggleStatus() {
  console.log(`In togglestatus...`);
  if (!activeLookupPlayer) return;
  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Updating status...';
  console.log(`In togglestatus with activeLookupPlayer...`);
  try {
    const res = await apiCall('toggleUnifiedActiveStatus', {
      phone: activeLookupPlayer.phone,
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
  // --- Tab 3 (Enter Scores) Form ---
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




async function runRescheduleCheckedIn() {
  const groupName = document.getElementById('adminGlobalGroupSelect').value || getSavedGroup();
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
      loadAdminPlayerStatusCache(groupName);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule.';
  }
}

async function runRescheduleActive() {
  const groupName = document.getElementById('adminGlobalGroupSelect').value || getSavedGroup();
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
      loadAdminPlayerStatusCache(groupName);
    } else {
      if (statusEl) statusEl.innerText = '❌ Reschedule failed: ' + (res.message || 'Error');
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = '❌ Error performing reschedule.';
  }
}


let checkInRefreshTimer = null;
let checkincnt=0                                      

function startCheckInAutoRefresh() {
   stopCheckInAutoRefresh();
   checkincnt= checkincnt+1;                                                                             
  checkInRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && document.getElementById('checkinTab').classList.contains('active')) {
      loadCheckInPlayers();
    }
  }, 30000);
}

function stopCheckInAutoRefresh() {
  if (checkInRefreshTimer) {
    clearInterval(checkInRefreshTimer);
    checkInRefreshTimer = null;
  }
}

function setSelectedGroup(groupName) {
  const cleanGroup = String(groupName).replace(/^(Sched|Score)\s*/i, '').trim();
  localStorage.setItem('scpb_selected_group', cleanGroup);
  localStorage.setItem('scpb_saved_group', cleanGroup);
}
// Helper to retrieve saved group from your apps key
function getSavedGroup() { 
  return localStorage.getItem('scpb_selected_group');
}

async function onGroupRadioChange(selectedGroup) {
  console.log(`onGroupRadioChange ${selectedGroup}`); // Fixed template literal backticks
  const cleanGroup = String(selectedGroup).replace(/^(Sched|Score)\s*/i, '').trim();

  // -------------------------------------------------------------
  // 1. Force DOM elements directly to show loading immediately
  // -------------------------------------------------------------
  
  // A. Front / Setup Tab Elements
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

  // B. Check-in Tab Elements (FIX: Immediately display loading state on Check-in Tab)
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

  // CRITICAL: Yield execution to allow browser UI thread to repaint screen instantly
  await new Promise(resolve => setTimeout(resolve, 50));

  // -------------------------------------------------------------
  // 2. Sync group selection across storage
  // -------------------------------------------------------------
  if (typeof setSelectedGroup === 'function') {
    setSelectedGroup(cleanGroup);
  } else {
    localStorage.setItem('scpb_selected_group', cleanGroup);
    localStorage.setItem('scpb_saved_group', cleanGroup);
  }

  // -------------------------------------------------------------
  // 3. Clear existing caches & active player references
  // -------------------------------------------------------------
  window.appPlayersCache = [];
  window.unifiedRosterCache = { data: null, group: null, timestamp: 0 };
  if (typeof checkInPlayersCache !== 'undefined') checkInPlayersCache = [];
  if (typeof adminPlayersCache !== 'undefined') adminPlayersCache = [];
  window.activeLookupPlayer = null;
  window.activeLookupFoursome = null;

  // -------------------------------------------------------------
  // 4. Sync radio buttons UI
  // -------------------------------------------------------------
  const allGroupRadios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"]'
  );
  allGroupRadios.forEach(radio => {
    radio.checked = (radio.value === cleanGroup);
  });

  // -------------------------------------------------------------
  // 5. Sync dropdowns/labels
  // -------------------------------------------------------------
  if (typeof syncAllGroupDropdowns === 'function') syncAllGroupDropdowns(cleanGroup);
  if (typeof updateAllGroupDisplays === 'function') updateAllGroupDisplays(cleanGroup);

  // -------------------------------------------------------------
  // 6. Run lookup for saved phone number
  // -------------------------------------------------------------
  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : (localStorage.getItem('scpb_saved_phone') || '');
  if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
    await loadPlayerStatusFromCache(savedPhone);
  } else if (typeof setAppViewState === 'function') {
    setAppViewState(false, '');
  }

  // -------------------------------------------------------------
  // 7. Refresh active tab data (Fetches server data & calls renderCheckInPlayers)
  // -------------------------------------------------------------
  if (typeof refreshActiveTabData === 'function') {
    await refreshActiveTabData(true);
  }
    
  // 8. FIX: Remove loading message after data lookup completes
  if (checkinStatus && checkinStatus.innerText.includes("Loading status")) {
    checkinStatus.innerText = ""; // Clear loading message
  }    
}




// 2. Sync UI state on page load
function syncGroupRadioUI() {
  const currentGroup = localStorage.getItem('scpb_selected_group');
  const cleanGroup = String(currentGroup).replace(/^(Sched|Score)\s*/i, '').trim();

  const allGroupRadios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"]'
  );
  allGroupRadios.forEach(radio => {
    radio.checked = (radio.value === cleanGroup);
  });

  document.querySelectorAll('.active-group-label').forEach(el => {
    el.textContent = cleanGroup;
  });
  loadUnifiedRosterData(cleanGroup);
    
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

// Run initial UI sync on DOM load
document.addEventListener('DOMContentLoaded', () => {
  syncGroupRadioUI();
});    




function renderRankingsAndSchedule(data) {
  const viewerContent = document.getElementById('viewerContent');
  if (!viewerContent) return;

  // Handles raw HTML string returned by backend
  if (typeof data === 'string') {
    viewerContent.innerHTML = data;
    return;
  }

  if (data.html) {
    viewerContent.innerHTML = data.html;
    return;
  }

  // Handles JSON object with rankings/schedule arrays
  let html = '';

  const scheduleList = data.schedule || data.courts || data.matches;
  if (scheduleList && Array.isArray(scheduleList) && scheduleList.length > 0) {
    html += `<h3 style="margin-top:0.5rem; margin-bottom:0.5rem;">📅 Current Schedule</h3>`;
    scheduleList.forEach(item => {
      if (typeof item === 'string') {
        html += `<div>${item}</div>`;
      } else {
        const courtLabel = item.court || item.courtName || `Court ${item.courtNum || ''}`;
        const players = item.players || item.foursome || [];
        html += `
          <div class="card" style="margin-bottom:0.5rem;">
            <div class="court-header">${courtLabel}</div>
            <div style="padding:0.5rem;">${Array.isArray(players) ? players.join(', ') : players}</div>
          </div>
        `;
      }
    });
  } else if (data.scheduleHtml) {
    html += `<h3 style="margin-top:0.5rem; margin-bottom:0.5rem;">📅 Current Schedule</h3>` + data.scheduleHtml;
  }

  const rankingsList = data.rankings || data.ranks || data.standings || data.players;
  if (rankingsList && Array.isArray(rankingsList) && rankingsList.length > 0) {
    html += `<h3 style="margin-top:1rem; margin-bottom:0.5rem;">🏆 Current Rankings / Standings</h3>`;
    html += `
      <table class="data-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Points</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    rankingsList.forEach((r, idx) => {
      if (typeof r === 'string') {
        html += `<tr><td colspan="4">${r}</td></tr>`;
      } else {
        const rank = r.rank || idx + 1;
        const name = r.name || `${r.first || ''} ${r.last || ''}`.trim();
        const score = r.points ?? r.score ?? r.pct ?? r.total ?? '';
        const status = r.status || 'Active';
        html += `
          <tr>
            <td><b>${rank}</b></td>
            <td>${name}</td>
            <td>${score}</td>
            <td><span class="status-badge ${status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}">${status}</span></td>
          </tr>
        `;
      }
    });
    html += `</tbody></table>`;
  } else if (data.rankingsHtml) {
    html += `<h3 style="margin-top:1rem; margin-bottom:0.5rem;">🏆 Current Rankings / Standings</h3>` + data.rankingsHtml;
  }

  if (!html) {
    viewerContent.innerHTML = `<pre style="white-space:pre-wrap; word-break:break-word;">${JSON.stringify(data, null, 2)}</pre>`;
    return;
  }

  viewerContent.innerHTML = html;
      }


function loadSavedPhone() {
  const savedPhone = localStorage.getItem('scpb_saved_phone') || localStorage.getItem('saved_phone') || '';
  const phoneInput = document.getElementById('phoneInput');
  const phoneEntry = document.getElementById('phoneEntrySection');
  
  if (phoneEntry) phoneEntry.style.display = 'block';
  if (phoneInput && savedPhone) {
    phoneInput.value = savedPhone;
    checkAndUnlockAdmin(savedPhone); // NEW: Auto-show tab on load
  }
  }
  


// 1. Run after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    // Load local cached phone number
    if (typeof loadSavedPhone === 'function') {
      loadSavedPhone();
    }

    // 🚀 Hide loading overlay immediately so the app UI is visible
    const overlay = document.getElementById('globalLoader');
    if (overlay) {
      overlay.style.display = 'none';
      // Or overlay.remove(); if you want to completely destroy the DOM element
    }
  }, 1000); 
});

// 2. Add to your active tab refresh logic so it stays populated when switching tabs
if (typeof refreshActiveTabData === 'function') {
  const oldRefresh = refreshActiveTabData;
  refreshActiveTabData = async function() {
    await oldRefresh();
  };
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

let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
});  







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


/**
 * 2. REFRESH ROUTER (Required by switchTab)
 */
async function refreshActiveTabData(forceRefresh = false) {
  const activeTab = localStorage.getItem('activeTab') || 'help';
  const currentGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : null;

  if (typeof renderHelpGroupRadios === 'function') {
    renderHelpGroupRadios();
  }

  if (!currentGroup) return;

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  if (activeTab === 'checkin' || activeTab === 'admin') {
    if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
    if (activeTab === 'admin') {
      if (typeof renderAdminCourts === 'function') await renderAdminCourts(currentGroup);
    }
    if (typeof loadUnifiedRosterData === 'function') {
      await loadUnifiedRosterData(currentGroup, forceRefresh);
    }
  } else if (activeTab === 'ranksched') {
    if (typeof loadRankingsAndSched === 'function') {
      await loadRankingsAndSched();
    }
  } else if (activeTab === 'scoreTab' || activeTab === 'score' || activeTab === 'phone') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
    if (typeof lookupPhone === 'function') {
      await lookupPhone();
    }
    if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();             
  } else if (activeTab === 'help') {
    const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : '';
    if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
      await loadPlayerStatusFromCache(savedPhone);
    }
  }

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();
}




/**
 * 3. VERSION CHECK FIX (Fixed Bitwise Syntax Error)
 */
function handleVersionCheck(serverVersion) {
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
function checkPlayerExists(phone, selectedGroup) {
  if (!phone) return { exists: false, player: null };

  // 1. Normalize phone input
  const cleanPhone = typeof normalizePhone === 'function'
    ? normalizePhone(phone)
    : String(phone).replace(/\D/g, '');

  if (cleanPhone.length < 7) return { exists: false, player: null };

  const targetGroup = selectedGroup ? String(selectedGroup).trim().toLowerCase() : '';

  // 2. Load active in-memory roster cache
  const roster = (Array.isArray(window.appPlayersCache) && window.appPlayersCache.length > 0)
    ? window.appPlayersCache
    : (Array.isArray(checkInPlayersCache) && checkInPlayersCache.length > 0)
      ? checkInPlayersCache
      : (Array.isArray(adminPlayersCache) ? adminPlayersCache : []);

  // 3. Search for a player matching BOTH phone number and group
  const player = roster.find(p => {
    // Match phone number
    const pPhone = typeof normalizePhone === 'function'
      ? normalizePhone(p.phone || p.cell || p.mobile || p.playerId)
      : String(p.phone || p.cell || p.mobile || p.playerId || '').replace(/\D/g, '');

    const phoneMatches = pPhone.length >= 7 && (
      pPhone === cleanPhone ||
      pPhone.endsWith(cleanPhone.slice(-7)) ||
      cleanPhone.endsWith(pPhone.slice(-7))
    );

    if (!phoneMatches) return false;

    // Match group (if selectedGroup is provided)
    if (!targetGroup) return true;

    const pGroup = String(p.groupName || p.group || p.selectedGroup || '').trim().toLowerCase();
    return !pGroup || pGroup === targetGroup;
  });

  return {
    exists: !!player,
    player: player || null
  };
}
  
// 4. Save Phone Number to LocalStorage & Load Status
function savePhoneToCache() {
  const phoneInput = document.getElementById("phoneInput");
  const savePhoneBtn = document.getElementById("savePhoneBtn");

  // Grab selected radio button group (Womens, Mixed, Mens)
  const selectedRadio = document.querySelector('input[name="helpGroupRadio"]:checked');
  const selectedGroup = selectedRadio ? selectedRadio.value : "";

  const phone = phoneInput ? phoneInput.value.trim() : "";

  if (!phone) {
    alert("Please enter a phone number.");
    return;
  }

  console.log('SavephonebtoCache  Phone ${phone}');
    

  // Fixed: Destructuring `exists` instead of `isRegistered`
  const { exists, player } = checkPlayerExists(phone, selectedGroup);

  if (exists) {
    // ==========================================
    // ✅ SUCCESS STATE: GREEN / "Registered ✓"
    // ==========================================
    console.log('Found player:', player);

      // 1. Save valid phone & group to localStorage
        localStorage.setItem("scpb_saved_group", selectedGroup);
        savePlayerCredentials(phone, player.name);

    // 2. Update button styling
    if (savePhoneBtn) {
      savePhoneBtn.style.backgroundColor = "#2d6a4f"; // Green
      savePhoneBtn.style.color = "#ffffff";
      savePhoneBtn.textContent = "Registered ✓";
      savePhoneBtn.onclick = savePhoneToCache;
    }

    checkAndUnlockAdmin(phone);        
      
    // 3. Update status
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  } else {
    // ==========================================
    // ❌ FAILURE STATE: RED / "Must register"
    // ==========================================

    // 1. Update button styling & rebind click to open registration form
    if (savePhoneBtn) {
      savePhoneBtn.style.backgroundColor = "#d90429"; // Red
      savePhoneBtn.style.color = "#ffffff";
      savePhoneBtn.textContent = "Must register";

      savePhoneBtn.onclick = function () {
        redirectToRegistrationTab(phone, selectedGroup);
      };
    }

    // 2. Direct user immediately to registration tab
    console.log('Not registered in group. Directing to registration...');
    redirectToRegistrationTab(phone, selectedGroup);
  }
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();    
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

  if (isFound && playerData) {
    // Player found in current group
    if (checkinName) checkinName.innerText = playerData.name || playerData.playerName;
    if (checkinStatus) checkinStatus.innerText = ""; // Reset/clear status text
    if (userCheckinBtn) {
      userCheckinBtn.disabled = false;
      userCheckinBtn.innerText = playerData.isCheckedIn ? "Cancel Check-in" : "Check In";
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
      const savedPhone = localStorage.getItem("userPhone") || localStorage.getItem("scpb_saved_phone") || "";      
      const isAdmin = isUserAdmin(savedPhone);
      saveBtn.textContent = "Admin Reg. ✓";
      
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


async function loadPlayerStatusFromCache(phone) {
  const statusCard = document.getElementById("frontStatusCard");
  const statusDisplay = document.getElementById("frontStatusDisplay");

  if (!statusCard || !statusDisplay) return;

  // Show loading indicator immediately before doing any lookup logic
  if (typeof showStatusLoading === "function") {
    showStatusLoading("⏳ LOOKING UP...");
  }

  const selectedGroup = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || 
                        document.querySelector('input[name="helpGroupRadio"]:checked')?.value || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    setAppViewState(false, phone);
    return;
  }

  let roster = window.appPlayersCache;
  const isRosterForGroup = Array.isArray(roster) && roster.length > 0 && 
    (roster[0]?.group === selectedGroup || roster[0]?.groupName === selectedGroup);

  if (!isRosterForGroup) {
    if (typeof fetchGroupRoster === "function") {
      roster = await fetchGroupRoster(selectedGroup, true);
    }
  }

  const cleanDigits = String(cleanPhone || "").replace(/\D/g, "");

  const found = Array.isArray(roster) ? roster.find(p => {
     const rawValue = p.phone || p.cell || p.mobile || p.phoneNumber || p.id || "";
     const pDigits = String(rawValue).replace(/\D/g, "");
     return pDigits.length >= 7 && cleanDigits.length >= 7 && pDigits.endsWith(cleanDigits.slice(-7));
  }) : null;

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

    setAppViewState(true, phone);
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





// ==========================================
// 5. TOGGLE PLAYER STATUS (Direct API & Sheet Sync)
// ==========================================
async function toggleStatusFromSetup() {
  const phone = localStorage.getItem("userPhone") || 
                localStorage.getItem("scpb_saved_phone") || 
                document.getElementById("phoneInput")?.value.trim() || "";
  const selectedGroup = document.querySelector('input[name="helpGroupRadio"]:checked')?.value || 
                        localStorage.getItem('scpb_saved_group') || '';

  const cleanPhone = typeof normalizePhone === "function" ? normalizePhone(phone) : phone.replace(/\D/g, "");

     console.log(`In togglestatus from Setup 2842...`);
    
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
    // Make exact backend API call with required 'sheet' tab name
    const res = await apiCall('toggleUnifiedActiveStatus', {
      phone: cleanPhone,
      groupName: selectedGroup,
      group: selectedGroup,
      sheet: "Sched " + selectedGroup
    });

    if (res && res.success) {
      const newStatus = res.newStatus || "ACTIVE";
      const isActive = String(newStatus).toUpperCase() === "ACTIVE";

      // 1. Update activeLookupPlayer global object
      if (!window.activeLookupPlayer) window.activeLookupPlayer = {};
      window.activeLookupPlayer.phone = cleanPhone;
      window.activeLookupPlayer.group = selectedGroup;
      window.activeLookupPlayer.status = newStatus;
      window.activeLookupPlayer.active = isActive;

      // 2. Sync change with local memory cache
      if (Array.isArray(window.appPlayersCache)) {
        const cachedPlayer = window.appPlayersCache.find(p => {
          const pPhone = typeof normalizePhone === "function" 
            ? normalizePhone(p.phone || p.cell || p.mobile || "") 
            : (p.phone || "").replace(/\D/g, "");
          return pPhone.length >= 7 && pPhone.endsWith(cleanPhone.slice(-7));
        });

        if (cachedPlayer) {
          cachedPlayer.status = newStatus;
          cachedPlayer.active = isActive;
        }
      }

      // 3. Update setup UI status badge
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

    // Revert UI badge to previous state
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

// ==========================================
// 2. UNIFIED USER REGISTRATION SUBMISSION
// ==========================================
// ==========================================
// UNIFIED USER REGISTRATION SUBMISSION
// ==========================================
async function submitUserRegistration() {
  const getInputValue = (...ids) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.value && el.value.trim() !== '') {
        return el.value.trim();
      }
    }
    return '';
  };

  const first = getInputValue('frontRegFirst', 'regFirst');
  const last = getInputValue('frontRegLast', 'regLast');
  const phone = getInputValue('frontRegPhone', 'regPhone');
  const email = getInputValue('frontRegEmail', 'regEmail');

  const topGroupSelect = document.getElementById('groupSelect') || 
                         document.getElementById('groupDropdown') || 
                         document.getElementById('adminGroupSelect');

  const group = (typeof getSavedGroup === 'function' ? getSavedGroup() : '') || 
                (topGroupSelect ? topGroupSelect.value : '');

  // --- VALIDATION GUARDS ---

  if (!group) {
    alert('⚠️ Please choose a Group at the top of the page before submitting registration.');
    return;
  }

  if (!first || !last || !phone) {
    let missing = [];
    if (!first) missing.push("First Name");
    if (!last) missing.push("Last Name");
    if (!phone) missing.push("Phone Number");

    alert(`⚠️ Please fill in all required fields:\n• ${missing.join('\n• ')}`);
    return;
  }

  if (!isValidPhone(phone)) {
    alert('⚠️ Please enter a valid 10-digit phone number.\nExample: (623) 555-0199 or 6235550199');
    return;
  }

  if (!isValidEmail(email)) {
    alert('⚠️ Please enter a valid email address (e.g. name@example.com) or leave the email field blank.');
    return;
  }

  const cleanDigits = phone.replace(/\D/g, '');
  const formattedPhone = cleanDigits.length === 10 
    ? `${cleanDigits.slice(0,3)}-${cleanDigits.slice(3,6)}-${cleanDigits.slice(6)}`
    : (cleanDigits.length === 11 && cleanDigits.startsWith('1'))
    ? `${cleanDigits.slice(1,4)}-${cleanDigits.slice(4,7)}-${cleanDigits.slice(7)}`
    : phone;
  savePhoneToCache(formattedPhone);

  const statusEl = document.getElementById('phoneStatus');
  if (statusEl) statusEl.innerText = 'Submitting registration...';

  // Find registration button(s)
  const regBtns = document.querySelectorAll('button[onclick*="Registration"], button[onclick*="submitUserRegistration"]');

  try {
    document.body.style.cursor = 'wait';

    const res = await apiCall('addNewUser', { 
      first, 
      last, 
      phone: formattedPhone, 
      email, 
      group: group,
      groupName: group,
      sheet: "Sched " + group
    });

    if (res && (res.success || !res.error)) {
      alert(`✅ Registration submitted for ${first} ${last}!\nStatus: Inactive (pending review in group '${group}').`);
      
      if (typeof cancelRegistration === 'function') cancelRegistration();
      if (statusEl) statusEl.innerText = '✅ Registration complete!';

      // 1. UPDATE BUTTON TO "REGISTERED"
      regBtns.forEach(btn => {
        btn.innerText = '✅ Registered';
        btn.style.backgroundColor = '#198754'; // Turn green for visual confirmation
      });

      // 2. AUTO-RESET BUTTON IF TYPO IS EDITED
      const inputIds = ['frontRegFirst', 'regFirst', 'frontRegLast', 'regLast', 'frontRegPhone', 'regPhone', 'frontRegEmail', 'regEmail'];
      
      const resetOnEdit = function() {
        regBtns.forEach(btn => {
          btn.innerText = 'Register New Player';
          btn.style.backgroundColor = ''; // Restore original style
        });
        // Remove listeners once reset
        inputIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.removeEventListener('input', resetOnEdit);
        });
      };

      inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', resetOnEdit);
      });

    } else {
      const errMsg = (typeof res === 'string' ? res : res.message) || 'Error submitting registration';
      alert('❌ Registration failed: ' + errMsg);
      if (statusEl) statusEl.innerText = '❌ Registration failed: ' + errMsg;
    }
  } catch (err) {
    console.error("Error submitting registration:", err);
    alert('❌ Error submitting registration. Please check your connection.');
    if (statusEl) statusEl.innerText = '❌ Error submitting registration.';
  } finally {
    document.body.style.cursor = 'default';
  }
}



// ==========================================
// 8. INITIALIZER ON DOM LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", async function () {
  // Restore saved text size or default to normal
  const savedSize = localStorage.getItem('pwa-text-size') || 'normal';
  if (typeof applyTextSize === "function") applyTextSize(savedSize);

  const scpb_saved_phone = localStorage.getItem("userPhone") || localStorage.getItem("scpb_saved_phone") || "";
  const cachedGroup = localStorage.getItem("scpb_saved_group") || localStorage.getItem("scpb_selected_group");
  const phoneInput = document.getElementById("phoneInput");

  if (cachedGroup) {
    const radio = document.querySelector(`input[name="helpGroupRadio"][value="${cachedGroup}"]`);
    if (radio) radio.checked = true;
    if (typeof fetchGroupRoster === "function") {
      await fetchGroupRoster(cachedGroup);
    }
  }

  console.log(`In DomContentload group ${cachedGroup}, Phone ${scpb_saved_phone}...`);

  if (phoneInput) {
    // Populate the input field immediately if cache exists
    if (scpb_saved_phone) {
      phoneInput.value = scpb_saved_phone;
    }


    // 1. INITIAL LOAD CHECK
    if (scpb_saved_phone) {
      const currentGroup = document.querySelector('input[name="helpGroupRadio"]:checked')?.value || cachedGroup;
      const { exists, player } = checkPlayerExists(scpb_saved_phone, currentGroup); 
      
      if (exists) {
        console.log('Found player:', player);
        showStatusLoading("Player Found...");
        if (typeof setSaveButtonState === "function") setSaveButtonState(true);
        if (typeof loadPlayerStatusFromCache === "function") await loadPlayerStatusFromCache(scpb_saved_phone);
      } else if (scpb_saved_phone.replace(/\D/g, "").length >= 10) {
        // Apply your "Unknown Player" logic if they have a full cached number but aren't in the group
        const saveBtn = document.getElementById('savePhoneBtn');
        if (saveBtn) {
          saveBtn.innerHTML = "Register New Player";
          saveBtn.disabled = false;
        }
        if (typeof showStatusLoading === "function") showStatusLoading("Player not found. Please register.");
        if (typeof setAppViewState === "function") setAppViewState(false, scpb_saved_phone);
      }
    }

    let phoneDebounceTimer = null;
    
    // 2. LIVE TYPING CHECK
    phoneInput.addEventListener("input", function () {
      if (typeof setSaveButtonState === "function") setSaveButtonState(false);
      const rawPhone = phoneInput.value.trim();
      const digits = typeof normalizePhone === "function" ? normalizePhone(rawPhone) : rawPhone.replace(/\D/g, "");

      if (phoneDebounceTimer) clearTimeout(phoneDebounceTimer);

      if (digits.length === 10) {
        if (typeof showStatusLoading === "function") showStatusLoading("⏳ VERIFYING...");
        
        phoneDebounceTimer = setTimeout(async () => {
          const currentGroup = document.querySelector('input[name="helpGroupRadio"]:checked')?.value || cachedGroup;
          const { exists, player } = checkPlayerExists(digits, currentGroup);
          
          if (exists) {
            if (typeof setSaveButtonState === "function") setSaveButtonState(true);
              if (typeof loadPlayerStatusFromCache === "function") await loadPlayerStatusFromCache(digits);
              savePhoneToCache(digits);
              const saveBtn = document.getElementById('savePhoneBtn');              
              saveBtn.innerHTML = "Registration found";
              saveBtn.disabled = false;              
                  
          } else {
            const saveBtn = document.getElementById('savePhoneBtn');
            if (saveBtn) {
              saveBtn.innerHTML = "Register New Player";
              saveBtn.disabled = false;
            }
            if (typeof showStatusLoading === "function") showStatusLoading("Player not found. Please register.");
            if (typeof setAppViewState === "function") setAppViewState(false, rawPhone);
          }
        }, 300);
      } else if (digits.length < 10) {
        if (typeof setAppViewState === "function") setAppViewState(false, rawPhone);
      }
    }); 
  }
  bindGroupRadioListeners();    
});


(function loadTheme() {
  const themeLink = document.getElementById('theme-stylesheet');
  const hostname = window.location.hostname;

  // Check if domain is local or explicitly a dev environment
  const isDev = hostname === 'localhost' || 
                hostname === '127.0.0.1' || 
                hostname.includes('dev') || 
                hostname.includes('staging');

  const targetTheme = isDev ? 'devtheme.css' : 'prodtheme.css';

  console.log(`[Theme Switcher] Host: "${hostname}" | Loading: ${targetTheme}`);
  
  if (themeLink) {
    themeLink.href = targetTheme;
  }
})();      


async function loadRankingsAndSched() {
  const groupSelect = document.getElementById('groupViewerSelect');
  const group = (groupSelect && groupSelect.value) ? groupSelect.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : '');
  
  const statusEl = document.getElementById('viewerStatus');
  const contentEl = document.getElementById('viewerContent');

  if (!group) {
    if (statusEl) statusEl.innerText = 'Please select a group.';
    return;
  }

  if (statusEl) statusEl.innerHTML = '<span class="loading-spinner"></span>Loading schedule & standings...';

  try {
    const res = await apiCall('getRankingsAndSchedData', { group: group });
    
    // Clear loading status
    if (statusEl) statusEl.innerText = '';

    // Extract the HTML string returned by backend (handling optional wrapper objects)
    let htmlContent = '';
    if (typeof res === 'string') {
      htmlContent = res;
    } else if (res && res.html) {
      htmlContent = res.html;
    } else if (res && res.data && res.data.html) {
      htmlContent = res.data.html;
    } else {
      htmlContent = '<i>No data returned for ' + group + '.</i>';
    }

    // Render the server-built tables directly into the container
    if (contentEl) contentEl.innerHTML = htmlContent;

  } catch (e) {
    console.error("Error loading schedule & standings:", e);
    if (statusEl) statusEl.innerText = e.message || "Network error loading data.";
  }
}


// ==========================================
// GEOFENCE & ADMIN CONFIGURATION
// ==========================================
const GEOFENCE_RADIUS_METERS = 1500;

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

    if (cleanUser) {
      const isAdmin = ADMIN_PHONES.some(adminPhone => {
        const cleanAdmin = cleanPhoneNumber(adminPhone);
        return cleanAdmin && (cleanUser === cleanAdmin || cleanUser.endsWith(cleanAdmin));
      });

      if (isAdmin) {
        console.log("⚡ Admin phone detected (" + cleanUser + "). Bypassing geofence restriction.");
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

  
function findPlayerAcrossGroups(payload) {
  try {
    const rawPhone = typeof payload === 'object' ? (payload.phone || payload.targetPlayer) : payload;
    const cleanPhone = String(rawPhone || "").replace(/\D/g, "");
    
    if (!cleanPhone || cleanPhone.length < 7) {
      return { found: false, message: "Invalid phone number." };
    }

    // 1. Get all group names in the Spreadsheet
    const groupNames = getAllGroupNames();

    // 2. Loop through each group's unified roster
    for (let i = 0; i < groupNames.length; i++) {
      const g = groupNames[i];
      
      // REUSE getUnifiedRoster -> Hits CacheService first!
      const rosterRes = getUnifiedRoster({ group: g });

      if (rosterRes && rosterRes.success && Array.isArray(rosterRes.players)) {
        // Search player list for phone match
        const matchedPlayer = rosterRes.players.find(p => {
          const pPhone = String(p.phone || "").replace(/\D/g, "");
          return pPhone && pPhone.endsWith(cleanPhone.slice(-7));
        });

        if (matchedPlayer) {
          // Parse first and last name from raw display name
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





// Global Roster Cache with Timestamp
window.unifiedRosterCache = {
  data: null,
  group: null,
  timestamp: 0
};

/**
 * Strict 60-Second TTL Unified Roster Loader
 * Only fetches from API if NO cache exists OR IF BOTH (cacheAge >= 60s AND forceRefresh === true).
 */
/**
 * Strict Unified Roster Loader
 * Never serves empty arrays from cache.
 */
async function loadUnifiedRosterData(groupName, forceRefresh = false) {
    console.log(`start loadunified group "${groupName}" `);
  const targetGroup = groupName 
    || (document.getElementById('sheetSelect')?.value) 
    || (document.getElementById('adminGlobalGroupSelect')?.value) 
    || (typeof getSavedGroup === 'function' ? getSavedGroup() : null);

  if (!targetGroup) return [];

  const cleanGroup = String(targetGroup).trim();
  const playerListEl = document.getElementById('playerList');
  const adminListEl = document.getElementById('adminPlayerStatusList');
  const now = Date.now();

  const cachedData = window.unifiedRosterCache?.data;
  const isSameGroup = window.unifiedRosterCache?.group === cleanGroup;
  
  // 1. VALIDATE CACHE: Must be an array AND contain at least 1 player
  const hasValidNonEmptyCache = isSameGroup && Array.isArray(cachedData) && cachedData.length > 0;
  const cacheAge = now - (window.unifiedRosterCache?.timestamp || 0);
  const isOlderThan60s = cacheAge >= 60000;

  // Serve cache ONLY if we have actual player records and refresh conditions aren't met
  const shouldRefresh = !hasValidNonEmptyCache || (isOlderThan60s && forceRefresh);

  if (!shouldRefresh) {
    console.log(`⚡ [Cache Hit - Age: ${Math.round(cacheAge / 1000)}s] Serving ${cachedData.length} players from local memory.`);
    
    if (typeof checkInPlayersCache !== 'undefined') checkInPlayersCache = cachedData;
    if (typeof adminPlayersCache !== 'undefined') adminPlayersCache = cachedData;

//    if (typeof renderCheckInPlayers === 'function') {
//      renderCheckInPlayers(cachedData);
//    }
    if (adminListEl && typeof filterAdminPlayers === 'function') {
      adminListEl.innerHTML = '';
      filterAdminPlayers();
    }
    return cachedData;
  }

  // 2. FETCH FROM API IF CACHE IS EMPTY OR EXPIRED WITH FORCE REFRESH
  console.log(`📡 Fetching fresh roster for group: "${cleanGroup}"...`);
  let res = null;
  let extractedPlayers = [];

  try {
    res = await apiCall('getUnifiedRoster', { 
      groupName: cleanGroup,
      forceRefresh: forceRefresh 
    });

    if (Array.isArray(res)) extractedPlayers = res;
    else if (res && Array.isArray(res.players)) extractedPlayers = res.players;
    else if (res && res.data && Array.isArray(res.data.players)) extractedPlayers = res.data.players;
    else if (res && Array.isArray(res.data)) extractedPlayers = res.data;

  } catch (err) {
    console.warn("⚠️ Error fetching roster data:", err);
  }

  // 3. ONLY STORE IN CACHE IF WE RECEIVED REAL PLAYERS
  if (extractedPlayers && extractedPlayers.length > 0) {
    window.unifiedRosterCache = {
      data: extractedPlayers,
      group: cleanGroup,
      timestamp: Date.now()
    };

    if (typeof checkInPlayersCache !== 'undefined') checkInPlayersCache = extractedPlayers;
    if (typeof adminPlayersCache !== 'undefined') adminPlayersCache = extractedPlayers;

//    if (playerListEl && typeof renderCheckInPlayers === 'function') {
//      playerListEl.innerHTML = '';
//      renderCheckInPlayers(extractedPlayers);
//    }
    if (adminListEl && typeof filterAdminPlayers === 'function') {
      adminListEl.innerHTML = '';
      filterAdminPlayers();
    }
    return extractedPlayers;
  } else {
    // DO NOT cache empty arrays so subsequent calls can retry the network
    window.unifiedRosterCache = { data: null, group: null, timestamp: 0 };
    
    const msg = (res && res.registered === false) 
      ? "Selected group is not registered yet." 
      : "No roster data available for this group.";
    const notice = `<div style="padding:0.75rem; color:#856404; background:#fff3cd; border:1px solid #ffeeba; border-radius:0.25rem;">${msg}</div>`;
    if (playerListEl) playerListEl.innerHTML = notice;
    if (adminListEl) adminListEl.innerHTML = notice;
    return [];
  }
}


/**
 * Handles checking registration and auto-checking in based on user role
 */
async function savePhoneToCache() {
  const phoneInput = document.getElementById('phoneInput');
  let phone = (phoneInput ? phoneInput.value : '') || getSavedPhone();
  phone = String(phone).replace(/\D/g, '');

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

  try {
    // 1. Fetch current roster to check registration
    const roster = await loadUnifiedRosterData(currentGroup, false) || [];
    
    const matchedPlayer = roster.find(p => {
      const pPhone = String(p.phone || p.cell || p.id || p.playerId || '').replace(/\D/g, '');
      return pPhone === phone;
    });

    const regAccordion = document.getElementById('registrationAccordion');

    if (matchedPlayer) {
      // --- REGISTERED PLAYER ---
      // A. Keep "New Player" detail box collapsed
      if (regAccordion) regAccordion.open = false;

      const pName = `${matchedPlayer.first || ''} ${matchedPlayer.last || ''}`.trim() || matchedPlayer.name || matchedPlayer.playerName || '';
      savePlayerCredentials(phone, pName);

      // B. Auto Check-In
      const checkinResult = await triggerAutoCheckIn();

      // C. Routing logic based on Admin status
      const isAdmin = isUserAdmin(phone);
      if (isAdmin) {
        checkAndUnlockAdmin(phone);
        switchTab('admin');
      } else {
        switchTab('score');
        const statusMsg = checkinResult?.message || "✅ Auto-checked in successfully!";
        updateAutoCheckinBanner(statusMsg, 'success');
      }

    } else {
      // --- UNREGISTERED PLAYER ---
      // Expand detail box so they can register
      if (regAccordion) regAccordion.open = true;
      alert("⚠️ Phone number not registered. Please complete registration in the box below.");
    }

  } catch (err) {
    console.error("Error checking registration:", err);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Check Registration';
    }
  }
}

/**
 * Updates status banner display at top of Enter Scores tab
 */
function updateAutoCheckinBanner(message, type = 'success') {
  const banner = document.getElementById('autoCheckinStatusBanner');
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

/**
 * Helper triggers auto-checkin and returns response payload
 */
async function triggerAutoCheckIn() {
  const scoreBanner = document.getElementById("scoreAutoCheckinBanner");
  const scoreBadge = document.getElementById("pStatusDisplay");
  const checkinBadge = document.getElementById("checkinPlayerStatusBadge");
  const checkinStatusMsg = document.getElementById("checkInStatus");
  const frontBadge = document.getElementById("frontStatusDisplay");

  function updateAllTabStatuses(message, badgeText, bgHex, textHex) {
    if (scoreBanner) {
      scoreBanner.style.display = "block";
      scoreBanner.innerText = message;
      scoreBanner.style.backgroundColor = bgHex;
      scoreBanner.style.color = textHex;
    }
    if (scoreBadge) scoreBadge.innerText = badgeText;

    if (checkinBadge) {
      checkinBadge.innerText = badgeText;
      checkinBadge.style.backgroundColor = bgHex;
      checkinBadge.style.color = textHex;
    }
    if (checkinStatusMsg) checkinStatusMsg.innerText = message;

    if (frontBadge) {
      frontBadge.innerText = badgeText;
      frontBadge.style.setProperty("background-color", bgHex, "important");
      frontBadge.style.setProperty("color", textHex, "important");
    }
  }

  updateAllTabStatuses("⏳ Auto checking in...", "Checking In...", "#ffc107", "#000000");

  try {
    const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : (localStorage.getItem('scpb_saved_phone') || '');
    const savedName = typeof getSavedName === 'function' ? getSavedName() : (localStorage.getItem('scpb_saved_name') || localStorage.getItem('scpb_player_name') || '');
    const currentGroup = typeof getSavedGroup === 'function' ? getSavedGroup() : (localStorage.getItem('scpb_selected_group') || '');

    if (!savedPhone && !savedName) {
      updateAllTabStatuses("⚠️ No saved player details found.", "Not Registered", "#6c757d", "#ffffff");
      return;
    }

    // Optional: Pre-check cached roster for active status
    if (window.cachedRoster && Array.isArray(window.cachedRoster)) {
      const targetPhoneDigits = savedPhone.replace(/\D/g, '');
      const player = window.cachedRoster.find(p => 
        (p.phone && p.phone.replace(/\D/g, '') === targetPhoneDigits) ||
        (p.name && p.name.toLowerCase() === savedName.toLowerCase())
      );

      if (player && (player.active === false || player.active === 'false' || player.status === 'Inactive')) {
        updateAllTabStatuses("⛔ Inactive cannot check in", "Inactive", "#6c757d", "#ffffff");
        return;
      }
    }

    // Call check-in API
    const res = await apiCall('toggleSingleCheckIn', {
      sheet: "Sched " + currentGroup,
      playerName: savedName,
      phone: savedPhone,
      groupName: currentGroup,
      isCheckedIn: true
    });

    // Check for Inactive state from backend response
    if (res && (res.isInactive || res.message?.toLowerCase().includes("inactive"))) {
      updateAllTabStatuses("⛔ Inactive cannot check in", "Inactive", "#6c757d", "#ffffff");
      return;
    }

    if (res && (res.success || res.status === 'Checked In' || res.checkedIn)) {
      updateAllTabStatuses("✅ Auto Checked-In Successfully", "Checked In", "#198754", "#ffffff");
    } else {
      const msg = res?.message || "Check-in failed";
      updateAllTabStatuses(`⚠️ Auto Check-In: ${msg}`, "Not Checked In", "#dc3545", "#ffffff");
    }
  } catch (err) {
    console.error("Auto check-in error:", err);
    updateAllTabStatuses("❌ Network Error during Auto Check-In", "Error", "#dc3545", "#ffffff");
  }
}




function submitFrontPageRegistration() {
  if (typeof submitUserRegistration === 'function') submitUserRegistration();
}

function forceRefresh() {
  const currentGroup = getSavedGroup();
  if (currentGroup) loadUnifiedRosterData(currentGroup, true);
  }

  


  function getCourtsForGroup(groupName) {
    return GROUP_COURT_MAP[groupName] || GROUP_COURT_MAP["Default"];
  }


  function getSelectedCourts() {
    const selected = [];
    const checkboxes = document.querySelectorAll('#admin-court-list input[type="checkbox"]:checked');
    checkboxes.forEach(cb => selected.push(parseInt(cb.value, 10)));
    return selected;
  }
  

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Service Worker registered:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    });
  }


function updateGlobalLoaderStatus() {
  const loader = document.getElementById('globalLoader');
  const loaderText = document.getElementById('globalLoaderText');
  if (!loader || !loaderText) return;

  if (isInitialLoading) {
    loaderText.innerText = "Loading app...";
      loader.style.display = "flex";
      isInitialLoading = false;      
  } else if (isProcessingQueue || apiQueue.length > 0) {
    const pending = apiQueue.length;
    loaderText.innerText = pending > 0 ? `Syncing (${pending + 1})...` : "Syncing...";
    loader.style.display = "flex";
  } else {
    loader.style.display = "none";
  }
}

async function apiCall(action, payload = {}) {
  if (!action) {
    console.error("❌ [API Error] Action cannot be empty.");
    return Promise.reject(new Error("API action cannot be empty"));
  }

  console.log(`🚀 [API Call Initiated] "${action}"`, {
    payload,
    time: new Date().toLocaleTimeString()
  });

  // [CHANGE]: Return an explicit success/registered structure on cache hits.
  // Previously, returning { players: checkInPlayersCache } lacked 'success: true', causing loadUnifiedRosterData to evaluate 'res.success' as undefined and clear the UI.
  if (action === 'getUnifiedRoster' && apiQueue.some(q => q.action === 'getUnifiedRoster' && JSON.stringify(q.payload) === JSON.stringify(payload))) {
    console.log(`⚡ [API Cache Hit] Deduplicating "${action}", returning cached players.`, checkInPlayersCache);
    return Promise.resolve({ success: true, registered: true, players: checkInPlayersCache || [] });
  }

  const result = await new Promise((resolve, reject) => {
    apiQueue.push({ action, payload, resolve, reject });
    if (!isProcessingQueue) processApiQueue();
  });

  console.log(`✅ [API result] "${action}"`, {
    result,
    time: new Date().toLocaleTimeString()
  });

  return result;
}

async function processApiQueue() {
  if (isProcessingQueue || apiQueue.length === 0) return;
  isProcessingQueue = true;

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  const { action, payload, resolve, reject } = apiQueue.shift();
  const endpoint = window.API_URL || (typeof API_URL !== 'undefined' ? API_URL : null);

  const targetSheet = payload.sheet || payload.sheetName || payload.scoreSheetName || "N/A";
  const targetGroup = payload.groupName || payload.group || "N/A";

  console.log(`📡 [API Dispatch] Sending "${action}" to server...`, {
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

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });

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
      console.log(`✅ [API Success] "${action}":`, data.data || data);
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
      console.log(`✅ [API Response] Raw data returned for "${action}":`, data);
      resolve(data);
    }
  } catch (err) {
    console.error(`❌ [API Request Failed] Action "${action}" failed:`, err);
    resolve({ success: false, registered: false, error: err.message });
  } finally {
    // [CHANGE]: Guarantees that processing flags are reset and loader state is updated regardless of network outcomes.
    isProcessingQueue = false;
    if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();
    if (apiQueue.length > 0) {
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
  return localStorage.getItem('scpb_saved_phone') || '';
}

/**
 * Retrieves the saved player name from localStorage.
 * If missing, attempts to resolve it using the saved phone and cached roster array,
 * automatically saving it to localStorage once found.
 */
function getSavedName() {
  // 1. Direct check in localStorage
  let savedName = localStorage.getItem('scpb_saved_name') || '';
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
  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      localStorage.setItem('scpb_saved_phone', cleanPhone);
    }
  }
  if (name && typeof name === 'string') {
    localStorage.setItem('scpb_saved_name', name.trim());
  }
}  


function bindGroupRadioListeners() {
  const radios = document.querySelectorAll('input[name="helpGroupRadio"], input[name="checkinGroupRadio"]');
  radios.forEach(radio => {
    // Remove existing listener to avoid duplicates
    radio.removeEventListener('change', handleRadioClick);
    radio.addEventListener('change', handleRadioClick);
  });
}

function handleRadioClick(event) {
  if (event.target && event.target.value) {
    onGroupRadioChange(event.target.value);
  }
}

// Function to determine and restore active tab on startup/refresh
function restoreActiveTabOnLoad() {
  const hashTab = window.location.hash.replace('#', '').trim();
  const savedTab = localStorage.getItem('activeTab');

  // Priorities: 1. URL Hash -> 2. Saved localStorage Tab -> 3. Default 'help'
  const initialTab = hashTab || savedTab || 'help';

  switchTab(initialTab, true);
}

// Listen for initial page load
document.addEventListener('DOMContentLoaded', restoreActiveTabOnLoad);

// Listen for browser forward/back button navigation (if running in standard browser)
window.addEventListener('hashchange', () => {
  const hashTab = window.location.hash.replace('#', '').trim();
  if (hashTab) {
    switchTab(hashTab, true);
  }
});


async function handlePlayerNotFoundInCurrentGroup(searchedPhone, currentGroup) {
  console.log("handlePlayerNotFoundInCurrentGroup:", searchedPhone,currentGroup);
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');

  try {
    // 1. Search all other groups for this phone number
    const crossRes = await apiCall('findPlayerAcrossGroups', { phone: searchedPhone });

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
