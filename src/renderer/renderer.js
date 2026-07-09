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
  document.getElementById('wiring-panel').hidden = showCode;
}
tabCode.addEventListener('click', () => selectTab(true));
tabWiring.addEventListener('click', () => selectTab(false));
document.addEventListener('blockduino:code-updated', () =>
  renderWiringPanel(workspace, document.getElementById('wiring-panel')));
renderWiringPanel(workspace, document.getElementById('wiring-panel'));

window.blockduino = { refreshCode, selectTab };

const { ipcRenderer } = require('electron');
const path = require('path');

async function saveProject() {
  const json = Blockly.serialization.workspaces.save(workspace);
  const saved = await ipcRenderer.invoke('project:save', {
    json, filePath: window.appState.currentFilePath,
  });
  if (saved && saved.error) {
    showError(saved.error.message, saved.error.detail, false);
    setStatus('저장에 실패했어요');
    return;
  }
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
  if (result.error) {
    showError(result.error.message, result.error.detail, false);
    setStatus('프로젝트를 여는 데 실패했어요');
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
  // 아두이노(호환) 보드가 없으면 안내 문구를 기본 선택으로 유지 —
  // 기타 포트에 실수로 업로드하지 않도록
  const hasBoard = ports.some((p) => p.rank <= 1);
  if (!hasBoard) portSelect.add(new Option('보드를 연결하세요', ''));
  for (const p of ports) portSelect.add(new Option(p.label, p.port));
  if (ports.some((p) => p.port === prev)) portSelect.value = prev;
  else if (hasBoard) portSelect.value = ports[0].port; // rank 정렬됨: 아두이노 우선
  else portSelect.value = '';
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

// ── 예제 데모 ──────────────────────────────────────
const { EXAMPLES } = require('../shared/examples.js');
const exampleSelect = document.getElementById('example-select');
for (const ex of EXAMPLES) {
  exampleSelect.add(new Option(`${ex.title} — ${ex.description}`, ex.id));
}
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
  // 기본은 연습 배치: 일부 값이 다르고 일부 블록이 떨어져 있다
  loadWorkspaceJson(ex.practice);
  window.appState.currentFilePath = null;
  window.appState.currentExample = ex;
  btnAnswer.disabled = false;
  document.getElementById('project-name').value = ex.title;
  selectTab(false); // 배선 탭으로 전환해 연결 그림을 바로 보여줌
  setStatus(`예제 '${ex.title}'을(를) 열었어요. 떨어진 블록을 연결하고 값을 고쳐 완성해 보세요`);
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
  loadWorkspaceJson(ex.workspace);
  setStatus(`'${ex.title}' 정답 블록으로 바꿨어요`);
}

document.getElementById('answer-ok').addEventListener('click', tryShowAnswer);
document.getElementById('answer-cancel').addEventListener('click', () => answerDialog.close());
answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryShowAnswer();
});
