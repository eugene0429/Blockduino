'use strict';
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpc } = require('./ipc.js');

// 개발 모드(npm start)에서는 일렉트론 기본 아이콘이 뜨므로 로고를 직접 지정.
// 패키징된 앱은 electron-builder가 실행파일에 아이콘을 심으므로 이 파일이 없어도 된다.
const DEV_ICON = path.join(__dirname, '../../build/icon.png');
const devIcon = fs.existsSync(DEV_ICON) ? DEV_ICON : undefined;

// 기본 메뉴는 영어(File/Edit/...)이며 macOS에서는 Cmd+C/V/Q 등 표준 단축키가
// 이 메뉴에 묶여 있으므로, 배포 대상인 윈도우에서만 제거한다.
if (process.platform === 'win32') Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Blockduino',
    icon: devIcon, // 윈도우/리눅스 창·작업표시줄 아이콘 (macOS는 무시됨)
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  // 표준 블록 우클릭 도움말 등이 여는 새 창을 차단 (완전 오프라인 정책)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}

let mainWindow = null;
app.whenReady().then(() => {
  if (process.platform === 'darwin' && devIcon && app.dock) {
    app.dock.setIcon(devIcon); // macOS 독 아이콘 (개발 모드용)
  }
  mainWindow = createWindow();
  registerIpc(() => mainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { createWindow };
