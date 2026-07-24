import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set(); // 중복 스캔 방지 바구니

let html5QrCode; 
let currentFacingMode = "environment"; // 항상 후면 카메라 유지[cite: 1]
let isFlipped = false; // 💡 좌우 반전 상태를 기억하는 변수

document.addEventListener("DOMContentLoaded", () => {
    html5QrCode = new Html5Qrcode("reader");[cite: 1]
    startCamera();[cite: 1]
});

// 카메라를 켜는 함수
function startCamera() {
    const cameraConfig = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        videoConstraints: {
            advanced: [{ focusMode: "continuous" }]
        }
    };[cite: 1]

    html5QrCode.start(
        { facingMode: currentFacingMode },
        cameraConfig,
        onScanSuccess, 
        onScanError
    ).then(() => {
        // 💡 카메라가 켜지면 현재 설정된 좌우 반전 상태를 즉시 적용
        applyFlipState();
    }).catch((err) => {
        console.error("카메라 시작 에러:", err);[cite: 1]
        alert("카메라 권한을 허용하시거나 다른 브라우저를 사용해주세요.");[cite: 1]
    });
}

// 💡 좌우 반전 버튼을 눌렀을 때 실행되는 로직
const flipBtn = document.getElementById('flipCameraBtn');
if (flipBtn) {
    flipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped; // 상태 뒤집기 (true <-> false)
        applyFlipState(); // 화면에 적용
    });
}

// 💡 비디오 태그에 거울 모드(CSS)를 적용하는 함수
function applyFlipState() {
    const videoElement = document.querySelector('#reader video');
    if (videoElement) {
        // isFlipped가 true면 -1(반전), false면 1(원래대로)
        videoElement.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    }
}

// 효과음 함수
function playBeep(isSuccess) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;[cite: 1]
        if (!AudioContext) return;[cite: 1]
        const ctx = new AudioContext();[cite: 1]
        const osc = ctx.createOscillator();[cite: 1]
        const gainNode = ctx.createGain();[cite: 1]
        osc.connect(gainNode);[cite: 1]
        gainNode.connect(ctx.destination);[cite: 1]
        if (isSuccess) {
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); [cite: 1]
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.15); [cite: 1]
        } else {
            osc.type = 'square'; osc.frequency.setValueAtTime(300, ctx.currentTime); [cite: 1]
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); [cite: 1]
        }
    } catch (e) {}[cite: 1]
}

// 진동 함수
function triggerVibration() {
    if (navigator.vibrate) navigator.vibrate(200); [cite: 1]
}

