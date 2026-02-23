export function chapterItem(ch) {
    const words = ch.word_count || 0;
    const readTime = Math.ceil(words / 225) || 1;
    
    let badge = "";
    if (ch.date_added) {
        const added = new Date(ch.date_added);
        if ((new Date() - added) < (48 * 60 * 60 * 1000)) {
            badge = '<span class="badge-new" style="background:#2ecc71; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px;">New</span>';
        }
    }

    return `
        <li style="margin-bottom: 15px; list-style: none;">
            <a href="/?id=${ch._id}" style="color: #3498db; text-decoration: none; font-size: 1.1em; font-weight: 500;">
                ${ch.title}${badge}
            </a>
            <div style="color: #666; font-size: 0.85em; margin-top: 4px;">
                ${words.toLocaleString()} words • ${readTime} min read
            </div>
        </li>
    `;
}