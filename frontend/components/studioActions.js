import { createManuscript } from '../services/novelService.js';

export function renderCreateModal(onSuccess) {
    const name = prompt("Enter the name of the new manuscript:");
    if (!name) return;

    createManuscript({ display_name: name })
        .then(() => {
            alert("Manuscript created successfully!");
            onSuccess(); // Refresh the view
        })
        .catch(err => alert("Error: " + err.message));
}

export function uploadButton(manuscriptId) {
    return `
        <button class="btn-upload" onclick="triggerUpload('${manuscriptId}')">
            ↑ Upload Chapters
        </button>
    `;
}