const fs = require("fs");
const path = require("path");

const en = require("./en.json");
const ar = require("./ar.json");
const locales = { en, ar };

function getTranslations(lang){
    return locales[lang] || en;
}

module.exports = { getTranslations };