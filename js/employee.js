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

    // 새로운 QRious 라이브러리로 그리기
    new QRious({
        element: document.getElementById('qrCanvas'),
        value: qrString, // 이제 한글이 깨지지 않는 안전한 텍스트가 들어갑니다
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