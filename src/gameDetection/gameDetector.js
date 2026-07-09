const psList = require("ps-list");

const GAME_MAP = [
    { name: "cs2", process: ["cs2.exe", "csgo.exe"] },
    { name: "valorant", process: ["valorant-win64-shipping.exe"] },
    { name: "fivem", process: ["fivem_b2189_gtaprocess.exe", "fivem.exe"] },
    { name: "apex", process: ["r5apex.exe", "easyanticheat_launcher.exe"] },
    { name: "fortnite", process: ["fortniteclient-win64-shipping.exe", "fortniteclient.exe"] },
    { name: "overwatch", process: ["overwatch.exe", "overwatch launcher.exe"] },
    { name: "pubg", process: ["tslgame.exe", "tslgame_ue4.exe", "battlegrounds_ue4.exe"] },
    { name: "r6", process: ["rainbow6.exe", "rainbow6_ siege.exe", "rainbowsix.exe"] },
    { name: "cod", process: ["cod.exe", "modernwarfare.exe", "blackops.exe", "callofduty.exe"] }
];

async function detectRunningGame() {
    const processes = await psList();
    const names = new Set(processes.map(p => p.name.toLowerCase()));

    for(const entry of GAME_MAP){
        if(entry.process.some(p => names.has(p))){
            return entry.name;
        }
    }

    return null;
}

module.exports = {
    detectRunningGame
};