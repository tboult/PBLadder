async function apiCall(action, payload = {}) {
  if (!action) {
    console.error("❌ [API Error] Action cannot be empty.");
    return Promise.reject(new Error("API action cannot be empty"));
  }

  console.log(`🚀 [API Call Initiated] "${action}"`, {
    payload,
    time: new Date().toLocaleTimeString()
  });

  // FIX: Bypass deduplication when forceRefresh is true
  const isForceRefresh = Boolean(payload && payload.forceRefresh);
  if (!isForceRefresh && typeof apiQueue !== 'undefined' && action === 'getUnifiedRoster' && 
      apiQueue.some(q => q.action === 'getUnifiedRoster' && JSON.stringify(q.payload) === JSON.stringify(payload))) {
    const cachedPlayers = (Array.isArray(window.appPlayersCache) && window.appPlayersCache.length > 0) 
      ? window.appPlayersCache 
      : (window.cachedRoster || []);
    console.log(`⚡ [API Cache Hit] Deduplicating "${action}", returning cached players.`, cachedPlayers);
    return Promise.resolve({ success: true, registered: true, players: cachedPlayers });
  }

  const result = await new Promise((resolve, reject) => {
    if (typeof apiQueue !== 'undefined') {
      apiQueue.push({ action, payload, resolve, reject });
      if (typeof isProcessingQueue !== 'undefined' && !isProcessingQueue && typeof processApiQueue === 'function') processApiQueue();
    } else {
      resolve({ success: false, error: 'apiQueue not initialized' });
    }
  });

  console.log(`✅ [API result] "${action}"`, {
    result,
    time: new Date().toLocaleTimeString()
  });

  return result;
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
  if (typeof setSavedGroup === 'function') {
    setSavedGroup(cleanGroup);
  }
}

async function onGroupRadioChange(selectedGroup) {
  console.log(`onGroupRadioChange ${selectedGroup}`);
  const cleanGroup = String(selectedGroup).replace(/^(Sched|Score)\s*/i, '').trim();

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

  // 4. Sync UI elements (Radios/Dropdowns)
  const allGroupRadios = document.querySelectorAll(
    'input[name="helpGroupRadio"], input[name="checkinGroupRadio"]'
  );
  allGroupRadios.forEach(radio => {
    radio.checked = (radio.value === cleanGroup);
  });
  if (typeof syncAllGroupDropdowns === 'function') syncAllGroupDropdowns(cleanGroup);
  if (typeof updateAllGroupDisplays === 'function') updateAllGroupDisplays(cleanGroup);

  // FIX: 5. Fetch fresh roster FIRST before attempting lookup or tab renders
  if (typeof loadUnifiedRosterData === 'function') {
    await loadUnifiedRosterData(cleanGroup, true);
  }

  // FIX: 6. Run lookup with newly updated roster populated in memory
  const savedPhone = typeof getSavedPhone === 'function' ? getSavedPhone() : (localStorage.getItem('scpb_saved_phone') || '');
  if (savedPhone && typeof loadPlayerStatusFromCache === 'function') {
    await loadPlayerStatusFromCache(savedPhone);
  } else if (typeof setAppViewState === 'function') {
    setAppViewState(false, '');
  }

  // 7. Refresh active tab UI elements
  if (typeof refreshActiveTabData === 'function') {
    await refreshActiveTabData(false);
  }
    
  if (checkinStatus && checkinStatus.innerText.includes("Loading status")) {
    checkinStatus.innerText = "";
  }    
}






