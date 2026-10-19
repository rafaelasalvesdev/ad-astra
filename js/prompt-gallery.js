// js/prompt-gallery.js
document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('grid');
    const dialog = document.getElementById('dEdit');
    const form = document.getElementById('fEdit');
    const btnAdd = document.getElementById('btn-add-prompt');
    const btnCancel = document.getElementById('btn-cancel');

    // 1. Load prompts directly from the hard drive
    let prompts = await Storage.getPrompts();

    // 2. Render the gallery grid
    function renderGallery() {
        if (prompts.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--mut);">Your gallery is empty. Click "+ Add prompt" to start.</p>`;
            return;
        }

        grid.innerHTML = prompts.map(p => `
            <article class="card">
                ${p.img ? `<img src="${p.img}" class="thumb">` : `<div class="thumb"></div>`}
                <div class="cb">
                    <h3>${p.title}</h3>
                    <p class="pt">${p.prompt}</p>
                </div>
            </article>
        `).join('');
    }

    renderGallery();

    // 3. UI Interactions
    if (btnAdd) btnAdd.addEventListener('click', () => dialog.showModal());
    if (btnCancel) btnCancel.addEventListener('click', () => {
        dialog.close();
        form.reset();
    });

    // 4. Save a new prompt
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('et').value;
            const promptInput = document.getElementById('ep').value;
            const fileInput = document.getElementById('ef');

            if (fileInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await saveNewCard(titleInput, promptInput, event.target.result);
                };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                saveNewCard(titleInput, promptInput, null);
            }
        });
    }

    async function saveNewCard(title, prompt, imgBase64) {
        const newCard = {
            id: 'prompt_' + Date.now(),
            title: title,
            prompt: prompt,
            img: imgBase64
        };

        prompts.unshift(newCard); 
        prompts = await Storage.savePrompts(prompts); 
        
        renderGallery();
        dialog.close();
        form.reset();
    }
});