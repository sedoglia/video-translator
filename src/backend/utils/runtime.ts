import path from 'path';

/**
 * Where the backend finds bundled files and where it may write.
 *
 * The Electron main process sets VT_RESOURCES_DIR / VT_DATA_DIR when the app
 * is packaged: bundled binaries live in the read-only resources folder, while
 * models, logs and temp files go to the per-user data folder. In development
 * (npm start, backend:dev, scripts) neither is set and everything resolves
 * from the project root, as before.
 */
export function getResourcesDir(): string {
  return process.env.VT_RESOURCES_DIR || process.cwd();
}

export function getDataDir(): string {
  return process.env.VT_DATA_DIR || process.cwd();
}

export function isPackaged(): boolean {
  return !!process.env.VT_DATA_DIR;
}

/**
 * Executables shipped inside node_modules are unpacked next to app.asar by
 * electron-builder: point at the real file so it can be spawned (and updated).
 */
export function unpackedPath(filePath: string): string {
  return filePath.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}
