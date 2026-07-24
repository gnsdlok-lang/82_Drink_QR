import { supabase } from './supabase.js';

document.addEventListener("DOMContentLoaded", async () => {
    // 1. 관리자 권한 확인
    const userRole = localStorage.getItem('userRole');
    if (userRole != 1) {
        alert("관리자만 접근할 수 있는 페이지입니다.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Supabase에서 data_stack 데이터 가져오기 
    const { data, error } = await supabase
        .from('data_stack')
        .select('*')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return; // 테이블 영역이 없으면 에러 방지

    tbody.innerHTML = ""; // '불러오는 중...' 글자 지우기

    if (error) {
        console.error("데이터 불러오기 에러:", error);
        tbody.innerHTML = `<tr><td colspan="5">데이터를 불러오는데 실패했습니다.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">아직 주문 내역이 없습니다.</td></tr>`;
        return;
    }

    // 3. 가져온 데이터를 한 줄씩 표(Table Row)로 만들기
    data.forEach(row => {
        const tr = document.createElement('tr');

        const dateObj = new Date(row.created_at);
        const timeString = dateObj.toLocaleString('ko-KR'); 

        tr.innerHTML = `
            <td>${timeString}</td>
            <td>${row.성명}</td>
            <td>${row.아이디}</td>
            <td>${row.생년월일}</td>
            <td><strong>${row.주문음료}</strong></td>
        `;
        
        tbody.appendChild(tr);
    });
});

// 버튼 이벤트 (안전장치 추가)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'admin-main.html';
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
