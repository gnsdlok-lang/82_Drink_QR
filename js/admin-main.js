document.addEventListener("DOMContentLoaded", () => {
    // 1. 권한 검증: 관리자(권한 1)가 아니면 쫓아내기
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');

    // == 를 사용하여 숫자 1이든 문자 '1'이든 통과하게 처리
    if (userRole != 1) { 
        alert("관리자만 접근할 수 있는 페이지입니다.");
        window.location.href = 'index.html';
        return;
    }

    // 이름 표시
    document.getElementById('adminName').innerText = userName;
});

// 2. 메뉴 이동 버튼 기능
document.getElementById('btnScanner').addEventListener('click', () => {
    window.location.href = 'admin-scanner.html';
});

document.getElementById('btnDashboard').addEventListener('click', () => {
    window.location.href = 'admin-dashboard.html';
});

// 3. 로그아웃 로직
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});