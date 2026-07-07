'use strict';
const Blockly = require('blockly');
const ko = require('blockly/msg/ko');
require('../shared/blocks/index.js');
const { arduinoGenerator } = require('../shared/arduino-generator.js');
const toolbox = require('./toolbox.js');

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