// QR 스캔 메인 로직
async function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;[cite: 1]
    isProcessing = true; [cite: 1]

    const msgBox = document.getElementById('resultMessage');[cite: 1]
    document.body.style.transition = "background-color 0.3s";[cite: 1]
    document.body.style.backgroundColor = "#fff9e6";[cite: 1]
    msgBox.innerText = "데이터 확인 중...";[cite: 1]
    msgBox.style.color = "#ff9800"; [cite: 1]

    try {
        const decodedString = decodeURIComponent(decodedText);[cite: 1]
        const qrData = JSON.parse(decodedString);[cite: 1]
        
        const userName = qrData.n;[cite: 1]
        const userBirth = qrData.b;[cite: 1]
        const userId = qrData.i;[cite: 1]
        const drinkName = qrData.d;[cite: 1]
        const qrTime = qrData.t;[cite: 1]

        const uniqueToken = `${userId}_${qrTime}`; [cite: 1]
        if (scannedTokens.has(uniqueToken)) throw new Error("이미 처리된 QR코드입니다. (중복)");[cite: 1]
        
        const currentTime = new Date().getTime();[cite: 1]
        if (currentTime - qrTime > 30000) throw new Error("유효시간(30초)이 지난 QR코드입니다.");[cite: 1]

        console.log("=== 스캔 진행 ===");[cite: 1]
        console.log("1. 사용자 아이디:", userId, "선택음료:", drinkName);[cite: 1]

        // --- [순서 1] 직원 정보 확인 ---
        const { data: empData, error: empReadErr } = await supabase[cite: 1]
            .from('employees')[cite: 1]
            .select('총주문량, 주문가능량')[cite: 1]
            .eq('아이디', userId)[cite: 1]
            .single();[cite: 1]
            
        if (empReadErr) throw new Error("직원 정보 조회 실패");[cite: 1]

        const currentAvailable = Number(empData.주문가능량 || 0); [cite: 1]
        const currentTotal = Number(empData.총주문량 || 0);[cite: 1]
        console.log("2. 현재 상태 - 주문가능량:", currentAvailable, "총주문량:", currentTotal);[cite: 1]

        if (currentAvailable < 1) throw new Error(`${userName}님은 주문가능량이 없습니다.`);[cite: 1]

        // --- [순서 2] 음료 정보 확인 ---
        const { data: drinkData, error: drinkReadErr } = await supabase[cite: 1]
            .from('drink')[cite: 1]
            .select('잔여수량')[cite: 1]
            .eq('음료선택', drinkName)[cite: 1]
            .single();[cite: 1]
            
        if (drinkReadErr) throw new Error("음료 재고 조회 실패");[cite: 1]

        const currentRemain = Number(drinkData.잔여수량 || 0);[cite: 1]
        console.log("3. 남은 음료 재고:", currentRemain);[cite: 1]

        if (currentRemain < 1) throw new Error(`${drinkName} 재고가 없습니다!`);[cite: 1]

        // --- [순서 3] DB에 3연속 업데이트 ---
        const { error: insertErr } = await supabase.from('data_stack').insert([[cite: 1]
            { 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }[cite: 1]
        ]);[cite: 1]
        if (insertErr) throw new Error("기록 저장 실패");[cite: 1]

        const { error: empUpdateErr } = await supabase.from('employees').update({ [cite: 1]
            '총주문량': currentTotal + 1, [cite: 1]
            '주문가능량': currentAvailable - 1 [cite: 1]
        }).eq('아이디', userId);[cite: 1]
        if (empUpdateErr) throw new Error("직원 수량 수정 실패");[cite: 1]

        const { error: drinkUpdateErr } = await supabase.from('drink').update({ [cite: 1]
            '잔여수량': currentRemain - 1 [cite: 1]
        }).eq('음료선택', drinkName);[cite: 1]
        if (drinkUpdateErr) throw new Error("음료 재고 수정 실패");[cite: 1]

        // 성공 처리
        scannedTokens.add(uniqueToken); [cite: 1]
        playBeep(true);        [cite: 1]
        triggerVibration();    [cite: 1]

        msgBox.innerText = `✅ [성공] ${userName}님\n${drinkName} 주문 완료\n(남은 가능량: ${currentAvailable - 1}개)`;[cite: 1]
        msgBox.style.color = "#155724"; [cite: 1]
        document.body.style.backgroundColor = "#d4edda"; [cite: 1]
        console.log("4. 업데이트 성공!");[cite: 1]

    } catch (error) {
        console.error("에러 발생:", error.message);[cite: 1]
        playBeep(false);       [cite: 1]
        triggerVibration();    [cite: 1]
        msgBox.innerText = `❌ [거절] ${error.message}`;[cite: 1]
        msgBox.style.color = "#721c24"; [cite: 1]
        document.body.style.backgroundColor = "#f8d7da";[cite: 1]
    }

    setTimeout(() => {
        document.body.style.backgroundColor = "#ffffff";[cite: 1]
        msgBox.innerText = "스캔 대기 중...";[cite: 1]
        msgBox.style.color = "#0056b3";[cite: 1]
        isProcessing = false; [cite: 1]
    }, 3000);[cite: 1]
}

function onScanError(errorMessage) {}[cite: 1]

document.getElementById('logoutBtn').addEventListener('click', () => {[cite: 1]
    localStorage.clear();[cite: 1]
    window.location.href = 'index.html';[cite: 1]
});[cite: 1]

document.getElementById('backBtn').addEventListener('click', () => {[cite: 1]
    window.location.href = 'admin-main.html';[cite: 1]
});[cite: 1]
