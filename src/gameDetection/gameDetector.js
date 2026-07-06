const psList = require("ps-list").default || require("ps-list");

async function detectRunningGame() {

    const processes = await psList();

    const names =
    processes.map(
        p => p.name.toLowerCase()
    );

    if (
        names.includes(
            "fivem_b2189_gtaProcess.exe".toLowerCase()
        ) ||
        names.includes(
            "fivem.exe"
        )
    ) {
        return "fivem";
    }

    if (
        names.includes(
            "valorant-win64-shipping.exe"
        )
    ) {
        return "valorant";
    }

    if (
        names.includes(
            "cs2.exe"
        ) ||
        names.includes(
            "csgo.exe"
        )
    ) {
        return "cs2";
    }

    return null;
}

module.exports = {
    detectRunningGame
};