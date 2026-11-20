'use strict';
const Blockly = require('blockly');
const { ipcRenderer } = require('electron');
const path = require('path');
const i18n = require('../shared/i18n.js');
require('../shared/blocks/index.js');
const { applyBlockMessages } = require('../shared/blocks/messages.js');
const { arduinoGenerator } = require('../shared/arduino-generator.js');
const { buildToolbox } = require('./toolbox.js');
const { renderWiringPanel } = require('./wiring.js');
const { EXAMPLES, EXAMPLE_VARIABLES, localizeWorkspace } = require('../shared/examples.js');

const { t } = i18n;

// ── 언어 (기본: 영어) ────────────────────────────────
// 선택한 언어는 이 PC의 localStorage에 기억한다. 저장소를 못 쓰면 기본값으로 동작.
const LANG_STORAGE_KEY = 'blockduino.lang';
const BLOCKLY_LOCALES = {
  en: require('blockly/msg/en'),
  ko: require('blockly/msg/ko'),
};

function loadSavedLang() {
  try { return localStorage.getItem(LANG_STORAGE_KEY); } catch { return null; }
}
function saveLang(lang) {
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* 무시 */ }
}
function applyBlocklyLocale() {
  Blockly.setLocale(BLOCKLY_LOCALES[i18n.getLang()]); // 표준 블록(만약/반복 등) 문구
  applyBlockMessages(i18n.getLang());                 // 우리 블록 문구 (%{BKY_BD_*})
}
// HTML의 data-i18n / data-i18n-title / data-i18n-placeholder 요소에 문구를 채운다
function applyStaticTexts() {
  document.documentElement.lang = i18n.getLang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
}

i18n.setLang(loadSavedLang() || i18n.DEFAULT_LANG);
ipcRenderer.invoke('lang:set', i18n.getLang()); // 메인 프로세스(대화상자·포트 이름·오류 문구)
applyBlocklyLocale();
applyStaticTexts();
document.getElementById('project-name').value = t('project.defaultName');

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: buildToolbox(),
  grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9 },
  trashcan: true,
  // 오프라인 환경: 기본값(https://blockly-demo.appspot.com/...) 대신 로컬 미디어 사용
  media: '../../node_modules/blockly/media/',
  sounds: false,
});

window.appState = { workspace, currentFilePath: null, dirty: false, currentExample: null };

// 새 프로젝트 기본 블록: 시작하면 + 계속 반복하기
// Blockly 이벤트는 비동기로 플러시되므로, 프로그램적 로드 중에는 이벤트를 꺼서
// 뒤늦게 도착하는 change 이벤트가 dirty 플래그를 되돌리지 않도록 한다.
Blockly.Events.disable();
try {
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_setup', x: 40, y: 40 },
    { type: 'basic_loop', x: 40, y: 220 },
  ] } }, workspace);
} finally {
  Blockly.Events.enable();
}

function refreshCode() {
  const code = arduinoGenerator.workspaceToCode(workspace);
  document.getElementById('code-preview').textContent = code;
  document.dispatchEvent(new CustomEvent('blockduino:code-updated'));
}

workspace.addChangeListener((e) => {
  if (e.isUiEvent) return;
  window.appState.dirty = true;
  refreshCode();
});
refreshCode();
window.appState.dirty = false;

// 코드/배선 탭 전환
const tabCode = document.getElementById('tab-code');
const tabWiring = document.getElementById('tab-wiring');
function selectTab(showCode) {
  tabCode.classList.toggle('active', showCode);
  tabWiring.classList.toggle('active', !showCode);
  document.getElementById('code-preview').hidden = !showCode;
  document.getElementById('wiring-container').hidden = showCode;
}
tabCode.addEventListener('click', () => selectTab(true));
tabWiring.addEventListener('click', () => selectTab(false));

// ── 배선 고정: 체크되면 현재 블록 대신 예제 정답 기준으로 배선을 그린다 ──
const wiringLock = document.getElementById('wiring-lock');
let answerWiringWs = null; // 예제 정답을 로드해 둔 헤드리스 워크스페이스

