import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set(); // 중복 스캔 방지용

document.addEventListener("DOMContentLoaded", () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanError);
});

// 효과음 함수
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

// 진동 함수
function triggerVibration() {
    if (navigator.vibrate) navigator.vibrate(200); 
}

// QR 스캔 메인 로직
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

        // 💡 디버깅: 스캔된 정보 확인
        console.log("=== 스캔 진행 ===");
        console.log("1. 사용자 아이디:", userId, "선택음료:", drinkName);

        // --- [순서 1] 직원 정보 확인 ---
        const { data: empData, error: empReadErr } = await supabase
            .from('employees')
            .select('총주문량, 주문가능량')
            .eq('아이디', userId)
            .single();
            
        if (empReadErr) throw new Error("직원 정보 조회 실패");

        // 🔥 강제로 숫자로 변환 (문자열 결합 방지)
        const currentAvailable = Number(empData.주문가능량 || 0); 
        const currentTotal = Number(empData.총주문량 || 0);
        console.log("2. 현재 상태 - 주문가능량:", currentAvailable, "총주문량:", currentTotal);

        if (currentAvailable < 1) throw new Error(`${userName}님은 주문가능량이 없습니다.`);

        // --- [순서 2] 음료 정보 확인 ---
        const { data: drinkData, error: drinkReadErr } = await supabase
            .from('drink')
            .select('잔여수량')
            .eq('음료선택', drinkName)
            .single();
            
        if (drinkReadErr) throw new Error("음료 재고 조회 실패");

        const currentRemain = Number(drinkData.잔여수량 || 0);
        console.log("3. 남은 음료 재고:", currentRemain);

        if (currentRemain < 1) throw new Error(`${drinkName} 재고가 없습니다!`);

        // --- [순서 3] DB에 3연속 업데이트 ---
        const { error: insertErr } = await supabase.from('data_stack').insert([
            { 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }
        ]);
        if (insertErr) throw new Error("기록 저장 실패");

        // 🔥 컬럼명을 따옴표로 감싸서 정확히 매칭시킵니다.
        const { error: empUpdateErr } = await supabase.from('employees').update({ 
            '총주문량': currentTotal + 1, 
            '주문가능량': currentAvailable - 1 
        }).eq('아이디', userId);
        if (empUpdateErr) throw new Error("직원 수량 수정 실패");

        const { error: drinkUpdateErr } = await supabase.from('drink').update({ 
            '잔여수량': currentRemain - 1 
        }).eq('음료선택', drinkName);
        if (drinkUpdateErr) throw new Error("음료 재고 수정 실패");

        // 성공 처리
        scannedTokens.add(uniqueToken); 
        playBeep(true);        
        triggerVibration();    

        msgBox.innerText = `✅ [성공] ${userName}님\n${drinkName} 주문 완료\n(남은 가능량: ${currentAvailable - 1}개)`;
        msgBox.style.color = "#155724"; 
        document.body.style.backgroundColor = "#d4edda"; 
        console.log("4. 업데이트 성공!");

    } catch (error) {
        console.error("에러 발생:", error.message);
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

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});
// 메인 화면으로 돌아가기
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'admin-main.html';
});