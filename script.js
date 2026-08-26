// --- Extracted from index.html ---

// --- Part 1: Firebase Module (Previously inside <script type="module">) ---
import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue
}
from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiRuuvqXPyum-kubFm_uj6oTj_qjplwa4",
  authDomain: "smart-bin-e2a4e.firebaseapp.com",
  databaseURL: "https://smart-bin-e2a4e-default-rtdb.firebaseio.com",
  projectId: "smart-bin-e2a4e",
  storageBucket: "smart-bin-e2a4e.firebasestorage.app",
  messagingSenderId: "691078659393",
  appId: "1:691078659393:web:f27c98e4e5b9f48526f5c0"
};

// Firebase Initialize
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Tracking Variables
let previousBins = { Organic: null, Plastic: null, Paper: null };
let depositCounts = { Organic: 0, Plastic: 0, Paper: 0 };
let totalDeposits = 0;

window.smartBinDB = database;
console.log("🔥 Firebase connected!");

// ------------------------------------
// ADD TO PERMANENT HISTORY (GLOBAL)
// ------------------------------------
window.addHistory = function(bin, event, status) {
  const historyRef = ref(database, "smartbin/history");
  push(historyRef, {
    bin: bin || "System",
    event: event,
    status: status || "INFO",
    timestamp: Date.now()
  });
};

// ------------------------------------
// BIN DATA LISTENER
// ------------------------------------
window.initFirebase = function () {
  const binsRef = ref(database, "bins");
  onValue(binsRef, (snapshot) => {
    const data = snapshot.val();
    console.log("Firebase Data:", data);
    if (!data) {
      console.log("No bin data available yet");
      return;
    }
    
    // Firebase mapping
    const organicFill = Number(data.bin1 ?? 0);
    const plasticFill = Number(data.bin2 ?? 0);
    const paperFill = Number(data.bin3 ?? 0);
    
    // Update Last Sync Time
    const now = new Date();
    document.getElementById("lastSync").textContent = now.toLocaleTimeString();

    const binsData = { Organic: organicFill, Plastic: plasticFill, Paper: paperFill };

    // Update Analytics Chart
    updateAnalytics(plasticFill, paperFill, organicFill);

    Object.entries(binsData).forEach(([binName, fill]) => {
      
      // --- 1. Deposit Logic ---
      if (previousBins[binName] !== null && fill > previousBins[binName]) {
        depositCounts[binName]++;
        totalDeposits++;
        document.getElementById("totalDeposits").textContent = totalDeposits;
      }

      // --- 2. Dashboard UI update ---
      window.updateBinUI(binName, fill, depositCounts[binName], false);

      // --- 3. Activity log - value changed ---
      if (previousBins[binName] !== null && previousBins[binName] !== fill) {
        window.addActivityLog(`${binName} bin level changed from ${previousBins[binName]}% to ${fill}%`);
      }

      // --- 4. Check Alerts ---
      window.checkBinAlert(binName, fill);
      
      previousBins[binName] = fill;
    });

    // Firebase status online
    window.setFirebaseStatus(true);
  }, (error) => {
    console.error("Firebase read error:", error);
    window.setFirebaseStatus(false);
  });

  listenAlerts();
  listenHistory();
};

// ------------------------------------
// SAVE ALERT TO FIREBASE (PERMANENT)
// ------------------------------------
window.saveAlertToFirebase = function(alertData) {
  const alertRef = ref(database, "smartbin/alerts");
  push(alertRef, {
    bin: alertData.bin,
    level: alertData.level,
    message: alertData.message,
    timestamp: Date.now()
  });
};

