const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow = null;
let backendProcess = null;

// Poll health endpoint until backend is ready or timeout
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
  if (isDev) return Promise.resolve(); // dev: backend started separately

  const backendPath = path.join(__dirname, '../../backend/dist/index.js');
  backendProcess = spawn(process.execPath, [backendPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
      // SQLite-mode DATABASE_URL set by installer, falls back to in-memory mock
    },
    cwd: path.join(__dirname, '../../backend'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
  backendProcess.on('exit', (code) => console.log('[backend] exited with code', code));

  return waitForBackend('http://localhost:3001/health');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    title: 'TradeEdge — Starting...',
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show a simple loading HTML while backend starts
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
    const frontendPath = path.join(__dirname, '../../frontend/dist/index.html');
    mainWindow.loadFile(frontendPath);
    mainWindow.setTitle('TradeEdge');
  }

  mainWindow.once('ready-to-show', () => mainWindow.focus());
}

app.whenReady().then(createWindow);

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
