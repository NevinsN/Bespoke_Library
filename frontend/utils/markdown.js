/**
 * markdown.js
 * Loads marked.js from CDN on demand and renders markdown to HTML.
 * Cached after first load — subsequent calls are synchronous.
 */

let _marked = null;

async function getMarked() {
  if (_marked) return _marked;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load marked.js'));
    document.head.appendChild(s);
  });
  // Configure once
  window.marked.setOptions({
    breaks: true,    // single newline → <br> (natural for prose)
    gfm:    true,    // github flavoured markdown
  });
  _marked = window.marked;
  return _marked;
}

/**
 * Render a markdown string to an HTML string.
 * Falls back to plain text wrapped in <p> tags if marked fails to load.
 */
export async function renderMarkdown(mdText) {
  try {
    const marked = await getMarked();
    return marked.parse(mdText || '');
  } catch (err) {
    console.warn('Markdown rendering unavailable, displaying plain text.', err);
    // Graceful fallback — wrap paragraphs manually
    return (mdText || '')
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
}
