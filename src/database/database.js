const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let _db = null;
let _migrated = false;

function getDb(){
    if(_db) return _db;
    const userData = process.env.CROSSHAIR0_USER_DATA || path.join(require("os").homedir(), ".Crosshair0");
    if(!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
    _db = new Database(path.join(userData, "Crosshair0.db"));
    _db.pragma("journal_mode = WAL");
    if(!_migrated){ _migrated = true; migrate(); }
    return _db;
}

function migrate(){
    const db = _db;
    db.exec(`
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    type TEXT, color TEXT, size INTEGER, gap INTEGER,
    thickness INTEGER, opacity REAL, outline INTEGER,
    outlineColor TEXT, outline_thickness INTEGER DEFAULT 1,
    center_dot INTEGER DEFAULT 0, rgb INTEGER,
    rgb_speed REAL DEFAULT 2.0, display_index INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE, data TEXT
);
CREATE TABLE IF NOT EXISTS custom_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, data TEXT, favorite INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT, created_at TEXT DEFAULT (datetime('now'))
);
    `);
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    const newCols = {
        outline_thickness: "INTEGER DEFAULT 1",
        center_dot: "INTEGER DEFAULT 0",
        rgb_speed: "REAL DEFAULT 2.0",
        display_index: "INTEGER DEFAULT 0",
        rotation: "REAL DEFAULT 0",
        outline_opacity: "REAL DEFAULT 1.0",
        layer2_enabled: "INTEGER DEFAULT 0",
        layer2_type: "TEXT DEFAULT 'cross'",
        layer2_color: "TEXT DEFAULT '#00ff00'",
        layer2_size: "INTEGER DEFAULT 30",
        layer2_gap: "INTEGER DEFAULT 6",
        layer2_thickness: "INTEGER DEFAULT 2",
        layer2_rotation: "REAL DEFAULT 0",
        fps_enabled: "INTEGER DEFAULT 1",
        offset_x: "INTEGER DEFAULT 0",
        offset_y: "INTEGER DEFAULT 0"
    };
    Object.entries(newCols).forEach(([name, def]) => {
        if(!cols.includes(name)){
            db.exec(`ALTER TABLE settings ADD COLUMN ${name} ${def}`);
        }
    });
    const pCols = db.prepare("PRAGMA table_info(custom_presets)").all().map(c => c.name);
    if(!pCols.includes("favorite")){
        db.exec("ALTER TABLE custom_presets ADD COLUMN favorite INTEGER DEFAULT 0");
    }
}

function fillSettings(s){
    return {
        ...s,
        rotation: s.rotation || 0,
        outline_opacity: s.outline_opacity !== null ? s.outline_opacity : 1,
        layer2_enabled: s.layer2_enabled ? true : false,
        layer2_type: s.layer2_type || "cross",
        layer2_color: s.layer2_color || "#00ff00",
        layer2_size: s.layer2_size || 30,
        layer2_gap: s.layer2_gap || 6,
        layer2_thickness: s.layer2_thickness || 2,
        layer2_rotation: s.layer2_rotation || 0,
        fps_enabled: s.fps_enabled !== undefined ? s.fps_enabled : true,
        offset_x: s.offset_x || 0,
        offset_y: s.offset_y || 0
    };
}

function getSettings(){
    const db = getDb();
    const row = db.prepare("SELECT * FROM settings LIMIT 1").get();
    return row ? fillSettings(row) : null;
}

function saveSettings(settings){
    const db = getDb();
    db.prepare("DELETE FROM settings").run();
    db.prepare(`
        INSERT INTO settings(
            id, type, color, size, gap, thickness, opacity,
            outline, outlineColor, outline_thickness, center_dot,
            rgb, rgb_speed, display_index, rotation, outline_opacity,
            layer2_enabled, layer2_type, layer2_color, layer2_size,
            layer2_gap, layer2_thickness, layer2_rotation, fps_enabled,
            offset_x, offset_y
        ) VALUES(
            1,?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?,
            ?,?,?,?,?, ?,?,?,?,?
        )
    `).run(
        settings.type, settings.color, settings.size, settings.gap,
        settings.thickness, settings.opacity,
        settings.outline ? 1 : 0, settings.outlineColor || "#000000",
        settings.outline_thickness || 1, settings.center_dot ? 1 : 0,
        settings.rgb ? 1 : 0, settings.rgb_speed || 2.0,
        settings.display_index || 0, settings.rotation || 0,
        settings.outline_opacity !== undefined ? settings.outline_opacity : 1.0,
        settings.layer2_enabled ? 1 : 0, settings.layer2_type || "cross",
        settings.layer2_color || "#00ff00", settings.layer2_size || 30,
        settings.layer2_gap || 6, settings.layer2_thickness || 2,
        settings.layer2_rotation || 0,
        settings.fps_enabled !== undefined ? (settings.fps_enabled ? 1 : 0) : 1,
        settings.offset_x || 0, settings.offset_y || 0
    );
}

function saveProfile(name, data){
    getDb().prepare("INSERT OR REPLACE INTO profiles(name, data) VALUES(?,?)").run(
        name, JSON.stringify(data)
    );
}

function loadProfile(name){
    const row = getDb().prepare("SELECT * FROM profiles WHERE name = ?").get(name);
    return row ? JSON.parse(row.data) : null;
}

function deleteProfile(name){
    getDb().prepare("DELETE FROM profiles WHERE name = ?").run(name);
}

function renameProfile(oldName, newName){
    const db = getDb();
    const row = db.prepare("SELECT * FROM profiles WHERE name = ?").get(oldName);
    if(!row) return false;
    db.prepare("DELETE FROM profiles WHERE name = ?").run(newName);
    db.prepare("UPDATE profiles SET name = ? WHERE name = ?").run(newName, oldName);
    return true;
}

function getProfiles(){
    return getDb().prepare("SELECT id, name FROM profiles ORDER BY name").all();
}

function saveCustomPreset(name, data){
    getDb().prepare("INSERT INTO custom_presets(name, data, favorite) VALUES(?,?,0)").run(name, JSON.stringify(data));
}

function getCustomPresets(){
    return getDb().prepare("SELECT id, name, data, favorite FROM custom_presets ORDER BY favorite DESC, id").all().map(r => ({
        id: r.id,
        name: r.name,
        favorite: !!r.favorite,
        ...JSON.parse(r.data)
    }));
}

function deleteCustomPreset(id){
    getDb().prepare("DELETE FROM custom_presets WHERE id = ?").run(id);
}

function toggleCustomPresetFavorite(id){
    const db = getDb();
    const row = db.prepare("SELECT favorite FROM custom_presets WHERE id = ?").get(id);
    if(!row) return false;
    db.prepare("UPDATE custom_presets SET favorite = ? WHERE id = ?").run(row.favorite ? 0 : 1, id);
    return true;
}

function addHistory(data){
    const db = getDb();
    db.prepare("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 9)").run();
    db.prepare("INSERT INTO history(data) VALUES(?)").run(JSON.stringify(data));
}

function getHistory(){
    return getDb().prepare("SELECT id, data FROM history ORDER BY id DESC LIMIT 10").all().map(r => ({
        id: r.id,
        name: r.name,
        ...JSON.parse(r.data)
    }));
}

module.exports = {
    getSettings, saveSettings,
    saveProfile, loadProfile, deleteProfile, renameProfile, getProfiles,
    saveCustomPreset, getCustomPresets, deleteCustomPreset, toggleCustomPresetFavorite,
    addHistory, getHistory
};