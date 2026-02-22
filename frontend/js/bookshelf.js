import { apiFetch } from './api.js';

async function init() {
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

        const groups = {};
        novels.forEach(novel => {
            const parts = novel.display_name.split(' - ');
            const series = parts[0]?.trim() || "Standalone";
            const book = parts[1]?.trim() || "Novel";
            const draft = parts[2]?.trim() || "Current Draft";
            
            if (!groups[series]) groups[series] = {};
            if (!groups[series][book]) groups[series][book] = [];
            groups[series][book].push({ ...novel, draft });
        });

        for (const [series, books] of Object.entries(groups)) {
            const sDiv = document.createElement('div');
            sDiv.className = 'series-container';
            sDiv.innerHTML = `<div class="series-title">${series}</div>`;

            for (const [book, drafts] of Object.entries(books)) {
                sDiv.innerHTML += `<div class="book-group-header">${book}</div>`;
                drafts.forEach(novel => {
                    const count = novel.total_word_count || 0;
                    const readTime = Math.ceil(count / 225);
                    const percent = Math.min((count / targetGoal) * 100, 100).toFixed(0);
                    const isDone = count >= targetGoal;

                    sDiv.innerHTML += `
                        <div class="book-card">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <a href="/?book=${novel._id}">${novel.draft}</a>
                                <span class="status-badge ${isDone ? 'status-complete' : 'status-progress'}">${isDone ? 'Completed' : 'In Progress'}</span>
                            </div>
                            <div class="goal-container"><div class="goal-fill" style="width:${percent}%"></div></div>
                            <div style="display:flex; justify-content:space-between; font-size:11px; color:#888;">
                                <span>${count.toLocaleString()} words | ${readTime} min read</span>
                                <span style="color:#2ecc71;">${percent}%</span>
                            </div>
                        </div>`;
                });
            }
            list.appendChild(sDiv);
        }
    } catch (err) { list.innerHTML = "Error loading library."; }
}

async function loadChapters(bookId) {
    const list = document.getElementById('chapter-list');
    try {
        const result = await apiFetch(`/api/GetChapters?manuscript_id=${bookId}`);
        const chapters = result.data;
        let total = 0;
        list.innerHTML = chapters.map(ch => {
            total += ch.word_count;
            const time = Math.ceil(ch.word_count / 225);
            return `<li><a class="chapter-link" href="/reader.html?id=${ch._id}">${ch.title}</a><div class="ch-metadata">${ch.word_count.toLocaleString()} words | ${time} min read</div></li>`;
        }).join('');
        document.getElementById('total-words').innerText = `${total.toLocaleString()} words`;
    } catch (err) { list.innerHTML = "Error loading chapters."; }
}

init();
