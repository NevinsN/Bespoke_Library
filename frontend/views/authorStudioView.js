import { getNovels } from '../services/novelService.js';
import { processUpload } from '../services/authorService.js';

// Load JSZip dynamically from CDN
async function getJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.JSZip;
}

const containerId = 'main-content';

export async function renderAuthorStudio() {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const title = document.createElement('h1');
    title.textContent = 'Author Studio';
    container.appendChild(title);

    // Load existing novels/projects
    const novels = await getNovels();
    novels.forEach(novel => {
        const el = document.createElement('div');
        el.textContent = novel.display_name;
        el.className = 'studio-item';
        container.appendChild(el);
    });

    // File upload UI
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.multiple = true;
    uploadInput.accept = '.md,.docx,.zip';
    container.appendChild(uploadInput);

    const modeRadios = document.createElement('div');
    modeRadios.innerHTML = `
        <label><input type="radio" name="uploadMode" value="sequential" checked> Sequential Upload</label>
        <label><input type="radio" name="uploadMode" value="non-sequential"> Non-Sequential Upload</label>
    `;
    container.appendChild(modeRadios);

    const previewContainer = document.createElement('div');
    previewContainer.id = 'upload-preview';
    container.appendChild(previewContainer);

    uploadInput.addEventListener('change', async (event) => {
        previewContainer.innerHTML = '';
        const files = Array.from(event.target.files);
        let previewFiles = [];

        for (const file of files) {
            if (file.name.endsWith('.zip')) {
                // Preview ZIP contents
                const JSZip = await getJSZip();
                const zipData = await file.arrayBuffer();
                const zip = await JSZip.loadAsync(zipData);
                for (const [filename, f] of Object.entries(zip.files)) {
                    if (!f.dir) {
                        previewFiles.push({ filename, content: await f.async('text') });
                    }
                }
            } else if (file.name.endsWith('.md') || file.name.endsWith('.docx')) {
                const text = await file.text();
                previewFiles.push({ filename: file.name, content: text });
            }
        }

        // Render preview
        previewFiles.forEach((f, idx) => {
            const div = document.createElement('div');
            div.textContent = f.filename;
            div.className = 'upload-preview-item';

            // Non-sequential slot selector
            if (document.querySelector('input[name="uploadMode"]:checked').value === 'non-sequential') {
                const slotSelect = document.createElement('select');
                for (let i = 0; i <= 30; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Slot ${i}`;
                    slotSelect.appendChild(option);
                }
                div.appendChild(slotSelect);
                f.slotSelect = slotSelect; // attach for backend use
            }

            previewContainer.appendChild(div);
        });

        // Commit Upload Button
        const commitBtn = document.createElement('button');
        commitBtn.textContent = 'Upload Chapters';
        commitBtn.onclick = async () => {
            const sequential = document.querySelector('input[name="uploadMode"]:checked').value === 'sequential';
            // Map files for backend
            const uploadData = previewFiles.map(f => ({
                filename: f.filename,
                content: f.content,
                slot: f.slotSelect?.value
            }));
            const manuscriptId = prompt("Enter manuscript ID to upload to:");
            const result = await processUpload(manuscriptId, uploadData, sequential);
            console.log(result);
            alert(`Upload complete: ${result.added.length} added, ${result.updated.length} updated`);
            previewContainer.innerHTML = '';
        };
        previewContainer.appendChild(commitBtn);
    });
}