function renderWiring() {
  const source = wiringLock.checked && answerWiringWs ? answerWiringWs : workspace;
  renderWiringPanel(source, document.getElementById('wiring-panel'));
}
function setWiringLockExample(exampleOrNull) {
  if (answerWiringWs) {
    answerWiringWs.dispose();
    answerWiringWs = null;
  }
  if (exampleOrNull) {
    answerWiringWs = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(exampleOrNull.workspace, answerWiringWs);
    wiringLock.disabled = false;
    wiringLock.checked = true; // 예제는 자동으로 배선 고정
  } else {
    wiringLock.checked = false;
    wiringLock.disabled = true;
  }
}
wiringLock.addEventListener('change', renderWiring);
document.addEventListener('blockduino:code-updated', renderWiring);
renderWiring();

window.blockduino = { refreshCode, selectTab };

async function saveProject() {
  const json = Blockly.serialization.workspaces.save(workspace);
  const saved = await ipcRenderer.invoke('project:save', {
    json, filePath: window.appState.currentFilePath,
  });
  if (saved && saved.error) {
    showError(saved.error.message, saved.error.detail, false);
    setStatus(t('status.saveFailed'));
    return;
  }
  if (saved) {
    window.appState.currentFilePath = saved;
    window.appState.dirty = false;
    document.getElementById('project-name').value = path.basename(saved, '.bdn');
    setStatus(t('status.saved'));
  }
}

async function openProject() {
  if (window.appState.dirty &&
      !(await ipcRenderer.invoke('confirm-discard'))) return;
  const result = await ipcRenderer.invoke('project:open');
  if (!result) return;
  if (result.error) {
    showError(result.error.message, result.error.detail, false);
    setStatus(t('status.openFailed'));
    return;
  }
  Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load(result.json, workspace);
  } finally {
    Blockly.Events.enable();
  }
  window.appState.currentFilePath = result.filePath;
  window.appState.dirty = false;
  window.appState.currentExample = null;
  document.getElementById('btn-answer').disabled = true;
  setWiringLockExample(null);
  renderWiring();
  document.getElementById('project-name').value = path.basename(result.filePath, '.bdn');
  refreshCode();
  setStatus(t('status.opened'));
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

document.getElementById('btn-save').addEventListener('click', saveProject);
document.getElementById('btn-open').addEventListener('click', openProject);
window.blockduino.setStatus = setStatus;

// ── 포트 감지 & 업로드 ──────────────────────────────
const portSelect = document.getElementById('port-select');
let knownPorts = null; // null이면 다음 refreshPorts에서 목록을 무조건 다시 그린다

async function refreshPorts() {
  const ports = await ipcRenderer.invoke('ports:list');
  if (knownPorts && JSON.stringify(ports) === JSON.stringify(knownPorts)) return;
  knownPorts = ports;
  const prev = portSelect.value;
  portSelect.innerHTML = '';
  // 아두이노(호환) 보드가 없으면 안내 문구를 기본 선택으로 유지 —
  // 기타 포트에 실수로 업로드하지 않도록
  const hasBoard = ports.some((p) => p.rank <= 1);
  if (!hasBoard) portSelect.add(new Option(t('ports.placeholder'), ''));
  for (const p of ports) portSelect.add(new Option(p.label, p.port));
  if (ports.some((p) => p.port === prev)) portSelect.value = prev;
  else if (hasBoard) portSelect.value = ports[0].port; // rank 정렬됨: 아두이노 우선
  else portSelect.value = '';
}
refreshPorts();
setInterval(refreshPorts, 3000);

// ── 시리얼 디버그: 센서값 모니터 ──────────────────────
const serialToggle = document.getElementById('serial-toggle');
const serialPanel = document.getElementById('serial-panel');
const serialLog = document.getElementById('serial-log');
const SERIAL_MAX_LINES = 500;
let serialPlaceholderKey = null; // 언어를 바꾸면 안내 문구도 다시 그리기 위해 기억

function serialPlaceholder(key) {
  serialPlaceholderKey = key;
  serialLog.textContent = '';
  const span = document.createElement('span');
  span.className = 'placeholder';
  span.textContent = t(key);
  serialLog.appendChild(span);
}

