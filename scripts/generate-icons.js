const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

function createCrosshairPNG(size){
    const png = new PNG({ width: size, height: size, colorType: 6 });
    const color = [37, 99, 235, 255];
    const t = Math.max(3, Math.round(size * 0.07));
    const h = Math.round(size * 0.28);
    const g = Math.round(size * 0.06);
    const cx = Math.floor(size/2), cy = Math.floor(size/2);
    const hw = Math.floor(t/2);

    function fill(x1, y1, x2, y2){
        for(let y = Math.max(0, y1); y <= Math.min(size-1, y2); y++){
            for(let x = Math.max(0, x1); x <= Math.min(size-1, x2); x++){
                const idx = (y * size + x) * 4;
                png.data[idx] = color[0];
                png.data[idx+1] = color[1];
                png.data[idx+2] = color[2];
                png.data[idx+3] = color[3];
            }
        }
    }

    // Top arm
    fill(cx - hw, cy - g - h, cx + hw, cy - g);
    // Bottom arm
    fill(cx - hw, cy + g, cx + hw, cy + g + h);
    // Left arm
    fill(cx - g - h, cy - hw, cx - g, cy + hw);
    // Right arm
    fill(cx + g, cy - hw, cx + g + h, cy + hw);

    return png;
}

async function generateIcons(){
    const assetsDir = path.join(__dirname, "..", "assets");
    if(!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

    const png256 = createCrosshairPNG(256);
    const pngPath = path.join(assetsDir, "icon.png");
    fs.writeFileSync(pngPath, PNG.sync.write(png256));
    console.log("Generated: icon.png (256x256)");

    const sizes = [64, 48, 32, 16];
    for(const s of sizes){
        const small = createCrosshairPNG(s);
        const smallPath = path.join(assetsDir, `icon_${s}.png`);
        fs.writeFileSync(smallPath, PNG.sync.write(small));
        console.log(`Generated: icon_${s}.png (${s}x${s})`);
    }

    // Create .ico from PNG
    try {
        const { default: pngToIco } = require("png-to-ico");
        const buf = await pngToIco(pngPath);
        const icoPath = path.join(assetsDir, "icon.ico");
        fs.writeFileSync(icoPath, buf);
        console.log("Generated: icon.ico");
    } catch(e) {
        console.error("Failed to generate .ico:", e.message);
    }

    console.log("All icons generated successfully!");
}

generateIcons().catch(console.error);
