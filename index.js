/* =========================
 * 全域狀態
 * ========================= */
const AppState = {
  currentUserId: '',
  user: null,
  users: [],
  records: [],
  selectedMonth: '',
  gps: { ok: false, lat: null, lng: null, message: '尚未定位' },
  hasOpenRecord: false
};

const API = {
  read: `${window.GAS_CONFIG?.BASE_URL || ''}?action=read`,
  create: `${window.GAS_CONFIG?.BASE_URL || ''}?action=create`,
  update: `${window.GAS_CONFIG?.BASE_URL || ''}?action=update`
};

const CHECKPOINTS = [
  { name: '日月光K11', lat: 22.722175781517592, lng: 120.30469452841636 },
  { name: '新興分隊', lat: 22.63061642963968, lng: 120.31139119733957 },
  { name: '吉林街', lat: 22.644404289374926, lng: 120.306559031746 }
];

const MAX_DISTANCE_METER = 250;


/* =========================
 * 初始化
 * ========================= */
$(async function init() {
  AppState.selectedMonth = getCurrentMonth();
  $('#recordMonth').val(AppState.selectedMonth);

  buildHalfHourOptions('#inTime');
  buildHalfHourOptions('#outTime');
  bindEvents();
  startClock();
  await detectGPS();
  await loadData();
});

/* =========================
 * 事件
 * ========================= */
function bindEvents() {
  $('#switchUserBtn').on('click', openSwitchModal);
  $('#confirmSwitchBtn').on('click', confirmSwitchUser);
  $('#switchName').on('change', () => syncUserFields($('#switchName').val(), '#switchUnit', '#switchTitle'));

  $('#checkGpsBtn').on('click', detectGPS);
  $('#recordMonth').on('change', async () => {
    AppState.selectedMonth = $('#recordMonth').val();
    await loadData();
  });

  $('#checkInBtn').on('click', () => {
    if (!canCheckIn()) return;
    fillCheckInModal();
    new bootstrap.Modal('#checkInModal').show();
  });

  $('#checkOutBtn').on('click', () => {
    if (!canCheckOut()) return;
    fillCheckOutModal();
    new bootstrap.Modal('#checkOutModal').show();
  });

  $('#inName').on('change', () => syncUserFields($('#inName').val(), null, '#inTitle'));
  $('#outName').on('change', () => syncUserFields($('#outName').val(), null, '#outTitle'));

  $('#confirmCheckInBtn').on('click', submitCheckIn);
  $('#confirmCheckOutBtn').on('click', submitCheckOut);
}

/* =========================
 * 時鐘
 * ========================= */
function startClock() {
  const update = () => {
    const now = new Date();
    $('#clockTime').text(formatTime(now));
    $('#clockDate').text(now.toISOString().slice(0, 10));
  };
  update();
  setInterval(update, 1000);
}

/* =========================
 * 讀取資料
 * ========================= */
async function loadData() {
  showLoading(true);
  try {
    const res = await $.getJSON(API.read, {
      userId: AppState.currentUserId,
      month: AppState.selectedMonth
    });
    if (!res.success) throw new Error(res.message || '讀取失敗');

    AppState.users = res.users || [];

    if (!AppState.currentUserId) {
      AppState.currentUserId = AppState.users[0]?.id || '';
      if (!AppState.currentUserId) throw new Error('人員資料為空');
      return await loadData();
    }

    AppState.user = res.user;
    AppState.records = res.records || [];
    AppState.hasOpenRecord = !!res.hasOpenRecord;

    renderUser();
    renderSummary(res.summary || { monthHours: 0, totalHours: 0 });
    renderRecords();
    updateActionButtons();
  } catch (error) {
    showStatus('danger', `讀取資料失敗：${error.message}`);
  } finally {
    showLoading(false);
  }
}

/* =========================
 * GPS
 * ========================= */
