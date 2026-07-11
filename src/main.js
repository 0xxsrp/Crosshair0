const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, Tray, Menu, nativeImage, clipboard } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const AutoLaunch = require("auto-launch");
const { detectRunningGame } = require("./gameDetection/gameDetector");
const { getSettings, saveSettings, saveProfile, loadProfile, deleteProfile, renameProfile, getProfiles, saveCustomPreset, getCustomPresets, deleteCustomPreset, toggleCustomPresetFavorite, addHistory, getHistory } = require("./database/database");
const { exportProfile } = require("./profiles/exporter");
const { importProfile } = require("./profiles/importer");
const config = require("./storage/config");

let overlayWindow;
let dashboardWindow;
let currentDisplayIndex = 0;
let registeredShortcuts = {};
let tray = null;
let minimizeToTray = false;
let _revertOnExit = true;

function createTray(){
    const icon = nativeImage.createEmpty();
    try {
        const iconPath = path.join(__dirname, "icon.png");
        if(fs.existsSync(iconPath)) icon = nativeImage.createFromPath(iconPath);
    } catch(e) {}
    tray = new Tray(icon);
    tray.setToolTip("Crosshair0");
    updateTrayMenu();
}

function updateTrayMenu(){
    const contextMenu = Menu.buildFromTemplate([
        { label: "Show Crosshair0", click: () => { if(dashboardWindow) dashboardWindow.show(); if(overlayWindow) overlayWindow.show(); } },
        { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
}

app.on("before-quit", () => { app.isQuitting = true; });

function createOverlay(displayIndex){
    const displays = screen.getAllDisplays();
    const idx = (displayIndex !== undefined && displayIndex < displays.length) ? displayIndex : currentDisplayIndex;
    const display = displays[idx] || screen.getPrimaryDisplay();
    currentDisplayIndex = idx;

    if(overlayWindow){
        try { overlayWindow.close(); } catch(e) {}
        overlayWindow = null;
    }

    overlayWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });

    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.loadFile(path.join(__dirname, "overlay", "overlay.html"));
    overlayWindow.webContents.on("did-finish-load", () => {
        const s = getSettings();
        if(s) overlayWindow.webContents.send("crosshair:update", s);
    });
}

function loadWindowState(){
    try {
        const p = path.join(process.env.CROSSHAIR0_USER_DATA || __dirname, "windowState.json");
        if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch(e) {}
    return null;
}

function saveWindowState(bounds){
    try {
        const p = path.join(process.env.CROSSHAIR0_USER_DATA || __dirname, "windowState.json");
        fs.writeFileSync(p, JSON.stringify(bounds));
    } catch(e) {}
}

function createDashboard(){
    const saved = loadWindowState();
    dashboardWindow = new BrowserWindow({
        width: saved ? saved.width : 1400,
        height: saved ? saved.height : 900,
        x: saved ? saved.x : undefined,
        y: saved ? saved.y : undefined,
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });
    dashboardWindow.loadFile(path.join(__dirname, "dashboard", "index.html"));
    dashboardWindow.on("resize", () => {
        if(!dashboardWindow.isMaximized()) saveWindowState(dashboardWindow.getBounds());
    });
    dashboardWindow.on("move", () => {
        if(!dashboardWindow.isMaximized()) saveWindowState(dashboardWindow.getBounds());
    });
    dashboardWindow.on("close", (e) => {
        if(!app.isQuitting && minimizeToTray){
            e.preventDefault();
            dashboardWindow.hide();
            if(overlayWindow) overlayWindow.hide();
        }
    });
    if(saved && saved.maximized) dashboardWindow.maximize();
}

function loadProfileFile(profileName){
    try {
        if(!/^[\w-]+$/.test(profileName)) return null;
        const profilePath = path.join(__dirname, "profiles", `${profileName}.json`);
        if(!fs.existsSync(profilePath)) return null;
        return JSON.parse(fs.readFileSync(profilePath, "utf8"));
    } catch(e) {
        console.error(`Failed to load profile ${profileName}:`, e);
        return null;
    }
}

function registerAllShortcuts(){
    globalShortcut.unregisterAll();
    const cfg = config.shortcuts;
    Object.entries({
        [cfg.hide]: () => { if(overlayWindow) overlayWindow.hide(); },
        [cfg.show]: () => { if(overlayWindow) overlayWindow.show(); },
        [cfg.toggleRGB]: () => { if(overlayWindow) overlayWindow.webContents.send("toggle-rgb"); }
    }).forEach(([key, fn]) => {
        try {
            globalShortcut.register(key, fn);
            registeredShortcuts[key] = true;
        } catch(e) {
            console.error(`Failed to register shortcut ${key}:`, e);
        }
    });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;
autoUpdater.setFeedURL({
    provider: "github",
    owner: "0Srp",
    repo: "Crosshair0"
});

autoUpdater.on("update-available", (info) => {
    console.log("[AutoUpdater] Update available:", info.version);
    if(dashboardWindow) dashboardWindow.webContents.send("update:available", info.version);
});

autoUpdater.on("download-progress", (p) => {
    if(dashboardWindow) dashboardWindow.webContents.send("update:progress", p.percent);
});

autoUpdater.on("update-downloaded", () => {
    if(dashboardWindow) dashboardWindow.webContents.send("update:downloaded");
});

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
    process.env.CROSSHAIR0_USER_DATA = app.getPath("userData");

    try { createTray(); } catch(e) { console.error("Tray error:", e); }

    const settings = getSettings();
    createOverlay(settings ? settings.display_index : 0);
    createDashboard();

    const launcher = new AutoLaunch({ name: "Crosshair0" });

    registerAllShortcuts();

    // Trigger auto-update check after a delay (not in dev)
    if(!app.isPackaged) {
        console.log("[AutoUpdater] Skipped: dev mode");
    } else {
        setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
    }

    let currentGame = null;
    setInterval(async () => {
        try {
            const game = await detectRunningGame();
            _lastDetectedGame = game;
            if(!game){
                if(currentGame && _revertOnExit){
                    const s = getSettings();
                    if(s) overlayWindow.webContents.send("crosshair:update", s);
                }
                currentGame = null;
                if(overlayWindow) overlayWindow.webContents.send("cursor:set", true);
                if(dashboardWindow){
                    dashboardWindow.webContents.send("game:detected", null);
                    dashboardWindow.webContents.send("game:profile-active", null);
                }
                return;
            }
            if(currentGame === game) return;
            currentGame = game;
            if(overlayWindow) overlayWindow.webContents.send("cursor:set", false);
            const profile = loadProfileFile(game);
            if(profile){
                overlayWindow.webContents.send("crosshair:update", profile);
                console.log(`[Crosshair0] Auto-switched: ${game}`);
            }
            if(dashboardWindow){
                dashboardWindow.webContents.send("game:detected", game);
                dashboardWindow.webContents.send("game:profile-active", { game, profile });
            }
        } catch(err) {
            console.error(err);
        }
    }, 5000);
});

ipcMain.on("crosshair:update", (_, settings) => {
    if(!overlayWindow) return;
    overlayWindow.webContents.send("crosshair:update", settings);
});

ipcMain.handle("cursor:set", (_, visible) => {
    if(overlayWindow) overlayWindow.webContents.send("cursor:set", visible);
});

ipcMain.on("crosshair:updateOffset", (_, data) => {
    if(!overlayWindow) return;
    overlayWindow.webContents.send("crosshair:updateOffset", data);
});

ipcMain.handle("settings:save", async (_, settings) => {
    saveSettings(settings);
    return true;
});

ipcMain.handle("settings:load", async () => {
    return getSettings();
});

ipcMain.handle("settings:reset", async () => {
    saveSettings(config.defaultSettings);
    const s = getSettings();
    if(overlayWindow) overlayWindow.webContents.send("crosshair:update", config.defaultSettings);
    return config.defaultSettings;
});

ipcMain.handle("config:get", async () => {
    return { presets: config.presets, shortcuts: config.shortcuts, defaultSettings: config.defaultSettings, minimizeToTray, revertOnExit: _revertOnExit };
});

ipcMain.handle("shortcut:update", async (_, key, value) => {
    config.shortcuts[key] = value;
    config.save();
    registerAllShortcuts();
    return true;
});

ipcMain.handle("displays:list", async () => {
    return screen.getAllDisplays().map((d, i) => ({
        index: i,
        width: d.bounds.width,
        height: d.bounds.height,
        x: d.bounds.x,
        y: d.bounds.y,
        primary: d === screen.getPrimaryDisplay()
    }));
});

ipcMain.handle("overlay:recreate", async (_, index) => {
    createOverlay(index);
    const settings = getSettings();
    if(settings && overlayWindow){
        setTimeout(() => {
            overlayWindow.webContents.send("crosshair:update", settings);
        }, 500);
    }
    return true;
});

ipcMain.handle("profile:save", async (_, { name, data }) => {
    saveProfile(name, data);
    return true;
});

ipcMain.handle("profile:load", async (_, name) => {
    return loadProfile(name);
});

ipcMain.handle("profile:list", async () => {
    return getProfiles();
});

ipcMain.handle("profile:delete", async (_, name) => {
    deleteProfile(name);
    return true;
});

ipcMain.handle("profile:rename", async (_, oldName, newName) => {
    return renameProfile(oldName, newName);
});

ipcMain.handle("custom-preset:save", async (_, name, data) => {
    saveCustomPreset(name, data);
    return true;
});

ipcMain.handle("custom-preset:list", async () => {
    return getCustomPresets();
});

ipcMain.handle("custom-preset:delete", async (_, id) => {
    deleteCustomPreset(id);
    return true;
});

ipcMain.handle("config:update", async (_, updates) => {
    const allowed = new Set(["minimizeToTray", "revertOnExit"]);
    for(const key of Object.keys(updates)){
        if(!allowed.has(key)) continue;
        config[key] = updates[key];
    }
    if(updates.minimizeToTray !== undefined) minimizeToTray = updates.minimizeToTray;
    if(updates.revertOnExit !== undefined) _revertOnExit = updates.revertOnExit;
    config.save();
    return true;
});

ipcMain.handle("profile:export", async (_, data) => {
    const result = await dialog.showSaveDialog(dashboardWindow, {
        defaultPath: "crosshair-profile.json",
        filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if(result.canceled) return false;
    exportProfile(result.filePath, data);
    return true;
});

ipcMain.handle("profile:import", async () => {
    const result = await dialog.showOpenDialog(dashboardWindow, {
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"]
    });
    if(result.canceled) return null;
    try {
        return importProfile(result.filePaths[0]);
    } catch(e) {
        return null;
    }
});

const autoLauncher = new AutoLaunch({ name: "Crosshair0" });

ipcMain.handle("auto-launch:get", async () => {
    try { return await autoLauncher.isEnabled(); } catch(e) { return false; }
});

ipcMain.handle("auto-launch:set", async (_, enabled) => {
    try {
        if(enabled) await autoLauncher.enable();
        else await autoLauncher.disable();
        return true;
    } catch(e) { return false; }
});

ipcMain.on("fps:toggle", (_, settings) => {
    if(overlayWindow) overlayWindow.webContents.send("fps:toggle");
});

const { getTranslations } = require("./i18n/index");

ipcMain.handle("language:translations", async (_, lang) => {
    return getTranslations(lang);
});

ipcMain.handle("language:get", async () => {
    try {
        const p = path.join(process.env.CROSSHAIR0_USER_DATA || __dirname, "userConfig.json");
        if(fs.existsSync(p)){
            const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
            return cfg.language || "en";
        }
    } catch(e) {}
    return "en";
});

let _lastDetectedGame = null;

ipcMain.handle("game:detected", async () => {
    return _lastDetectedGame || null;
});

ipcMain.handle("language:set", async (_, lang) => {
    try {
        const p = path.join(process.env.CROSSHAIR0_USER_DATA || __dirname, "userConfig.json");
        let cfg = {};
        if(fs.existsSync(p)) cfg = JSON.parse(fs.readFileSync(p, "utf8"));
        cfg.language = lang;
        fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
        return true;
    } catch(e) { return false; }
});



ipcMain.handle("custom-preset:favorite", async (_, id) => {
    return toggleCustomPresetFavorite(id);
});

ipcMain.on("history:add", (_, data) => {
    addHistory(data);
});

ipcMain.handle("history:list", async () => {
    return getHistory();
});

ipcMain.handle("share:link", async (_, data) => {
    const json = JSON.stringify(data);
    const encoded = Buffer.from(json, "utf8").toString("base64url");
    return `crosshair0://${encoded}`;
});

ipcMain.handle("share:load", async (_, code) => {
    try {
        const prefix = "crosshair0://";
        const b64 = code.startsWith(prefix) ? code.slice(prefix.length) : code;
        const json = Buffer.from(b64, "base64url").toString("utf8");
        return JSON.parse(json);
    } catch(e) {
        return null;
    }
});

ipcMain.handle("update:check", async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        const latest = result?.updateInfo?.version;
        const current = app.getVersion();
        if(latest && latest !== current){
            return { latest, current, hasUpdate: true };
        }
        return { latest, current, hasUpdate: false };
    } catch(e) {
        try {
            const result = await new Promise((resolve) => {
                https.get("https://api.github.com/repos/0Srp/Crosshair0/releases/latest", {
                    headers: { "User-Agent": "Crosshair0" }
                }, (res) => {
                    let data = "";
                    res.on("data", chunk => data += chunk);
                    res.on("end", () => {
                        try {
                            const release = JSON.parse(data);
                            const latest = (release.tag_name || release.name || "").replace(/^v/, "");
                            const current = app.getVersion();
                            resolve({ latest, current, hasUpdate: latest !== current && !!latest });
                        } catch(e) { resolve(null); }
                    });
                }).on("error", () => resolve(null));
            });
            return result;
        } catch(e) { return null; }
    }
});

ipcMain.handle("update:checkAuto", async () => {
    try {
        autoUpdater.setFeedURL({ provider: "github", owner: "0Srp", repo: "Crosshair0" });
        const result = await autoUpdater.checkForUpdates();
        return result?.updateInfo?.version !== app.getVersion();
    } catch(e) {
        console.error("Auto-update check failed:", e);
        return false;
    }
});

ipcMain.handle("update:install", async () => {
    setImmediate(() => autoUpdater.quitAndInstall());
    return true;
});

const ALLOWED_GAMES = new Set(["cs2", "valorant", "fivem", "apex", "fortnite", "overwatch", "pubg", "r6", "cod"]);

ipcMain.on("game:assign", (_, { game, name }) => {
    try {
        if(!ALLOWED_GAMES.has(game)) return;
        if(!/^[\w\s-]+$/.test(name)) return;
        const profile = loadProfile(name);
        if(profile){
            saveProfile("game_" + game, profile);
            const profilePath = path.join(__dirname, "profiles", `${game}.json`);
            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        }
    } catch(e) { console.error("Failed to assign game profile:", e); }
});

ipcMain.on("game:reset", (_, game) => {
    try {
        if(!ALLOWED_GAMES.has(game)) return;
        deleteProfile("game_" + game);
        const profilePath = path.join(__dirname, "profiles", `${game}.json`);
        if(fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
    } catch(e) { console.error("Failed to reset game assignment:", e); }
});

app.on("window-all-closed", () => {
    if(process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});