// 2. Sync UI state on page load
function syncGroupRadioUI() {
  const currentGroup = localStorage.getItem('scpb_selected_group') || localStorage.getItem('scpb_saved_group') || '';
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
  if (cleanGroup && typeof loadUnifiedRosterData === 'function') {
    loadUnifiedRosterData(cleanGroup);
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
  const currentGroup = getSavedGroup();

  if (typeof renderHelpGroupRadios === 'function') {
    renderHelpGroupRadios();
  }

  if (currentGroup) {
    setSavedGroup(currentGroup);
  }

  if (typeof updateGlobalLoaderStatus === 'function') updateGlobalLoaderStatus();

  try {
    // FIX: Always ensure roster is fetched regardless of which tab is active
    if (currentGroup && typeof loadUnifiedRosterData === 'function') {
      await loadUnifiedRosterData(currentGroup, forceRefresh);
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


async function loadPlayerStatusFromCache(phone) {
  const statusCard = document.getElementById("frontStatusCard");
  const statusDisplay = document.getElementById("frontStatusDisplay");

  if (!statusCard || !statusDisplay) return;

  // Show loading indicator immediately before doing any lookup logic
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

  // FIXED: Automatically unlock admin if user is an admin
  if (typeof checkAndUnlockAdmin === "function" && phone) {
    checkAndUnlockAdmin(phone);
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

    // FIXED: Pass player object instead of phone string to avoid "undefined" display name
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

/**
 * Loads schedule and rankings data for the active group and renders into viewerContent
 */
/**
 * Loads schedule and rankings data for the active group and renders into viewerContent
 */
async function loadRankingsAndSched(targetGroup = null) {
  const groupSelect = document.getElementById('groupViewerSelect');
  const group = targetGroup || (groupSelect && groupSelect.value ? groupSelect.value : (typeof getSavedGroup === 'function' ? getSavedGroup() : ''));

  const statusEl = document.getElementById('viewerStatus');
  const contentEl = document.getElementById('viewerContent');

  if (!contentEl) {
    console.error('💥 [Rankings Error] Target element "#viewerContent" not found in DOM.');
    return;
  }

  // =========================================================================
  // 📍 BEST INSERTION POINT: Unhide #viewerContent and all parent tab wrappers
  // =========================================================================
  if (statusEl) statusEl.style.display = 'block';
  contentEl.style.display = 'block';

  let parent = contentEl.parentElement;
  while (parent && parent !== document.body) {
    if (window.getComputedStyle(parent).display === 'none') {
      console.warn(`⚠️ [Visibility Fix] Unhiding parent container <${parent.tagName.toLowerCase()}> (id="${parent.id}", class="${parent.className}")`);
      parent.style.display = 'block';
      parent.classList.add('active', 'show');
      parent.classList.remove('hidden', 'd-none');
    }
    parent = parent.parentElement;
  }
  // =========================================================================

  if (!group) {
    if (statusEl) statusEl.innerText = 'Please select a group.';
    return;
  }

  if (statusEl) statusEl.innerHTML = '<span class="loading-spinner"></span>Loading schedule & standings...';

  try {
    console.log(`📊 [Rankings & Sched] Requesting data for group: "${group}"`);
    const res = await apiCall('getRankingsAndSchedData', { group: group });

    if (statusEl) statusEl.innerText = '';

    // Extract payload string
    let htmlContent = '';
    if (typeof res === 'string') {
      htmlContent = res;
    } else if (res && typeof res.html === 'string') {
      htmlContent = res.html;
    } else if (res && typeof res.data === 'string') {
      htmlContent = res.data;
    } else if (res && res.data && typeof res.data.html === 'string') {
      htmlContent = res.data.html;
    } else if (res && typeof res.result === 'string') {
      htmlContent = res.result;
    } else {
      htmlContent = `<i>No renderable schedule data returned for group "${group}".</i>`;
    }

    // Inject HTML
    contentEl.innerHTML = htmlContent;

    // Diagnostic check
    const computed = window.getComputedStyle(contentEl);
    console.log('🔍 [DOM Visibility Diagnostic]:', {
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
      offsetHeight: contentEl.offsetHeight,
      offsetWidth: contentEl.offsetWidth,
      injectedCharacterCount: contentEl.innerHTML.length
    });

  } catch (e) {
    console.error("💥 Error loading schedule & standings:", e);
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

    if (cleanUser && typeof ADMIN_PHONES !== 'undefined' && Array.isArray(ADMIN_PHONES)) {
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
let currentRosterFetchPromise = null;
let lastFetchedGroup = null;

async function loadUnifiedRosterData(groupName, forceRefresh = false) {
  if (!groupName) return [];

  // 1. Return memory roster if already fetched for this group and not force-refreshing
  if (!forceRefresh && lastFetchedGroup === groupName && Array.isArray(window.cachedRoster) && window.cachedRoster.length > 0) {
    return window.cachedRoster;
  }

  // 2. Return in-flight request if currently fetching for the target group
  if (currentRosterFetchPromise && lastFetchedGroup === groupName && !forceRefresh) {
    return currentRosterFetchPromise;
  }

  lastFetchedGroup = groupName;

  currentRosterFetchPromise = (async () => {
    try {
      console.log(`📡 Fetching fresh roster for group: "${groupName}"...`);
      const res = await apiCall('getUnifiedRoster', { group: groupName, forceRefresh: forceRefresh });
      
      // FIX: Guard against race condition if group changed while request was in-flight
      if (lastFetchedGroup === groupName && res && res.success && Array.isArray(res.players)) {
        window.cachedRoster = res.players;
        window.unifiedRoster = res.players;
        window.appPlayersCache = res.players;
        return res.players;
      }
      return window.cachedRoster || [];
    } catch (err) {
      console.error("Error fetching roster:", err);
      return [];
    } finally {
      if (lastFetchedGroup === groupName) {
        currentRosterFetchPromise = null;
      }
    }
  })();

  return currentRosterFetchPromise;
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
    return (typeof GROUP_COURT_MAP !== 'undefined' && GROUP_COURT_MAP[groupName]) || (typeof GROUP_COURT_MAP !== 'undefined' && GROUP_COURT_MAP["Default"]) || [];
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

  if (typeof isInitialLoading !== 'undefined' && isInitialLoading) {
    loaderText.innerText = "Loading app...";
      loader.style.display = "flex";
      isInitialLoading = false;      
  } else if (typeof isProcessingQueue !== 'undefined' && typeof apiQueue !== 'undefined' && (isProcessingQueue || apiQueue.length > 0)) {
    const pending = apiQueue.length;
    loaderText.innerText = pending > 0 ? `Syncing (${pending + 1})...` : "Syncing...";
    loader.style.display = "flex";
  } else {
    loader.style.display = "none";
  }
}

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
    if (activeTab === 'checkin') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
      if (currentGroup && typeof loadUnifiedRosterData === 'function') {
        await loadUnifiedRosterData(currentGroup, forceRefresh);
      }
    } else if (activeTab === 'admin') {
      if (typeof triggerAutoCheckIn === 'function') await triggerAutoCheckIn();
      // FIX: Fetch group roster data FIRST before rendering admin courts or admin tabs
      if (currentGroup && typeof loadUnifiedRosterData === 'function') {
        await loadUnifiedRosterData(currentGroup, forceRefresh);
      }
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



async function processApiQueue() {
  if ((typeof isProcessingQueue !== 'undefined' && isProcessingQueue) || typeof apiQueue === 'undefined' || apiQueue.length === 0) return;
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
  console.log(` in SavePlayerCredential:`, phone, name);                  
  if (phone) {
    console.log(` caching phone:`, phone, phone.length);                      
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      localStorage.setItem('scpb_saved_phone', cleanPhone);
      localStorage.setItem('saved_phone', cleanPhone);
      console.log(` caching phone:`, cleanPhone);              
    }
  }
  if (name && typeof name === 'string') {
    localStorage.setItem('scpb_saved_name', name.trim());
    console.log(` caching name:`, name);      
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


// Listen for browser forward/back button navigation (if running in standard browser)
window.addEventListener('hashchange', () => {
  const hashTab = window.location.hash.replace('#', '').trim();
  if (hashTab) {
    switchTab(hashTab, true);
  }
});


async function handlePlayerNotFoundInCurrentGroup(searchedPhone, currentGroup) {
  console.log("handlePlayerNotFoundInCurrentGroup:", searchedPhone, currentGroup);
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
  console.log("checkregistrationstatus:", phone);
  const cleanPhoneInput = String(phone || '').replace(/\D/g, '');
  const statusMsg = document.getElementById('phoneStatus') || document.getElementById('checkInStatus');

  if (!cleanPhoneInput || cleanPhoneInput.length < 7) {
    if (statusMsg) {
      statusMsg.innerText = "Please enter a valid phone number.";
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
      const isAdmin = (typeof isUserAdmin === 'function') && isUserAdmin(phone);
      if (isAdmin) {
        if (typeof checkAndUnlockAdmin === 'function') checkAndUnlockAdmin(phone);
        switchTab('admin');
      } else {
        switchTab('score');
        const statusMsg = checkinResult?.message || "✅ Auto-checked in successfully!";
        updateAutoCheckinBanner(statusMsg, 'success');
      }

      setSaveButtonState(true);

    } else {
      // --- UNREGISTERED PLAYER ---
      // Expand detail box so they can register
      if (regAccordion) regAccordion.open = true;
      setSaveButtonState(false);
      alert("⚠️ Phone number not registered. Please complete registration in the box below.");
    }

  } catch (err) {
    console.error("Error checking registration:", err);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      const savedPhone = getSavedPhone();
      const isAdmin = (typeof isUserAdmin === 'function') && isUserAdmin(savedPhone);
      saveBtn.innerHTML = isAdmin ? 'Admin Reg. ✓' : 'Registered ✓';
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

// Global listener: Persist group selection immediately when clicked on any tab
document.addEventListener('change', (e) => {
  if (e.target && (e.target.name === 'helpGroupRadio' || e.target.name === 'checkinGroupRadio')) {
    setSavedGroup(e.target.value);
    if (typeof refreshActiveTabData === 'function') {
      refreshActiveTabData(true);
    }
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

// 2. Add auto-initialization listener at the bottom of api_4.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof syncGroupRadioUI === 'function') syncGroupRadioUI();
  restoreActiveTabOnLoad();
});
