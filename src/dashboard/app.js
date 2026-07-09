// ===== I18N =====
let _t = (k,v) => k;
const _translations = {};
let _currentLang = "en";

async function loadTranslations(lang){
    const t = await window.CrosshairAPI.getTranslations(lang);
    Object.assign(_translations, t);
    _currentLang = lang;
}

function applyLang(lang){
    loadTranslations(lang).then(() => {
        window.CrosshairAPI.setLanguage(lang);
        _t = (key, vars) => {
            let str = _translations[key];
            if(!str) return key;
            if(vars) Object.entries(vars).forEach(([k,v]) => str = str.replace(`{${k}}`, v));
            return str;
        };
        document.querySelectorAll("[data-i18n]").forEach(el => {
            el.textContent = _t(el.dataset.i18n);
            if(el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = _t(el.dataset.i18n);
        });
        document.getElementById("confirm-ok").textContent = _t("profiles.ok") || "OK";
        document.getElementById("confirm-cancel").textContent = _t("profiles.cancel") || "Cancel";
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = lang;
        document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
    });
}

// Load initial language
window.CrosshairAPI.getLanguage().then(lang => {
    applyLang(lang);
    // Also refresh profile manager buttons text
    refreshProfilesList();
});

// ===== TOAST =====
function showToast(msg, type){
    type = type || "info";
    const c = document.getElementById("toast-container");
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.remove(); }, 3000);
}

// ===== CONFIRM =====
let _confirmResolve = null;
document.getElementById("confirm-ok").addEventListener("click", () => {
    document.getElementById("confirm-overlay").classList.add("hidden");
    if(_confirmResolve) _confirmResolve(true);
});
document.getElementById("confirm-cancel").addEventListener("click", () => {
    document.getElementById("confirm-overlay").classList.add("hidden");
    if(_confirmResolve) _confirmResolve(false);
});
function showConfirm(msg){
    return new Promise(resolve => {
        document.getElementById("confirm-msg").textContent = msg;
        document.getElementById("confirm-overlay").classList.remove("hidden");
        _confirmResolve = resolve;
    });
}

// ===== DOM REFS =====
const type = document.getElementById("type");
const color = document.getElementById("color");
const size = document.getElementById("size");
const gap = document.getElementById("gap");
const thickness = document.getElementById("thickness");
const opacity = document.getElementById("opacity");
const rotation = document.getElementById("rotation");
const rgb = document.getElementById("rgb");
const outline = document.getElementById("outline");
const outlineColor = document.getElementById("outline-color");
const outlineThickness = document.getElementById("outline-thickness");
const outlineOpacity = document.getElementById("outline-opacity");
const centerDot = document.getElementById("center-dot");
const rgbSpeed = document.getElementById("rgb-speed");
const offsetX = document.getElementById("offset-x");
const offsetY = document.getElementById("offset-y");
const preview = document.getElementById("preview-crosshair");

// Layer2
const layer2Enable = document.getElementById("layer2-enable");
const layer2Type = document.getElementById("layer2-type");
const layer2Color = document.getElementById("layer2-color");
const layer2Size = document.getElementById("layer2-size");
const layer2Gap = document.getElementById("layer2-gap");
const layer2Thickness = document.getElementById("layer2-thickness");
const layer2Rotation = document.getElementById("layer2-rotation");

let fpsEnabled = true;

// ===== UNDO / REDO =====
const historyMax = 50;
let undoStack = [];
let redoStack = [];
let historyPaused = false;

function pushHistory(){
    if(historyPaused) return;
    undoStack.push(currentSettings());
    if(undoStack.length > historyMax) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
}

document.addEventListener("keydown", e => {
    if((e.ctrlKey || e.metaKey) && e.key === "z"){
        e.preventDefault();
        if(undoStack.length){
            redoStack.push(currentSettings());
            const s = undoStack.pop();
            historyPaused = true;
            applySettingsToUI(s);
            document.getElementById("outline-options").classList.toggle("hidden", !s.outline);
            updateLabels();
            drawPreview();
            historyPaused = false;
            updateUndoButtons();
        }
    }
    if((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))){
        e.preventDefault();
        if(redoStack.length){
            undoStack.push(currentSettings());
            const s = redoStack.pop();
            historyPaused = true;
            applySettingsToUI(s);
            document.getElementById("outline-options").classList.toggle("hidden", !s.outline);
            updateLabels();
            drawPreview();
            historyPaused = false;
            updateUndoButtons();
        }
    }
});

function updateUndoButtons(){
    const ub = document.getElementById("undo-btn");
    const rb = document.getElementById("redo-btn");
    if(ub) ub.disabled = !undoStack.length;
    if(rb) rb.disabled = !redoStack.length;
}

// Add undo/redo buttons after the preview
function addUndoButtons(){
    const box = document.querySelector(".preview-card .preview-box");
    if(!box) return;
    const div = document.createElement("div");
    div.className = "undo-redo";
    div.innerHTML = `<button id="undo-btn" disabled>↩ Undo</button><button id="redo-btn" disabled>↪ Redo</button>`;
    box.parentNode.insertBefore(div, box.nextSibling);
    document.getElementById("undo-btn").addEventListener("click", () => {
        if(undoStack.length){
            redoStack.push(currentSettings());
            const s = undoStack.pop();
            historyPaused = true;
            applySettingsToUI(s);
            document.getElementById("outline-options").classList.toggle("hidden", !s.outline);
            updateLabels();
            drawPreview();
            historyPaused = false;
            updateUndoButtons();
        }
    });
    document.getElementById("redo-btn").addEventListener("click", () => {
        if(redoStack.length){
            undoStack.push(currentSettings());
            const s = redoStack.pop();
            historyPaused = true;
            applySettingsToUI(s);
            document.getElementById("outline-options").classList.toggle("hidden", !s.outline);
            updateLabels();
            drawPreview();
            historyPaused = false;
            updateUndoButtons();
        }
    });
}

