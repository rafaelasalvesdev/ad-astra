// main.js
const { app, BrowserWindow, ipcMain } = require('electron/main');
const path = require('node:path');
const fs = require('node:fs');

// Define where data lives on the hard drive (portable ./data folder)
const DATA_DIR = path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts-data.json');
const META_FILE = path.join(DATA_DIR, 'metadata.json');

// Ensure folders and base JSON files exist on startup
function ensureStorageExists() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR);
    if (!fs.existsSync(PROMPTS_FILE)) fs.writeFileSync(PROMPTS_FILE, JSON.stringify([], null, 2));
    if (!fs.existsSync(META_FILE)) {
        const defaultMeta = {
            tags: ['Portrait', 'Full body', 'Cozy', 'Forest', 'Night'],
            colors: {},
            todos: []
        };
        fs.writeFileSync(META_FILE, JSON.stringify(defaultMeta, null, 2));
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        title: "Ad Astra",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
}

// --- HARD DRIVE READ/WRITE LISTENERS (IPC) ---

// 1. Read Prompts
ipcMain.handle('get-prompts', () => {
    const raw = fs.readFileSync(PROMPTS_FILE, 'utf-8');
    return JSON.parse(raw);
});

// 2. Save All Prompts (and save Base64 uploads as real image files!)
ipcMain.handle('save-prompts', (event, promptsArray) => {
    const updatedPrompts = promptsArray.map(card => {
        // If the card has a newly uploaded Base64 image, save it as a file on disk
        if (card.img && card.img.startsWith('data:image/jpeg;base64,')) {
            const base64Data = card.img.replace(/^data:image\/jpeg;base64,/, "");
            const fileName = `${card.id}.jpg`;
            const filePath = path.join(IMG_DIR, fileName);
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            // Replace the heavy string in JSON with a lightweight local file path
            card.img = `data/images/${fileName}`;
        }
        return card;
    });

    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(updatedPrompts, null, 2));
    return updatedPrompts;
});

// 3. Read Metadata
ipcMain.handle('get-metadata', () => {
    const raw = fs.readFileSync(META_FILE, 'utf-8');
    return JSON.parse(raw);
});

// 4. Save Metadata
ipcMain.handle('save-metadata', (event, metaObj) => {
    fs.writeFileSync(META_FILE, JSON.stringify(metaObj, null, 2));
    return true;
});

// Launch the app
app.whenReady().then(() => {
    ensureStorageExists();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});