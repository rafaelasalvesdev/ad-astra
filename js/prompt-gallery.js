// js/prompt-gallery.js

document.addEventListener('DOMContentLoaded', async () => {

    // =========================================================================
    // 1. CONSTANTS & STATE
    // =========================================================================

    const PRIMARY_CATEGORIES = ['male', 'female', 'couple', 'group'];
    const DEFAULT_PALETTE = [
        '#cf3f38', '#4f7f70', '#d9a441', '#3f6f86',
        '#8a5a8f', '#e8665f', '#6e8f6a', '#b27d87'
    ];

    // Helper to select a single DOM element
    const $ = (selector) => document.querySelector(selector);

    // Load saved prompts and metadata from hard drive via Electron
    let rawPrompts = [];
    let rawMeta = { tags: [], colors: {}, todos: [] };

    try {
        rawPrompts = await Storage.getPrompts();
        rawMeta = await Storage.getMetadata();
    } catch (err) {
        console.error('[Ad Astra] Error reading from Storage:', err);
    }

    // Sanitize existing cards so old test cards missing 'tags' or 'primary' never crash the UI
    const sanitizedCards = (Array.isArray(rawPrompts) ? rawPrompts : []).map((card, idx) => {
        const validCategory = PRIMARY_CATEGORIES.includes(card.primary) ? card.primary : 'female';
        return {
            id: card.id ? String(card.id) : 'c_' + idx + '_' + Date.now(),
            primary: validCategory,
            prompt: card.prompt ? String(card.prompt) : '',
            tags: Array.isArray(card.tags) ? card.tags : [],
            img: card.img ? card.img : ''
        };
    });

    // Main application state
    let state = {
        cards: sanitizedCards,
        tags: Array.isArray(rawMeta.tags) ? rawMeta.tags : [],
        colors: rawMeta.colors ? rawMeta.colors : {}
    };

    // Active filter state
    let filters = {
        primary: 'all',
        tags: new Set(),
        searchQuery: ''
    };

    // Modal state trackers
    let editingDraft = null; // Stores the prompt currently being created/edited
    let viewingCard = null;  // Stores the prompt currently open in the View modal
    let colorWheel = { tagIndex: 0, h: 0, s: 100, l: 50 }; // Color picker state
    let toastTimeout = null;

    // =========================================================================
    // 2. INITIALIZATION & SEED DATA
    // =========================================================================

    const DEFAULT_TAGS = [
        'Portrait', 'Full body', 'Close-up', 'Cozy',
        'Forest', 'Lakeside', 'Night', 'Action', 'Emotional'
    ];

    // Make sure all 9 default tags exist if the tag list is empty or incomplete
    if (state.tags.length === 0) {
        state.tags = [...DEFAULT_TAGS];
    }

    // If there are no cards on disk yet, seed the 4 prototype cards
    if (state.cards.length === 0) {
        state.tags = [...DEFAULT_TAGS];
        state.cards = [
            {
                id: 's1',
                primary: 'male',
                prompt: 'Sitting on a wooden dock at dawn, fishing rod in hand, soft mist over the lake, pastel sage and cream palette, pixel-art style, calm and nostalgic mood',
                tags: ['Lakeside', 'Cozy', 'Full body'],
                img: generatePlaceholderArt('male', '#c9ddd3')
            },
            {
                id: 's2',
                primary: 'female',
                prompt: 'Reading under a giant oak tree beside a lantern, warm afternoon light, books on a wooden shelf, gentle expression, cozy storybook illustration',
                tags: ['Cozy', 'Portrait'],
                img: generatePlaceholderArt('female', '#cfe0e3')
            },
            {
                id: 's3',
                primary: 'couple',
                prompt: 'Two companions sharing one umbrella on a quiet forest path in light rain, standing close together, soft sage tones, tender mood',
                tags: ['Forest', 'Emotional'],
                img: generatePlaceholderArt('couple', '#e3dcc4')
            },
            {
                id: 's4',
                primary: 'group',
                prompt: 'A small group around a campfire at night beneath tall pines, telling a story, warm firelight against cool blue shadows, wide shot',
                tags: ['Night', 'Forest'],
                img: generatePlaceholderArt('group', '#8fa6ad')
            }
        ];
        ensureTagColors();
        await saveToDisk();
    } else {
        ensureTagColors();
        await saveToDisk();
    }

    // =========================================================================
    // 3. HELPER FUNCTIONS (Text Formatting, Art, & Storage)
    // =========================================================================

    // Capitalizes the first letter of a word (e.g., "male" -> "Male")
    function capitalize(word) {
        if (!word) return '';
        return word[0].toUpperCase() + word.slice(1);
    }

    // Escapes HTML characters so user text doesn't break the page layout
    function escapeHTML(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(text).replace(/[&<>"']/g, (char) => map[char]);
    }

    // Assigns a default border color to any tag that doesn't have one yet
    function ensureTagColors() {
        state.tags.forEach((tag, index) => {
            if (!state.colors[tag]) {
                state.colors[tag] = DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
            }
        });
    }

    // Returns the inline CSS border-color rule for a given tag
    function getTagBorderStyle(tag) {
        const color = state.colors[tag] ? state.colors[tag] : 'var(--line)';
        return `border-color:${color}`;
    }

    // Saves both prompt cards and tag metadata to the hard drive via Electron
    async function saveToDisk() {
        try {
            // Save prompts (main.js converts Base64 images into data/images/*.jpg)
            state.cards = await Storage.savePrompts(state.cards);

            // Save tags and colors while preserving dashboard todos
            rawMeta.tags = state.tags;
            rawMeta.colors = state.colors;
            await Storage.saveMetadata(rawMeta);
        } catch (err) {
            console.error('[Ad Astra] Error saving to disk:', err);
            showToast('Could not save data to disk');
        }
    }

    // Shows a temporary notification bubble at the bottom of the screen
    function showToast(message) {
        const toastEl = $('#toast');
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('on');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toastEl.classList.remove('on'), 2200);
    }

    // Copies text to the user's clipboard
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Prompt copied');
        } catch (err) {
            showToast('Failed to copy prompt');
        }
    }

    // Generates the pixel-art bunny SVG placeholder when no image is uploaded
    function generatePlaceholderArt(category, bgColor) {
        const palettes = {
            male: ['#4f7f70'],
            female: ['#e8665f'],
            couple: ['#4f7f70', '#e8665f'],
            group: ['#4f7f70', '#e8665f', '#d9a441']
        };
        const colors = palettes[category] ? palettes[category] : ['#e8665f'];
        const startX = 100 - (colors.length * 30 - 11) / 2;

        const bunnies = colors.map((coatColor, i) => `
            <g transform="translate(${startX + i * 30} 66)">
                <rect x="3" width="5" height="16" fill="#fbf8f0"/>
                <rect x="11" width="5" height="16" fill="#fbf8f0"/>
                <rect y="16" width="19" height="14" fill="#fbf8f0"/>
                <rect y="30" width="19" height="16" fill="${coatColor}"/>
                <rect x="12" y="21" width="2" height="2" fill="#3b2b36"/>
            </g>
        `).join('');

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" shape-rendering="crispEdges"><rect width="200" height="150" fill="${bgColor}"/><rect x="40" y="30" width="60" height="14" fill="#f1efdf"/><path d="M14 112V90h-6l9-12h-6l11-16 11 16h-6l9 12h-6v22zM170 112V86h-7l10-14h-7l12-18 12 18h-7l10 14h-7v26z" fill="#86a897"/><rect y="112" width="200" height="38" fill="#9fc3a8"/><rect y="112" width="200" height="5" fill="#7ea17a"/>${bunnies}</svg>`;
        return 'data:image/svg+xml,' + encodeURIComponent(svgString);
    }

    // =========================================================================
    // 4. GALLERY RENDERING & FILTERING
    // =========================================================================

    // Returns the list of cards that match the active category, tags, and search query
    function getFilteredCards() {
        const query = filters.searchQuery.toLowerCase();
        return state.cards.filter(card => {
            const matchesCategory = (filters.primary === 'all') ? true : (card.primary === filters.primary);
            const cardTags = Array.isArray(card.tags) ? card.tags : [];
            const matchesTags = [...filters.tags].every(tag => cardTags.includes(tag));
            const searchableText = (card.prompt + ' ' + cardTags.join(' ')).toLowerCase();
            const matchesQuery = (query === '') ? true : searchableText.includes(query);

            return matchesCategory && matchesTags && matchesQuery;
        });
    }

    // Renders the category bar, tag filter bar, and prompt cards grid
    function renderGallery() {
        // 1. Render Primary Category Buttons (All, Male, Female, Couple, Group)
        const categories = ['all', ...PRIMARY_CATEGORIES];
        $('#prim').innerHTML = categories.map(cat => {
            const count = state.cards.filter(c => (cat === 'all') ? true : (c.primary === cat)).length;
            const label = (cat === 'all') ? 'All' : capitalize(cat);
            return `<button type="button" class="sb" aria-pressed="${filters.primary === cat}" data-act="prim" data-v="${cat}">${label}<span>${count}</span></button>`;
        }).join('');

        // 2. Render Sub-Tag Filter Chips
        if (state.tags.length > 0) {
            $('#tagbar').innerHTML = state.tags.map(tag => `
                <button type="button" class="chip" aria-pressed="${filters.tags.has(tag)}" data-act="ftag" data-v="${escapeHTML(tag)}" style="${getTagBorderStyle(tag)}">${escapeHTML(tag)}</button>
            `).join('');
        } else {
            $('#tagbar').innerHTML = '<span class="mut">No tags yet. Use Manage tags to create some.</span>';
        }

        // 3. Render Prompt Cards Grid (Without Title or {character} highlight)
        const visibleCards = getFilteredCards();
        $('#grid').innerHTML = visibleCards.map(card => {
            const imageSrc = card.img ? card.img : generatePlaceholderArt(card.primary, '#c9ddd3');
            const cardTags = Array.isArray(card.tags) ? card.tags : [];
            const tagsHTML = cardTags.map(t => `<span class="tag" style="${getTagBorderStyle(t)}">${escapeHTML(t)}</span>`).join('');

            return `
                <article class="card">
                    <button type="button" class="thumb" data-act="view" data-id="${card.id}" aria-label="Expand prompt">
                        <img src="${imageSrc}" alt="Prompt reference image">
                        <span class="badge b-${card.primary}">${card.primary}</span>
                    </button>
                    <div class="cb">
                        <p class="pt">${escapeHTML(card.prompt)}</p>
                        <div class="tg">${tagsHTML}</div>
                        <div class="ca">
                            <button type="button" class="btn sec sm" data-act="edit" data-id="${card.id}">Edit</button>
                            <button type="button" class="btn sec sm" data-act="copy" data-id="${card.id}">Copy</button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // 4. Handle Empty State Message
        const emptyEl = $('#empty');
        emptyEl.hidden = (visibleCards.length > 0);
        if (state.cards.length > 0) {
            emptyEl.innerHTML = '<p>No prompts match these filters.</p><button type="button" class="btn sec" data-act="clear">Clear filters</button>';
        } else {
            emptyEl.innerHTML = '<p>Your gallery is empty.</p><button type="button" class="btn pri" data-act="add">+ Add your first prompt</button>';
        }
    }

    // =========================================================================
    // 5. ADD / EDIT PROMPT MODAL
    // =========================================================================

    // Updates the image dropzone preview inside the Add/Edit modal
    function updateImagePreview() {
        if (editingDraft && editingDraft.img) {
            $('#prev').innerHTML = `<img src="${editingDraft.img}" alt="Selected example">`;
        } else {
            $('#prev').innerHTML = '<span>Click to choose an image, or drop one here</span>';
        }
    }

    // Renders the selectable tag chips inside the Add/Edit modal
    function renderEditModalTags() {
        if (state.tags.length > 0) {
            $('#etags').innerHTML = state.tags.map(tag => `
                <button type="button" class="chip" aria-pressed="${editingDraft.tags.has(tag)}" data-act="etag" data-v="${escapeHTML(tag)}" style="${getTagBorderStyle(tag)}">${escapeHTML(tag)}</button>
            `).join('');
        } else {
            $('#etags').innerHTML = '<span class="mut">No tags yet. Add one below.</span>';
        }
    }

    // Opens the Add/Edit modal (if cardId is provided, loads that card for editing)
    function openEditModal(cardId) {
        const existingCard = cardId ? state.cards.find(c => c.id === cardId) : null;

        editingDraft = {
            id: existingCard ? existingCard.id : null,
            img: existingCard ? existingCard.img : '',
            tags: new Set((existingCard && Array.isArray(existingCard.tags)) ? existingCard.tags : []),
            confirmDelete: false
        };

        $('#eh').textContent = existingCard ? 'Edit prompt' : 'Add prompt';
        $('#ep').value = existingCard ? existingCard.prompt : '';
        $('#nt').value = '';
        $('#ef').value = '';

        // Check the matching radio button for category
        const targetCategory = existingCard ? existingCard.primary : 'female';
        document.querySelectorAll('[name="pr"]').forEach(radio => {
            radio.checked = (radio.value === targetCategory);
        });

        // Show Delete button only when editing an existing card
        const deleteBtn = $('#del');
        deleteBtn.hidden = !existingCard;
        deleteBtn.textContent = 'Delete';

        updateImagePreview();
        renderEditModalTags();
        $('#dEdit').showModal();
    }

    // Reads an uploaded image file, scales it down cleanly on a canvas, and stores Base64 JPEG
    function handleImageFile(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 900 / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

                editingDraft.img = canvas.toDataURL('image/jpeg', 0.85);
                updateImagePreview();
            };
            img.onerror = () => showToast('Could not read that image');
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    // =========================================================================
    // 6. VIEW PROMPT MODAL (Expand Image & Copy Prompt)
    // =========================================================================

    function openViewModal(cardId) {
        viewingCard = state.cards.find(c => c.id === cardId);
        if (!viewingCard) return;

        $('#vi').src = viewingCard.img ? viewingCard.img : generatePlaceholderArt(viewingCard.primary, '#c9ddd3');

        const badge = $('#vb');
        badge.className = 'badge b-' + viewingCard.primary;
        badge.style.position = 'static';
        badge.textContent = viewingCard.primary;

        const cardTags = Array.isArray(viewingCard.tags) ? viewingCard.tags : [];
        $('#vg').innerHTML = cardTags.map(t => `<span class="tag" style="${getTagBorderStyle(t)}">${escapeHTML(t)}</span>`).join('');
        $('#vp').textContent = viewingCard.prompt;
        $('#dView').showModal();
    }

    // =========================================================================
    // 7. TAG MANAGEMENT & COLOR WHEEL
    // =========================================================================

    // Converts HSL values to a #RRGGBB hex string
    function hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => {
            const k = (n + h / 30) % 12;
            return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        };
        return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    }

    // Converts a #RRGGBB hex string to [h, s, l]
    function hexToHsl(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        const l = (max + min) / 2;
        let h = 0, s = 0;

        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return [h, s * 100, l * 100];
    }

    // Creates a new tag if it doesn't already exist
    async function createNewTag(rawName) {
        const cleanName = rawName.trim();
        if (!cleanName) return null;

        const existing = state.tags.find(t => t.toLowerCase() === cleanName.toLowerCase());
        if (existing) return existing;

        state.tags.push(cleanName);
        state.colors[cleanName] = DEFAULT_PALETTE[(state.tags.length - 1) % DEFAULT_PALETTE.length];
        await saveToDisk();
        return cleanName;
    }

    // Updates the visual position of the color wheel knob and preview tag
    function paintColorWheel() {
        const activeTag = state.tags[colorWheel.tagIndex];
        const wheelEl = $('#wh');
        if (!activeTag) {
            wheelEl.style.opacity = 0.4;
            return;
        }

        const colorHex = state.colors[activeTag];
        const radius = 84;
        const angleRad = colorWheel.h * Math.PI / 180;
        const knobEl = $('#wk');

        wheelEl.style.opacity = 1;
        wheelEl.style.setProperty('--l', colorWheel.l + '%');
        knobEl.style.left = (radius + (colorWheel.s / 100) * radius * Math.sin(angleRad)) + 'px';
        knobEl.style.top = (radius - (colorWheel.s / 100) * radius * Math.cos(angleRad)) + 'px';

        $('#wlt').value = colorWheel.l;
        $('#hx').value = colorHex;
        $('#wl').textContent = 'Color for: ' + activeTag;

        const previewTag = $('#wv');
        previewTag.textContent = activeTag;
        previewTag.style.borderColor = colorHex;

        const swatchBtn = document.querySelector(`.sw[data-i="${colorWheel.tagIndex}"]`);
        if (swatchBtn) swatchBtn.style.borderColor = colorHex;
    }

    // Syncs the color wheel HSL state from the currently selected tag's hex color
    function syncWheelFromSelectedTag() {
        const activeTag = state.tags[colorWheel.tagIndex];
        if (activeTag && state.colors[activeTag]) {
            [colorWheel.h, colorWheel.s, colorWheel.l] = hexToHsl(state.colors[activeTag]);
            colorWheel.l = Math.min(75, Math.max(25, colorWheel.l));
        }
        paintColorWheel();
    }

    // Renders the list of tags inside the Manage Tags modal
    function renderTagManagerList() {
        if (colorWheel.tagIndex >= state.tags.length) {
            colorWheel.tagIndex = Math.max(0, state.tags.length - 1);
        }

        if (state.tags.length > 0) {
            $('#tl').innerHTML = state.tags.map((tag, index) => {
                const useCount = state.cards.filter(c => Array.isArray(c.tags) && c.tags.includes(tag)).length;
                return `
                    <li>
                        <button type="button" class="sw" aria-pressed="${colorWheel.tagIndex === index}" data-act="pick" data-i="${index}" aria-label="Choose color for ${escapeHTML(tag)}" style="border-color:${state.colors[tag]}"></button>
                        <input class="in" value="${escapeHTML(tag)}" data-rn="${index}" aria-label="Rename tag ${escapeHTML(tag)}">
                        <span class="mut">${useCount} used</span>
                        <button type="button" class="btn sec sm" data-act="dtag" data-i="${index}">Delete</button>
                    </li>
                `;
            }).join('');
        } else {
            $('#tl').innerHTML = '<li class="mut">No tags yet.</li>';
        }
        syncWheelFromSelectedTag();
    }

    // =========================================================================
    // 8. EVENT LISTENERS
    // =========================================================================

    // Global Click Delegation for all [data-act] buttons
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) {
            const action = btn.dataset.act;
            const val = btn.dataset.v;
            const id = btn.dataset.id;

            if (action === 'prim') {
                filters.primary = val;
                renderGallery();
            } else if (action === 'ftag') {
                filters.tags.has(val) ? filters.tags.delete(val) : filters.tags.add(val);
                renderGallery();
            } else if (action === 'clear') {
                filters.primary = 'all';
                filters.tags.clear();
                filters.searchQuery = '';
                $('#q').value = '';
                renderGallery();
            } else if (action === 'add') {
                openEditModal(null);
            } else if (action === 'edit') {
                openEditModal(id);
            } else if (action === 'view') {
                openViewModal(id);
            } else if (action === 'copy') {
                const card = state.cards.find(c => c.id === id);
                if (card) copyToClipboard(card.prompt);
            } else if (action === 'vcopy') {
                if (viewingCard) copyToClipboard(viewingCard.prompt);
            } else if (action === 'vedit') {
                $('#dView').close();
                if (viewingCard) openEditModal(viewingCard.id);
            } else if (action === 'close') {
                const dlg = btn.closest('dialog');
                if (dlg) dlg.close();
            } else if (action === 'etag') {
                editingDraft.tags.has(val) ? editingDraft.tags.delete(val) : editingDraft.tags.add(val);
                renderEditModalTags();
            } else if (action === 'newtag') {
                const newTag = await createNewTag($('#nt').value);
                if (newTag) {
                    editingDraft.tags.add(newTag);
                    $('#nt').value = '';
                    renderEditModalTags();
                    renderGallery();
                }
            } else if (action === 'del') {
                if (!editingDraft.confirmDelete) {
                    editingDraft.confirmDelete = true;
                    btn.textContent = 'Click again to delete';
                    return;
                }
                state.cards = state.cards.filter(c => c.id !== editingDraft.id);
                await saveToDisk();
                $('#dEdit').close();
                renderGallery();
                showToast('Prompt deleted');
            } else if (action === 'mng') {
                renderTagManagerList();
                $('#dTags').showModal();
            } else if (action === 'pick') {
                colorWheel.tagIndex = Number(btn.dataset.i);
                renderTagManagerList();
            } else if (action === 'dtag') {
                const idx = Number(btn.dataset.i);
                const removedTag = state.tags[idx];
                state.tags.splice(idx, 1);
                state.cards.forEach(c => {
                    if (Array.isArray(c.tags)) {
                        c.tags = c.tags.filter(t => t !== removedTag);
                    }
                });
                delete state.colors[removedTag];
                filters.tags.delete(removedTag);
                await saveToDisk();
                renderTagManagerList();
                renderGallery();
            }
            return;
        }

        // Clicking on the dark backdrop outside a modal closes it
        if (e.target.tagName === 'DIALOG') {
            e.target.close();
        }
    });

    // Handle Image Upload Input & Tag Renaming
    document.addEventListener('change', async (e) => {
        const target = e.target;

        // Image file selected
        if (target.id === 'ef' && target.files && target.files[0]) {
            handleImageFile(target.files[0]);
        }

        // Tag renamed inside Manage Tags modal
        if (target.dataset.rn !== undefined) {
            const idx = Number(target.dataset.rn);
            const oldName = state.tags[idx];
            const newName = target.value.trim();

            if (!newName) {
                renderTagManagerList();
                return;
            }
            if (newName === oldName) {
                renderTagManagerList();
                return;
            }
            if (state.tags.some((t, j) => j !== idx && t.toLowerCase() === newName.toLowerCase())) {
                showToast('That tag already exists');
                renderTagManagerList();
                return;
            }

            state.tags[idx] = newName;
            state.colors[newName] = state.colors[oldName];
            delete state.colors[oldName];
            state.cards.forEach(c => {
                if (Array.isArray(c.tags)) {
                    c.tags = c.tags.map(t => (t === oldName ? newName : t));
                }
            });
            if (filters.tags.delete(oldName)) filters.tags.add(newName);

            await saveToDisk();
            renderTagManagerList();
            renderGallery();
        }
    });

    // Save Prompt Form Submission
    $('#fEdit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const promptValue = $('#ep').value.trim();
        if (!promptValue) {
            $('#ep').focus();
            showToast('Add a prompt first');
            return;
        }

        const checkedRadio = document.querySelector('[name="pr"]:checked');
        const primaryCategory = checkedRadio ? checkedRadio.value : 'female';

        const cardData = {
            id: editingDraft.id ? editingDraft.id : 'c' + Date.now(),
            prompt: promptValue,
            primary: primaryCategory,
            tags: [...editingDraft.tags],
            img: editingDraft.img ? editingDraft.img : generatePlaceholderArt(primaryCategory, '#c9ddd3')
        };

        const existingIndex = state.cards.findIndex(c => c.id === cardData.id);
        if (existingIndex < 0) {
            state.cards.unshift(cardData);
        } else {
            state.cards[existingIndex] = cardData;
        }

        await saveToDisk();
        $('#dEdit').close();
        renderGallery();
        showToast(existingIndex < 0 ? 'Prompt added' : 'Changes saved');
    });

    // Add Tag Form Submission inside Manage Tags modal
    $('#fTag').addEventListener('submit', async (e) => {
        e.preventDefault();
        const added = await createNewTag($('#tn').value);
        if (added) {
            $('#tn').value = '';
            colorWheel.tagIndex = state.tags.indexOf(added);
            renderTagManagerList();
            renderGallery();
        }
    });

    // Pressing Enter inside the "New tag" input in the Add/Edit modal
    $('#nt').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.querySelector('[data-act="newtag"]').click();
        }
    });

    // Live Search Input
    $('#q').addEventListener('input', (e) => {
        filters.searchQuery = e.target.value;
        renderGallery();
    });

    // Drag-and-Drop Image Support on the Dropzone
    const dropzone = $('#prev');
    dropzone.addEventListener('dragover', (e) => e.preventDefault());
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    // Color Wheel Pointer Dragging & Lightness/Hex Controls
    const wheelEl = $('#wh');
    function updateWheelFromPointer(e) {
        const rect = wheelEl.getBoundingClientRect();
        const radius = rect.width / 2;
        const dx = e.clientX - rect.left - radius;
        const dy = e.clientY - rect.top - radius;

        colorWheel.h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        colorWheel.s = Math.min(100, (Math.hypot(dx, dy) / radius) * 100);

        const activeTag = state.tags[colorWheel.tagIndex];
        if (activeTag) {
            state.colors[activeTag] = hslToHex(colorWheel.h, colorWheel.s, colorWheel.l);
            paintColorWheel();
        }
    }

    wheelEl.addEventListener('pointerdown', (e) => {
        if (state.tags.length === 0) return;
        wheelEl.setPointerCapture(e.pointerId);
        updateWheelFromPointer(e);
        wheelEl.onpointermove = updateWheelFromPointer;
    });

    const stopWheelDrag = async () => {
        if (wheelEl.onpointermove) {
            wheelEl.onpointermove = null;
            await saveToDisk();
            renderGallery();
        }
    };
    wheelEl.addEventListener('pointerup', stopWheelDrag);
    wheelEl.addEventListener('pointercancel', stopWheelDrag);

    // Lightness Slider
    $('#wlt').addEventListener('input', (e) => {
        colorWheel.l = Number(e.target.value);
        const activeTag = state.tags[colorWheel.tagIndex];
        if (activeTag) {
            state.colors[activeTag] = hslToHex(colorWheel.h, colorWheel.s, colorWheel.l);
            paintColorWheel();
        }
    });
    $('#wlt').addEventListener('change', async () => {
        await saveToDisk();
        renderGallery();
    });

    // Manual Hex Input
    $('#hx').addEventListener('change', async (e) => {
        let val = e.target.value.trim();
        if (val[0] !== '#') val = '#' + val;
        const activeTag = state.tags[colorWheel.tagIndex];

        if (activeTag && /^#[0-9a-f]{6}$/i.test(val)) {
            state.colors[activeTag] = val.toLowerCase();
            syncWheelFromSelectedTag();
            await saveToDisk();
            renderGallery();
        } else {
            showToast('Use a hex like #4f7f70');
            paintColorWheel();
        }
    });

    // Initial render when the page opens
    renderGallery();
});