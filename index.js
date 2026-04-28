const STORAGE_KEY_CURRENT_USER = "attendance_current_user";

const staffData = [
    { unit: "新興分隊", title: "隊員", name: "王小明" },
    { unit: "新興分隊", title: "隊員", name: "陳小華" },
    { unit: "新興分隊", title: "小隊長", name: "林志強" },
    { unit: "新興分隊", title: "副小隊長", name: "黃雅婷" },
    { unit: "日月光 K11", title: "隊員", name: "李志偉" },
    { unit: "吉林街", title: "幹部", name: "張淑芬" }
];

const TARGET_MONTH_HOURS = 12;
const ENABLE_LOCATION_CHECK = true;

let currentUser = null;

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
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
}

function formatDateDash(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatMonth(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
}

// ===== 日期 =====
function initDates() {
    const now = new Date();

    $("#checkInDate").val(formatDateDash(now));
    $("#checkOutDate").val(formatDateDash(now));
    $("#searchMonth").val(formatMonth(now));
}

// ===== 人員 =====
function initStaffOptions() {
    const selects = $("#switchName, #checkInName, #checkOutName");

    selects.empty();
    selects.append(`<option value="">請選擇姓名</option>`);

    staffData.forEach(user => {
        selects.append(`<option value="${user.name}">${user.name}</option>`);
    });
}

function restoreCurrentUser() {
    const savedName = localStorage.getItem(STORAGE_KEY_CURRENT_USER);

    if (!savedName) {
        renderDefaultNavbar();
        return;
    }

    const user = staffData.find(x => x.name === savedName);

    if (!user) {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        renderDefaultNavbar();
        return;
    }

    applyCurrentUser(user, false);
}

function applyCurrentUser(user, shouldSave) {
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

    if (shouldSave) {
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

// ===== 時間選單 =====
function initTimeOptions() {
    $(".time-select").each(function () {
        const select = $(this);
        select.empty();

        for (let h = 0; h < 24; h++) {
            for (const m of [0, 30]) {
                const hh = String(h).padStart(2, "0");
                const mm = String(m).padStart(2, "0");
                select.append(`<option value="${hh}:${mm}">${hh}:${mm}</option>`);
            }
        }
    });

    const now = new Date();
    const minute = now.getMinutes() < 30 ? "00" : "30";
    const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${minute}`;

    $("#checkInTime").val(defaultTime);
    $("#checkOutTime").val(defaultTime);
}

// ===== 事件 =====
function initEvents() {
    $("#switchName").on("change", function () {
        const name = $(this).val();
        const user = staffData.find(x => x.name === name);

        if (!user) {
            $("#switchUnit").val("");
            $("#switchTitle").val("");
            return;
        }

        $("#switchUnit").val(user.unit);
        $("#switchTitle").val(user.title);
    });

    $("#btnApplyUser").on("click", function () {
        const name = $("#switchName").val();
        const user = staffData.find(x => x.name === name);

        if (!user) {
            showStatus("請先選擇姓名");
            return;
        }

        applyCurrentUser(user, true);

        const modal = bootstrap.Modal.getInstance(document.getElementById("switchModal"));
        modal.hide();
    });

    $("#checkInName, #checkOutName").on("change", function () {
        const name = $(this).val();
        const user = staffData.find(x => x.name === name);

        if (user) {
            applyCurrentUser(user, true);
        }
    });

    $("#checkOutDutyType, #checkOutStatus").on("change", function () {
        updateCheckOutVisibleBlocks();
    });

    $("#btnRelocate").on("click", getLocation);
    $("#btnClearSignature").on("click", clearSignature);

    $("#checkOutModal").on("shown.bs.modal", function () {
        resizeSignatureCanvas();
    });
}

// ===== 簽退欄位顯示 =====
function updateCheckOutVisibleBlocks() {
    const dutyType = $("#checkOutDutyType").val();
    const serviceType = $("#checkOutStatus").val();

    if (dutyType === "協勤") {
        $("#checkOutStatusBlock").show();
    } else {
        $("#checkOutStatusBlock").hide();
    }

    const shouldShowWorkContent =
        (dutyType === "協勤" && serviceType === "出勤") ||
        dutyType === "公差勤務";

    if (shouldShowWorkContent) {
        $("#workContentBlock").show();
    } else {
        $("#workContentBlock").hide();
        $("#workContent").val("");
    }
}

// ===== 狀態 =====
function showStatus(message) {
    $("#statusText").text(message);
    $("#statusBox").removeClass("d-none");
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

    if (!navigator.geolocation) {
        $("#locationStatus").text("瀏覽器不支援定位");
        return;
    }

    $("#locationStatus").text("定位中...");

    navigator.geolocation.getCurrentPosition(
        function () {
            $("#locationStatus").text("定位成功");
        },
        function () {
            $("#locationStatus").text("定位失敗");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ===== 簽名 Canvas =====
let signatureCanvas = null;
let signatureCtx = null;
let isDrawing = false;

function initSignatureCanvas() {
    signatureCanvas = document.getElementById("signatureCanvas");
    if (!signatureCanvas) return;

    signatureCanvas.addEventListener("pointerdown", startDraw);
    signatureCanvas.addEventListener("pointermove", drawSignature);
    signatureCanvas.addEventListener("pointerup", endDraw);
    signatureCanvas.addEventListener("pointerleave", endDraw);
    signatureCanvas.addEventListener("pointercancel", endDraw);

    window.addEventListener("resize", resizeSignatureCanvas);
}

function resizeSignatureCanvas() {
    if (!signatureCanvas) return;

    const rect = signatureCanvas.getBoundingClientRect();

    if (!rect.width || rect.width <= 0) return;

    signatureCanvas.width = rect.width;
    signatureCanvas.height = 120;

    signatureCtx = signatureCanvas.getContext("2d");
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = "round";
    signatureCtx.lineJoin = "round";
    signatureCtx.strokeStyle = "#000";
}

function getCanvasPosition(event) {
    const rect = signatureCanvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function startDraw(event) {
    event.preventDefault();

    if (!signatureCtx) {
        resizeSignatureCanvas();
    }

    isDrawing = true;

    const pos = getCanvasPosition(event);
    signatureCtx.beginPath();
    signatureCtx.moveTo(pos.x, pos.y);
}

function drawSignature(event) {
    if (!isDrawing) return;

    event.preventDefault();

    const pos = getCanvasPosition(event);
    signatureCtx.lineTo(pos.x, pos.y);
    signatureCtx.stroke();
}

function endDraw(event) {
    if (event) {
        event.preventDefault();
    }

    isDrawing = false;
}

function clearSignature() {
    if (!signatureCtx || !signatureCanvas) return;

    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}
