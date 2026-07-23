import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set(); // 💡 중복 스캔 방지용: 처리 완료된 QR의 '사번_시간'을 기억하는 바구니

document.addEventListener("DOMContentLoaded", () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanError);
});

// 💡 삐 소리(효과음)를 만들어내는 함수 (외부 파일 필요 없음)
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
            // 성공: 경쾌하고 높은 삑! 소리
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15); // 0.15초 재생
        } else {
            // 실패: 낮고 둔탁한 띡- 소리
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.3); // 0.3초 재생
        }
    } catch (error) {
        console.warn("오디오 지원 안됨");
    }
}

// 💡 스마트폰 진동 함수
function triggerVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(200); // 0.2초 동안 징~ 울림 (모바일 전용)
    }
}

// QR 스캔 메인 로직
async function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; 

    const msgBox = document.getElementById('resultMessage');
    
    // 시각 효과: 처리 중일 때 노란색 배경
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

        // 💡 1. 중복 스캔 완벽 방지
        const uniqueToken = `${userId}_${qrTime}`; // 예: "15-501206_171092301293"
        if (scannedTokens.has(uniqueToken)) {
            throw new Error("이미 스캔된 QR입니다. (중복 인식)");
        }

        // 2. 시간 검증 (30초 만료)
        const currentTime = new Date().getTime();
        if (currentTime - qrTime > 30000) { 
            throw new Error("유효시간(30초)이 지난 QR코드입니다.");
        }

        // 3. DB 통신 (data_stack 삽입 -> employees 갱신 -> drink 갱신)
        const { error: insertErr } = await supabase.from('data_stack').insert([{ 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }]);
        if (insertErr) throw new Error("데이터 저장 실패");

        const { data: empData } = await supabase.from('employees').select('총주문량').eq('아이디', userId).single();
        await supabase.from('employees').update({ 총주문량: (empData?.총주문량 || 0) + 1 }).eq('아이디', userId);

        const { data: drinkData } = await supabase.from('drink').select('잔여수량').eq('음료선택', drinkName).single();
        if ((drinkData?.잔여수량 || 0) <= 0) throw new Error(`${drinkName} 재고 부족!`);
        await supabase.from('drink').update({ 잔여수량: drinkData.잔여수량 - 1 }).eq('음료선택', drinkName);

        // 💡 성공 처리 완료
        scannedTokens.add(uniqueToken); // 바구니에 토큰 저장 (다음 번엔 막힘)
        playBeep(true);        // 삑! 소리
        triggerVibration();    // 징~ 진동

        msgBox.innerText = `✅ [성공] ${userName}님\n${drinkName} 주문 완료`;
        msgBox.style.color = "#155724"; 
        
        // 시각 효과: 화면 전체 배경을 초록색으로 3초간 변경
        document.body.style.backgroundColor = "#d4edda"; 

    } catch (error) {
        // 💡 실패 처리 완료
        playBeep(false);       // 띡- 에러음
        triggerVibration();    // 징~ 진동

        msgBox.innerText = `❌ [거절] ${error.message}`;
        msgBox.style.color = "#721c24"; 
        
        // 시각 효과: 화면 전체 배경을 빨간색으로 3초간 변경
        document.body.style.backgroundColor = "#f8d7da";
    }

    // 💡 3초 뒤에 원래의 하얀 화면으로 원상복구 및 다음 스캔 준비
    setTimeout(() => {
        document.body.style.backgroundColor = "#ffffff";
        msgBox.innerText = "스캔 대기 중...";
        msgBox.style.color = "#0056b3";
        isProcessing = false; 
    }, 3000);
}

function onScanError(errorMessage) {
    // 백그라운드 노이즈는 무시
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});