import { supabase } from './supabase.js';

document.getElementById('loginBtn').addEventListener('click', async () => {
    const id = document.getElementById('empId').value;
    const pw = document.getElementById('password').value;

    if (!id || !pw) {
        alert("아이디와 비밀번호를 모두 입력해주세요.");
        return;
    }

    // Supabase의 '신상정보' 테이블(영문명: employees 권장)에서 조회
    // 💡 주의: Supabase에 등록한 실제 테이블 영문 이름으로 'employees' 부분을 바꿔주세요.
    const { data, error } = await supabase
        .from('employees') 
        .select('*')
        // 컬럼명(열 이름)도 DB에 등록하신 영문 컬럼명으로 정확히 일치시켜야 합니다.
        .eq('아이디', id) // DB의 컬럼명이 '아이디'인 경우
        .eq('비밀번호', pw) // DB의 컬럼명이 '비밀번호'인 경우
        .single(); // 일치하는 하나만 가져옴

    if (error || !data) {
        // 일치하는 데이터가 없거나 에러 발생 시
        alert('로그인 실패: 아이디나 비밀번호를 확인해주세요.');
        console.error("로그인 에러:", error);
        return;
    }

    // 로그인 성공 시!
    // 1. 다음 화면에서 이름을 띄우기 위해 브라우저(localStorage)에 성명 저장
    localStorage.setItem('userName', data.성명); 
    // 권한(1, 2)도 저장해두면 나중에 쓸 일이 있습니다.
    localStorage.setItem('userRole', data.권한); 
    localStorage.setItem('userId', data.아이디);
    localStorage.setItem('userBirth', data.생년월일);
    // 2. 권한(3열: int2)에 따라 라우팅
    // 권한이 1(관리자)이라고 가정, 2(직원)이라고 가정
    if (data.권한 === 1) {
        // 일단 지금은 관리자도 qr 발급 화면으로 보내거나 다른 알림창을 띄워둡니다.
        // window.location.href = 'admin-scanner.html'; 
        alert("관리자 계정입니다. 스캐너 화면으로 이동해야 하지만 임시로 QR 화면으로 이동합니다.");
        window.location.href = 'employee-qr.html';
    } else {
        window.location.href = 'employee-qr.html';
    }
});