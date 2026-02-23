import { apiFetch, getRole } from './api.js';

async function init() {
    const role = getRole();

    // 1. If Author, load the Studio Module
    if (role === 'author') {
        try {
            const { initAuthorStudio } = await import('./author-studio.js');
            initAuthorStudio();
        } catch (err) {
            console.error("Failed to load Author Studio:", err);
        }
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
    const role = getRole();

    try {
        const result = await apiFetch('/api/GetNovels');
        const novels = result.data;
        list.innerHTML = '';

        // 1. Grouping Logic (Series > Book > Draft)
        const groups = {};
        novels.forEach(novel => {
            const s = novel.series || "Standalone";
            const b = novel.book || "Novel";
            const d = novel.draft || "Current Draft";
            
            if (!groups[s]) groups[s] = {};
            if (!groups[s][b]) groups[s][b] = [];
            groups[s][b].push({ ...novel, d });
        });

        // 2. Render Hierarchy
        for (const [series, books] of Object.entries(groups)) {
            const sDiv = document.createElement('div');
            sDiv.className = 'series-container';
            sDiv.innerHTML = `<div class="series-title">${series}</div>`;

            for (const [book, drafts] of Object.entries(books)) {
                sDiv.innerHTML += `<div class="book-group-header">${book}</div>`;
                
                drafts.forEach(n => {
                    // Only show to readers if published. Authors see everything.
                    if (role !== 'author' && n.published === false) return;

                    const count = n.total_word_count || 0;
                    const readTime = Math.ceil(count / 225);
                    const targetGoal = n.target_goal || 50000;
                    const percent = Math.min((count / targetGoal) * 100, 100).toFixed(0);
                    const isDone = count >= targetGoal;

                    sDiv.innerHTML += `
                        <div class="book-card ${n.published === false ? 'draft-mode' : ''}">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <a href="/?book=${n._id}">${n.d}</a>
                                <span class="status-badge ${isDone ? 'status-complete' : 'status-progress'}">
                                    ${n.published === false ? 'DRAFT' : (isDone ? 'Completed' : 'In Progress')}
                                </span>
                            </div>
                            <div class="goal-container"><div class="goal-fill" style="width:${percent}%"></div></div>
                            <div style="display:flex; justify-content:space-between; font-size:11px; color:#888;">
                                <span>${count.toLocaleString()} words | ${readTime} min read</span>
                                <span>Goal: ${(targetGoal/1000).toFixed(0)}k (${percent}%)</span>
                            </div>
                        </div>`;
                });
            }
            list.appendChild(sDiv);
        }
    } catch (err) {
        list.innerHTML = `<p>Error loading library.</p>`;
    }
}

async function loadChapters(bookId) {
    const list = document.getElementById('chapter-list');
    const role = getRole();
    try {
        const result = await apiFetch(`/api/GetChapters?manuscript_id=${bookId}`);
        const chapters = result.data;
        let total = 0;
        
        list.innerHTML = chapters
            .filter(ch => role === 'author' || ch.published !== false)
            .map(ch => {
                total += ch.word_count;
                const time = Math.ceil(ch.word_count / 225);
                return `
                <li>
                    <a class="chapter-link" href="/reader.html?id=${ch._id}">${ch.title}</a>
                    <div class="ch-metadata">
                        ${ch.word_count.toLocaleString()} words | ${time} min read
                        ${ch.published === false ? ' <b style="color:#e74c3c">[DRAFT]</b>' : ''}
                    </div>
                </li>`;
            }).join('');

        document.getElementById('total-words').innerText = `${total.toLocaleString()} words`;
    } catch (err) {
        list.innerHTML = `<p>Error loading chapters.</p>`;
    }
}

init();