// ------------------------------------
// LISTEN ALERTS
// ------------------------------------
function listenAlerts() {
  const alertsRef = ref(database, "smartbin/alerts");
  onValue(alertsRef, (snapshot) => {
    const data = snapshot.val();
    const fullAlertLog = document.getElementById("fullAlertLog");

    if (!data) {
      fullAlertLog.innerHTML = `<div class="text-muted p-4 text-center">No alerts recorded yet.</div>`;
      return;
    }

    const alerts = Object.values(data).reverse(); 
    let fullHTML = "";

    alerts.forEach(alert => {
      const time = new Date(alert.timestamp).toLocaleString();
      const iconColor = alert.level === "FULL" ? "text-danger" : "text-warning";
      const icon = alert.level === "FULL" ? "bi-exclamation-octagon-fill" : "bi-exclamation-triangle-fill";

      fullHTML += `
        <div class="alert-panel mb-3">
          <div class="panel-body py-3">
            <div class="d-flex align-items-center mb-1">
              <i class="bi ${icon} ${iconColor} me-2" style="font-size: 1.2rem;"></i>
              <strong style="font-size: 14px;">${alert.level} — ${alert.bin} Bin</strong>
            </div>
            <div style="color: var(--text-body); margin-left: 30px; font-size: 13px;">${alert.message}</div>
            <div class="text-muted mt-1" style="font-size: 11px; margin-left: 30px;">
              <i class="bi bi-clock me-1"></i> ${time}
            </div>
          </div>
        </div>
      `;
    });
    fullAlertLog.innerHTML = fullHTML;
  });
}

// ------------------------------------
// ANALYTICS UPDATE
// ------------------------------------
function updateAnalytics(plastic, paper, organic) {
  const bars = document.querySelectorAll("#view-analytics .bar");
  if (bars.length >= 3) {
    bars[0].style.height = `${plastic}%`;
    bars[0].setAttribute("data-v", `${plastic}%`);
    bars[1].style.height = `${paper}%`;
    bars[1].setAttribute("data-v", `${paper}%`);
    bars[2].style.height = `${organic}%`;
    bars[2].setAttribute("data-v", `${organic}%`);
  }
}

