'use strict';
const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const arduino = require('./arduino.js');
const { friendlyError } = require('./messages.js');

const BDN_FILTER = [{ name: 'Blockduino 프로젝트', extensions: ['bdn'] }];

function registerIpc(getWindow) {
  ipcMain.handle('project:save', async (_e, { json, filePath }) => {
    try {
      let target = filePath;
      if (!target) {
        const r = await dialog.showSaveDialog(getWindow(), {
          title: '프로젝트 저장', defaultPath: '새 프로젝트.bdn', filters: BDN_FILTER,
        });
        if (r.canceled) return null;
        target = r.filePath;
      }
      await fs.writeFile(target, JSON.stringify(json, null, 2), 'utf8');
      return target;
    } catch (err) {
      return {
        error: {
          message: '프로젝트를 저장하지 못했어요. 다른 위치에 저장해 보세요',
          detail: String(err),
        },
      };
    }
  });

  ipcMain.handle('project:open', async () => {
    try {
      const r = await dialog.showOpenDialog(getWindow(), {
        title: '프로젝트 열기', filters: BDN_FILTER, properties: ['openFile'],
      });
      if (r.canceled || !r.filePaths[0]) return null;
      const text = await fs.readFile(r.filePaths[0], 'utf8');
      return { filePath: r.filePaths[0], json: JSON.parse(text) };
    } catch (err) {
      return {
        error: {
          message: '프로젝트 파일을 열 수 없어요. 파일이 손상되었을 수 있어요',
          detail: String(err),
        },
      };
    }
  });

  ipcMain.handle('confirm-discard', async () => {
    const r = await dialog.showMessageBox(getWindow(), {
      type: 'question', buttons: ['계속하기', '취소'], defaultId: 1, cancelId: 1,
      message: '저장하지 않은 변경이 있어요. 저장하지 않고 계속할까요?',
    });
    return r.response === 0;
  });

  ipcMain.handle('ports:list', () => arduino.listPorts());

  ipcMain.handle('sketch:upload', async (_e, { code, port }) => {
    if (!port) {
      const fe = friendlyError('no-port', '');
      return { ok: false, ...fe };
    }
    const result = await arduino.compileAndUpload(code, port, (stage) => {
      getWindow().webContents.send('upload:stage', stage);
    });
    if (result.ok) return { ok: true };
    const fe = friendlyError(result.stage, result.output);
    return { ok: false, ...fe };
  });
}

module.exports = { registerIpc };
