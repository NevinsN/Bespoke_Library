import { getChapters } from '../services/novelService.js';

export async function renderChapterList(bookId) {
    const container = document.getElementById('main-content');
    container.innerHTML = `<div class="loading">Loading table of contents...</div>`;

    const chapters = await getChapters(bookId);

    if (!chapters.length) {
        container.innerHTML = `<p>No chapters found for this manuscript.</p>`;
        return;
    }

    let totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);

    let html = `
        <div id="chapter-view">
            <a href="/" class="back-link">← Back to Library</a>
            <h1>${chapters[0].manuscript_display_name}</h1>
            <p>Total Progress: <strong>${totalWords.toLocaleString()} words</strong></p>
            <ul class="chapter-list">
    `;

    chapters.forEach(ch => {
        html += `
            <li>
                <a href="/?id=${ch._id}">${ch.title}</a>
                <span class="ch-metadata">${ch.word_count.toLocaleString()} words</span>
            </li>
        `;
    });

    html += `</ul></div>`;
    container.innerHTML = html;
}