// ===== SETTINGS STATE =====
const defaults = {
    type: "cross", color: "#ff0000", size: 20, gap: 4, thickness: 4,
    opacity: 1, outline: false, outlineColor: "#000000",
    outline_thickness: 1, outline_opacity: 1, center_dot: false,
    rgb: false, rgb_speed: 2.0, display_index: 0, rotation: 0,
    layer2_enabled: false, layer2_type: "cross", layer2_color: "#00ff00",
    layer2_size: 30, layer2_gap: 6, layer2_thickness: 2, layer2_rotation: 0,
    fps_enabled: true,
    offset_x: 0, offset_y: 0
};

function currentSettings(){
    const ds = document.getElementById("display-select");
    return {
        type: type.value,
        color: color.value,
        size: Number(size.value),
        gap: Number(gap.value),
        thickness: Number(thickness.value),
        opacity: Number(opacity.value),
        rotation: Number(rotation.value),
        outline: outline.checked,
        outlineColor: outlineColor.value,
        outline_thickness: Number(outlineThickness.value),
        outline_opacity: Number(outlineOpacity.value),
        center_dot: centerDot.checked,
        rgb: rgb.checked,
        rgb_speed: Number(rgbSpeed.value),
        display_index: ds ? Number(ds.value || 0) : 0,
        layer2_enabled: layer2Enable.checked,
        layer2_type: layer2Type.value,
        layer2_color: layer2Color.value,
        layer2_size: Number(layer2Size.value),
        layer2_gap: Number(layer2Gap.value),
        layer2_thickness: Number(layer2Thickness.value),
        layer2_rotation: Number(layer2Rotation.value),
        fps_enabled: fpsEnabled,
        offset_x: Number(offsetX.value),
        offset_y: Number(offsetY.value)
    };
}

function applySettingsToUI(s){
    type.value = s.type || defaults.type;
    color.value = s.color || defaults.color;
    size.value = s.size ?? defaults.size;
    gap.value = s.gap ?? defaults.gap;
    thickness.value = s.thickness ?? defaults.thickness;
    opacity.value = s.opacity ?? defaults.opacity;
    rotation.value = s.rotation ?? 0;
    outline.checked = Boolean(s.outline);
    outlineColor.value = s.outlineColor || defaults.outlineColor;
    outlineThickness.value = s.outline_thickness ?? defaults.outline_thickness;
    outlineOpacity.value = s.outline_opacity ?? 1;
    centerDot.checked = Boolean(s.center_dot);
    rgb.checked = Boolean(s.rgb);
    rgbSpeed.value = s.rgb_speed ?? defaults.rgb_speed;
    layer2Enable.checked = Boolean(s.layer2_enabled);
    layer2Type.value = s.layer2_type || "cross";
    layer2Color.value = s.layer2_color || "#00ff00";
    layer2Size.value = s.layer2_size ?? 30;
    layer2Gap.value = s.layer2_gap ?? 6;
    layer2Thickness.value = s.layer2_thickness ?? 2;
    layer2Rotation.value = s.layer2_rotation ?? 0;
    offsetX.value = s.offset_x ?? 0;
    offsetY.value = s.offset_y ?? 0;
    const ds = document.getElementById("display-select");
    if(ds && s.display_index !== undefined) ds.value = s.display_index;
    document.getElementById("outline-options").classList.toggle("hidden", !s.outline);
    document.getElementById("layer2-options").classList.toggle("hidden", !s.layer2_enabled);
    fpsEnabled = s.fps_enabled !== undefined ? s.fps_enabled : true;
}

function updateLabels(){
    document.getElementById("size-val").textContent = size.value;
    document.getElementById("gap-val").textContent = gap.value;
    document.getElementById("thickness-val").textContent = thickness.value;
    document.getElementById("opacity-val").textContent = opacity.value;
    document.getElementById("rotation-val").textContent = rotation.value + "\u00B0";
    document.getElementById("outline-thickness-val").textContent = outlineThickness.value;
    document.getElementById("outline-opacity-val").textContent = outlineOpacity.value;
    document.getElementById("rgb-speed-val").textContent = rgbSpeed.value;
    document.getElementById("layer2-size-val").textContent = layer2Size.value;
    document.getElementById("layer2-gap-val").textContent = layer2Gap.value;
    document.getElementById("layer2-thickness-val").textContent = layer2Thickness.value;
    document.getElementById("layer2-rotation-val").textContent = layer2Rotation.value;
    document.getElementById("offset-x-val").textContent = offsetX.value;
    document.getElementById("offset-y-val").textContent = offsetY.value;
}

// ===== RESET INDIVIDUAL =====
const resetDefaults = {
    type: "cross", color: "#ff0000", size: 20, gap: 4, thickness: 4,
    opacity: 1, rotation: 0, outline: false, outlineColor: "#000000",
    outline_thickness: 1, outline_opacity: 1, center_dot: false,
    rgb: false, rgb_speed: 2.0,
    layer2_enabled: false, layer2_type: "cross", layer2_color: "#00ff00",
    layer2_size: 30, layer2_gap: 6, layer2_thickness: 2, layer2_rotation: 0,
    fps_enabled: true,
    offset_x: 0, offset_y: 0
};

document.querySelectorAll(".reset-val").forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const el = document.getElementById(target);
        if(!el) return;
        const def = resetDefaults[target];
        if(def !== undefined){
            if(el.type === "checkbox") el.checked = Boolean(def);
            else el.value = def;
        }
        if(target === "outline"){
            document.getElementById("outline-options").classList.toggle("hidden", !el.checked);
        }
        updateLabels();
        drawPreview();
        pushHistory();
        showToast(_t("editor.resetHint"), "info");
    });
});

// ===== PREVIEW RENDERERS =====
function renderPreviewCross(s, cx, cy){
    const t = s.thickness, sz = s.size, g = s.gap, c = s.color, o = s.opacity, r = s.rotation || 0;
    const out = s.outline ? `${s.outline_thickness||1}px solid ${s.outlineColor||"#000"}` : "";
    const outlineStyle = out ? `outline:${out};outline-offset:1px;` : "";
    const rot = r ? `transform:rotate(${r}deg);transform-origin:${cx}px ${cy}px;` : "";
    preview.innerHTML = `<div style="position:absolute;width:${t}px;height:${sz}px;background:${c};left:${cx-t/2}px;top:${cy-g-sz}px;opacity:${o};${outlineStyle}${rot}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${t}px;height:${sz}px;background:${c};left:${cx-t/2}px;top:${cy+g}px;opacity:${o};${outlineStyle}${rot}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${sz}px;height:${t}px;background:${c};left:${cx-g-sz}px;top:${cy-t/2}px;opacity:${o};${outlineStyle}${rot}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${sz}px;height:${t}px;background:${c};left:${cx+g}px;top:${cy-t/2}px;opacity:${o};${outlineStyle}${rot}"></div>`;
    if(s.center_dot){
        const ds = Math.max(3, t);
        preview.innerHTML += `<div style="position:absolute;width:${ds}px;height:${ds}px;border-radius:50%;background:${c};left:${cx-ds/2}px;top:${cy-ds/2}px;opacity:${o}"></div>`;
    }
}

