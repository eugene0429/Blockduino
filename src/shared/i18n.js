'use strict';

// Tiny i18n layer shared by the main and renderer processes.
// Each process keeps its own current language; the renderer tells the main
// process about changes over IPC ('lang:set').

const LOCALES = {
  en: require('./locales/en.js'),
  ko: require('./locales/ko.js'),
};

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
];

const DEFAULT_LANG = 'en';
let current = DEFAULT_LANG;

function normalizeLang(lang) {
  return Object.prototype.hasOwnProperty.call(LOCALES, lang) ? lang : DEFAULT_LANG;
}

function setLang(lang) {
  current = normalizeLang(lang);
  return current;
}

function getLang() {
  return current;
}

function format(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

// Look up a UI string in the current language, falling back to English, then the key.
function t(key, params) {
  const s = LOCALES[current].ui[key] ?? LOCALES[DEFAULT_LANG].ui[key] ?? key;
  return format(s, params);
}

function locale(lang = current) {
  return LOCALES[normalizeLang(lang)];
}

module.exports = { LANGUAGES, DEFAULT_LANG, LOCALES, setLang, getLang, normalizeLang, t, locale };
