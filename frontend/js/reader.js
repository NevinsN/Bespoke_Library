import { apiFetch, getRole } from './api.js';

// Progress bar logic
window.onscroll = function() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    const bar = document.getElementById("progress-bar");
    if (bar) bar.style.width = scrolled + "%";
};

async function loadChapter() {
    // Set up the mode button in the reader header
    const btn = document.getElementById('mode-toggle');
    if (btn) {
        btn.innerText = `Mode: ${getRole()}`;
        btn.onclick = () => {
            const next = (getRole() === 'reader' ? 'author' : 'reader');
            localStorage.setItem('view_as_role', next);
            location.reload(); // Reload reader to apply author styles if needed
        };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('id');

    try {
        const result = await apiFetch(`/api/GetChapterContent?id=${chapterId}`);
        const data = result.data;

        // Navigation
        const prevLink = document.getElementById('prev-link');
        const nextLink = document.getElementById('next-link');

        if (data.prev_id) {
            prevLink.href = `/reader.html?id=${data.prev_id}`;
            prevLink.style.visibility = 'visible';
        }
        if (data.next_id) {
            nextLink.href = `/reader.html?id=${data.next_id}`;
            nextLink.style.visibility = 'visible';
        }

        // Content
        document.title = `${data.title} | Bespoke Library`;
        document.getElementById('chapter-title').innerText = data.title;
        document.getElementById('chapter-content').innerHTML = data.content;
        
        if (getRole() === 'author') {
            document.body.classList.add('author-mode');
        }

    } catch (err) {
        document.getElementById('chapter-title').innerText = "Error";
        document.getElementById('chapter-content').innerHTML = "<p>Access denied or content not found.</p>";
    }
}

loadChapter();
