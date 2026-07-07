const container = document.getElementById("crosshair");
let rgbEnabled = false;
let rgbSpeed = 2;
let currentRotation = 0;

function clear(){
    container.innerHTML = "";
}

function hexToRgba(hex, alpha){
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function part(){
    const div = document.createElement("div");
    div.className = "part";
    container.appendChild(div);
    return div;
}

function applyOutline(el, s){
    if(s.outline){
        const o = s.outline_opacity !== undefined ? s.outline_opacity : 1;
        const rgba = hexToRgba(s.outlineColor || "#000000", o);
        el.style.outline = `${s.outline_thickness || 1}px solid ${rgba}`;
    }
}

function applyRotation(r, ox, oy){
    const offX = ox || 0;
    const offY = oy || 0;
    if(r){
        container.style.transform = `translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px)) rotate(${r}deg)`;
    } else {
        container.style.transform = `translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px))`;
    }
}

function renderLayer(s){
    switch(s.type){
        case "dot": renderDotParts(s); break;
        case "circle": renderCircleParts(s); break;
        case "x": renderXParts(s); break;
        case "t": renderTParts(s); break;
        default: renderCrossParts(s); break;
    }
}

function renderDotParts(s){
    const dot = part();
    dot.style.width = s.size + "px";
    dot.style.height = s.size + "px";
    dot.style.borderRadius = "50%";
    dot.style.background = s.color;
    dot.style.left = "50%";
    dot.style.top = "50%";
    dot.style.transform = "translate(-50%,-50%)";
    applyOutline(dot, s);
}

function renderCircleParts(s){
    const circle = part();
    circle.style.width = s.size + "px";
    circle.style.height = s.size + "px";
    circle.style.border = s.thickness + "px solid " + s.color;
    circle.style.borderRadius = "50%";
    circle.style.left = "50%";
    circle.style.top = "50%";
    circle.style.transform = "translate(-50%,-50%)";
    applyOutline(circle, s);
    if(s.center_dot) renderCenterDot(s);
}

function renderCrossParts(s){
    const gap = s.gap, size = s.size, thickness = s.thickness, color = s.color;

    const top = part();
    top.style.width = thickness + "px"; top.style.height = size + "px";
    top.style.background = color; top.style.left = "50%";
    top.style.transform = "translateX(-50%)"; top.style.top = -(size+gap) + "px";
    applyOutline(top, s);

    const bottom = part();
    bottom.style.width = thickness + "px"; bottom.style.height = size + "px";
    bottom.style.background = color; bottom.style.left = "50%";
    bottom.style.transform = "translateX(-50%)"; bottom.style.top = gap + "px";
    applyOutline(bottom, s);

    const left = part();
    left.style.width = size + "px"; left.style.height = thickness + "px";
    left.style.background = color; left.style.left = -(size+gap) + "px";
    left.style.top = "50%"; left.style.transform = "translateY(-50%)";
    applyOutline(left, s);

    const right = part();
    right.style.width = size + "px"; right.style.height = thickness + "px";
    right.style.background = color; right.style.left = gap + "px";
    right.style.top = "50%"; right.style.transform = "translateY(-50%)";
    applyOutline(right, s);

    if(s.center_dot) renderCenterDot(s);
}

function renderTParts(s){
    const gap = s.gap, size = s.size, thickness = s.thickness, color = s.color;

    const left = part();
    left.style.width = size + "px"; left.style.height = thickness + "px";
    left.style.background = color; left.style.left = -(size+gap) + "px";
    left.style.top = "50%"; left.style.transform = "translateY(-50%)";
    applyOutline(left, s);

    const right = part();
    right.style.width = size + "px"; right.style.height = thickness + "px";
    right.style.background = color; right.style.left = gap + "px";
    right.style.top = "50%"; right.style.transform = "translateY(-50%)";
    applyOutline(right, s);

    const bottom = part();
    bottom.style.width = thickness + "px"; bottom.style.height = size + "px";
    bottom.style.background = color; bottom.style.left = "50%";
    bottom.style.transform = "translateX(-50%)"; bottom.style.top = gap + "px";
    applyOutline(bottom, s);

    if(s.center_dot) renderCenterDot(s);
}

function renderXParts(s){
    const a = part();
    const b = part();
    [a,b].forEach(el => {
        el.style.width = s.size + "px"; el.style.height = s.thickness + "px";
        el.style.background = s.color; el.style.left = "50%"; el.style.top = "50%";
        applyOutline(el, s);
    });
    a.style.transform = "translate(-50%,-50%) rotate(45deg)";
    b.style.transform = "translate(-50%,-50%) rotate(-45deg)";
    if(s.center_dot) renderCenterDot(s);
}

function renderCenterDot(s){
    const dot = part();
    const dotSize = Math.max(3, s.thickness);
    dot.style.width = dotSize + "px"; dot.style.height = dotSize + "px";
    dot.style.borderRadius = "50%"; dot.style.background = s.color;
    dot.style.left = "50%"; dot.style.top = "50%";
    dot.style.transform = "translate(-50%,-50%)";
    applyOutline(dot, s);
}

function applyOpacity(value){
    document.querySelectorAll(".part").forEach(el => {
        el.style.opacity = value;
    });
}

function applyRGB(){
    document.querySelectorAll(".part").forEach(el => {
        el.style.animation = rgbEnabled ? `rgb ${rgbSpeed}s linear infinite` : "none";
    });
}

let fpsVisible = true;
window.CrosshairAPI.onFpsToggle(() => {
    fpsVisible = !fpsVisible;
    document.getElementById("fps").style.display = fpsVisible ? "block" : "none";
});

window.CrosshairAPI.onToggleRGB(() => {
    rgbEnabled = !rgbEnabled;
    applyRGB();
});

window.CrosshairAPI.receive((settings) => {
    rgbEnabled = settings.rgb || false;
    rgbSpeed = settings.rgb_speed || 2;
    currentRotation = settings.rotation || 0;
    clear();
    applyRotation(settings.rotation || 0, settings.offset_x, settings.offset_y);

    renderLayer(settings);

    if(settings.layer2_enabled){
        const layer2 = {
            type: settings.layer2_type || "cross",
            color: settings.layer2_color || "#00ff00",
            size: settings.layer2_size || 30,
            gap: settings.layer2_gap || 6,
            thickness: settings.layer2_thickness || 2,
            outline: settings.outline,
            outlineColor: settings.outlineColor,
            outline_thickness: settings.outline_thickness,
            outline_opacity: settings.outline_opacity,
            center_dot: false,
            opacity: settings.opacity,
            rotation: 0
        };
        renderLayer(layer2);
    }

    applyOpacity(settings.opacity);
    applyRGB();
});

let frames = 0;
let lastTime = performance.now();

function fpsLoop(){
    frames++;
    const now = performance.now();
    if(now - lastTime >= 1000){
        document.getElementById("fps").textContent = "FPS: " + frames;
        frames = 0;
        lastTime = now;
    }
    requestAnimationFrame(fpsLoop);
}

window.CrosshairAPI.onOffsetUpdate((data) => {
    applyRotation(currentRotation, data.offset_x, data.offset_y);
});

fpsLoop();