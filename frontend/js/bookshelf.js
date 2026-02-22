import { apiFetch, getRole } from './api.js';

async function init() {
    const btn = document.getElementById('mode-toggle');
    if (btn) {
        btn.innerText = `Mode: ${getRole()}`;
        btn.onclick = () => {
            const current = getRole();
            const next = current === 'reader' ? 'author' : 'reader';
            localStorage.setItem('view_as_role', next);
            btn.innerText = `Mode: ${next}`;
        };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');

    if (!bookId) {
        document.getElementById('books-list-view').style.display = 'block';
        await loadBookshelf();
    } else {
        document.getElementById('chapter-view').style.display = 'block';
        await loadChapters(bookId);
    }
}

async function loadBookshelf() {
    const list = document.getElementById('books-list');
    const targetGoal = 50000;

    try {
        const result = await apiFetch('/api/GetNovels');
        const novels = result.data;
        list.innerHTML = '';

        novels.forEach(novel => {
            const currentCount = novel.total_word_count || 0;
            const percent = Math.min((currentCount / targetGoal) * 100, 100).toFixed(0);

            // Clean naming logic: Series: Title (Draft)
            const parts = novel.display_name.split(' - ');
            let displayLink = novel.display_name;
            if (parts.length >= 2) {
                const series = parts[0].trim();
                const title = parts[1].trim();
                const draft = parts[2] ? ` (${parts[2].trim()})` : '';
                displayLink = `${series}: ${title}${draft}`;
            }

            const item = document.createElement('div');
            item.className = "book-card"; 
            item.innerHTML = `
                <a href="/?book=${novel._id}">${displayLink}</a>
                <div class="goal-container"><div class="goal-fill" style="width: ${percent}%;"></div></div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px;">
                    <span style="color: #888;">${currentCount.toLocaleString()} / ${targetGoal.toLocaleString()} WORDS</span>
                    <span style="color: #2ecc71;">${percent}%</span>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        list.innerHTML = `<p>Error connecting to library.</p>`;
    }
}

async function loadChapters(bookId) {
    try {
        const result = await apiFetch(`/api/GetChapters?manuscript_id=${bookId}`);
        const chapters = result.data;
        const list = document.getElementById('chapter-list');
        
        let totalWords = 0;
        list.innerHTML = chapters.map(ch => {
            totalWords += (ch.word_count || 0);
            return `
                <li>
                    <a class="chapter-link" href="/reader.html?id=${ch._id}">${ch.title}</a>
                    <div class="ch-metadata">${ch.word_count.toLocaleString()} words</div>
                </li>
            `;
        }).join('');

        document.getElementById('total-words').innerText = `${totalWords.toLocaleString()} words`;
        if (chapters.length > 0) {
            document.getElementById('series-title').innerText = chapters[0].manuscript_display_name;
        }
    } catch (err) {
        list.innerHTML = "<li>Error loading chapters.</li>";
    }
}

init();
