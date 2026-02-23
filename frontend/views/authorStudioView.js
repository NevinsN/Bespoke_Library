import { getNovels } from '../services/novelService.js';
import { uploadFiles } from '../services/authorService.js';

const containerId = 'main-content';

export async function renderAuthorStudio() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // --- Header ---
  const title = document.createElement('h1');
  title.textContent = 'Author Studio';
  container.appendChild(title);

  // --- Upload Mode ---
  const modeContainer = document.createElement('div');
  modeContainer.className = 'upload-mode';
  modeContainer.innerHTML = `
    <label><input type="radio" name="uploadMode" value="sequential" checked> Sequential Upload</label>
    <label><input type="radio" name="uploadMode" value="manual"> Manual Slot Assignment</label>
  `;
  container.appendChild(modeContainer);

  // --- File Input ---
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  container.appendChild(fileInput);

  // --- Files Preview Area ---
  const preview = document.createElement('div');
  preview.id = 'file-preview';
  container.appendChild(preview);

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    preview.innerHTML = '';

    files.forEach((file, index) => {
      const fileDiv = document.createElement('div');
      fileDiv.className = 'file-item';
      fileDiv.innerHTML = `
        <span>${file.name}</span>
        <select class="chapter-slot">
          ${[...Array(31).keys()].map(i => `<option value="${i}">${i}</option>`).join('')}
        </select>
      `;
      preview.appendChild(fileDiv);
    });
  });

  // --- Submit Button ---
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Upload Files';
  submitBtn.onclick = async () => {
    const mode = document.querySelector('input[name="uploadMode"]:checked').value;
    const filesData = Array.from(preview.querySelectorAll('.file-item')).map(div => {
      return {
        name: div.querySelector('span').textContent,
        slot: div.querySelector('select').value
      };
    });

    try {
      await uploadFiles(filesData, mode);
      alert('Files uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    }
  };
  container.appendChild(submitBtn);
}