// ===== 基本設定 =====
const STORAGE_KEY_CURRENT_USER = "attendance_current_user";
const TARGET_MONTH_HOURS = 12;

// ===== 定位設定 =====
const ENABLE_LOCATION_CHECK = true;
const LOCATION_RADIUS_METERS = 200;

const LOCATIONS = [
    { name: "新興分隊", lat: 22.630672158276443, lng: 120.31128327916338 },
    { name: "日月光 K11", lat: 22.72216361392138, lng: 120.30467815407455 },
    { name: "吉林街", lat: 22.644404291421328, lng: 120.30641955636828 }
];

// ===== 範例人員 =====
const staffData = [
    { unit: "新興分隊", title: "隊員", name: "王小明" },
    { unit: "新興分隊", title: "隊員", name: "陳小華" },
    { unit: "新興分隊", title: "小隊長", name: "林志強" }
];

let currentUser = null;


// ===== 初始化 =====
$(function () {
    initClock();
    initDates();
    initStaffOptions();
    initTimeOptions();
    initEvents();
    initSignatureCanvas();
    initLocation();
    restoreCurrentUser();
    updateCheckOutVisibleBlocks();
});


// ===== 時鐘 =====
function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    $("#timeText").text(formatTime(now));
    $("#dateText").text(formatDateSlash(now));
}

function formatTime(date) {
    return [
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0")
    ].join(":");
}

function formatDateSlash(date) {
    return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}`;
}

function formatDateDash(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function formatMonth(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}


// ===== 日期初始化 =====
function initDates() {
    const now = new Date();

    $("#checkInDate").val(formatDateDash(now));
    $("#checkOutDate").val(formatDateDash(now));
    $("#searchMonth").val(formatMonth(now));
}


// ===== 人員 =====
function initStaffOptions() {
    const selects = $("#switchName, #checkInName, #checkOutName");

    selects.empty().append(`<option value="">請選擇姓名</option>`);

    staffData.forEach(u => {
        selects.append(`<option value="${u.name}">${u.name}</option>`);
    });
}

function restoreCurrentUser() {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);

    if (!saved) {
        renderDefaultNavbar();
        return;
    }

    const user = staffData.find(x => x.name === saved);

    if (!user) {
        renderDefaultNavbar();
        return;
    }

    applyCurrentUser(user, false);
}

function applyCurrentUser(user, save) {
    currentUser = user;

    if (!user) {
        renderDefaultNavbar();
        return;
    }

    $("#switchUnit").val(user.unit);
    $("#switchTitle").val(user.title);
    $("#switchName").val(user.name);

    $("#checkInTitle").val(user.title);
    $("#checkInName").val(user.name);

    $("#checkOutTitle").val(user.title);
    $("#checkOutName").val(user.name);

    renderNavbarUser(user);

    if (save) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, user.name);
    }
}

function renderDefaultNavbar() {
    $("#navbarUserInfo").html(`
        <span><i class="fa-solid fa-building"></i></span>
        <span>-</span>
        <span><i class="fa-solid fa-user-tie"></i></span>
        <span>-</span>
        <span><i class="fa-solid fa-user"></i></span>
        <span>-</span>

        <button class="btn btn-outline-primary btn-sm ms-2" data-bs-toggle="modal" data-bs-target="#switchModal">
            <i class="fa-solid fa-right-left"></i> 切換
        </button>
    `);
}

function renderNavbarUser(user) {
    $("#navbarUserInfo").html(`
        <span><i class="fa-solid fa-building"></i> ${user.unit}</span>
        <span><i class="fa-solid fa-user-tie"></i> ${user.title}</span>
        <span><i class="fa-solid fa-user"></i> ${user.name}</span>

        <button class="btn btn-outline-primary btn-sm ms-2" data-bs-toggle="modal" data-bs-target="#switchModal">
            <i class="fa-solid fa-right-left"></i> 切換
        </button>
    `);
}


// ===== 時間選單（00 / 30）=====
function initTimeOptions() {
    $(".time-select").each(function () {
        const select = $(this);
        select.empty();

        for (let h = 0; h < 24; h++) {
            for (let m of [0, 30]) {
                const hh = String(h).padStart(2, "0");
                const mm = String(m).padStart(2, "0");
                select.append(`<option value="${hh}:${mm}">${hh}:${mm}</option>`);
            }
        }
    });
}


// ===== 事件 =====
function initEvents() {

    $("#switchName").on("change", function () {
        const user = staffData.find(x => x.name === $(this).val());
        if (!user) return;

        $("#switchUnit").val(user.unit);
        $("#switchTitle").val(user.title);
    });

    $("#btnApplyUser").on("click", function () {
        const user = staffData.find(x => x.name === $("#switchName").val());
        if (!user) return;

        applyCurrentUser(user, true);
        bootstrap.Modal.getInstance(document.getElementById("switchModal")).hide();
    });

    $("#checkOutDutyType, #checkOutStatus").on("change", updateCheckOutVisibleBlocks);

    $("#btnRelocate").on("click", getLocation);

    $("#btnClearSignature").on("click", clearSignature);

    $("#checkOutModal").on("shown.bs.modal", resizeSignatureCanvas);
}


// ===== 簽退顯示邏輯 =====
function updateCheckOutVisibleBlocks() {

    const dutyType = $("#checkOutDutyType").val();
    const serviceType = $("#checkOutStatus").val();

    if (dutyType === "協勤") {
        $("#checkOutStatusBlock").show();
    } else {
        $("#checkOutStatusBlock").hide();
    }

    const showWork =
        (dutyType === "協勤" && serviceType === "出勤") ||
        dutyType === "公差勤務";

    showWork ? $("#workContentBlock").show() : $("#workContentBlock").hide();
}


// ===== 定位 =====
function initLocation() {
    getLocation();
}

function getLocation() {
    if (!ENABLE_LOCATION_CHECK) {
        $("#locationStatus").text("定位已關閉");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            const nearest = findNearestLocation(pos.coords.latitude, pos.coords.longitude);

            if (nearest.distance <= LOCATION_RADIUS_METERS) {
                $("#locationStatus").text(`✔ ${nearest.name} (${nearest.distance.toFixed(0)}m)`);
            } else {
                $("#locationStatus").text(`✖ 不在範圍 (${nearest.name} ${nearest.distance.toFixed(0)}m)`);
            }
        },
        () => $("#locationStatus").text("定位失敗"),
        { enableHighAccuracy: true }
    );
}

function findNearestLocation(lat, lng) {
    let nearest = null;

    LOCATIONS.forEach(l => {
        const d = getDistance(lat, lng, l.lat, l.lng);

        if (!nearest || d < nearest.distance) {
            nearest = { name: l.name, distance: d };
        }
    });

    return nearest;
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


// ===== 簽名 =====
let canvas, ctx, drawing = false;

function initSignatureCanvas() {
    canvas = document.getElementById("signatureCanvas");
    if (!canvas) return;

    ctx = canvas.getContext("2d");

    canvas.addEventListener("pointerdown", e => {
        drawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    });

    canvas.addEventListener("pointermove", e => {
        if (!drawing) return;
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });

    canvas.addEventListener("pointerup", () => drawing = false);
}

function resizeSignatureCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 120;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