function appendSerial(line) {
  const ph = serialLog.querySelector('.placeholder');
  if (ph) { // 안내 문구는 첫 데이터에서 지운다
    serialLog.textContent = '';
    serialPlaceholderKey = null;
  }
  serialLog.appendChild(document.createTextNode(line + '\n'));
  while (serialLog.childNodes.length > SERIAL_MAX_LINES) {
    serialLog.removeChild(serialLog.firstChild); // 오래된 줄 버려 메모리 제한
  }
  serialLog.scrollTop = serialLog.scrollHeight;
}

function startSerialIfBoard() {
  if (portSelect.value) {
    ipcRenderer.invoke('serial:start', portSelect.value);
    serialPlaceholder('serial.waiting');
  } else {
    serialPlaceholder('serial.noBoard');
  }
}

serialToggle.addEventListener('change', () => {
  arduinoGenerator.debugSerial = serialToggle.checked;
  refreshCode(); // 미리보기·업로드 코드에 센서값 출력이 반영됨
  serialPanel.hidden = !serialToggle.checked;
  if (serialToggle.checked) startSerialIfBoard();
  else ipcRenderer.invoke('serial:stop');
});

document.getElementById('serial-clear').addEventListener('click', () => {
  serialLog.textContent = '';
  serialPlaceholderKey = null;
});
document.getElementById('serial-close').addEventListener('click', () => {
  serialToggle.checked = false;
  serialToggle.dispatchEvent(new Event('change'));
});

// 디버그 중 보드(포트)를 바꾸면 모니터도 새 포트로 옮긴다
portSelect.addEventListener('change', () => {
  if (serialToggle.checked) startSerialIfBoard();
});

ipcRenderer.on('serial:data', (_e, line) => appendSerial(line));

function setStatusClass(cls) {
  document.getElementById('status-bar').className = cls;
}

function showError(message, detail, showCh340Hint) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-detail').textContent = detail || t('error.noDetail');
  document.getElementById('ch340-hint').hidden = !showCh340Hint;
  document.getElementById('error-dialog').showModal();
}
document.getElementById('error-close').addEventListener('click', () =>
  document.getElementById('error-dialog').close());

ipcRenderer.on('upload:stage', (_e, stage) => {
  setStatus(t(stage === 'compile' ? 'status.compiling' : 'status.uploading'));
});

const btnUpload = document.getElementById('btn-upload');
btnUpload.addEventListener('click', async () => {
  const code = arduinoGenerator.workspaceToCode(workspace);
  btnUpload.disabled = true;
  setStatusClass('busy');
  setStatus(t('status.compiling'));
  const r = await ipcRenderer.invoke('sketch:upload', {
    code, port: portSelect.value,
  });
  btnUpload.disabled = false;
  if (r.ok) {
    setStatusClass('ok');
    setStatus(t('status.uploadOk'));
  } else {
    setStatusClass('error');
    setStatus(t('status.uploadFailed'));
    // 윈도우에서 포트가 하나도 안 잡히면 CH340 드라이버 안내 표시
    const noPorts = (!knownPorts || knownPorts.length === 0) && process.platform === 'win32';
    showError(r.message, r.detail, noPorts);
  }
});

// ── 예제 데모 ──────────────────────────────────────
const exampleSelect = document.getElementById('example-select');
function renderExampleOptions() {
  exampleSelect.length = 1; // 첫 항목("예제 열기…")만 남긴다
  for (const ex of EXAMPLES) {
    exampleSelect.add(new Option(`${ex.title} — ${ex.description}`, ex.id));
  }
}
renderExampleOptions();
const btnAnswer = document.getElementById('btn-answer');

function loadWorkspaceJson(json) {
  Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load(json, workspace);
  } finally {
    Blockly.Events.enable();
  }
  refreshCode();
  window.appState.dirty = false;
}

exampleSelect.addEventListener('change', async () => {
  const ex = EXAMPLES.find((e) => e.id === exampleSelect.value);
  exampleSelect.value = '';
  if (!ex) return;
  if (window.appState.dirty &&
      !(await ipcRenderer.invoke('confirm-discard'))) return;
  // 기본은 연습 배치: 모든 블록이 분리되어 있고 값도 전부 정답과 다르다.
  // 배선 고정을 먼저 켜서 배선 탭은 정답 기준으로 그려지게 한다.
  setWiringLockExample(ex);
  loadWorkspaceJson(localizeWorkspace(ex.practice, i18n.getLang()));
  window.appState.currentFilePath = null;
  window.appState.currentExample = ex;
  btnAnswer.disabled = false;
  document.getElementById('project-name').value = ex.title;
  selectTab(false); // 배선 탭으로 전환해 연결 그림을 바로 보여줌
  setStatus(t('status.exampleOpened', { title: ex.title }));
});

