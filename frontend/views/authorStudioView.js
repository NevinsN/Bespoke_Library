// frontend/views/authorStudioView.js
import { getNovels } from '../services/novelService.js';

const containerId = 'main-content';

export async function renderAuthorStudio() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const title = document.createElement('h1');
  title.textContent = 'Author Studio';
  container.appendChild(title);

  const novels = await getNovels();

  novels.forEach(novel => {
    const el = document.createElement('div');
    el.textContent = novel.display_name;
    el.className = 'studio-item';

    // Future: edit click
    container.appendChild(el);
  });

  // ➕ New project button
  const newBtn = document.createElement('button');
  newBtn.textContent = 'New Project';
  newBtn.className = 'studio-btn';
  newBtn.onclick = () => {
    console.log('Create new project');
    // Could open modal to enter series/book/draft info
  };
  container.appendChild(newBtn);

  // ➕ Upload files section
  const uploadInput = document.createElement('input');
  uploadInput.type = 'file';
  uploadInput.multiple = true;
  uploadInput.className = 'studio-input';
  container.appendChild(uploadInput);

  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = 'Upload Chapters';
  uploadBtn.className = 'studio-btn';
  container.appendChild(uploadBtn);

  uploadBtn.onclick = async () => {
    const files = Array.from(uploadInput.files);
    if (!files.length) return alert('Select files to upload');

    // FormData for backend
    const formData = new FormData();
    const manuscriptId = prompt('Enter the manuscript ID for this upload:');
    formData.append('manuscript_id', manuscriptId);
    formData.append('mode', 'sequential'); // Could let user choose sequential/non-sequential

    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch('/api/UploadChapters', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      const data = await res.json();
      console.log('Upload result:', data);

      // --- Dispatch event to refresh bookshelf ---
      document.dispatchEvent(new CustomEvent('chaptersUploaded', {
        detail: { manuscript_id: manuscriptId }
      }));

      alert('Upload successful! Check the bookshelf for new chapters.');
    } catch (err) {
      console.error(err);
      alert('Upload failed. See console for details.');
    }
  };
}