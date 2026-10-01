
// Global cache variables (ensure these exist in your script)


//  window.API_URL = "https://script.google.com/macros/s/AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ/exec";
  window.API_URL =CONFIG.apiUrl
  const API_URL = window.API_URL;
  const CURRENT_APP_VERSION = "0.9.8";

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


// ==========================================
// MASTER INITIALIZER ON DOM LOAD
// ==========================================
// Global tracker to prevent duplicate status checks on identical numbers
let lastCheckedPhone = "";

// Helper to handle both regular player UI and Admin UI toggles
async function handleUserAndAdminState(phone, player) {
  // 1. Set App View to Active Player mode (hides register form)
  if (typeof setAppViewState === "function") {
    setAppViewState(true, phone);
  }
  if (typeof setSaveButtonState === "function") {
    setSaveButtonState(true);
  }

  // 2. Check if user is an Admin
  let isAdminUser = false;
  if (player && (player.isAdmin || player.role === 'admin')) {
      isAdminUser = true;
      console.log('isamind1:',isAdminUser)
  } else if (typeof checkAdminStatus === "function") {
      isAdminUser = await checkAdminStatus(phone);
      console.log('isamind2:',isAdminUser)
  } else if (typeof checkIfAdmin === "function") {
      isAdminUser = checkIfAdmin(phone);
      console.log('isamind3:',isAdminUser)      
  }

  // 3. Trigger Admin UI / Controls if Admin
  if (isAdminUser) {
    console.log("👑 Admin privileges granted for:", phone);
    if (typeof showAdminControls === "function") showAdminControls(true);
    if (typeof enableAdminUI === "function") enableAdminUI(true);
    if (typeof setAdminMode === "function") setAdminMode(true);
  }

  // 4. Update Button State / Label
  const saveBtn = document.getElementById('savePhoneBtn') || document.getElementById('actionButton');
  if (saveBtn) {
    if (isAdminUser) {
      saveBtn.innerHTML = "Admin / Registration Found";
    } else if (player && player.checkedIn) {
      saveBtn.innerHTML = `Checked In (${player.court || 'Assigned'})`;
    } else {
      saveBtn.innerHTML = "Registration Found";
    }
    saveBtn.disabled = false;
  }

  // 5. Load Cached Player Status / Attendance
  if (typeof loadPlayerStatusFromCache === "function") {
    await loadPlayerStatusFromCache(phone);
  }
}

// ==========================================
// MASTER INITIALIZER ON DOM LOAD
// ==========================================

  
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
  if (adminBtn) adminBtn.style.display = 'inline-block';

  // Enable Admin UI components
  if (typeof enableAdminUI === 'function') enableAdminUI(true);
  if (typeof showAdminControls === 'function') showAdminControls(true);
  if (typeof setAdminMode === 'function') setAdminMode(true);

  alert('🔓 Admin Mode Unlocked!');
  switchTab('admin');

  const currentGroup = getSavedGroup();
  if (typeof loadAdminTabData === 'function') loadAdminTabData(currentGroup);
  if (typeof loadAdminPlayerStatusCache === 'function') loadAdminPlayerStatusCache(currentGroup);
  }
}



/**
 * Utility function to dump all application-related cache items to console
 */
function logAllCachedValues() {
  console.group('📦 === LOCAL STORAGE CACHE DUMP ===');
  console.log('scpb_saved_group:', localStorage.getItem('scpb_saved_group'));
  console.log('scpb_saved_phone:', localStorage.getItem('scpb_saved_phone'));
  console.log('saved_phone:     ', localStorage.getItem('saved_phone'));
  console.log('activeTab:       ', localStorage.getItem('activeTab'));
  console.log('scpb_player_name:', localStorage.getItem('scpb_player_name'));
  console.groupEnd();
}

// Automatically print cache dump once document finishes loading
document.addEventListener('DOMContentLoaded', () => {
  logAllCachedValues();
});

