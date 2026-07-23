import { supabase } from './supabase.js';

let isProcessing = false; // 중복 스캔 방지용 자물쇠

document.addEventListener("DOMContentLoaded", () => {
    // 카메라 스캐너 엔진 켜기 (초당 10번 검사, 스캔 영역 크기 250px)
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanError);
});

// QR 코드를 성공적으로 읽었을 때 실행되는 함수
async function onScanSuccess(decodedText, decodedResult) {
    // 1. 중복 인식 방지 (한 번 찍히면 처리 끝날 때까지 무시)
    if (isProcessing) return;
    isProcessing = true; 

    const msgBox = document.getElementById('resultMessage');
    msgBox.innerText = "처리 중입니다...";
    msgBox.style.color = "#ff9800"; // 주황색

    try {
        // 2. QR 데이터 해독 (아까 다이어트했던 알파벳 키 복구)
        const qrData = JSON.parse(decodedText);
        const userName = qrData.n;
        const userBirth = qrData.b;
        const userId = qrData.i;
        const drinkName = qrData.d;
        const qrTime = qrData.t;

        // 3. 시간 검증 (30초가 지났는지 확인)
        const currentTime = new Date().getTime();
        if (currentTime - qrTime > 30000) { // 30,000 밀리초 = 30초
            throw new Error("만료된 QR 코드입니다. 다시 발급받아 주세요.");
        }

        // --- 여기서부터 DB 3연속 업데이트 ---

        // DB 1: data_stack 테이블에 기록 추가 (INSERT)
        const { error: insertErr } = await supabase
            .from('data_stack')
            .insert([{ 성명: userName, 생년월일: userBirth, 아이디: userId, 주문음료: drinkName }]);
        if (insertErr) throw new Error("기록 저장 실패: " + insertErr.message);

        // DB 2: employees 테이블에서 현재 총주문량 확인 후 +1 업데이트
        // (먼저 현재 주문량을 가져옵니다)
        const { data: empData, error: empReadErr } = await supabase
            .from('employees')
            .select('총주문량')
            .eq('아이디', userId)
            .single();
        
        let currentTotal = empData?.총주문량 || 0; // 값이 없으면 0으로 시작
        
        const { error: empUpdateErr } = await supabase
            .from('employees')
            .update({ 총주문량: currentTotal + 1 })
            .eq('아이디', userId);
        if (empUpdateErr) throw new Error("총주문량 갱신 실패");

        // DB 3: drink 테이블에서 잔여수량 확인 후 -1 업데이트
        const { data: drinkData, error: drinkReadErr } = await supabase
            .from('drink')
            .select('잔여수량')
            .eq('음료선택', drinkName)
            .single();

        let currentRemain = drinkData?.잔여수량 || 0;
        if (currentRemain <= 0) {
            throw new Error(`${drinkName} 재고가 부족합니다!`);
        }

        const { error: drinkUpdateErr } = await supabase
            .from('drink')
            .update({ 잔여수량: currentRemain - 1 })
            .eq('음료선택', drinkName);
        if (drinkUpdateErr) throw new Error("잔여수량 차감 실패");

        // 4. 모든 작업 성공 시 화면 출력
        msgBox.innerText = `${userName}님 ${drinkName}를 주문하셨습니다. 감사합니다.`;
        msgBox.style.color = "#28a745"; // 초록색

    } catch (error) {
        // 에러 발생 시 알림 (JSON 파싱 에러, 시간 초과, 재고 부족 등)
        msgBox.innerText = `오류: ${error.message}`;
        msgBox.style.color = "#dc3545"; // 빨간색
    }

    // 5. 다음 사람을 위해 3초 뒤에 카메라 자물쇠 해제
    setTimeout(() => {
        if(msgBox.style.color !== "rgb(220, 53, 69)") { // 에러가 아니었다면 원래 상태로
            msgBox.innerText = "스캔 대기 중...";
            msgBox.style.color = "#0056b3";
        }
        isProcessing = false; 
    }, 3000);
}

// 스캔 중 오류 (흔들림 등) - 화면에 띄우지 않고 조용히 넘깁니다.
function onScanError(errorMessage) {
    // console.warn(errorMessage);
}

// 로그아웃 로직
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});