// ------------------------------------
// LISTEN HISTORY
// ------------------------------------
function listenHistory() {
  const historyRef = ref(database, "smartbin/history");
  onValue(historyRef, (snapshot) => {
    const data = snapshot.val();
    const table = document.getElementById("historyTableBody");
    if (!data) {
      table.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No collection logs available.</td></tr>`;
      return;
    }
    const history = Object.values(data).reverse();
    let html = "";
    history.forEach(item => {
      const time = new Date(item.timestamp).toLocaleString();
      const binType = (item.bin || "system").toLowerCase();
      html += `
        <tr>
          <td>${time}</td>
          <td><span class="type-chip type-${binType}">${item.bin || "System"}</span></td>
          <td>${item.event}</td>
          <td><span class="badge ${item.status === 'FULL' || item.status === 'ERROR' ? 'bg-danger' : item.status === 'WARNING' ? 'bg-warning text-dark' : 'bg-success'}">${item.status}</span></td>
        </tr>
      `;
    });
    table.innerHTML = html;
  });
}

// ------------------------------------
// COMMANDS & SETTINGS
// ------------------------------------
window.sendEmptyCmd = function (binName) {
  const commandRef = ref(database, "smartbin/commands");
  set(commandRef, { command: "empty", bin: binName, timestamp: Date.now() })
  .then(() => {
    window.addHistory(binName, "Bin marked as emptied", "SUCCESS");
    window.updateBinUI(binName, 0, depositCounts[binName], false);
    console.log(`Empty command sent for ${binName}`);
  })
  .catch((error) => {
    console.error("Firebase command error:", error);
    alert("Could not send command to Firebase.");
  });
};

window.saveSettings = function () {
  const threshold = document.getElementById("cfgAlertThreshold").value || 85;
  const autolock = document.getElementById("cfgAutoLock").checked;
  set(ref(database, "smartbin/settings"), {
    threshold: Number(threshold),
    autoLock: autolock,
    updatedAt: Date.now()
  })
  .then(() => alert("Settings saved successfully!"))
  .catch((error) => alert("Could not save settings."));
};

// --- Part 2: UI Logic (Previously inside standard <script>) ---
let activityLogs = [];
let alertHistory = [];
let startTime = Date.now();

window.addEventListener('load', initDashboard);

function initDashboard() {
  initClock();
  initNavigation();
  if (window.initFirebase) window.initFirebase();
  setInterval(updateUptime, 1000);
}

// Mobile Sidebar Toggle function
window.toggleSidebar = function() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  if (sidebar.classList.contains('open')) {
    overlay.classList.add('show');
  } else {
    overlay.classList.remove('show');
  }
};

// Real-time Top Clock
function initClock() {
  const rtTime = document.getElementById('rtTime');
  const rtDate = document.getElementById('rtDate');
  function tick() {
    const now = new Date();
    rtTime.textContent = now.toTimeString().split(' ')[0];
    rtDate.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  setInterval(tick, 1000);
  tick();
}

// Navigation Tabs Switcher
function initNavigation() {
  const links = document.querySelectorAll('.sidebar-nav .nav-link');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const targetView = link.getAttribute('data-view');
      document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
      document.getElementById(`view-${targetView}`).classList.add('active');
      
      // Remove link tags dynamically for non-dashboard views to prevent confusing clicks
      if(targetView === 'dashboard') {
        document.getElementById('viewTitle').innerHTML = '<a href="https://pasindu-surath.github.io/Smart-Waste-Management-System/" class="title-link">Live Monitor</a>';
      } else {
        document.getElementById('viewTitle').innerHTML = link.getAttribute('data-title');
      }
      
      document.getElementById('viewSubtitle').textContent = link.getAttribute('data-sub');
      
      // Auto-close sidebar on mobile after clicking a link
      if (window.innerWidth <= 900) {
        toggleSidebar();
      }
    });
  });
}

// Dynamic UI Binder
window.updateBinUI = function updateBinUI(binName, fill, deposits, isOpen) {
  const fillEl = document.getElementById(`fill-${binName}`);
  const barEl = document.getElementById(`bar-${binName}`);
  const pctEl = document.getElementById(`pct-${binName}`);
  const valEl = document.getElementById(`fill-val-${binName}`);
  const tapsEl = document.getElementById(`taps-${binName}`);
  const lidEl = document.getElementById(`lid-${binName}`);
  const pillEl = document.getElementById(`pill-${binName}`);
  const cardEl = document.getElementById(`card-${binName}`);
  if(!fillEl) return;

  fillEl.style.height = `${fill}%`;
  barEl.style.width = `${fill}%`;
  pctEl.textContent = `${fill}%`;
  valEl.textContent = `${fill}%`;
  tapsEl.textContent = deposits;

  if(isOpen) lidEl.classList.add('open');
  else lidEl.classList.remove('open');

  // Threshold styling
  if(fill >= 80) {
    fillEl.style.background = 'linear-gradient(to top, #DC2626, #EF4444)';
    pillEl.className = 'bin-status-pill pill-locked';
    pillEl.innerHTML = `<i class="bi bi-lock-fill"></i> Full`;
    cardEl.classList.add('full-alert');
  } else if (fill >= 50) {
    fillEl.style.background = 'linear-gradient(to top, #D97706, #F59E0B)';
    pillEl.className = 'bin-status-pill pill-warn';
    pillEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> Warning`;
    cardEl.classList.remove('full-alert');
  } else {
    fillEl.style.background = 'linear-gradient(to top, var(--green-deep), var(--green))';
    pillEl.className = 'bin-status-pill pill-ok';
    pillEl.innerHTML = `<i class="bi bi-circle-fill" style="font-size:6px"></i> Normal`;
    cardEl.classList.remove('full-alert');
  }
};

function updateUptime() {
  const diff = Date.now() - startTime;
  const hrs = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  document.getElementById('systemUptime').textContent = `${hrs}:${mins}:${secs}`;
}

// Status Pill
window.setFirebaseStatus = function(isOnline) {
  const connStatus = document.getElementById("connStatus");
  const connText = document.getElementById("connText");
  if (isOnline) {
    connStatus.className = "conn-pill online";
    connText.textContent = "Firebase Online";
  } else {
    connStatus.className = "conn-pill offline";
    connText.textContent = "Firebase Offline";
  }
};

// Activity Log
window.addActivityLog = function(message) {
  const now = new Date();
  const time = now.toLocaleTimeString();
  activityLogs.unshift({ message: message, time: time });
  if (activityLogs.length > 20) activityLogs.pop();
  renderActivityLogs();
};

function renderActivityLogs() {
  const logList = document.getElementById("logList");
  if (!logList) return;
  if (activityLogs.length === 0) {
    logList.innerHTML = `<div class="text-muted text-center py-3">Waiting for device activity...</div>`;
    return;
  }
  logList.innerHTML = "";
  activityLogs.forEach(log => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `
      <div class="log-dot" style="background: var(--green)"></div>
      <div class="log-msg">${log.message}</div>
      <div class="log-time">${log.time}</div>
    `;
    logList.appendChild(div);
  });
}

// BIN ALERT SYSTEM 
window.checkBinAlert = function(binName, fill) {
  const alertKey = `${binName}-alert`;
  const existingIndex = alertHistory.findIndex(alert => alert.key === alertKey);
  let alert = null;

  if (fill >= 85) {
    alert = {
      key: alertKey,
      bin: binName,
      level: "FULL",
      message: `${binName} bin is full (${fill}%)`,
      fill: fill
    };
  } else if (fill >= 65) {
    alert = {
      key: alertKey,
      bin: binName,
      level: "WARNING",
      message: `${binName} bin is nearly full (${fill}%)`,
      fill: fill
    };
  }

  if (alert) {
    if (existingIndex === -1) {
      alert.time = new Date().toLocaleTimeString();
      alertHistory.push(alert);
      window.addActivityLog(`⚠ Alert triggered: ${alert.message}`);
      if (window.saveAlertToFirebase) window.saveAlertToFirebase(alert);
      if (window.addHistory) window.addHistory(binName, alert.message, alert.level);
    } else {
      if (alertHistory[existingIndex].level !== alert.level) {
        if (window.saveAlertToFirebase) window.saveAlertToFirebase(alert);
        if (window.addHistory) window.addHistory(binName, alert.message, alert.level);
      }
      alertHistory[existingIndex] = { ...alertHistory[existingIndex], ...alert };
    }
  } else {
    if (existingIndex !== -1) {
      alertHistory.splice(existingIndex, 1);
      window.addActivityLog(`✓ ${binName} bin returned to normal level`);
      if (window.addHistory) window.addHistory(binName, `${binName} bin level returned to normal (${fill}%)`, "NORMAL");
    }
  }
  renderAlerts();
};

// Render Dashboard Active Alerts
function renderAlerts() {
  const alertList = document.getElementById("alertList");
  const activeAlertCount = document.getElementById("activeAlertCount");
  if (!alertList) return;

  activeAlertCount.textContent = alertHistory.length;

if (alertHistory.length === 0) {
  alertList.innerHTML = `<div class="no-alerts"><i class="bi bi-shield-check"></i>All bins operating normally.</div>`;
  return;
}

alertList.innerHTML = "";
alertHistory.forEach(alert => {
  const div = document.createElement("div");
  div.className = "alert-item";
  const iconClass = alert.level === "FULL" ? "ai-red" : "ai-amber";
  const icon = alert.level === "FULL" ? "bi-exclamation-octagon-fill" : "bi-exclamation-triangle-fill";

  div.innerHTML = `
    <div class="alert-icon-wrap ${iconClass}">
      <i class="bi ${icon}"></i>
    </div>
    <div>
      <div class="alert-title">${alert.level} — ${alert.bin} Bin</div>
      <div class="alert-desc">${alert.message}</div>
      <div class="alert-time">${alert.time}</div>
    </div>
  `;
  alertList.appendChild(div);
});
}