'use strict';
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { registerIpc } = require('./ipc.js');

// 기본 메뉴는 영어(File/Edit/...)이며 macOS에서는 Cmd+C/V/Q 등 표준 단축키가
// 이 메뉴에 묶여 있으므로, 배포 대상인 윈도우에서만 제거한다.
if (process.platform === 'win32') Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Blockduino',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  // 표준 블록 우클릭 도움말 등이 여는 새 창을 차단 (완전 오프라인 정책)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}

let mainWindow = null;
app.whenReady().then(() => {
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