// ── 정답 보기 (관리자 비밀번호 필요) ────────────────────
// 배포 전에 원하는 비밀번호로 바꿔 주세요.
const ANSWER_PASSWORD = '0000';
const answerDialog = document.getElementById('answer-dialog');
const answerInput = document.getElementById('answer-password');
const answerError = document.getElementById('answer-error');

btnAnswer.addEventListener('click', () => {
  if (!window.appState.currentExample) return;
  answerInput.value = '';
  answerError.hidden = true;
  answerDialog.showModal();
  answerInput.focus();
});

function tryShowAnswer() {
  if (answerInput.value !== ANSWER_PASSWORD) {
    answerError.hidden = false;
    answerInput.value = '';
    answerInput.focus();
    return;
  }
  answerDialog.close();
  const ex = window.appState.currentExample;
  loadWorkspaceJson(localizeWorkspace(ex.workspace, i18n.getLang()));
  setStatus(t('status.answerShown', { title: ex.title }));
}

document.getElementById('answer-ok').addEventListener('click', tryShowAnswer);
document.getElementById('answer-cancel').addEventListener('click', () => answerDialog.close());
answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryShowAnswer();
});

// ── 언어 전환 ──────────────────────────────────────
const langSelect = document.getElementById('lang-select');
for (const { code, name } of i18n.LANGUAGES) langSelect.add(new Option(`🌐 ${name}`, code));
langSelect.value = i18n.getLang();

// 블록 문구는 블록이 만들어질 때 정해지므로, 워크스페이스를 저장했다가 다시 불러와
// 새 언어로 다시 그린다. 예제 변수 이름도 사용자가 바꾸지 않았다면 함께 번역한다.
function rebuildWorkspace(prevLang) {
  const { scrollX, scrollY, scale } = workspace;
  Blockly.Events.disable();
  try {
    for (const [id, key] of Object.entries(EXAMPLE_VARIABLES)) {
      const v = workspace.getVariableById(id);
      if (v && v.name === i18n.locale(prevLang).variables[key]) {
        workspace.renameVariableById(id, i18n.locale().variables[key]);
      }
    }
    const state = Blockly.serialization.workspaces.save(workspace);
    Blockly.serialization.workspaces.load(state, workspace);
  } finally {
    Blockly.Events.enable();
  }
  workspace.clearUndo();
  workspace.setScale(scale);
  workspace.scroll(scrollX, scrollY);
  workspace.updateToolbox(buildToolbox());
}

function changeLanguage(lang) {
  const prevLang = i18n.getLang();
  if (lang === prevLang) return;
  // 이름 칸이 기본 이름/예제 제목 그대로면 새 언어로 바꿔 준다 (사용자가 고친 이름은 유지)
  const nameInput = document.getElementById('project-name');
  const ex = window.appState.currentExample;
  const nameWasDefault = nameInput.value === t('project.defaultName');
  const nameWasExample = !!ex && nameInput.value === ex.title;

  i18n.setLang(lang);
  saveLang(lang);
  ipcRenderer.invoke('lang:set', lang);
  applyBlocklyLocale();
  applyStaticTexts();
  setStatusClass('');

  if (nameWasDefault) nameInput.value = t('project.defaultName');
  else if (nameWasExample) nameInput.value = ex.title;

  renderExampleOptions();
  if (serialPlaceholderKey) serialPlaceholder(serialPlaceholderKey);
  knownPorts = null; // 포트 이름도 새 언어로
  refreshPorts();

  const wasDirty = window.appState.dirty;
  rebuildWorkspace(prevLang);
  refreshCode(); // 센서값 출력 라벨 등 코드도 새 언어로
  window.appState.dirty = wasDirty;
}

langSelect.addEventListener('change', () => changeLanguage(langSelect.value));
