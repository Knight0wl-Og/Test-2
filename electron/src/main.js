const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';
const resourcesPath = process.resourcesPath;
let mainWindow = null;
let backendProcess = null;

// ── Auto-updater ──────────────────────────────────────────────────────────────
function initAutoUpdater() {
  if (isDev) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of TradeEdge has been downloaded. It will be installed when you quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[updater] error:', err.message);
    });

    // Check after window is ready to avoid blocking startup
    app.whenReady().then(() => setTimeout(() => autoUpdater.checkForUpdates(), 5000));
  } catch (err) {
    console.warn('[updater] not available:', err.message);
  }
}

// ── Backend ───────────────────────────────────────────────────────────────────
function waitForBackend(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    }
    function retry() {
      if (Date.now() - start > timeoutMs) return reject(new Error('Backend timed out'));
      setTimeout(check, 500);
    }
    check();
  });
}

function startBackend() {
  if (isDev) return Promise.resolve();

  const backendPath = path.join(resourcesPath, 'backend', 'dist', 'index.js');
  backendProcess = spawn(process.execPath, [backendPath], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
    cwd: path.join(resourcesPath, 'backend'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
  backendProcess.on('exit', (code) => console.log('[backend] exited with code', code));

  return waitForBackend('http://localhost:3001/health');
}

// ── Window ────────────────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    show: false,
    title: 'TradeEdge — Starting...',
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`data:text/html,<html style="background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#6366f1"><div style="text-align:center"><div style="font-size:32px;font-weight:bold;letter-spacing:4px;margin-bottom:16px">TRADEEDGE</div><div style="color:#6b7280;font-size:14px">Starting services...</div></div></html>`);
  mainWindow.show();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    try {
      await startBackend();
    } catch (err) {
      console.error('Backend failed to start:', err);
    }
    mainWindow.loadFile(path.join(resourcesPath, 'frontend', 'dist', 'index.html'));
    mainWindow.setTitle('TradeEdge');
  }

  mainWindow.once('ready-to-show', () => mainWindow.focus());
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
