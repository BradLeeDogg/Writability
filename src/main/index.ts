import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { tmpdir } from 'os'
import { registerIpc } from './ipc'
import { runSelftest } from './selftest'
import { runSmoke } from './smoke'

const isSelftest = process.env.WP_SELFTEST === '1'
const isSmoke = process.env.WP_SMOKE === '1'

// Redirect storage to a throwaway folder for test runs so we never touch the
// user's real papers.
if ((isSelftest || isSmoke) && !process.env.WP_DATA_DIR) {
  process.env.WP_DATA_DIR = join(tmpdir(), `writability-test-${process.pid}`)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: '#f6f4ee',
    autoHideMenuBar: true,
    title: 'Writability',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Keep the renderer responsive even when hidden (matters for the smoke run).
      backgroundThrottling: false
    }
  })

  win.once('ready-to-show', () => {
    if (!isSmoke) win.show()
  })

  // Open external links in the user's browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Quit-safe saving: before the window closes, ask the renderer to flush any
  // debounced save and wait (briefly) for its ack so the last keystrokes are
  // never lost to the 700ms autosave window.
  let flushed = false
  win.on('close', (e) => {
    if (flushed || win.webContents.isDestroyed()) return
    e.preventDefault()
    const finish = (): void => {
      if (flushed) return
      flushed = true
      ipcMain.removeListener('app:flushed', finish)
      if (!win.isDestroyed()) win.destroy()
    }
    ipcMain.once('app:flushed', finish)
    win.webContents.send('app:flush')
    setTimeout(finish, 1000)
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  registerIpc()

  if (isSelftest) {
    await runSelftest()
    return
  }

  const win = createWindow()

  if (isSmoke) {
    await runSmoke(win)
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Quiet auto-update (Windows installer builds only). Downloads in the
  // background from the rolling win-latest release and installs on quit —
  // one calm toast, no nagging, nothing interrupts writing.
  if (app.isPackaged && process.platform === 'win32') {
    try {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://github.com/BradLeeDogg/Writability/releases/download/win-latest'
      })
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      autoUpdater.on('update-downloaded', (info) => {
        win.webContents.send('app:update-ready', info.version)
      })
      autoUpdater.on('error', () => {
        // Updates are best-effort; never surface update noise to the student.
      })
      void autoUpdater.checkForUpdates()
    } catch {
      // No update feed available (e.g. offline) — carry on silently.
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isSelftest || isSmoke) app.quit()
})
