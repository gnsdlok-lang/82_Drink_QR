import { supabase } from './supabase.js';

let allDrinks = []; // DB에서 가져온 음료 데이터를 담아둘 바구니
let refreshInterval = null; // 30초 갱신 타이머
let countdownInterval = null; // 1초 카운트다운 타이머

document.addEventListener("DOMContentLoaded", async () => {
    // 1. 로그인 확인 (저장된 정보 꺼내기)
    const userName = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');
    const userBirth = localStorage.getItem('userBirth');

    if (!userName || !userId) {
        alert("로그인이 필요합니다!");
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('displayName').innerText = userName;
    const { data: myData, error: myError } = await supabase
        .from('employees')
        .select('주문가능량')
        .eq('아이디', userId)
        .single();
    
    if (myData) {
        document.getElementById('myAvailableCount').innerText = myData.주문가능량;
    }
    // 2. Supabase에서 'drink' 테이블 데이터 가져와서 목록 만들기
    const { data: drinks, error } = await supabase.from('drink').select('*');
    if (error) {
        console.error("음료 불러오기 에러:", error);
        return;
    }
    
    allDrinks = drinks; // 나중에 수량 찾기 위해 바구니에 저장
    const selectBox = document.getElementById('drinkSelect');
    
    // HTML의 <select> 안에 <option> 태그들을 하나씩 만들어서 넣습니다.
    drinks.forEach(d => {
        const option = document.createElement('option');
        option.value = d.음료선택;
        option.text = d.음료선택;
        selectBox.appendChild(option);
    });

    // 3. 음료를 다른 걸로 바꿀 때마다 잔여 수량 텍스트 업데이트
    selectBox.addEventListener('change', (e) => {
        const selectedDrinkName = e.target.value;
        const selectedDrinkData = allDrinks.find(d => d.음료선택 === selectedDrinkName);
        
        if (selectedDrinkData) {
            document.getElementById('remainCount').innerText = selectedDrinkData.잔여수량;
        } else {
            document.getElementById('remainCount').innerText = "-";
        }
    });
});

// 4. QR 코드 생성 버튼 클릭 로직
document.getElementById('generateBtn').addEventListener('click', () => {
    const selectedDrink = document.getElementById('drinkSelect').value;
    if (!selectedDrink) {
        alert("음료를 먼저 선택해주세요!");
        return;
    }

    // 기존 타이머들이 돌고 있다면 초기화 (버튼 여러번 누름 방지)
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    // QR 최초 1번 생성
    makeDynamicQR(selectedDrink);

    // 이후 30초마다 QR 새로 생성 무한 반복
    refreshInterval = setInterval(() => {
        makeDynamicQR(selectedDrink);
    }, 30000);
});

// 5. QR 코드 생성기 (수정됨)
function makeDynamicQR(drinkName) {
    // 💡 데이터 다이어트: 한글 이름표(Key) 대신 짧은 영문을 써서 QR 밀도를 낮춥니다.
    const qrData = {
        n: localStorage.getItem('userName'),  // 성명 (Name)
        b: localStorage.getItem('userBirth'), // 생년월일 (Birth)
        i: localStorage.getItem('userId'),    // 아이디 (Id)
        d: drinkName,                         // 주문음료 (Drink)
        t: new Date().getTime()               // 생성시간 (Time)
    };
// 정보를 텍스트(JSON)로 변환
    const qrString = encodeURIComponent(JSON.stringify(qrData));

   
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '<canvas id="qrCanvas"></canvas>'; 


    // 새로운 QRious 라이브러리로 그리기
    new QRious({
        element: document.getElementById('qrCanvas'), 
        value: qrString, 
        size: 200,
        level: 'L'
    });


    // 30초 카운트다운 화면에 보여주기
    let timeLeft = 30;
    document.getElementById('timerText').innerText = `남은 시간: ${timeLeft}초 (이후 자동 갱신)`;
    
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timerText').innerText = `남은 시간: ${timeLeft}초 (이후 자동 갱신)`;
        if (timeLeft <= 0) clearInterval(countdownInterval);
    }, 1000);
}

// 로그아웃 로직
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// =========================================================================
// [안드로이드 기기 뒤로가기 버튼 방어 및 더블 탭 종료 로직]
// =========================================================================

// 1. 페이지가 켜지자마자 가짜 히스토리를 하나 밀어넣어서 뒤로가기를 막을 준비를 합니다.
window.history.pushState(null, null, window.location.href);

let backPressedOnce = false;

window.addEventListener('popstate', function(event) {
    if (!backPressedOnce) {
        // 첫 번째 뒤로가기 누름
        backPressedOnce = true;
        
        // 다시 가짜 히스토리를 밀어넣어서 뒤로 안가게 한 번 더 막음
        window.history.pushState(null, null, window.location.href);

        // 안드로이드 토스트(안내문) 띄우기
        const toast = document.createElement('div');
        toast.innerText = "뒤로가기를 한 번 더 누르면 종료됩니다.";
        toast.style.cssText = `
            position: fixed; 
            bottom: 50px; 
            left: 50%; 
            transform: translateX(-50%); 
            background: rgba(0, 0, 0, 0.7); 
            color: white; 
            padding: 12px 24px; 
            border-radius: 20px; 
            font-size: 14px; 
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
        
        // 2초 뒤에 '한 번 누름' 상태와 토스트 메시지 초기화
        setTimeout(() => {
            backPressedOnce = false;
            if (document.body.contains(toast)) toast.remove();
        }, 2000);

    } else {
        // 2초 안에 두 번째 뒤로가기 누름 -> 종료 의사 확인
        if (confirm("종료(로그아웃) 하시겠습니까?")) {
            // 확인 시: 데이터 지우고 첫 화면으로
            localStorage.clear();
            window.location.href = 'index.html';
        } else {
            // 취소 시: 다시 뒤로가기 방어태세 돌입
            backPressedOnce = false;
            window.history.pushState(null, null, window.location.href);
        }
    }
});
