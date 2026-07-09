const fs = require("fs");
const path = require("path");
const yml = fs.readFileSync("dist/latest.yml", "utf8");
const fixed = yml.replace(/-Setup-/g, ".Setup.");
fs.writeFileSync("dist/latest.yml", fixed);
