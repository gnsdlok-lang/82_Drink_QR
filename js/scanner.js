import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set();
let isFlipped = false; 

document.addEventListener("DOMContentLoaded", () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanError);
});

// 좌우 반전(거울 모드) 기능
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
        // 🔥 1. 초경량 QR코드 해독 로직 (구분자로 쪼개기)
        const parts = decodedText.split('|');
        if (parts.length !== 3) throw new Error("유효하지 않은 QR 코드 형식입니다.");
        
        const userId = parts[0];
        const drinkNumber = parts[1];
        const qrTime = parseInt(parts[2], 10);

        const uniqueToken = `${userId}_${qrTime}`; 
        if (scannedTokens.has(uniqueToken)) throw new Error("이미 처리된 QR코드입니다. (중복)");
        
        const currentTime = new Date().getTime();
        if (currentTime - qrTime > 30000) throw new Error("유효시간(30초)이 지난 QR코드입니다.");

        // 🔥 2. 직원 정보 확인 (QR에 없던 이름과 생년월일을 여기서 가져옵니다!)
        const { data: empData, error: empReadErr } = await supabase
            .from('employees')
            .select('성명, 생년월일, 총주문량, 주문가능량')
            .eq('아이디', userId)
            .single();
            
        if (empReadErr) throw new Error("등록되지 않은 직원입니다.");

        const userName = empData.성명;
        const userBirth = empData.생년월일;
        const currentAvailable = Number(empData.주문가능량 || 0); 
        const currentTotal = Number(empData.총주문량 || 0);

        if (currentAvailable < 1) throw new Error(`${userName}님은 주문가능량이 없습니다.`);

        // 🔥 3. 음료 정보 확인 (문자가 아닌 number 로 조회)
        const { data: drinkData, error: drinkReadErr } = await supabase
            .from('drink')
            .select('음료선택, 잔여수량')
            .eq('number', drinkNumber) 
            .single();
            
        if (drinkReadErr) throw new Error("존재하지 않는 음료 번호입니다.");

        const drinkName = drinkData.음료선택;
        const currentRemain = Number(drinkData.잔여수량 || 0);

        if (currentRemain < 1) throw new Error(`${drinkName} 재고가 없습니다!`);

        // --- 4. DB에 3연속 업데이트 ---
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
        }).eq('number', drinkNumber); // 문자 대신 번호로 정확하게 업데이트
        if (drinkUpdateErr) throw new Error("음료 재고 수정 실패");

        // 성공 처리
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