function renderPreviewDot(s, cx, cy){
    const o = s.opacity;
    preview.innerHTML = `<div style="width:${s.size}px;height:${s.size}px;background:${s.color};border-radius:50%;opacity:${o};position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)"></div>`;
}

function renderPreviewCircle(s, cx, cy){
    preview.innerHTML = `<div style="width:${s.size}px;height:${s.size}px;border:${s.thickness}px solid ${s.color};border-radius:50%;opacity:${s.opacity};position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)"></div>`;
    if(s.center_dot){
        const ds = Math.max(3, s.thickness);
        preview.innerHTML += `<div style="position:absolute;width:${ds}px;height:${ds}px;border-radius:50%;background:${s.color};left:${cx-ds/2}px;top:${cy-ds/2}px;opacity:${s.opacity}"></div>`;
    }
}

function renderPreviewX(s, cx, cy){
    const len = s.size * 0.7, t = s.thickness, c = s.color, o = s.opacity, r = s.rotation || 0;
    const base = `transform-origin:${cx}px ${cy}px;`;
    const rot1 = `transform:rotate(${45+r}deg);transform-origin:${cx}px ${cy}px;`;
    const rot2 = `transform:rotate(${-45+r}deg);transform-origin:${cx}px ${cy}px;`;
    preview.innerHTML = `<div style="position:absolute;width:${len}px;height:${t}px;background:${c};left:${cx-len/2}px;top:${cy-t/2}px;opacity:${o};${rot1}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${len}px;height:${t}px;background:${c};left:${cx-len/2}px;top:${cy-t/2}px;opacity:${o};${rot2}"></div>`;
    if(s.center_dot){
        const ds = Math.max(3, t);
        preview.innerHTML += `<div style="position:absolute;width:${ds}px;height:${ds}px;border-radius:50%;background:${c};left:${cx-ds/2}px;top:${cy-ds/2}px;opacity:${o}"></div>`;
    }
}

function renderPreviewT(s, cx, cy){
    const t = s.thickness, sz = s.size, g = s.gap, c = s.color, o = s.opacity, r = s.rotation || 0;
    const rot = r ? `transform:rotate(${r}deg);transform-origin:${cx}px ${cy}px;` : "";
    preview.innerHTML = `<div style="position:absolute;width:${sz}px;height:${t}px;background:${c};left:${cx-g-sz}px;top:${cy-t/2}px;opacity:${o};${rot}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${sz}px;height:${t}px;background:${c};left:${cx+g}px;top:${cy-t/2}px;opacity:${o};${rot}"></div>`;
    preview.innerHTML += `<div style="position:absolute;width:${t}px;height:${sz}px;background:${c};left:${cx-t/2}px;top:${cy+g}px;opacity:${o};${rot}"></div>`;
    if(s.center_dot){
        const ds = Math.max(3, t);
        preview.innerHTML += `<div style="position:absolute;width:${ds}px;height:${ds}px;border-radius:50%;background:${c};left:${cx-ds/2}px;top:${cy-ds/2}px;opacity:${o}"></div>`;
    }
}

function drawPreview(){
    const s = currentSettings();
    preview.innerHTML = "";
    const cx = 75 + (s.offset_x || 0) * 0.3, cy = 75 + (s.offset_y || 0) * 0.3;
    if(s.type === "dot"){ renderPreviewDot(s, cx, cy); }
    else if(s.type === "circle"){ renderPreviewCircle(s, cx, cy); }
    else if(s.type === "x"){ renderPreviewX(s, cx, cy); }
    else if(s.type === "t"){ renderPreviewT(s, cx, cy); }
    else { renderPreviewCross(s, cx, cy); }

    if(s.layer2_enabled){
        const l2cx = 75 + (s.offset_x || 0) * 0.3, l2cy = 75 + (s.offset_y || 0) * 0.3;
        const l2 = { ...s, type: s.layer2_type || "cross", color: s.layer2_color || "#00ff00", size: s.layer2_size || 30, gap: s.layer2_gap || 6, thickness: s.layer2_thickness || 2, rotation: s.layer2_rotation || 0, center_dot: false };
        if(l2.type === "dot") renderPreviewDot(l2, l2cx, l2cy);
        else if(l2.type === "circle") renderPreviewCircle(l2, l2cx, l2cy);
        else if(l2.type === "x") renderPreviewX(l2, l2cx, l2cy);
        else if(l2.type === "t") renderPreviewT(l2, l2cx, l2cy);
        else renderPreviewCross(l2, l2cx, l2cy);
    }
}

// ===== INPUT EVENTS =====
const allInputs = [type, color, size, gap, thickness, opacity, rotation, offsetX, offsetY, rgb, outline, outlineColor, outlineThickness, outlineOpacity, centerDot, rgbSpeed, layer2Type, layer2Color, layer2Size, layer2Gap, layer2Thickness, layer2Rotation];
allInputs.forEach(el => {
    el.addEventListener("input", () => { drawPreview(); updateLabels(); pushHistory(); });
});

[offsetX, offsetY].forEach(el => {
    el.addEventListener("input", () => {
        window.CrosshairAPI.updateOffset(Number(offsetX.value), Number(offsetY.value));
    });
});

outline.addEventListener("change", () => {
    document.getElementById("outline-options").classList.toggle("hidden", !outline.checked);
    pushHistory();
});

layer2Enable.addEventListener("change", () => {
    document.getElementById("layer2-options").classList.toggle("hidden", !layer2Enable.checked);
    pushHistory();
    drawPreview();
});

