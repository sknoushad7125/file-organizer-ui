// --- Initial State ---
const defaultData = [
    { id: 'root', name: 'Home', type: 'folder', parentId: null },
    { id: '1', name: 'Documents', type: 'folder', parentId: 'root' },
    { id: '2', name: 'Images', type: 'folder', parentId: 'root' },
    { id: '3', name: 'Videos', type: 'folder', parentId: 'root' },
    { id: '4', name: 'presentation.pptx', type: 'presentation', parentId: 'root', content: 'Slide 1: Q3 Earnings...' },
    { id: '5', name: 'readme.md', type: 'text', parentId: 'root', content: '# FileHub\nWelcome to your new storage system.' }
];

let fs = JSON.parse(localStorage.getItem('filehub_data')) || defaultData;
let currentFolder = localStorage.getItem('filehub_folder') || 'root';
let viewMode = localStorage.getItem('filehub_view') || 'grid';
let sortDesc = false;

// DOM Elements
const workspace = document.getElementById('workspace');
const breadcrumbs = document.getElementById('breadcrumbs');
const ctxMenu = document.getElementById('context-menu');
const modal = document.getElementById('preview-modal');
let ctxTargetId = null;

// --- Initialization ---
function init() {
    updateViewMode(viewMode);
    render();
    setupEvents();
}

function save() {
    localStorage.setItem('filehub_data', JSON.stringify(fs));
    localStorage.setItem('filehub_folder', currentFolder);
    localStorage.setItem('filehub_view', viewMode);
}

// --- Helpers ---
const genId = () => Math.random().toString(36).substr(2, 9);
const getItem = (id) => fs.find(i => i.id === id);
const getChildren = (pid) => fs.filter(i => i.parentId === pid);

function getIcon(type) {
    const map = {
        'folder': 'fa-solid fa-folder color-folder',
        'image': 'fa-solid fa-image color-image',
        'video': 'fa-solid fa-circle-play color-video',
        'presentation': 'fa-solid fa-chalkboard-user color-presentation',
        'text': 'fa-solid fa-file-lines color-text'
    };
    return map[type] || 'fa-solid fa-file color-text';
}

// --- Rendering ---
function render(query = '') {
    workspace.innerHTML = '';
    let items = query ? fs.filter(i => i.id !== 'root' && i.name.toLowerCase().includes(query.toLowerCase())) 
                      : getChildren(currentFolder);

    renderBreadcrumbs(!!query);

    if (items.length === 0) {
        workspace.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); margin-top: 2rem;">Folder is empty</div>`;
        return;
    }

    // Sort: Folders first, then name
    items.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.dataset.id = item.id;
        card.draggable = true;

        // Inject the HTML, including the new file-actions div
        card.innerHTML = `
            <i class="file-icon ${getIcon(item.type)}"></i>
            <span class="file-name">${item.name}</span>
            <div class="file-actions">
                ${item.type !== 'folder' ? `<button class="action-btn download-btn" title="Download"><i class="fa-solid fa-download"></i></button>` : ''}
                <button class="action-btn delete-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `;

        // 1. Double Click to open
        card.addEventListener('dblclick', () => {
            if (item.type === 'folder') { currentFolder = item.id; document.getElementById('search-input').value = ''; save(); render(); }
            else { openPreview(item.id); }
        });

        // 2. Quick Action: Download Click
        const downloadBtn = card.querySelector('.download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents the card click event from firing
                downloadItem(item.id);
            });
        }

        // 3. Quick Action: Delete Click
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents the card click event from firing
                if(confirm(`Are you sure you want to delete "${item.name}"?`)) { 
                    fs = fs.filter(i => i.id !== item.id && i.parentId !== item.id); 
                    save(); 
                    render(); 
                }
            });
        }

        // 4. Existing Context Menu Event
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctxTargetId = item.id;
            
            document.getElementById('ctx-download').style.display = item.type === 'folder' ? 'none' : 'flex';
            document.getElementById('ctx-preview').style.display = item.type === 'folder' ? 'none' : 'flex';

            ctxMenu.style.display = 'block';
            ctxMenu.style.left = `${Math.min(e.pageX, window.innerWidth - ctxMenu.offsetWidth)}px`;
            ctxMenu.style.top = `${Math.min(e.pageY, window.innerHeight - ctxMenu.offsetHeight)}px`;
        });

        // 5. Existing Drag Events
        card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text', item.id));
        if (item.type === 'folder') {
            card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', handleDrop);
        }

        workspace.appendChild(card);
    });
}

