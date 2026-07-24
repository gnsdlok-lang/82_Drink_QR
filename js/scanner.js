import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set();
let isFlipped = false; // 💡 거울 모드 상태 기억

document.addEventListener("DOMContentLoaded", () => {
    // 💡 가장 안정적이었던 이전 자동 스캐너 모드로 복구
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanError);
});

// 💡 좌우 반전(거울 모드) 기능 (화면만 뒤집기)
const flipBtn = document.getElementById('flipCameraBtn');
if (flipBtn) {
    flipBtn.addEventListener('click', () => {
        const videoElement = document.querySelector('#reader video');
        if (videoElement) {
            isFlipped = !isFlipped;
            videoElement.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
        } else {
            alert("카메라가 완전히 켜진 후에 눌러주세요.");
        }
    });
}

function playBeep(isSuccess) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        if (isSuccess) {
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.15); 
        } else {
            osc.type = 'square'; osc.frequency.setValueAtTime(300, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); 
        }
    } catch (e) {}
}

function triggerVibration() {
    if (navigator.vibrate) navigator.vibrate(200); 
}

async function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; 

    const msgBox = document.getElementById('resultMessage');
    document.body.style.transition = "background-color 0.3s";
    document.body.style.backgroundColor = "#fff9e6";
    msgBox.innerText = "데이터 확인 중...";
    msgBox.style.color = "#ff9800"; 

    try {
        const decodedString = decodeURIComponent(decodedText);
        const qrData = JSON.parse(decodedString);
        
        const userName = qrData.n;
        const userBirth = qrData.b;
        const userId = qrData.i;
        const drinkName = qrData.d;
        const qrTime = qrData.t;

        const uniqueToken = `${userId}_${qrTime}`; 
        if (scannedTokens.has(uniqueToken)) throw new Error("이미 처리된 QR코드입니다. (중복)");
        
        const currentTime = new Date().getTime();
        if (currentTime - qrTime > 30000) throw new Error("유효시간(30초)이 지난 QR코드입니다.");

        const { data: empData, error: empReadErr } = await supabase
            .from('employees')
            .select('총주문량, 주문가능량')
            .eq('아이디', userId)
            .single();
            
        if (empReadErr) throw new Error("직원 정보 조회 실패");

        const currentAvailable = Number(empData.주문가능량 || 0); 
        const currentTotal = Number(empData.총주문량 || 0);

        if (currentAvailable < 1) throw new Error(`${userName}님은 주문가능량이 없습니다.`);

        const { data: drinkData, error: drinkReadErr } = await supabase
            .from('drink')
            .select('잔여수량')
            .eq('음료선택', drinkName)
            .single();
            
        if (drinkReadErr) throw new Error("음료 재고 조회 실패");

        const currentRemain = Number(drinkData.잔여수량 || 0);

        if (currentRemain < 1) throw new Error(`${drinkName} 재고가 없습니다!`);

        const { error: insertErr } = await supabase.from('data_stack').insert([
            { 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }
        ]);
        if (insertErr) throw new Error("기록 저장 실패");

        const { error: empUpdateErr } = await supabase.from('employees').update({ 
            '총주문량': currentTotal + 1, 
            '주문가능량': currentAvailable - 1 
        }).eq('아이디', userId);
        if (empUpdateErr) throw new Error("직원 수량 수정 실패");

        const { error: drinkUpdateErr } = await supabase.from('drink').update({ 
            '잔여수량': currentRemain - 1 
        }).eq('음료선택', drinkName);
        if (drinkUpdateErr) throw new Error("음료 재고 수정 실패");

        scannedTokens.add(uniqueToken); 
        playBeep(true);        
        triggerVibration();    

        msgBox.innerText = `✅ [성공] ${userName}님\n${drinkName} 주문 완료\n(남은 가능량: ${currentAvailable - 1}개)`;
        msgBox.style.color = "#155724"; 
        document.body.style.backgroundColor = "#d4edda"; 

    } catch (error) {
        playBeep(false);       
        triggerVibration();    
        msgBox.innerText = `❌ [거절] ${error.message}`;
        msgBox.style.color = "#721c24"; 
        document.body.style.backgroundColor = "#f8d7da";
    }

    setTimeout(() => {
        document.body.style.backgroundColor = "#ffffff";
        msgBox.innerText = "스캔 대기 중...";
        msgBox.style.color = "#0056b3";
        isProcessing = false; 
    }, 3000);
}

function onScanError(errorMessage) {}

// HTML 버튼 이벤트 (오류 없이 안전하게 연결)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'admin-main.html';
    });
}

// =========================================================================
// [안드로이드 기기 뒤로가기 버튼 방어 로직] - 충돌 없도록 수정
// =========================================================================
history.pushState(null, null, location.href);
let backPressedOnce = false;

window.addEventListener('popstate', (event) => {
    if (!backPressedOnce) {
        backPressedOnce = true;
        history.pushState(null, null, location.href);
        
        const toast = document.createElement('div');
        toast.innerText = "종료하시려면 뒤로가기를 한 번 더 누르세요.";
        toast.style.cssText = `
            position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
            border-radius: 20px; font-size: 14px; z-index: 9999;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            backPressedOnce = false;
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 2000);
    } else {
        if (confirm("로그아웃 하시겠습니까?")) {
            localStorage.clear();
            window.location.replace('index.html');
        } else {
            backPressedOnce = false;
            history.pushState(null, null, location.href);
        }
    }
});
