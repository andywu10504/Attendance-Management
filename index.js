/* =========================
 * 全域設定與狀態
 * ========================= */
const AppState = {
  currentUserId: 'A001',
  user: null,
  records: [],
  gps: { ok: false, lat: null, lng: null, message: '尚未定位' },
  hasOpenRecord: false
};

/* =========================
 * API 設定
 * ========================= */
const API = {
  read: `${window.GAS_CONFIG?.BASE_URL || ''}?action=read`,
  create: `${window.GAS_CONFIG?.BASE_URL || ''}?action=create`,
  update: `${window.GAS_CONFIG?.BASE_URL || ''}?action=update`
};

/* =========================
 * 初始化
 * ========================= */
$(async function init() {
  bindEvents();
  startClock();
  await detectGPS();
  await loadData();
});

/* =========================
 * 事件綁定
 * ========================= */
function bindEvents() {
  $('#switchUserBtn').on('click', onSwitchUser);
  $('#checkGpsBtn').on('click', detectGPS);

  $('#checkInBtn').on('click', () => {
    if (!canCheckIn()) return;
    new bootstrap.Modal('#checkInModal').show();
  });

  $('#checkOutBtn').on('click', () => {
    if (!canCheckOut()) return;
    new bootstrap.Modal('#checkOutModal').show();
  });

  $('#confirmCheckInBtn').on('click', submitCheckIn);
  $('#confirmCheckOutBtn').on('click', submitCheckOut);
}

/* =========================
 * 時鐘顯示
 * ========================= */
function startClock() {
  const update = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    $('#clockTime').text(`${hh}:${mm}:${ss}`);
    $('#clockDate').text(now.toISOString().slice(0, 10));
  };
  update();
  setInterval(update, 1000);
}

/* =========================
 * GPS 定位（僅前端驗證）
 * ========================= */
async function detectGPS() {
  if (!navigator.geolocation) {
    AppState.gps = { ok: false, lat: null, lng: null, message: '瀏覽器不支援定位' };
    renderGPS();
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        AppState.gps = {
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          message: `定位成功 (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`
        };
        renderGPS();
        showStatus('success', 'GPS 驗證成功，可進行簽到簽退。');
        resolve();
      },
      (err) => {
        AppState.gps = { ok: false, lat: null, lng: null, message: `定位失敗：${err.message}` };
        renderGPS();
        showStatus('danger', 'GPS 驗證失敗，請開啟定位權限後重試。');
        resolve();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function renderGPS() {
  $('#gpsStatus').text(AppState.gps.message)
    .toggleClass('text-success', AppState.gps.ok)
    .toggleClass('text-danger', !AppState.gps.ok);
}

/* =========================
 * 載入資料
 * ========================= */
async function loadData() {
  try {
    const res = await $.getJSON(API.read, { userId: AppState.currentUserId });
    if (!res.success) throw new Error(res.message || '讀取失敗');

    AppState.user = res.user;
    AppState.records = res.records || [];
    AppState.hasOpenRecord = AppState.records.some((r) => r.checkInTime && !r.checkOutTime);

    renderUser();
    renderSummary(res.summary || { monthHours: 0, totalHours: 0 });
    renderRecords();
    updateActionButtons();
  } catch (error) {
    showStatus('danger', `讀取資料失敗：${error.message}`);
  }
}

function renderUser() {
  $('#unitText').text(AppState.user?.unit || '-');
  $('#titleText').text(AppState.user?.title || '-');
  $('#nameText').text(AppState.user?.name || '-');
}

function renderSummary(summary) {
  $('#monthHours').text(Number(summary.monthHours || 0).toFixed(2));
  $('#totalHours').text(Number(summary.totalHours || 0).toFixed(2));
}

function renderRecords() {
  const rows = AppState.records.map((r) => {
    const hours = Number(r.hours || 0).toFixed(2);
    return `
      <tr>
        <td>${escapeHtml(r.workType || '一般勤務')}</td>
        <td>${escapeHtml(r.checkInDate || '')}</td>
        <td>${escapeHtml(r.checkInTime || '')}</td>
        <td>${escapeHtml(r.checkOutDate || '')}</td>
        <td>${escapeHtml(r.checkOutTime || '')}</td>
        <td>${hours}</td>
      </tr>
    `;
  }).join('');

  $('#recordTableBody').html(rows || '<tr><td colspan="6" class="text-center text-muted">目前沒有資料</td></tr>');
}

/* =========================
 * 按鈕與流程控制
 * ========================= */
function canCheckIn() {
  if (!AppState.gps.ok) return showStatus('warning', '尚未完成 GPS 驗證，無法簽到。'), false;
  if (AppState.hasOpenRecord) return showStatus('warning', '您目前已有未簽退紀錄，不能重複簽到。'), false;
  return true;
}

function canCheckOut() {
  if (!AppState.gps.ok) return showStatus('warning', '尚未完成 GPS 驗證，無法簽退。'), false;
  if (!AppState.hasOpenRecord) return showStatus('warning', '目前沒有未簽退紀錄。'), false;
  return true;
}

function updateActionButtons() {
  $('#checkInBtn').prop('disabled', AppState.hasOpenRecord);
  $('#checkOutBtn').prop('disabled', !AppState.hasOpenRecord);
}

async function submitCheckIn() {
  try {
    const payload = {
      userId: AppState.currentUserId,
      workContent: $('#checkInWorkContent').val().trim(),
      signUrl: $('#checkInSignUrl').val().trim(),
      gpsLat: AppState.gps.lat,
      gpsLng: AppState.gps.lng
    };

    const res = await $.ajax({
      url: API.create,
      method: 'POST',
      data: JSON.stringify(payload),
      contentType: 'application/json'
    });

    if (!res.success) throw new Error(res.message || '簽到失敗');
    bootstrap.Modal.getInstance(document.getElementById('checkInModal')).hide();
    showStatus('success', '簽到成功。');
    await loadData();
  } catch (error) {
    showStatus('danger', `簽到失敗：${error.message}`);
  }
}

async function submitCheckOut() {
  try {
    const payload = {
      userId: AppState.currentUserId,
      gpsLat: AppState.gps.lat,
      gpsLng: AppState.gps.lng
    };

    const res = await $.ajax({
      url: API.update,
      method: 'POST',
      data: JSON.stringify(payload),
      contentType: 'application/json'
    });

    if (!res.success) throw new Error(res.message || '簽退失敗');
    bootstrap.Modal.getInstance(document.getElementById('checkOutModal')).hide();
    showStatus('success', '簽退成功。');
    await loadData();
  } catch (error) {
    showStatus('danger', `簽退失敗：${error.message}`);
  }
}

function onSwitchUser() {
  AppState.currentUserId = AppState.currentUserId === 'A001' ? 'A002' : 'A001';
  showStatus('info', `已切換人員：${AppState.currentUserId}`);
  loadData();
}

/* =========================
 * UI 工具
 * ========================= */
function showStatus(type, message) {
  const html = `<div class="alert alert-${type} mb-0" role="alert">${escapeHtml(message)}</div>`;
  $('#statusArea').removeClass('d-none').html(html);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
