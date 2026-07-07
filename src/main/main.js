'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpc } = require('./ipc.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Blockduino',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
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
