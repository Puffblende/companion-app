import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFile } from 'node:fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  initDatabase,
  getCompanions,
  getCompanion,
  createCompanion,
  updateCompanion,
  deleteCompanion,
  getMessages,
  addMessage,
  clearMessages,
  getSetting,
  setSetting,
} from './database'
import { streamMessage } from './ai'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' blob: 'unsafe-inline'"],
      },
    })
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase()

  // ── File system ──────────────────────────────────────────────────────────
  ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
    return await readFile(filePath)
  })

  // ── Companions ───────────────────────────────────────────────────────────
  ipcMain.handle('companion:list', () => getCompanions())
  ipcMain.handle('companion:get', (_e, id: string) => getCompanion(id))
  ipcMain.handle('companion:create', (_e, data) => createCompanion(data))
  ipcMain.handle('companion:update', (_e, id: string, data) => {
    updateCompanion(id, data)
    return getCompanion(id)
  })
  ipcMain.handle('companion:delete', (_e, id: string) => deleteCompanion(id))

  // ── Messages ─────────────────────────────────────────────────────────────
  ipcMain.handle('message:list', (_e, companionId: string) => getMessages(companionId))
  ipcMain.handle('message:clear', (_e, companionId: string) => clearMessages(companionId))

  // ── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value))

  // ── AI Chat (streaming) ──────────────────────────────────────────────────
  ipcMain.handle('ai:chat', async (event, { companionId, content }: { companionId: string; content: string }) => {
    const apiKey = getSetting('anthropic_api_key')
    if (!apiKey) throw new Error('NO_API_KEY')

    const companion = getCompanion(companionId)
    if (!companion) throw new Error('COMPANION_NOT_FOUND')

    addMessage(companionId, 'user', content)

    const history = getMessages(companionId, 40)
    const historyWithoutLast = history.slice(0, -1)

    const responseText = await streamMessage(
      companion,
      historyWithoutLast,
      content,
      apiKey,
      (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', { companionId, text: chunk })
        }
      }
    )

    const msg = addMessage(companionId, 'assistant', responseText)
    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:done', { companionId, message: msg })
    }
    return msg
  })

  electronApp.setAppUserModelId('com.companion.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
