'use strict';
const Blockly = require('blockly');
const ko = require('blockly/msg/ko');
require('../shared/blocks/index.js');
const { arduinoGenerator } = require('../shared/arduino-generator.js');
const toolbox = require('./toolbox.js');
const { renderWiringPanel } = require('./wiring.js');

Blockly.setLocale(ko);

const workspace = Blockly.inject('blocklyDiv', {
  toolbox,
  grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9 },
  trashcan: true,
});

window.appState = { workspace, currentFilePath: null, dirty: false };

// 새 프로젝트 기본 블록: 시작하면 + 계속 반복하기
Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
  { type: 'basic_setup', x: 40, y: 40 },
  { type: 'basic_loop', x: 40, y: 220 },
] } }, workspace);

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
  document.getElementById('wiring-panel').hidden = showCode;
}
tabCode.addEventListener('click', () => selectTab(true));
tabWiring.addEventListener('click', () => selectTab(false));
document.addEventListener('blockduino:code-updated', () =>
  renderWiringPanel(workspace, document.getElementById('wiring-panel')));

window.blockduino = { refreshCode, selectTab };

const { ipcRenderer } = require('electron');
const path = require('path');

async function saveProject() {
  const json = Blockly.serialization.workspaces.save(workspace);
  const saved = await ipcRenderer.invoke('project:save', {
    json, filePath: window.appState.currentFilePath,
  });
  if (saved) {
    window.appState.currentFilePath = saved;
    window.appState.dirty = false;
    document.getElementById('project-name').value = path.basename(saved, '.bdn');
    setStatus('저장 완료 ✓');
  }
}

async function openProject() {
  if (window.appState.dirty &&
      !(await ipcRenderer.invoke('confirm-discard'))) return;
  const result = await ipcRenderer.invoke('project:open');
  if (!result) return;
  Blockly.serialization.workspaces.load(result.json, workspace);
  window.appState.currentFilePath = result.filePath;
  window.appState.dirty = false;
  document.getElementById('project-name').value = path.basename(result.filePath, '.bdn');
  refreshCode();
  setStatus('프로젝트를 열었어요');
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

document.getElementById('btn-save').addEventListener('click', saveProject);
document.getElementById('btn-open').addEventListener('click', openProject);
window.blockduino.setStatus = setStatus;

// ── 포트 감지 & 업로드 ──────────────────────────────
const portSelect = document.getElementById('port-select');
let knownPorts = [];

async function refreshPorts() {
  const ports = await ipcRenderer.invoke('ports:list');
  if (JSON.stringify(ports) === JSON.stringify(knownPorts)) return;
  knownPorts = ports;
  const prev = portSelect.value;
  portSelect.innerHTML = '';
  if (ports.length === 0) {
    portSelect.add(new Option('보드를 연결하세요', ''));
  } else {
    for (const p of ports) portSelect.add(new Option(p.label, p.port));
    const uno = ports.find((p) => p.isUno);
    portSelect.value = ports.some((p) => p.port === prev) ? prev
      : (uno ? uno.port : ports[0].port);
  }
}
refreshPorts();
setInterval(refreshPorts, 3000);

function setStatusClass(cls) {
  document.getElementById('status-bar').className = cls;
}

function showError(message, detail, showCh340Hint) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-detail').textContent = detail || '(추가 정보 없음)';
  document.getElementById('ch340-hint').hidden = !showCh340Hint;
  document.getElementById('error-dialog').showModal();
}
document.getElementById('error-close').addEventListener('click', () =>
  document.getElementById('error-dialog').close());

ipcRenderer.on('upload:stage', (_e, stage) => {
  setStatus(stage === 'compile' ? '컴파일 중...' : '보드에 업로드 중...');
});

const btnUpload = document.getElementById('btn-upload');
btnUpload.addEventListener('click', async () => {
  const code = arduinoGenerator.workspaceToCode(workspace);
  btnUpload.disabled = true;
  setStatusClass('busy');
  setStatus('컴파일 중...');
  const r = await ipcRenderer.invoke('sketch:upload', {
    code, port: portSelect.value,
  });
  btnUpload.disabled = false;
  if (r.ok) {
    setStatusClass('ok');
    setStatus('업로드 완료! ✓');
  } else {
    setStatusClass('error');
    setStatus('업로드 실패');
    // 윈도우에서 포트가 하나도 안 잡히면 CH340 드라이버 안내 표시
    const noPorts = knownPorts.length === 0 && process.platform === 'win32';
    showError(r.message, r.detail, noPorts);
  }
});