// ===== APPLY / SAVE / RESET =====
document.getElementById("apply").addEventListener("click", () => {
    window.CrosshairAPI.update(currentSettings());
    addToHistory();
    showToast(_t("toast.settingsSaved"), "success");
});

document.getElementById("save").addEventListener("click", async () => {
    await window.CrosshairAPI.saveSettings(currentSettings());
    addToHistory();
    showToast(_t("toast.settingsSaved"), "success");
});

document.getElementById("reset-btn").addEventListener("click", async () => {
    if(!await showConfirm(_t("confirm.resetAll"))) return;
    await window.CrosshairAPI.resetSettings();
    applySettingsToUI(defaults);
    updateLabels();
    drawPreview();
    showToast(_t("toast.settingsReset"), "success");
});

// ===== COPY / PASTE =====
document.getElementById("copy-btn").addEventListener("click", () => {
    const json = JSON.stringify(currentSettings());
    navigator.clipboard.writeText(json);
    showToast(_t("toast.copied"), "success");
});

document.getElementById("paste-btn").addEventListener("click", async () => {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        if(!data.type) throw new Error("Invalid");
        applySettingsToUI(data);
        updateLabels();
        drawPreview();
        showToast(_t("toast.pasted"), "success");
    } catch(e) {
        showToast(_t("toast.invalidClipboard"), "error");
    }
});

// ===== SAVE TO PRESETS (custom user preset) =====
document.getElementById("save-preset-btn").addEventListener("click", async () => {
    const s = currentSettings();
    // Use inline rename-style modal
    const overlay = document.getElementById("confirm-overlay");
    const dialog = document.getElementById("confirm-dialog");
    const oldMsg = document.getElementById("confirm-msg");
    oldMsg.textContent = _t("profiles.name") + ":";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "rename-input";
    input.value = "Custom";
    oldMsg.parentNode.insertBefore(input, oldMsg.nextSibling);
    overlay.classList.remove("hidden");
    const name = await new Promise(resolve => {
        const ok = document.getElementById("confirm-ok");
        const cancel = document.getElementById("confirm-cancel");
        const h = () => { overlay.classList.add("hidden"); resolve(input.value); };
        const ch = () => { overlay.classList.add("hidden"); resolve(null); };
        ok.onclick = h; cancel.onclick = ch;
        input.addEventListener("keydown", e => { if(e.key === "Enter") h(); if(e.key === "Escape") ch(); });
        input.focus(); input.select();
    });
    input.remove();
    document.getElementById("confirm-ok").onclick = null;
    document.getElementById("confirm-cancel").onclick = null;
    // Restore original confirm
    document.getElementById("confirm-ok").addEventListener("click", () => {
        document.getElementById("confirm-overlay").classList.add("hidden");
        if(_confirmResolve) _confirmResolve(true);
    });
    document.getElementById("confirm-cancel").addEventListener("click", () => {
        document.getElementById("confirm-overlay").classList.add("hidden");
        if(_confirmResolve) _confirmResolve(false);
    });
    if(!name) return;
    await window.CrosshairAPI.saveCustomPreset(name, { ...s, name });
    loadPresets();
    showToast(_t("toast.addedToPresets"), "success");
});

// ===== EXPORT PNG =====
document.getElementById("export-png-btn").addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const s = currentSettings();
    const cx = 150, cy = 150;

    function drawOutline(x, y, w, h){
        if(!s.outline) return;
        ctx.strokeStyle = s.outlineColor || "#000";
        ctx.lineWidth = (s.outline_thickness || 1) * 2;
        ctx.strokeRect(x - (s.outline_thickness||1), y - (s.outline_thickness||1), w + (s.outline_thickness||1)*2, h + (s.outline_thickness||1)*2);
    }

    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = s.color;

    if(s.type === "dot"){
        ctx.beginPath(); ctx.arc(cx, cy, s.size/2, 0, Math.PI*2); ctx.fill();
    } else if(s.type === "circle"){
        ctx.strokeStyle = s.color; ctx.lineWidth = s.thickness;
        ctx.beginPath(); ctx.arc(cx, cy, s.size/2, 0, Math.PI*2); ctx.stroke();
        if(s.center_dot){ ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(cx, cy, Math.max(3,s.thickness)/2, 0, Math.PI*2); ctx.fill(); }
    } else {
        const t = s.thickness, sz = s.size, g = s.gap;
        const r = (s.rotation || 0) * Math.PI / 180;
        function rotate(x, y){
            const cos = Math.cos(r), sin = Math.sin(r);
            return [cx + (x-cx)*cos - (y-cy)*sin, cy + (x-cx)*sin + (y-cy)*cos];
        }
        function fillRect(x, y, w, h){
            const [rx, ry] = rotate(x + w/2, y + h/2);
            ctx.save(); ctx.translate(rx, ry); ctx.rotate(r);
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.restore();
            if(s.outline){
                ctx.save(); ctx.translate(rx, ry); ctx.rotate(r);
                drawOutline(-w/2, -h/2, w, h);
                ctx.restore();
            }
        }
        if(s.type === "cross"){
            fillRect(cx-t/2, cy-g-sz, t, sz);
            fillRect(cx-t/2, cy+g, t, sz);
            fillRect(cx-g-sz, cy-t/2, sz, t);
            fillRect(cx+g, cy-t/2, sz, t);
        } else if(s.type === "x"){
            const len = sz * 0.7;
            fillRect(cx-len/2, cy-t/2, len, t); // rotated by global rot in cross/X
        } else if(s.type === "t"){
            fillRect(cx-g-sz, cy-t/2, sz, t);
            fillRect(cx+g, cy-t/2, sz, t);
            fillRect(cx-t/2, cy+g, t, sz);
        }
        if(s.center_dot){
            ctx.fillStyle = s.color;
            ctx.beginPath(); ctx.arc(cx, cy, Math.max(3,t)/2, 0, Math.PI*2); ctx.fill();
        }
    }

    const link = document.createElement("a");
    link.download = "crosshair.png";
    link.href = canvas.toDataURL();
    link.click();
    showToast(_t("toast.pngExported"), "success");
});

