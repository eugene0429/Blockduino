'use strict';
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

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
// FTDI(0403), CP210x(10C4) — 국내 교육용 호환보드는 대부분 CH340
const LIKELY_VIDS = new Set(['2341', '2A03', '1A86', '0403', '10C4']);
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
        return { port: addr, label: `아두이노 보드 (${addr})`,
          isUno: board.fqbn === FQBN, rank: 0 };
      }
      const vid = String((p.port.properties || {}).vid || '')
        .replace(/^0x/i, '').toUpperCase();
      if (LIKELY_VIDS.has(vid)) {
        return { port: addr, label: `아두이노 호환 보드 (${addr})`, isUno: false, rank: 1 };
      }
      return { port: addr, label: `기타 포트 (${addr})`, isUno: false, rank: 2 };
    })
    .sort((a, b) => a.rank - b.rank);
}

async function listPorts() {
  const r = await runCli(['board', 'list', '--json']);
  return r.ok ? parseBoardList(r.stdout) : [];
}

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

module.exports = { parseBoardList, listPorts, compileAndUpload, FQBN };
