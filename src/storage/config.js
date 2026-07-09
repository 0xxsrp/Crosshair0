const fs = require("fs");
const path = require("path");

const defaults = {
    appName: "Crosshair0",
    version: "3.0.0",
    database: "Crosshair0.db",
    defaultSettings: {
        type: "cross", color: "#ff0000", size: 20, gap: 4, thickness: 4,
        opacity: 1, outline: false, outlineColor: "#000000",
        outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0,
        display_index: 0,
        rotation: 0,
        outline_opacity: 1.0, outline_type: "outline",
        offset_x: 0, offset_y: 0,
        layer2_enabled: false, layer2_type: "cross", layer2_color: "#00ff00",
        layer2_size: 30, layer2_gap: 6, layer2_thickness: 2, layer2_rotation: 0
    },
    presets: [
        { name: "CS:GO Classic", type: "cross", color: "#00ff00", size: 16, gap: 2, thickness: 2, opacity: 1, outline: true, outlineColor: "#000000", outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0 },
        { name: "Valorant Dot", type: "dot", color: "#ffffff", size: 10, gap: 0, thickness: 2, opacity: 0.9, outline: false, outlineColor: "#000000", outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0 },
        { name: "Apex Legends", type: "cross", color: "#ff0000", size: 24, gap: 4, thickness: 3, opacity: 1, outline: true, outlineColor: "#000000", outline_thickness: 1, center_dot: true, rgb: false, rgb_speed: 2.0 },
        { name: "Fortnite", type: "cross", color: "#00ffff", size: 20, gap: 2, thickness: 2, opacity: 1, outline: false, outlineColor: "#000000", outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0 },
        { name: "Rainbow Six", type: "x", color: "#ff6600", size: 22, gap: 0, thickness: 2, opacity: 1, outline: true, outlineColor: "#000000", outline_thickness: 1, center_dot: true, rgb: false, rgb_speed: 2.0 },
        { name: "Cyberpunk", type: "cross", color: "#ff00ff", size: 28, gap: 6, thickness: 4, opacity: 1, outline: true, outlineColor: "#00ffff", outline_thickness: 2, center_dot: true, rgb: true, rgb_speed: 1.5 },
        { name: "Minimal T", type: "t", color: "#ffffff", size: 14, gap: 2, thickness: 2, opacity: 0.7, outline: false, outlineColor: "#000000", outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0 },
        { name: "Classic Circle", type: "circle", color: "#00ff00", size: 30, gap: 0, thickness: 3, opacity: 0.9, outline: false, outlineColor: "#000000", outline_thickness: 1, center_dot: true, rgb: false, rgb_speed: 2.0 },
        { name: "Warzone", type: "cross", color: "#ffff00", size: 18, gap: 3, thickness: 3, opacity: 0.95, outline: true, outlineColor: "#000000", outline_thickness: 1, center_dot: false, rgb: false, rgb_speed: 2.0 }
    ],
    shortcuts: { hide: "F6", show: "F7", toggleRGB: "F8" }
};

function userDataDir(){
    return process.env.CROSSHAIR0_USER_DATA || __dirname;
}

function getConfigPath(){
    return path.join(userDataDir(), "userConfig.json");
}

let _overrides = null;
function getOverrides(){
    if(_overrides) return _overrides;
    try {
        const p = getConfigPath();
        if(fs.existsSync(p)) _overrides = JSON.parse(fs.readFileSync(p, "utf8"));
        else _overrides = {};
    } catch(e) { _overrides = {}; }
    return _overrides;
}

const config = {
    ...defaults,
    get shortcuts(){
        return { ...defaults.shortcuts, ...(getOverrides().shortcuts || {}) };
    },
    set shortcuts(v){
        getOverrides().shortcuts = v;
    },
    get minimizeToTray(){
        const o = getOverrides().minimizeToTray;
        return o !== undefined ? o : false;
    },
    set minimizeToTray(v){
        getOverrides().minimizeToTray = v;
    },
    get revertOnExit(){
        const o = getOverrides().revertOnExit;
        return o !== undefined ? o : true;
    },
    set revertOnExit(v){
        getOverrides().revertOnExit = v;
    }
};

function save(){
    try {
        const data = {
            shortcuts: config.shortcuts,
            minimizeToTray: config.minimizeToTray,
            revertOnExit: config.revertOnExit
        };
        const dir = userDataDir();
        if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2));
    } catch(e) { console.error("Failed to save config:", e); }
}

config.save = save;

module.exports = config;