// ===== COPY FOR CS2 =====
document.getElementById("copy-cs2").addEventListener("click", () => {
    const s = currentSettings();
    const style = s.type === "dot" ? 5 : s.type === "circle" ? 3 : s.type === "t" ? 2 : 4;
    const code = [
        `cl_crosshairstyle ${style}`,
        `cl_crosshairdot ${s.type === "dot" ? 1 : 0}`,
        `cl_crosshair_t ${s.type === "t" ? 1 : 0}`,
        `cl_crosshaircolor 5`,
        `cl_crosshaircolor_r ${parseInt(s.color.slice(1,3),16)}`,
        `cl_crosshaircolor_g ${parseInt(s.color.slice(3,5),16)}`,
        `cl_crosshaircolor_b ${parseInt(s.color.slice(5,7),16)}`,
        `cl_crosshairalpha ${Math.round(s.opacity * 255)}`,
        `cl_crosshairusealpha 1`,
        `cl_crosshairsize ${s.size}`,
        `cl_crosshairgap ${s.gap}`,
        `cl_crosshairthickness ${s.thickness}`,
        `cl_crosshair_drawoutline ${s.outline ? 1 : 0}`,
        `cl_crosshair_outlinethickness ${s.outline_thickness || 1}`,
        `cl_crosshair_sniper_width 1`
    ].join("; ");
    navigator.clipboard.writeText(code);
    showToast(_t("toast.cs2Copied"), "success");
});

document.getElementById("copy-valorant").addEventListener("click", () => {
    const s = currentSettings();
    const val = [
        `0;s:${s.type === "dot" ? 1 : 0};`,
        `c:${s.color};`,
        `o:${Math.round(s.opacity)};`,
        `f:${s.outline ? 1 : 0};`,
        `t:${s.thickness};`,
        `s:${s.size};`,
        `g:${s.gap};`,
        `d:${s.center_dot ? 1 : 0};`
    ].join("");
    navigator.clipboard.writeText(val);
    showToast(_t("toast.valorantCopied"), "success");
});

// ===== PREVIEW BACKGROUND =====
document.querySelectorAll(".bg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".bg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const box = document.querySelector(".preview-box");
        box.classList.remove("bg-light", "bg-transparent");
        if(btn.dataset.bg === "light") box.classList.add("bg-light");
        else if(btn.dataset.bg === "transparent") box.classList.add("bg-transparent");
    });
});

// ===== RENAME PROFILE =====
async function promptRename(oldName){
    const overlay = document.getElementById("confirm-overlay");
    const dialog = document.getElementById("confirm-dialog");
    const oldMsg = document.getElementById("confirm-msg");
    const oldOk = document.getElementById("confirm-ok");
    const oldCancel = document.getElementById("confirm-cancel");

    oldMsg.textContent = _t("profilesManager.renamePrompt");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "rename-input";
    input.value = oldName;
    oldMsg.parentNode.insertBefore(input, oldMsg.nextSibling);

    overlay.classList.remove("hidden");
    const result = await new Promise(resolve => {
        const okHandler = () => { overlay.classList.add("hidden"); resolve(input.value); };
        const cancelHandler = () => { overlay.classList.add("hidden"); resolve(null); };
        oldOk.onclick = okHandler;
        oldCancel.onclick = cancelHandler;
        input.addEventListener("keydown", e => { if(e.key === "Enter") okHandler(); if(e.key === "Escape") cancelHandler(); });
        input.focus();
        input.select();
    });

    input.remove();
    oldOk.onclick = null;
    oldCancel.onclick = null;
    // Restore original confirm behavior
    document.getElementById("confirm-ok").addEventListener("click", () => {
        document.getElementById("confirm-overlay").classList.add("hidden");
        if(_confirmResolve) _confirmResolve(true);
    });
    document.getElementById("confirm-cancel").addEventListener("click", () => {
        document.getElementById("confirm-overlay").classList.add("hidden");
        if(_confirmResolve) _confirmResolve(false);
    });

    if(!result || result === oldName) return;
    const success = await window.CrosshairAPI.renameProfile(oldName, result);
    if(success){
        refreshProfilesList();
        showToast(_t("toast.profileRenamed").replace("{name}", result), "success");
    }
}

// ===== PERSISTENT CUSTOM PRESETS (replaced above) =====

// ===== DISPLAY SELECT =====
async function loadDisplays(){
    const displays = await window.CrosshairAPI.getDisplays();
    const sel = document.getElementById("display-select");
    sel.innerHTML = "";
    displays.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.index;
        opt.textContent = d.primary ? `Display ${d.index+1} (Primary) - ${d.width}x${d.height}` : `Display ${d.index+1} - ${d.width}x${d.height}`;
        sel.appendChild(opt);
    });
    sel.addEventListener("change", async () => {
        await window.CrosshairAPI.recreateOverlay(Number(sel.value));
    });
}

// ===== SHORTCUTS =====
async function loadShortcuts(){
    const cfg = await window.CrosshairAPI.getConfig();
    document.getElementById("sc-hide").textContent = cfg.shortcuts.hide;
    document.getElementById("sc-show").textContent = cfg.shortcuts.show;
    document.getElementById("sc-rgb").textContent = cfg.shortcuts.toggleRGB;
    loadShortcutEditor();
}

// ===== PRESETS GALLERY (moved to loadCustomPresets) =====

// ===== PRESET SEARCH =====
document.getElementById("preset-search").addEventListener("input", function(){
    const q = this.value.toLowerCase();
    document.querySelectorAll(".preset-item").forEach(el => {
        const name = el.querySelector("span")?.textContent?.toLowerCase() || "";
        el.style.display = name.includes(q) ? "flex" : "none";
    });
});

// ===== PROFILE SEARCH =====
document.getElementById("profile-search-input")?.addEventListener("input", function(){
    const q = this.value.toLowerCase();
    document.querySelectorAll(".profile-manager-item").forEach(el => {
        const name = el.querySelector("span")?.textContent?.toLowerCase() || "";
        el.style.display = name.includes(q) ? "flex" : "none";
    });
});

