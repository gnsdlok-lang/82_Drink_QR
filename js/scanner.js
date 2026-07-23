import { supabase } from './supabase.js';

let isProcessing = false; 
const scannedTokens = new Set(); // 중복 스캔 방지 바구니

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
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15); 
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, ctx.currentTime); 
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.3); 
        }
    } catch (error) {
        console.warn("오디오 지원 안됨");
    }
}

// 진동 함수
function triggerVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(200); 
    }
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

        // 1. 중복 및 시간 검증
        const uniqueToken = `${userId}_${qrTime}`; 
        if (scannedTokens.has(uniqueToken)) throw new Error("이미 처리된 QR코드입니다. (중복)");
        
        const currentTime = new Date().getTime();
        if (currentTime - qrTime > 30000) throw new Error("유효시간(30초)이 지난 QR코드입니다.");

        // --- 💡 [순서 1] DB 읽기 및 조건 검증 ---
        
        // 직원 데이터 가져오기 (띄어쓰기 없앰!)
        const { data: empData, error: empReadErr } = await supabase
            .from('employees')
            .select('총주문량, 주문가능량')
            .eq('아이디', userId)
            .single();
            
        if (empReadErr) throw new Error("직원 정보 조회 실패");

        let currentAvailable = empData.주문가능량 || 0; 
        let currentTotal = empData.총주문량 || 0;

        if (currentAvailable < 1) {
            throw new Error(`${userName}님은 더 이상 주문할 수 없습니다. (가능량 소진)`);
        }

        // 음료 데이터 가져오기
        const { data: drinkData, error: drinkReadErr } = await supabase
            .from('drink')
            .select('잔여수량')
            .eq('음료선택', drinkName)
            .single();
            
        if (drinkReadErr) throw new Error("음료 재고 조회 실패");

        let currentRemain = drinkData.잔여수량 || 0;
        if (currentRemain < 1) {
            throw new Error(`${drinkName} 재고가 0개입니다!`);
        }

        // --- 💡 [순서 2] DB 쓰기 및 수정 (실행) ---

        const { error: insertErr } = await supabase
            .from('data_stack')
            .insert([{ 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }]);
        if (insertErr) throw new Error("데이터 저장 실패");

        const { error: empUpdateErr } = await supabase
            .from('employees')
            .update({ 총주문량: currentTotal + 1, 주문가능량: currentAvailable - 1 })
            .eq('아이디', userId);
        if (empUpdateErr) throw new Error("직원 수량 갱신 실패");

        const { error: drinkUpdateErr } = await supabase
            .from('drink')
            .update({ 잔여수량: currentRemain - 1 })
            .eq('음료선택', drinkName);
        if (drinkUpdateErr) throw new Error("음료 재고 갱신 실패");

        // 💡 성공 처리 완료
        scannedTokens.add(uniqueToken); 
        playBeep(true);        
        triggerVibration();    

        msgBox.innerText = `✅ [성공] ${userName}님\n${drinkName} 주문 완료 (남은수량: ${currentAvailable - 1}개)`;
        msgBox.style.color = "#155724"; 
        document.body.style.backgroundColor = "#d4edda"; 

    } catch (error) {
        // 💡 실패 처리 완료
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