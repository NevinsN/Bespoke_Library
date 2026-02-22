import { apiFetch, getRole } from './api.js';

async function loadChapter() {
    const btn = document.getElementById('mode-toggle');
    btn.innerText = `Mode: ${getRole()}`;
    btn.onclick = () => {
        localStorage.setItem('view_as_role', getRole() === 'reader' ? 'author' : 'reader');
        location.reload();
    };

    const id = new URLSearchParams(window.location.search).get('id');
    try {
        const result = await apiFetch(`/api/GetChapterContent?id=${id}`);
        const data = result.data;
        document.getElementById('chapter-title').innerText = data.title;
        document.getElementById('chapter-content').innerHTML = data.content;
        
        const prev = document.getElementById('prev-link');
        const next = document.getElementById('next-link');
        if (data.prev_id) { prev.href = `/reader.html?id=${data.prev_id}`; prev.style.visibility = 'visible'; }
        if (data.next_id) { next.href = `/reader.html?id=${data.next_id}`; next.style.visibility = 'visible'; }
    } catch (err) { console.error(err); }
}

loadChapter();