// ===== FAVORITE PRESETS (loadCustomPresets override) =====
async function loadCustomPresets(){
    const presets = await window.CrosshairAPI.getCustomPresets();
    const grid = document.getElementById("presets-grid");
    grid.innerHTML = "";
    presets.forEach(p => {
        const card = document.createElement("div");
        card.className = "preset-item";
        const star = document.createElement("button");
        star.className = "preset-fav-btn" + (p.favorite ? " favorite" : "");
        star.textContent = "\u2605";
        star.addEventListener("click", async (e) => {
            e.stopPropagation();
            await window.CrosshairAPI.toggleFavoritePreset(p.id);
            loadCustomPresets();
        });
        const swatch = document.createElement("div");
        swatch.className = "preset-preview";
        swatch.style.background = p.color || "#fff";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name;
        card.appendChild(star);
        card.appendChild(swatch);
        card.appendChild(nameSpan);
        card.title = p.name;
        card.addEventListener("click", () => {
            applySettingsToUI(p);
            updateLabels();
            drawPreview();
        });
        grid.appendChild(card);
    });
    // Also load built-in presets after
    loadBuiltinPresets();
}
async function loadBuiltinPresets(){
    const cfg = await window.CrosshairAPI.getConfig();
    const grid = document.getElementById("presets-grid");
    cfg.presets.forEach(p => {
        const card = document.createElement("div");
        card.className = "preset-item";
        const swatch = document.createElement("div");
        swatch.className = "preset-preview";
        swatch.style.background = p.color;
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name;
        card.appendChild(swatch);
        card.appendChild(nameSpan);
        card.title = p.name;
        card.addEventListener("click", () => {
            applySettingsToUI(p);
            updateLabels();
            drawPreview();
        });
        grid.appendChild(card);
    });
}

// ===== GAME ASSIGNMENTS =====
async function loadGameAssignments(){
    const container = document.getElementById("game-assignments");
    if(!container) return;
    container.innerHTML = "";
    const games = ["cs2", "valorant", "fivem"];
    const profiles = await window.CrosshairAPI.getProfiles();
    for(const game of games){
        const p = profiles.find(p => p.name === "game_" + game);
        if(p){
            const data = await window.CrosshairAPI.loadProfile(p.name);
            if(data){
                const div = document.createElement("div");
                div.className = "game-assignment-item";
                const preview = document.createElement("div");
                preview.className = "game-assign-preview";
                preview.style.background = data.color || "#fff";
                const label = document.createElement("span");
                label.textContent = `${game.toUpperCase()}: ${data.type || "?"} (${data.size||"?"}px)`;
                const resetBtn = document.createElement("button");
                resetBtn.className = "reset-game-btn";
                resetBtn.textContent = _t("gameProfiles.reset") || "Reset";
                resetBtn.addEventListener("click", async () => {
                    await window.CrosshairAPI.deleteProfile(p.name);
                    showToast(_t("toast.gameReset").replace("{game}", game), "info");
                    loadGameAssignments();
                });
                div.appendChild(preview);
                div.appendChild(label);
                div.appendChild(resetBtn);
                container.appendChild(div);
            }
        }
    }
}

// ===== SHARE =====
document.getElementById("share-copy-link")?.addEventListener("click", async () => {
    const s = currentSettings();
    const link = await window.CrosshairAPI.getShareLink(s);
    navigator.clipboard.writeText(link);
    showToast(_t("toast.shareLinkCopied"), "success");
});
document.getElementById("share-import-link")?.addEventListener("click", async () => {
    try {
        const text = await navigator.clipboard.readText();
        const data = await window.CrosshairAPI.loadFromShare(text.trim());
        if(!data) throw new Error("Invalid");
        applySettingsToUI(data);
        updateLabels();
        drawPreview();
        showToast(_t("toast.profileImported"), "success");
    } catch(e) {
        showToast(_t("toast.invalidShareLink"), "error");
    }
});

// ===== HISTORY =====
async function addToHistory(){
    const s = currentSettings();
    await window.CrosshairAPI.addHistory(s);
}
async function loadHistory(){
    const list = document.getElementById("history-list");
    if(!list) return;
    const items = await window.CrosshairAPI.getHistory();
    list.innerHTML = "";
    if(!items.length){
        list.innerHTML = `<div style="color:#64748b;font-size:13px;">${_t("history.empty")}</div>`;
        return;
    }
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        const typeMap = { dot: "•", cross: "+", circle: "○", x: "✕", t: "⊥" };
        div.innerHTML = `<span>${typeMap[item.type] || "?"} ${item.type} - ${item.color}</span>`;
        const loadBtn = document.createElement("button");
        loadBtn.textContent = _t("history.load");
        loadBtn.addEventListener("click", () => {
            applySettingsToUI(item);
            updateLabels();
            drawPreview();
        });
        div.appendChild(loadBtn);
        list.appendChild(div);
    });
}

// ===== UPDATE CHECK =====
document.getElementById("check-update")?.addEventListener("click", async () => {
    showToast(_t("toast.checkingUpdate"), "info");
    const result = await window.CrosshairAPI.checkUpdate();
    if(!result){
        showToast(_t("toast.noUpdate"), "info");
        return;
    }
    if(result.hasUpdate){
        showToast(_t("toast.updateAvailable").replace("{version}", result.latest), "success");
    } else {
        showToast(_t("toast.noUpdate"), "info");
    }
    document.getElementById("update-version").textContent = _t("update.latest") + ": " + (result.latest || result.current);
});

window.CrosshairAPI.onUpdateAvailable((version) => {
    showToast(_t("toast.updateAvailable").replace("{version}", version), "success");
    document.getElementById("install-update-btn")?.classList.remove("hidden");
});

window.CrosshairAPI.onUpdateProgress((percent) => {
    const wrap = document.getElementById("update-progress-wrap");
    const bar = document.getElementById("update-progress-bar");
    const text = document.getElementById("update-progress-text");
    if(wrap) wrap.classList.remove("hidden");
    if(bar) bar.value = percent;
    if(text) text.textContent = Math.round(percent) + "%";
});

window.CrosshairAPI.onUpdateDownloaded(() => {
    document.getElementById("install-update-btn")?.classList.remove("hidden");
    document.getElementById("install-update-btn")?.classList.add("ready");
});

document.getElementById("install-update-btn")?.addEventListener("click", () => {
    window.CrosshairAPI.installUpdate();
});

