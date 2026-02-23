import { apiFetch } from './api.js';

export async function initAuthorStudio() {
    const container = document.getElementById('author-studio-container');
    if (!container) return;

    container.innerHTML = `
        <div id="author-studio" class="author-card">
            <h3 style="color: var(--accent-color); margin-top:0;">Author Studio</h3>
            
            <div id="project-step">
                <label>Select or Search Project</label>
                <input type="text" id="project-search" placeholder="Type to filter..." class="studio-input">
                <div id="project-list" class="scroll-list">
                    <div class="project-item" data-id="NEW" style="color:var(--accent-color); font-weight:bold;">+ Create New Project...</div>
                </div>
                
                <div id="meta-editor" style="display:none; margin-top:15px; padding:15px; background: rgba(255,255,255,0.05); border-radius:8px;">
                    <label>Word Count Goal</label>
                    <input type="number" id="goal-input" class="studio-input">
                    <button id="save-meta-btn" class="studio-btn small">Update Goal</button>
                </div>
            </div>

            <div id="upload-step" style="display:none; margin-top:20px; border-top:1px solid #333; padding-top:20px;">
                <div style="margin-bottom:10px;">
                    <label style="margin-right:15px;"><input type="radio" name="up-type" value="single" checked onclick="renderFilePreview()"> Individual Chapters</label>
                    <label><input type="radio" name="up-type" value="full" onclick="renderFilePreview()"> Full Manuscript</label>
                </div>
                <input type="file" id="studio-file" multiple class="studio-input" onchange="renderFilePreview()">
                <div id="slot-preview" class="scroll-list" style="display:none; padding:10px;"></div>
                
                <div style="margin: 15px 0;">
                    <label style="margin-right:15px;"><input type="radio" name="pub-status" value="true" checked> Publish</label>
                    <label><input type="radio" name="pub-status" value="false"> Keep as Draft</label>
                </div>
                <button id="studio-upload-btn" class="studio-btn">Sync to Library</button>
            </div>
        </div>
    `;

    setupLogic();
}

async function setupLogic() {
    const list = document.getElementById('project-list');
    const { data: novels } = await apiFetch('/api/GetNovels');

    const render = (filter = "") => {
        const filtered = novels.filter(n => n.display_name.toLowerCase().includes(filter.toLowerCase()));
        list.innerHTML = `<div class="project-item" data-id="NEW" style="color:var(--accent-color); font-weight:bold;">+ Create New Project...</div>` +
            filtered.map(n => `<div class="project-item" data-id="${n._id}" data-goal="${n.target_goal || 50000}">${n.display_name}</div>`).join('');
    };

    document.getElementById('project-search').oninput = (e) => render(e.target.value);
    
    list.onclick = async (e) => {
        const item = e.target.closest('.project-item');
        if (!item) return;

        if (item.dataset.id === "NEW") {
            const series = prompt("Series Name:");
            const book = prompt("Book Name:");
            const draft = prompt("Draft Name:");
            if (series && book && draft) {
                const res = await fetch('/api/CreateProject', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ series, book, draft })
                });
                if (res.ok) location.reload();
            }
            return;
        }

        document.querySelectorAll('.project-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        document.getElementById('meta-editor').style.display = 'block';
        document.getElementById('upload-step').style.display = 'block';
        document.getElementById('goal-input').value = item.dataset.goal;
    };

    // Meta Update Button
    document.getElementById('save-meta-btn').onclick = async () => {
        const id = document.querySelector('.project-item.selected').dataset.id;
        const goal = document.getElementById('goal-input').value;
        const res = await fetch('/api/UpdateNovelMeta', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id, target_goal: goal })
        });
        if (res.ok) alert("Goal Updated!");
    };

    // Final Upload Button
    document.getElementById('studio-upload-btn').onclick = handleStudioUpload;
}

window.renderFilePreview = function() {
    const files = document.getElementById('studio-file').files;
    const preview = document.getElementById('slot-preview');
    const isFull = document.querySelector('input[name="up-type"]:checked').value === 'full';
    
    if (isFull || files.length === 0) { preview.style.display = 'none'; return; }
    
    preview.style.display = 'block';
    preview.innerHTML = '<strong>Assign Slots:</strong>';
    Array.from(files).forEach((file, i) => {
        const match = file.name.match(/^(\d+)/);
        const def = match ? match[1] : i;
        preview.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.8em;">
                <span>${file.name}</span>
                <select class="slot-pick" data-name="${file.name}">
                    ${Array.from({length:51}, (_,v) => `<option value="${v}" ${v==def?'selected':''}>Slot ${v}</option>`).join('')}
                </select>
            </div>`;
    });
}

async function handleStudioUpload() {
    const files = document.getElementById('studio-file').files;
    const man_id = document.querySelector('.project-item.selected').dataset.id;
    const isFull = document.querySelector('input[name="up-type"]:checked').value === 'full';
    const published = document.querySelector('input[name="pub-status"]:checked').value;

    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('manuscript_id', man_id);
        formData.append('upload_type', isFull ? 'full' : 'single');
        formData.append('published', published);
        
        if (!isFull) {
            const slot = document.querySelector(`.slot-pick[data-name="${file.name}"]`).value;
            formData.append('order', slot);
        }

        await fetch('/api/UploadDraft', { method: 'POST', body: formData });
    }
    alert("Sync Complete!");
    location.reload();
}
