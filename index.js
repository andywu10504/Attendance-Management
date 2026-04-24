/* =========================
 * 全域狀態
 * ========================= */
const appState = {
  userId: 'U001',
  profile: null,
  records: [],
  hasUncheckedRecord: false,
  gps: null,
};

/* =========================
 * 初始化
 * ========================= */
$(function () {
  bindEvents();
  startClock();
  loadDashboard();
});

/* =========================
 * 事件綁定
 * ========================= */
function bindEvents() {
  $('#switchUserBtn').on('click', () => {
    const newId = prompt('請輸入人員 ID', appState.userId);
    if (newId) {
      appState.userId = newId.trim();
      loadDashboard();
    }
  });

  $('#checkInModal').on('show.bs.modal', async function () {
    const gpsResult = await getCurrentGps();
    renderGpsStatus('#checkInGpsStatus', gpsResult);
  });

  $('#checkOutModal').on('show.bs.modal', async function () {
    const gpsResult = await getCurrentGps();
    renderGpsStatus('#checkOutGpsStatus', gpsResult);
  });

  $('#confirmCheckInBtn').on('click', async () => {
    if (appState.hasUncheckedRecord) {
      showStatus('已簽到尚未簽退，請勿重複簽到。', 'warning');
      return;
    }

    if (!appState.gps || !appState.gps.ok) {
      showStatus('GPS 驗證失敗，無法簽到。', 'danger');
      return;
    }

    const payload = {
      id: appState.userId,
      latitude: appState.gps.latitude,
      longitude: appState.gps.longitude,
    };

    try {
      await gasCall('createCheckIn', payload);
      showStatus('簽到成功。', 'success');
      bootstrap.Modal.getInstance(document.getElementById('checkInModal')).hide();
      await loadDashboard();
    } catch (err) {
      showStatus(`簽到失敗：${err.message}`, 'danger');
    }
  });

  $('#confirmCheckOutBtn').on('click', async () => {
    if (!appState.hasUncheckedRecord) {
      showStatus('目前沒有可簽退的簽到紀錄。', 'warning');
      return;
    }

    if (!appState.gps || !appState.gps.ok) {
      showStatus('GPS 驗證失敗，無法簽退。', 'danger');
      return;
    }

    const payload = {
      id: appState.userId,
      latitude: appState.gps.latitude,
      longitude: appState.gps.longitude,
      workNote: '一般勤務',
      signatureFileId: '',
    };

    try {
      await gasCall('updateCheckOut', payload);
      showStatus('簽退成功。', 'success');
      bootstrap.Modal.getInstance(document.getElementById('checkOutModal')).hide();
      await loadDashboard();
    } catch (err) {
      showStatus(`簽退失敗：${err.message}`, 'danger');
    }
  });
}

/* =========================
 * 主畫面資料讀取
 * ========================= */
async function loadDashboard() {
  try {
    const data = await gasCall('getDashboardData', { id: appState.userId });
    appState.profile = data.profile;
    appState.records = data.records || [];
    appState.hasUncheckedRecord = appState.records.some((r) => !r.checkOutTime);

    renderProfile();
    renderHours(data.monthHours || 0, data.totalHours || 0);
    renderRecords(appState.records);
    updateButtonState();
  } catch (err) {
    showStatus(`載入資料失敗：${err.message}`, 'danger');
  }
}

/* =========================
 * 視圖渲染
 * ========================= */
function renderProfile() {
  $('#unitText').text(appState.profile?.unit || '單位');
  $('#titleText').text(appState.profile?.title || '職稱');
  $('#nameText').text(appState.profile?.name || '姓名');
}

function renderHours(monthHours, totalHours) {
  $('#monthHours').text(Number(monthHours).toFixed(2));
  $('#totalHours').text(Number(totalHours).toFixed(2));
}

function renderRecords(records) {
  const $body = $('#recordsTableBody');
  $body.empty();

  if (!records.length) {
    $body.append('<tr><td colspan="5" class="text-center text-muted">尚無資料</td></tr>');
    return;
  }

  records.forEach((row) => {
    $body.append(`
      <tr>
        <td>${escapeHtml(row.dutyType || '協勤')}</td>
        <td>${escapeHtml(row.checkInDate || '')}</td>
        <td>${escapeHtml(row.checkInTime || '')}</td>
        <td>${escapeHtml(row.checkOutDate || '')}</td>
        <td>${escapeHtml(row.checkOutTime || '')}</td>
      </tr>
    `);
  });
}

function updateButtonState() {
  $('#checkInBtn').prop('disabled', appState.hasUncheckedRecord);
  $('#checkOutBtn').prop('disabled', !appState.hasUncheckedRecord);
}

function showStatus(message, type) {
  $('#statusSection').removeClass('d-none');
  $('#statusAlert')
    .removeClass('alert-success alert-danger alert-warning alert-info')
    .addClass(`alert-${type || 'info'}`)
    .text(message);
}

/* =========================
 * 時鐘
 * ========================= */
function startClock() {
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mon = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    $('#clockTime').text(`${hh}:${mm}:${ss}`);
    $('#clockDate').text(`${yyyy}-${mon}-${dd}`);
  };

  tick();
  setInterval(tick, 1000);
}

/* =========================
 * GPS
 * ========================= */
async function getCurrentGps() {
  if (!navigator.geolocation) {
    appState.gps = { ok: false, message: '瀏覽器不支援 GPS。' };
    return appState.gps;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        appState.gps = {
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          message: 'GPS 驗證成功。',
        };
        resolve(appState.gps);
      },
      (error) => {
        appState.gps = { ok: false, message: `GPS 失敗：${error.message}` };
        resolve(appState.gps);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function renderGpsStatus(selector, gpsResult) {
  const cls = gpsResult.ok ? 'text-success' : 'text-danger';
  $(selector).removeClass('text-success text-danger').addClass(cls).text(gpsResult.message);
}

/* =========================
 * GAS 呼叫封裝
 * ========================= */
function gasCall(method, payload) {
  return new Promise((resolve, reject) => {
    // Apps Script 環境
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler((err) => reject(new Error(err.message || err)))
        [method](payload);
      return;
    }

    // 本地測試假資料
    const mock = mockApi(method, payload);
    resolve(mock);
  });
}

/* =========================
 * 本地假資料
 * ========================= */
function mockApi(method) {
  const mockRecords = [
    {
      dutyType: '協勤',
      checkInDate: '2026-04-22',
      checkInTime: '08:10:00',
      checkOutDate: '2026-04-22',
      checkOutTime: '17:40:00',
    },
  ];

  switch (method) {
    case 'getDashboardData':
      return {
        profile: { unit: '行政組', title: '隊員', name: '王小明' },
        monthHours: 45.5,
        totalHours: 356.5,
        records: mockRecords,
      };
    case 'createCheckIn':
    case 'updateCheckOut':
      return { ok: true };
    default:
      throw new Error(`未知方法：${method}`);
  }
}

/* =========================
 * 工具
 * ========================= */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