// ===== PROFILES =====
const profileNameInput = document.getElementById("profile-name");
const profilesList = document.getElementById("profiles-list");

document.getElementById("save-profile").addEventListener("click", async () => {
    const name = profileNameInput.value.trim();
    if(!name){ showToast(_t("toast.profileNameRequired"), "error"); return; }
    await window.CrosshairAPI.saveProfile(name, currentSettings());
    showToast(_t("toast.profileSaved"), "success");
    refreshProfilesList();
});

document.getElementById("load-profile").addEventListener("click", async () => {
    const name = profilesList.value;
    if(!name) return;
    const data = await window.CrosshairAPI.loadProfile(name);
    if(!data){ showToast(_t("toast.profileNotFound"), "error"); return; }
    applySettingsToUI(data);
    updateLabels();
    drawPreview();
});

async function refreshProfilesList(){
    const list = await window.CrosshairAPI.getProfiles();
    profilesList.innerHTML = "";
    list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = p.name;
        profilesList.appendChild(opt);
    });
    const mgr = document.getElementById("profiles-manager-list");
    if(mgr){
        mgr.innerHTML = "";
        list.forEach(p => {
            const div = document.createElement("div");
            div.className = "profile-manager-item";
            const span = document.createElement("span");
            span.textContent = p.name;
            span.title = _t("profilesManager.edit");
            span.addEventListener("click", async () => {
                const data = await window.CrosshairAPI.loadProfile(p.name);
                if(!data) return;
                applySettingsToUI(data);
                updateLabels();
                drawPreview();
                document.querySelector('[data-page="editor"]').click();
                showToast(_t("toast.profileLoaded").replace("{name}", p.name), "info");
            });
            div.appendChild(span);
            const btnGroup = document.createElement("div");
            btnGroup.style.display = "flex"; btnGroup.style.gap = "6px";
            const editBtn = document.createElement("button");
            editBtn.className = "edit-profile";
            editBtn.textContent = _t("profilesManager.edit");
            editBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const data = await window.CrosshairAPI.loadProfile(p.name);
                if(!data){ showToast(_t("toast.profileNotFound"), "error"); return; }
                applySettingsToUI(data);
                updateLabels();
                drawPreview();
                document.querySelector('[data-page="editor"]').click();
                showToast(_t("toast.profileEditing").replace("{name}", p.name), "info");
            });
            const renameBtn = document.createElement("button");
            renameBtn.className = "edit-profile";
            renameBtn.textContent = _t("profilesManager.rename");
            renameBtn.style.background = "#d97706";
            renameBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                promptRename(p.name);
            });
            const delBtn = document.createElement("button");
            delBtn.className = "del-profile";
            delBtn.textContent = _t("profilesManager.delete");
            delBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if(!await showConfirm(_t("confirm.deleteProfile").replace("{name}", p.name))) return;
                await window.CrosshairAPI.deleteProfile(p.name);
                refreshProfilesList();
                showToast(_t("toast.profileDeleted").replace("{name}", p.name), "info");
            });
            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(renameBtn);
            btnGroup.appendChild(delBtn);
            div.appendChild(btnGroup);
            mgr.appendChild(div);
        });
    }
}

const deleteBtn = document.createElement("button");
deleteBtn.textContent = _t("profiles.delete");
deleteBtn.id = "delete-profile";
deleteBtn.onclick = async () => {
    const name = profilesList.value;
    if(!name || !await showConfirm(_t("confirm.deleteProfile").replace("{name}", name))) return;
    await window.CrosshairAPI.deleteProfile(name);
    refreshProfilesList();
};
document.querySelector(".profile-actions").appendChild(deleteBtn);

document.getElementById("export-profile").addEventListener("click", async () => {
    await window.CrosshairAPI.exportProfile(currentSettings());
});

document.getElementById("import-profile").addEventListener("click", async () => {
    const data = await window.CrosshairAPI.importProfile();
    if(!data){ showToast(_t("toast.importFailed"), "error"); return; }
    applySettingsToUI(data);
    updateLabels();
    drawPreview();
    showToast(_t("toast.profileImported"), "success");
});

// ===== GAME PROFILES =====
const gameSelect = document.getElementById("game-select");
const gameProfileSelect = document.getElementById("game-profile-select");

async function refreshGameProfiles(){
    const list = await window.CrosshairAPI.getProfiles();
    gameProfileSelect.innerHTML = "";
    list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = p.name;
        gameProfileSelect.appendChild(opt);
    });
}

document.getElementById("assign-game-profile").addEventListener("click", async () => {
    const game = gameSelect.value;
    const profile = gameProfileSelect.value;
    if(!game || !profile){ showToast(_t("toast.selectGameAndProfile"), "error"); return; }
    window.CrosshairAPI.assignGameProfile(game, profile);
    showToast(_t("toast.assignedProfile").replace("{profile}", profile).replace("{game}", game), "success");
    loadGameAssignments();
});

// ===== FPS TOGGLE =====
document.getElementById("toggle-fps").addEventListener("click", async () => {
    fpsEnabled = !fpsEnabled;
    window.CrosshairAPI.toggleFps();
    await window.CrosshairAPI.saveSettings(currentSettings());
    showToast(fpsEnabled ? "FPS On" : "FPS Off", "success");
});

// ===== GAME DETECTION STATUS =====
let gameDetectInterval = null;

async function updateGameStatus(){
    try {
        const game = await window.CrosshairAPI.getDetectedGame();
        const dot = document.getElementById("status-dot");
        const name = document.getElementById("game-name");
        if(game){
            dot.className = "status-dot active";
            name.textContent = _t("gameDetect.detected") + " " + game;
            name.className = "active";
        } else {
            dot.className = "status-dot";
            name.textContent = _t("gameDetect.noGame");
            name.className = "";
        }
    } catch(e) {}
}

// ===== THEME =====
let activeTheme = null;
function loadTheme(name){
    const allowed = ["dark", "light", "cyber"];
    if(!allowed.includes(name)) return;
    if(activeTheme){ document.head.removeChild(activeTheme); activeTheme = null; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `../themes/${name}.css`;
    document.head.appendChild(link);
    activeTheme = link;
    document.querySelectorAll(".theme-btn").forEach(b => b.classList.toggle("active", b.dataset.theme === name));
}

document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => loadTheme(btn.dataset.theme));
});

