import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getDefaultOutputPath: () => ipcRenderer.invoke('get-default-output-path')
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      selectFile: () => Promise<string | null>;
      selectFolder: () => Promise<string | null>;
      openFolder: (path: string) => Promise<void>;
      getGPUInfo: () => Promise<any>;
      getDefaultOutputPath: () => Promise<string>;
    };
  }
}