async function detectGPS() {
  if (!navigator.geolocation) {
    AppState.gps = { ok: false, lat: null, lng: null, message: '瀏覽器不支援定位' };
    return renderGPS();
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const nearest = findNearestCheckpoint(lat, lng);
        const within = nearest && nearest.distance <= MAX_DISTANCE_METER;

        AppState.gps = {
          ok: !!within,
          lat,
          lng,
          message: within
            ? `定位成功：${nearest.name}（距離 ${nearest.distance.toFixed(0)} 公尺）`
            : `定位失敗：未在指定範圍內（最近 ${nearest.name} ${nearest.distance.toFixed(0)} 公尺）`
        };
        renderGPS();
        if (within) {
          showStatus('success', 'GPS 驗證成功，可進行簽到簽退。');
        } else {
          showStatus('warning', `GPS 驗證未通過，請於指定地點附近 ${MAX_DISTANCE_METER} 公尺內操作。`);
        }
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

/* =========================
 * 畫面更新
 * ========================= */
function renderUser() {
  $('#unitText').text(AppState.user?.unit || '-');
  $('#titleText').text(AppState.user?.title || '-');
  $('#nameText').text(AppState.user?.name || '-');
}

function renderSummary(summary) {
  const monthHours = Number(summary.monthHours || 0);
  const totalHours = Number(summary.totalHours || 0);

  $('#monthHours').text(monthHours.toFixed(2));
  $('#totalHours').text(totalHours.toFixed(2));

  const percentage = Math.min(100, (monthHours / 12) * 100);
  $('#monthProgress').css('width', `${percentage.toFixed(0)}%`).text(`${percentage.toFixed(0)}%`);
}

function renderRecords() {
  const rows = AppState.records.map((r) => `
    <tr>
      <td>${escapeHtml(r.workType || '')}</td>
      <td>${escapeHtml(r.checkInDate || '')}</td>
      <td>${escapeHtml(r.checkInTime || '')}</td>
      <td>${escapeHtml(r.checkOutDate || '')}</td>
      <td>${escapeHtml(r.checkOutTime || '')}</td>
      <td>${Number(r.hours || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  $('#recordTableBody').html(rows || '<tr><td colspan="6" class="text-center text-muted">目前沒有資料</td></tr>');
}

function renderGPS() {
  $('#gpsStatus').text(AppState.gps.message)
    .toggleClass('text-success', AppState.gps.ok)
    .toggleClass('text-danger', !AppState.gps.ok);
}

function showLoading(show) {
  $('#loadingMask').css('display', show ? 'flex' : 'none');
}

/* =========================
 * 流程判斷
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

/* =========================
 * 切換人員
 * ========================= */
function openSwitchModal() {
  populateUserOptions('#switchName', AppState.currentUserId);
  syncUserFields(AppState.currentUserId, '#switchUnit', '#switchTitle');
  new bootstrap.Modal('#switchUserModal').show();
}

async function confirmSwitchUser() {
  AppState.currentUserId = $('#switchName').val();
  bootstrap.Modal.getInstance(document.getElementById('switchUserModal')).hide();
  await loadData();
}

/* =========================
 * 簽到
 * ========================= */
function fillCheckInModal() {
  populateUserOptions('#inName', AppState.currentUserId);
  syncUserFields(AppState.currentUserId, null, '#inTitle');
  const now = new Date();
  $('#inDate').val(now.toISOString().slice(0, 10));
  $('#inTime').val(roundToHalfHour(now));
  $('#inDutyType').val('協勤');
}

async function submitCheckIn() {
  try {
    const payload = {
      userId: $('#inName').val(),
      dutyType: $('#inDutyType').val(),
      checkInDate: $('#inDate').val(),
      checkInTime: $('#inTime').val(),
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

/* =========================
 * 簽退
 * ========================= */
function fillCheckOutModal() {
  populateUserOptions('#outName', AppState.currentUserId);
  syncUserFields(AppState.currentUserId, null, '#outTitle');
  const now = new Date();
  $('#outDate').val(now.toISOString().slice(0, 10));
  $('#outTime').val(roundToHalfHour(now));
  $('#outDutyType').val('協勤');
  $('#outServiceType').val('待命協勤');
  $('#outWorkContent').val('');
  $('#outSignUrl').val('');
}

async function submitCheckOut() {
  try {
    const dutyType = $('#outDutyType').val();
    const serviceType = $('#outServiceType').val();
    const workContent = $('#outWorkContent').val().trim();

    if ((serviceType === '出勤' || dutyType === '公差勤務') && !workContent) {
      return showStatus('warning', '出勤或公差勤務時，工作內容必填。');
    }

    const payload = {
      userId: $('#outName').val(),
      dutyType,
      serviceType,
      checkOutDate: $('#outDate').val(),
      checkOutTime: $('#outTime').val(),
      workContent,
      signUrl: $('#outSignUrl').val().trim(),
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

/* =========================
 * 共用工具
 * ========================= */
function populateUserOptions(target, selectedId) {
  const html = AppState.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('');
  $(target).html(html).val(selectedId || AppState.users[0]?.id || '');
}

function syncUserFields(userId, unitTarget, titleTarget) {
  const user = AppState.users.find(u => u.id === userId);
  if (!user) return;
  if (unitTarget) $(unitTarget).val(user.unit || '');
  if (titleTarget) $(titleTarget).val(user.title || '');
}

function buildHalfHourOptions(selector) {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push(`<option value="${t}:00">${t}</option>`);
    }
  }
  $(selector).html(options.join(''));
}

function roundToHalfHour(date) {
  const d = new Date(date);
  const m = d.getMinutes();
  if (m < 15) d.setMinutes(0, 0, 0);
  else if (m < 45) d.setMinutes(30, 0, 0);
  else { d.setHours(d.getHours() + 1); d.setMinutes(0, 0, 0); }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}



function findNearestCheckpoint(lat, lng) {
  let nearest = null;
  CHECKPOINTS.forEach((point) => {
    const distance = calcDistanceMeter(lat, lng, point.lat, point.lng);
    if (!nearest || distance < nearest.distance) nearest = { ...point, distance };
  });
  return nearest;
}

function calcDistanceMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
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
