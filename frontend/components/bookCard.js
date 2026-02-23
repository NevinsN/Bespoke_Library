export function bookCard(novel) {
    const targetGoal = 50000;
    const currentCount = novel.total_word_count || 0;
    const percent = Math.min((currentCount / targetGoal) * 100, 100).toFixed(0);

    return `
        <div class="book-card" onclick="window.location.search = '?book=${novel._id}'" style="cursor: pointer; margin-bottom: 20px;">
            <div style="padding: 20px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333;">
                <span style="font-size: 1.25em; font-weight: bold; color: #3498db; display: block; margin-bottom: 10px;">
                    ${novel.display_name}
                </span>
                <div class="goal-container" style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div class="goal-fill" style="width: ${percent}%; background: #3498db; height: 100%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <span style="font-size: 11px; color: #888;">${currentCount.toLocaleString()} / ${targetGoal.toLocaleString()} WORDS</span>
                    <span style="font-size: 11px; color: #2ecc71;">${percent}%</span>
                </div>
            </div>
        </div>
    `;
}