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

// =========================================================================
// [안드로이드 기기 뒤로가기 버튼 방어 로직] - 충돌 없도록 수정
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
