/**
 * markdown.js
 * Loads marked.js from CDN and renders markdown to HTML.
 * Includes a footnote preprocessor since marked 9.x doesn't support [^1] natively.
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
  window.marked.setOptions({
    breaks: true,
    gfm:    true,
  });
  _marked = window.marked;
  return _marked;
}

/**
 * Pre-process markdown footnotes before passing to marked.
 * Converts [^1] references → <sup><a href="#fn-1" id="fnref-1">1</a></sup>
 * Converts [^1]: definition lines → a <section class="footnotes"> block
 */
function preprocessFootnotes(md) {
  const definitions = {};

  // Extract footnote definitions: [^1]: text (possibly multiline via indented continuation)
  const defPattern = /^\[\^([^\]]+)\]:\s*(.+?)(?=\n\[\^|\n\n|\n$|$)/gms;
  let match;
  while ((match = defPattern.exec(md)) !== null) {
    definitions[match[1]] = match[2].trim();
  }

  if (Object.keys(definitions).length === 0) return md;

  // Remove definition lines from body
  let body = md.replace(/^\[\^([^\]]+)\]:.+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

  // Replace inline references [^1] → superscript links
  body = body.replace(/\[\^([^\]]+)\]/g, (_, key) => {
    const id = key.replace(/\s+/g, '-');
    return `<sup><a href="#fn-${id}" id="fnref-${id}" class="footnote-ref">${key}</a></sup>`;
  });

  // Build footnotes section
  const fnItems = Object.entries(definitions).map(([key, text]) => {
    const id = key.replace(/\s+/g, '-');
    return `<li id="fn-${id}"><p>${text} <a href="#fnref-${id}" class="footnote-backref">↩</a></p></li>`;
  }).join('\n');

  const fnSection = `\n\n<section class="footnotes">\n<hr>\n<ol>\n${fnItems}\n</ol>\n</section>`;

  return body + fnSection;
}

/**
 * Render a markdown string to HTML.
 */
export async function renderMarkdown(mdText) {
  try {
    const marked = await getMarked();
    const processed = preprocessFootnotes(mdText || '');
    return marked.parse(processed);
  } catch (err) {
    console.warn('Markdown rendering unavailable, displaying plain text.', err);
    return (mdText || '')
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
}
