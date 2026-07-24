import { supabase } from './supabase.js';

let allDrinks = []; // DB에서 가져온 음료 데이터를 담아둘 바구니
let refreshInterval = null; // 30초 갱신 타이머
let countdownInterval = null; // 1초 카운트다운 타이머

document.addEventListener("DOMContentLoaded", async () => {
    // 1. 로그인 확인
    const userName = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');

    if (!userName || !userId) {
        alert("로그인이 필요합니다!");
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('displayName').innerText = userName;

    // 내 남은 수량 가져오기
    const { data: myData, error: myError } = await supabase
        .from('employees')
        .select('주문가능량')
        .eq('아이디', userId)
        .single();
    
    if (myData) {
        document.getElementById('myAvailableCount').innerText = myData.주문가능량;
    }

    // 2. DB에서 'drink' 테이블 데이터 가져오기
    const { data: drinks, error } = await supabase.from('drink').select('*');
    if (error) {
        console.error("음료 불러오기 에러:", error);
        return;
    }
    
    allDrinks = drinks; 
    const selectBox = document.getElementById('drinkSelect');
    
    // 🔥 [수정됨] option의 value에 이름 대신 'number'를 넣습니다!
    drinks.forEach(d => {
        const option = document.createElement('option');
        option.value = d.number; // 서버(DB)와 통신할 때 쓸 고유 번호
        option.text = d.음료선택; // 직원이 화면에서 읽을 한글 이름
        selectBox.appendChild(option);
    });

    // 3. 음료 선택 시 잔여 수량 텍스트 업데이트
    selectBox.addEventListener('change', (e) => {
        const selectedDrinkNumber = e.target.value;
        // value가 숫자 형태이므로 일치하는 number를 찾습니다.
        const selectedDrinkData = allDrinks.find(d => d.number == selectedDrinkNumber);
        
        if (selectedDrinkData) {
            document.getElementById('remainCount').innerText = selectedDrinkData.잔여수량;
        } else {
            document.getElementById('remainCount').innerText = "-";
        }
    });
});

// 4. QR 코드 생성 버튼 클릭 로직
document.getElementById('generateBtn').addEventListener('click', () => {
    const selectedDrinkNumber = document.getElementById('drinkSelect').value;
    
    if (!selectedDrinkNumber) {
        alert("음료를 먼저 선택해주세요!");
        return;
    }

    // 기존 타이머들이 돌고 있다면 겹치지 않게 초기화
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    // 최초 1번 즉시 생성
    makeDynamicQR(selectedDrinkNumber);

    // 이후 30초마다 QR 새로 갱신 무한 반복
    refreshInterval = setInterval(() => {
        makeDynamicQR(selectedDrinkNumber);
    }, 30000);
});

// 5. QR 코드 생성기 (초경량 압축 버전)
function makeDynamicQR(drinkNumber) {
    const userId = localStorage.getItem('userId');
    const qrTime = new Date().getTime(); 
    
    // 🔥 데이터 다이어트: 이름, 생일, JSON 기호 싹 빼고 오직 필수 데이터 3개만 구분자(|)로 연결
    // 예시 출력 결과: "15-501206|1|17234123123"
    const qrString = `${userId}|${drinkNumber}|${qrTime}`;

    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '<canvas id="qrCanvas"></canvas>'; 

    new QRious({
        element: document.getElementById('qrCanvas'), 
        value: qrString, 
        size: 200,
        level: 'L' // 🔥 패턴 단순화 (가장 낮은 복원율 적용)
    });

    // 30초 카운트다운 화면 로직
    let timeLeft = 30;
    const timerText = document.getElementById('timerText');
    
    if (timerText) {
        timerText.innerText = `남은 시간: ${timeLeft}초 (이후 자동 갱신)`;
        
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            timeLeft--;
            timerText.innerText = `남은 시간: ${timeLeft}초 (이후 자동 갱신)`;
            if (timeLeft <= 0) clearInterval(countdownInterval);
        }, 1000);
    }
}

// 6. 안전장치: 로그아웃 로직 (옵셔널 체이닝으로 에러 방지)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// =========================================================================
// [안드로이드 기기 뒤로가기 버튼 방어 로직] 
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
