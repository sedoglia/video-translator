import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';
import { VIDEO_EXTENSIONS } from './shared/types';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackendServer() {
  const serverPath = path.join(__dirname, 'backend', 'server.js');

  backendProcess = fork(serverPath, [], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
  });

  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend] ${data.toString()}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Backend Error] ${data.toString()}`);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
  });

  console.log('Backend server started');
}

function stopBackendServer() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    console.log('Backend server stopped');
  }
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  startBackendServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  stopBackendServer();
});

// IPC Handlers
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: VIDEO_EXTENSIONS.map(ext => ext.slice(1)) },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('open-folder', async (event, filePath: string) => {
  const folderPath = path.dirname(filePath);
  await shell.openPath(folderPath);
});

ipcMain.handle('get-gpu-info', async () => {
  // This will be fetched from backend, just a placeholder
  return { cudaAvailable: false };
});

ipcMain.handle('get-default-output-path', async () => {
  return 'C:\\TEMP';
});
