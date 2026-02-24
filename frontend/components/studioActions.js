// studioActions.js
// Retained for any inline upload button usage outside the studio view.

export function uploadButton(draftId, label = '↑ Upload Chapters') {
    const btn = document.createElement('button');
    btn.className = 'studio-btn small';
    btn.textContent = label;
    btn.onclick = () => {
        import('../views/authorStudioView.js').then(mod => mod.renderAuthorStudio());
    };
    return btn;
}
