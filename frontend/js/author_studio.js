import { apiFetch } from './api.js';

export async function initAuthorStudio() {
    const container = document.getElementById('author-studio-container');
    if (!container) return;

    // 1. Inject the Studio HTML
    container.innerHTML = `
        <div id="author-studio" class="author-card">
            <h3 style="color: var(--accent-color); margin-top:0;">Author Studio</h3>
            
            <div id="project-step">
                <label>Select or Search Project</label>
                <input type="text" id="project-search" placeholder="Type to filter..." class="studio-input">
                <div id="project-list" class="scroll-list"></div>
                
                <div id="meta-editor" style="display:none; margin-top:15px; padding:15px; background: rgba(255,255,255,0.05); border-radius:8px;">
                    <label>Word Count Goal</label>
                    <input type="number" id="goal-input" class="studio-input" value="50000">
                    <button id="save-meta-btn" class="studio-btn small">Update Goal</button>
                </div>
            </div>

            <div id="upload-step" style="display:none; margin-top:20px; border-top:1px solid #333; pt:20px;">
                <div class="toggle-group">
                    <label><input type="radio" name="up-type" value="single" checked> Single Chapter</label>
                    <label><input type="radio" name="up-type" value="full"> Full Manuscript</label>
                </div>
                <input type="file" id="studio-file" multiple class="studio-input">
                <div id="slot-preview" class="scroll-list" style="display:none;"></div>
                <button id="studio-upload-btn" class="studio-btn">Sync to Cosmos DB</button>
            </div>
        </div>
    `;

    setupLogic();
}

async function setupLogic() {
    const search = document.getElementById('project-search');
    const list = document.getElementById('project-list');
    
    // Fetch current novels to populate search
    const { data: novels } = await apiFetch('/api/GetNovels');

    const renderProjects = (filter = "") => {
        list.innerHTML = novels
            .filter(n => n.display_name.toLowerCase().includes(filter.toLowerCase()))
            .map(n => `<div class="project-item" data-id="${n._id}" data-goal="${n.target_goal || 50000}">${n.display_name}</div>`)
            .join('');
    };

    renderProjects();

    // Search Filtering
    search.oninput = (e) => renderProjects(e.target.value);

    // Project Selection
    list.onclick = (e) => {
        const item = e.target.closest('.project-item');
        if (!item) return;

        // Highlight selected
        document.querySelectorAll('.project-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');

        // Show Meta Editor & Upload Step
        document.getElementById('meta-editor').style.display = 'block';
        document.getElementById('upload-step').style.display = 'block';
        document.getElementById('goal-input').value = item.dataset.goal;
    };
}