// ===== LANGUAGE =====
document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        applyLang(btn.dataset.lang);
    });
});

// ===== SHORTCUT EDITOR =====
const scKeys = { hide: "sc-edit-hide", show: "sc-edit-show", toggleRGB: "sc-edit-rgb" };
let _scBuffer = null;

async function loadShortcutEditor(){
    const cfg = await window.CrosshairAPI.getConfig();
    Object.entries(scKeys).forEach(([key, id]) => {
        const inp = document.getElementById(id);
        if(inp){
            inp.value = cfg.shortcuts[key];
            inp._key = key;
        }
    });
}

document.querySelectorAll(".shortcut-input").forEach(inp => {
    inp.addEventListener("focus", () => {
        _scBuffer = inp.value;
        inp.value = "Press a key...";
        inp.style.color = "#94a3b8";
    });
    inp.addEventListener("keydown", async (e) => {
        e.preventDefault();
        const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
        if(["Shift","Control","Alt","Meta","CapsLock","Escape","Tab"].includes(key)) return;
        const displayKey = key.startsWith("F") && key.length <= 3 ? key : key;
        inp.value = displayKey;
        inp.style.color = "";
        inp.blur();
        if(inp._key){
            await window.CrosshairAPI.updateShortcut(inp._key, displayKey);
            loadShortcuts();
            showToast(_t("toast.shortcutUpdated").replace("{key}", displayKey), "success");
        }
    });
    inp.addEventListener("blur", () => {
        if(inp.value === "Press a key...") inp.value = _scBuffer || "";
        inp.style.color = "";
    });
});

// ===== AUTO LAUNCH =====
const autoLaunchChk = document.getElementById("auto-launch");
if(autoLaunchChk){
    window.CrosshairAPI.getAutoLaunch().then(enabled => {
        autoLaunchChk.checked = enabled;
    });
    autoLaunchChk.addEventListener("change", async () => {
        await window.CrosshairAPI.setAutoLaunch(autoLaunchChk.checked);
    });
}

// ===== REVERT ON EXIT =====
const revertChk = document.getElementById("revert-on-exit");
if(revertChk){
    window.CrosshairAPI.getConfig().then(cfg => {
        revertChk.checked = cfg.revertOnExit !== false;
    });
    revertChk.addEventListener("change", async () => {
        await window.CrosshairAPI.updateConfig({ revertOnExit: revertChk.checked });
    });
}

// ===== TRAY MINIMIZE =====
const trayChk = document.getElementById("minimize-tray");
if(trayChk){
    window.CrosshairAPI.getAutoLaunch().then(() => {
        window.CrosshairAPI.getConfig().then(cfg => {
            trayChk.checked = cfg.minimizeToTray || false;
        });
    });
    trayChk.addEventListener("change", async () => {
        await window.CrosshairAPI.updateConfig({ minimizeToTray: trayChk.checked });
    });
}

// ===== BACKUP / RESTORE =====
document.getElementById("backup-all").addEventListener("click", async () => {
    const settings = await window.CrosshairAPI.loadSettings();
    const profiles = await window.CrosshairAPI.getProfiles();
    const profilesData = {};
    for(const p of profiles){
        const data = await window.CrosshairAPI.loadProfile(p.name);
        if(data) profilesData[p.name] = data;
    }
    await window.CrosshairAPI.exportProfile({ version: "3.0.0", settings, profiles: profilesData });
    showToast(_t("toast.backupExported"), "success");
});

document.getElementById("restore-all").addEventListener("click", async () => {
    if(!await showConfirm(_t("confirm.restoreAll"))) return;
    const data = await window.CrosshairAPI.importProfile();
    if(!data || !data.settings){ showToast(_t("toast.invalidBackup"), "error"); return; }
    await window.CrosshairAPI.saveSettings(data.settings);
    if(data.profiles){
        for(const [name, profileData] of Object.entries(data.profiles)){
            await window.CrosshairAPI.saveProfile(name, profileData);
        }
    }
    refreshProfilesList();
    refreshGameProfiles();
    const s = await window.CrosshairAPI.loadSettings();
    if(s){
        applySettingsToUI(s);
    }
    updateLabels();
    drawPreview();
    showToast(_t("toast.settingsRestored"), "success");
});

// ===== SIDEBAR NAVIGATION =====
document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(`page-${btn.dataset.page}`).classList.add("active");
    });
});

// ===== GAME DETECTION IPC =====
window.CrosshairAPI.onGameDetected((game) => {
    const dot = document.getElementById("status-dot");
    const name = document.getElementById("game-name");
    const badge = document.getElementById("active-game-badge");
    if(game){
        dot.className = "status-dot active";
        name.textContent = _t("gameDetect.detected") + " " + game;
        name.className = "active";
        if(badge){
            badge.classList.remove("hidden");
            document.getElementById("active-game-icon").style.background = "#22c55e";
            document.getElementById("active-game-text").textContent = game.toUpperCase();
        }
    } else {
        dot.className = "status-dot";
        name.textContent = _t("gameDetect.noGame");
        name.className = "";
        if(badge) badge.classList.add("hidden");
    }
});

window.CrosshairAPI.onGameProfileActive((data) => {
    const statusDiv = document.getElementById("game-profile-status");
    const nameSpan = document.getElementById("active-profile-name");
    if(!data || !data.profile){
        if(statusDiv) statusDiv.classList.add("hidden");
        return;
    }
    if(statusDiv) statusDiv.classList.remove("hidden");
    if(nameSpan) nameSpan.textContent = data.profile.type + " [" + data.profile.color + "]";
});

// ===== INIT =====
async function init(){
    addUndoButtons();
    await loadDisplays();
    const s = await window.CrosshairAPI.loadSettings();
    if(s){
        applySettingsToUI(s);
    }
    updateLabels();
    drawPreview();
    loadShortcuts();
    loadCustomPresets();
    refreshProfilesList();
    refreshGameProfiles();
    loadGameAssignments();
    loadHistory();
    loadTheme("dark");
    updateGameStatus();
}

init();