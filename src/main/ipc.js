'use strict';
const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const arduino = require('./arduino.js');
const { friendlyError } = require('./messages.js');
const { t, setLang } = require('../shared/i18n.js');

const bdnFilter = () => [{ name: t('file.filterName'), extensions: ['bdn'] }];

function registerIpc(getWindow) {
  // The renderer owns the language choice; main mirrors it for dialogs,
  // port labels and upload error messages.
  ipcMain.handle('lang:set', (_e, lang) => setLang(lang));

  ipcMain.handle('project:save', async (_e, { json, filePath }) => {
    try {
      let target = filePath;
      if (!target) {
        const r = await dialog.showSaveDialog(getWindow(), {
          title: t('file.saveTitle'), defaultPath: t('file.defaultFileName'), filters: bdnFilter(),
        });
        if (r.canceled) return null;
        target = r.filePath;
      }
      await fs.writeFile(target, JSON.stringify(json, null, 2), 'utf8');
      return target;
    } catch (err) {
      return {
        error: {
          message: t('file.saveError'),
          detail: String(err),
        },
      };
    }
  });

  ipcMain.handle('project:open', async () => {
    try {
      const r = await dialog.showOpenDialog(getWindow(), {
        title: t('file.openTitle'), filters: bdnFilter(), properties: ['openFile'],
      });
      if (r.canceled || !r.filePaths[0]) return null;
      const text = await fs.readFile(r.filePaths[0], 'utf8');
      return { filePath: r.filePaths[0], json: JSON.parse(text) };
    } catch (err) {
      return {
        error: {
          message: t('file.openError'),
          detail: String(err),
        },
      };
    }
  });

  ipcMain.handle('confirm-discard', async () => {
    const r = await dialog.showMessageBox(getWindow(), {
      type: 'question', buttons: [t('file.discardContinue'), t('dialog.cancel')], defaultId: 1, cancelId: 1,
      message: t('file.discardMessage'),
    });
    return r.response === 0;
  });

  ipcMain.handle('ports:list', () => arduino.listPorts());

  // ── 시리얼 모니터 ──
  function startMon(port) {
    arduino.startMonitor(
      port,
      (line) => { const w = getWindow(); if (w) w.webContents.send('serial:data', line); },
      () => { const w = getWindow(); if (w) w.webContents.send('serial:closed'); },
    );
  }
  ipcMain.handle('serial:start', (_e, port) => { if (port) startMon(port); return true; });
  ipcMain.handle('serial:stop', () => { arduino.stopMonitor(); return true; });

  ipcMain.handle('sketch:upload', async (_e, { code, port }) => {
    if (!port) {
      const fe = friendlyError('no-port', '');
      return { ok: false, ...fe };
    }
    // 업로드하려면 포트를 독점해야 하므로 모니터를 잠시 닫고, 끝나면 재개한다.
    const resumePort = arduino.isMonitoring() ? arduino.currentMonitorPort() : null;
    if (resumePort) arduino.stopMonitor();
    try {
      const result = await arduino.compileAndUpload(code, port, (stage) => {
        getWindow().webContents.send('upload:stage', stage);
      });
      if (result.ok) return { ok: true };
      const fe = friendlyError(result.stage, result.output);
      return { ok: false, ...fe };
    } finally {
      if (resumePort) startMon(resumePort);
    }
  });
}

module.exports = { registerIpc };