// ==========================================
// MASTER INITIALIZER ON DOM LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", async function () {
  console.log("🚀 Initializing Application...");

  // 1. Restore Saved UI Preferences (Text Size)
  const savedSize = localStorage.getItem('pwa-text-size') || 'normal';
  if (typeof applyTextSize === "function") {
    applyTextSize(savedSize);
  }

  // 2. Retrieve Cached Credentials & Selected Group
  const scpb_saved_phone = localStorage.getItem("userPhone") || localStorage.getItem("scpb_saved_phone") || "";
  const cachedGroup = localStorage.getItem("scpb_saved_group") || localStorage.getItem("scpb_selected_group") || "Mixed";
  const phoneInput = document.getElementById("phoneInput") || document.getElementById("frontPhoneInput");

  // Sync active group radio UI & pre-fetch roster
  if (cachedGroup) {
    const radio = document.querySelector(`input[name="helpGroupRadio"][value="${cachedGroup}"]`);
    if (radio) radio.checked = true;

    if (typeof loadUnifiedRosterData === "function") {
      await loadUnifiedRosterData(cachedGroup);
    } else if (typeof fetchGroupRoster === "function") {
      await fetchGroupRoster(cachedGroup);
    }
  }

  console.log(`📌 App loaded | Group: "${cachedGroup}" | Saved Phone: "${scpb_saved_phone}"`);

  // 3. Process Saved Phone on Initial Load
  if (phoneInput) {
    if (scpb_saved_phone) phoneInput.value = scpb_saved_phone;

    if (scpb_saved_phone) {
      const currentGroup = document.querySelector('input[name="helpGroupRadio"]:checked')?.value || cachedGroup;
      const { exists, player } = checkPlayerExists(scpb_saved_phone, currentGroup);

      if (exists) {
        console.log("✅ Player found in current group on startup:", player);
        lastCheckedPhone = scpb_saved_phone;

        // Apply Player & Admin state
        await handleUserAndAdminState(scpb_saved_phone, player);

      } else if (scpb_saved_phone.replace(/\D/g, "").length >= 10) {
        console.log("⚠️ Saved phone not in active group. Triggering cross-group search...");
        if (typeof handlePlayerNotFoundInCurrentGroup === "function") {
          await handlePlayerNotFoundInCurrentGroup(scpb_saved_phone, currentGroup);
        }
      }
    }

    // 4. Debounced Typing Listener for Phone Input
    let phoneDebounceTimer = null;

    phoneInput.addEventListener("input", function () {
      if (typeof setSaveButtonState === "function") setSaveButtonState(false);

      const rawPhone = phoneInput.value.trim();
      const digits = typeof normalizePhone === "function" ? normalizePhone(rawPhone) : rawPhone.replace(/\D/g, "");

      if (digits === lastCheckedPhone) return;

      if (phoneDebounceTimer) clearTimeout(phoneDebounceTimer);

      if (digits.length === 10) {
        if (typeof showStatusLoading === "function") showStatusLoading("⏳ VERIFYING...");

        phoneDebounceTimer = setTimeout(async () => {
          lastCheckedPhone = digits;

          const currentGroup = document.querySelector('input[name="helpGroupRadio"]:checked')?.value || cachedGroup;
          const { exists, player } = checkPlayerExists(digits, currentGroup);

          if (exists) {
            console.log("✅ Live player match found:", player);
            if (typeof savePhoneToCache === "function") savePhoneToCache(digits);

            // Apply Player & Admin state
            await handleUserAndAdminState(digits, player);

          } else {
            console.log("🔍 Live lookup: Player not in current group. Executing cross-group lookup...");
            if (typeof handlePlayerNotFoundInCurrentGroup === "function") {
              await handlePlayerNotFoundInCurrentGroup(digits, currentGroup);
            }
          }
        }, 400);
      } else if (digits.length < 10) {
        lastCheckedPhone = "";
        if (typeof setAppViewState === "function") setAppViewState(false, rawPhone);
        if (typeof showAdminControls === "function") showAdminControls(false);
      }
    });

    // 5. Button Click & Enter Key Event Handlers
    const actionBtn = document.getElementById('actionButton') || document.getElementById('checkPhoneBtn') || document.getElementById('savePhoneBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const phoneVal = phoneInput.value.trim();
        if (phoneVal) {
          const digits = phoneVal.replace(/\D/g, "");
          if (digits.length >= 7 && typeof checkRegistrationStatus === "function") {
            checkRegistrationStatus(digits);
          }
        }
      });
    }

    phoneInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const phoneVal = phoneInput.value.trim();
        if (phoneVal) {
          const digits = phoneVal.replace(/\D/g, "");
          if (digits.length >= 7 && typeof checkRegistrationStatus === "function") {
            checkRegistrationStatus(digits);
          }
        }
      }
    });
  }

  // 6. Bind Group Radio Buttons
  if (typeof bindGroupRadioListeners === "function") {
    bindGroupRadioListeners();
  }
});


function hideGlobalLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// Hide loader automatically on window load or on API failure
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(hideGlobalLoader, 3000); // Fallback timeout to prevent permanent scroll lock
});
