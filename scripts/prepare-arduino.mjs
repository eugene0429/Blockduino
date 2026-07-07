import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const VERSION = '1.1.1';
const PLATFORM = process.platform; // 'win32' | 'darwin'
const ARCHIVES = {
  win32: `arduino-cli_${VERSION}_Windows_64bit.zip`,
  darwin: `arduino-cli_${VERSION}_macOS_ARM64.tar.gz`,
};
const archive = ARCHIVES[PLATFORM];
if (!archive) throw new Error(`지원하지 않는 플랫폼: ${PLATFORM}`);

const destDir = path.resolve('vendor/arduino', PLATFORM);
const bin = path.join(destDir, PLATFORM === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
mkdirSync(destDir, { recursive: true });

if (!existsSync(bin)) {
  const url = `https://downloads.arduino.cc/arduino-cli/${archive}`;
  console.log('다운로드:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const archivePath = path.join(destDir, archive);
  await pipeline(res.body, createWriteStream(archivePath));
  if (archive.endsWith('.zip')) {
    execFileSync('tar', ['-xf', archivePath, '-C', destDir]); // Win10+ 기본 tar가 zip 해제 지원
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', destDir]);
  }
}

const env = {
  ...process.env,
  ARDUINO_DIRECTORIES_DATA: path.join(destDir, 'data'),
  ARDUINO_DIRECTORIES_DOWNLOADS: path.join(destDir, 'downloads'),
  ARDUINO_DIRECTORIES_USER: path.join(destDir, 'user'),
};
const cli = (args) => execFileSync(bin, args, { env, stdio: 'inherit' });

cli(['core', 'update-index']);
cli(['core', 'install', 'arduino:avr']);
cli(['lib', 'install', 'Servo']);
cli(['lib', 'install', 'DHT sensor library']); // Adafruit, 의존성 자동 설치
cli(['lib', 'install', 'LiquidCrystal I2C']);
console.log('완료:', destDir);
