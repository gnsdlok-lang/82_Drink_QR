import { supabase } from './supabase.js';

document.addEventListener("DOMContentLoaded", async () => {
    // 1. 관리자 권한 확인 (localStorage에 저장된 권한이 1인지 확인)
    // 주의: 문자열 '1'로 저장되어 있을 수 있으니 Number로 변환해서 비교하거나 == 를 사용합니다.
    const userRole = localStorage.getItem('userRole');
    if (userRole != 1) {
        alert("관리자만 접근할 수 있는 페이지입니다.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Supabase에서 data_stack 데이터 가져오기 (가장 최근 데이터가 위에 오도록 정렬)
    // created_at은 Supabase가 자동으로 기록하는 생성 시간 컬럼입니다.
    const { data, error } = await supabase
        .from('data_stack')
        .select('*')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('dataTableBody');
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

        // 시간을 보기 좋게 포맷팅 (예: 2026. 7. 23. 오후 11:34)
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

// 로그아웃 로직
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});
// 메인 화면으로 돌아가기
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'admin-main.html';
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
            window.history.pushState(null, null, window.location.href);
        }
    }
});
