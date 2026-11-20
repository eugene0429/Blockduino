'use strict';
const { execFile, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { t } = require('../shared/i18n.js');

const FQBN = 'arduino:avr:uno';

function baseDir() {
  if (process.env.BLOCKDUINO_ARDUINO_DIR) return process.env.BLOCKDUINO_ARDUINO_DIR;
  if (process.resourcesPath && !process.defaultApp) {
    return path.join(process.resourcesPath, 'arduino'); // 패키징된 앱
  }
  return path.join(__dirname, '../../vendor/arduino', process.platform); // 개발 모드
}

function cliBin() {
  return path.join(baseDir(), process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
}

function cliEnv() {
  return {
    ...process.env,
    ARDUINO_DIRECTORIES_DATA: path.join(baseDir(), 'data'),
    ARDUINO_DIRECTORIES_DOWNLOADS: path.join(baseDir(), 'downloads'),
    ARDUINO_DIRECTORIES_USER: path.join(baseDir(), 'user'),
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
  };
}

function runCli(args) {
  return new Promise((resolve) => {
    execFile(cliBin(), args, { env: cliEnv(), timeout: 180000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

// 학생용 포트 목록: 무관한 포트는 숨기고, 아두이노(호환)를 한글 라벨로 앞에 정렬.
// USB 시리얼 칩 제조사 VID: Arduino(2341), Arduino.org(2A03), CH340(1A86),
// FTDI(0403), CP210x(10C4) — 국내 교육용 호환보드는 대부분 CH340.
// 0843: 네이티브 USB(CDC) 방식 호환보드 (예: FIREPHX "USB SER", /dev/cu.usbmodem*)
const LIKELY_VIDS = new Set(['2341', '2A03', '1A86', '0403', '10C4', '0843']);
const IGNORED_PORTS = /bluetooth|wlan-debug|debug-console/i;

function parseBoardList(stdout) {
  let data;
  try { data = JSON.parse(stdout); } catch { return []; }
  return (data.detected_ports || [])
    .filter((p) => p.port && p.port.protocol === 'serial')
    .filter((p) => !IGNORED_PORTS.test(p.port.address) && !IGNORED_PORTS.test(p.port.label || ''))
    .map((p) => {
      const addr = p.port.address;
      const board = (p.matching_boards || [])[0];
      if (board) {
        return { port: addr, label: t('port.arduino', { port: addr }),
          isUno: board.fqbn === FQBN, rank: 0 };
      }
      const vid = String((p.port.properties || {}).vid || '')
        .replace(/^0x/i, '').toUpperCase();
      if (LIKELY_VIDS.has(vid)) {
        return { port: addr, label: t('port.compatible', { port: addr }), isUno: false, rank: 1 };
      }
      return { port: addr, label: t('port.other', { port: addr }), isUno: false, rank: 2 };
    })
    .sort((a, b) => a.rank - b.rank);
}

async function listPorts() {
  const r = await runCli(['board', 'list', '--json']);
  return r.ok ? parseBoardList(r.stdout) : [];
}

// ── 시리얼 모니터 ────────────────────────────────────
// arduino-cli monitor로 보드 시리얼 출력을 스트리밍한다 (새 의존성 없음).
// 시리얼 포트는 배타적이라 한 번에 하나만 열고, 업로드 전에는 반드시 닫는다.
let monitorProc = null;
let monitorPort = null;

function startMonitor(port, onLine, onClose) {
  stopMonitor();
  monitorPort = port;
  const proc = spawn(cliBin(), ['monitor', '-p', port, '-c', 'baudrate=9600', '-q'], {
    env: cliEnv(),
  });
  monitorProc = proc;
  let buf = '';
  // setEncoding('utf8')을 걸면 Node의 StringDecoder가 청크 경계에 걸친
  // 멀티바이트(한글 3바이트 등) 문자를 이어붙여 준다. 이걸 안 하면
  // chunk.toString()이 반쪽 바이트를 깨진 문자()로 만든다.
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop(); // 마지막 조각은 다음 청크와 합친다
    for (const line of lines) onLine(line);
  });
  proc.on('error', () => { if (monitorProc === proc) { monitorProc = null; monitorPort = null; } onClose && onClose(); });
  proc.on('close', () => { if (monitorProc === proc) { monitorProc = null; monitorPort = null; } onClose && onClose(); });
  return proc;
}

function stopMonitor() {
  if (monitorProc) { monitorProc.kill(); monitorProc = null; }
  monitorPort = null;
}

function isMonitoring() { return !!monitorProc; }
function currentMonitorPort() { return monitorPort; }

async function compileAndUpload(code, port, onStage) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blockduino-'));
  const sketchDir = path.join(dir, 'sketch');
  await fs.mkdir(sketchDir);
  await fs.writeFile(path.join(sketchDir, 'sketch.ino'), code, 'utf8');
  try {
    onStage && onStage('compile');
    const c = await runCli(['compile', '--fqbn', FQBN, sketchDir]);
    if (!c.ok) return { ok: false, stage: 'compile', output: c.stderr || c.stdout };
    onStage && onStage('upload');
    const u = await runCli(['upload', '-p', port, '--fqbn', FQBN, sketchDir]);
    if (!u.ok) return { ok: false, stage: 'upload', output: u.stderr || u.stdout };
    return { ok: true };
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  parseBoardList, listPorts, compileAndUpload, FQBN,
  startMonitor, stopMonitor, isMonitoring, currentMonitorPort,
};