function renderBreadcrumbs(isSearch) {
    breadcrumbs.innerHTML = `<i class="fa-solid fa-house" id="nav-home" style="cursor:pointer" title="Home"></i> <span style="margin: 0 4px;">/</span> `;
    
    if (isSearch) {
        breadcrumbs.innerHTML += `<span class="current">Search Results</span>`;
    } else {
        const path = [];
        let curr = getItem(currentFolder);
        while (curr && curr.id !== 'root') { path.unshift(curr); curr = getItem(curr.parentId); }

        if (path.length === 0) {
            breadcrumbs.innerHTML += `<span class="current">Home</span>`;
        } else {
            breadcrumbs.innerHTML += `<span class="nav-crumb" data-id="root">Home</span> <span style="margin: 0 4px;">/</span> `;
            path.forEach((f, i) => {
                if (i === path.length - 1) {
                    breadcrumbs.innerHTML += `<span class="current">${f.name}</span>`;
                } else {
                    breadcrumbs.innerHTML += `<span class="nav-crumb" data-id="${f.id}">${f.name}</span> <span style="margin: 0 4px;">/</span> `;
                }
            });
        }
    }

    // Attach events to dynamic breadcrumbs
    document.getElementById('nav-home').addEventListener('click', () => navigateTo('root'));
    document.querySelectorAll('.nav-crumb').forEach(el => {
        el.addEventListener('click', (e) => navigateTo(e.target.dataset.id));
    });
}

function navigateTo(id) {
    currentFolder = id;
    document.getElementById('search-input').value = '';
    save(); render();
}

// --- Actions (Copy, Download, Preview, etc.) ---
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const draggedId = e.dataTransfer.getData('text');
    const targetId = e.currentTarget.dataset.id;
    if (draggedId === targetId) return;

    let curr = getItem(targetId);
    while (curr) {
        if (curr.id === draggedId) return alert("Cannot move folder into itself.");
        curr = getItem(curr.parentId);
    }

    getItem(draggedId).parentId = targetId;
    save(); render();
}

function createItem() {
    const name = prompt('Enter item name (e.g., "New Folder" or "notes.txt"):');
    if (!name) return;
    
    let type = 'folder';
    if (name.includes('.')) {
        const ext = name.split('.').pop().toLowerCase();
        if (['jpg','png'].includes(ext)) type = 'image';
        else if (['mp4'].includes(ext)) type = 'video';
        else if (['pptx'].includes(ext)) type = 'presentation';
        else type = 'text';
    }

    fs.push({ id: genId(), name, type, parentId: currentFolder, content: 'Empty file...' });
    save(); render();
}

function copyItem(id) {
    const item = getItem(id);
    if (!item) return;
    const newItem = { ...item, id: genId(), name: `${item.name} (Copy)` };
    fs.push(newItem);
    
    // If it's a folder, recursively copy children (Simplified for brevity, usually needs deep copy)
    save(); render();
}

function downloadItem(id) {
    const item = getItem(id);
    if (!item || item.type === 'folder') return;
    
    // Simulate File Download using Blob
    const blob = new Blob([item.content || 'Dummy content'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openPreview(id) {
    const item = getItem(id);
    document.getElementById('modal-title').innerText = item.name;
    document.getElementById('modal-body').innerText = item.content || 'No content available.';
    modal.style.display = 'flex';
}

// --- Setup Events ---
function setupEvents() {
    document.addEventListener('click', () => ctxMenu.style.display = 'none');
    document.getElementById('btn-new').addEventListener('click', createItem);
    
    // View Toggles
    document.getElementById('btn-grid').addEventListener('click', () => updateViewMode('grid'));
    document.getElementById('btn-list').addEventListener('click', () => updateViewMode('list'));
    
    // Sort
    document.getElementById('btn-sort').addEventListener('click', () => { sortDesc = !sortDesc; render(); });
    
    // Theme
    document.getElementById('btn-theme').addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        document.querySelector('#btn-theme i').className = document.body.classList.contains('light-mode') ? 'fa-regular fa-moon' : 'fa-regular fa-sun';
    });

    // Search
    document.getElementById('search-input').addEventListener('input', e => render(e.target.value));

    // Context Menu Actions
    document.getElementById('ctx-rename').addEventListener('click', () => {
        const item = getItem(ctxTargetId);
        const newName = prompt('Rename:', item.name);
        if (newName) { item.name = newName; save(); render(); }
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
        if(confirm('Delete this item?')) { fs = fs.filter(i => i.id !== ctxTargetId && i.parentId !== ctxTargetId); save(); render(); }
    });
    document.getElementById('ctx-copy').addEventListener('click', () => copyItem(ctxTargetId));
    document.getElementById('ctx-download').addEventListener('click', () => downloadItem(ctxTargetId));
    document.getElementById('ctx-preview').addEventListener('click', () => openPreview(ctxTargetId));

    // Modal
    document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
}

function updateViewMode(mode) {
    viewMode = mode;
    workspace.className = `workspace ${mode}-view`;
    document.getElementById('btn-grid').classList.toggle('active', mode === 'grid');
    document.getElementById('btn-list').classList.toggle('active', mode === 'list');
    save();
}

init();