import { contextBridge, ipcRenderer, webUtils, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Companion, Message } from '../main/database'

const api = {
  // ── File system ────────────────────────────────────────────────────────
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  readFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('fs:readFile', filePath),

  // ── Companions ─────────────────────────────────────────────────────────
  companion: {
    list: (): Promise<Companion[]> => ipcRenderer.invoke('companion:list'),
    get: (id: string): Promise<Companion | undefined> => ipcRenderer.invoke('companion:get', id),
    create: (data: Omit<Companion, 'id' | 'created_at'>): Promise<Companion> => ipcRenderer.invoke('companion:create', data),
    update: (id: string, data: Partial<Omit<Companion, 'id' | 'created_at'>>): Promise<Companion> => ipcRenderer.invoke('companion:update', id, data),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('companion:delete', id),
  },

  // ── Messages ───────────────────────────────────────────────────────────
  message: {
    list: (companionId: string): Promise<Message[]> => ipcRenderer.invoke('message:list', companionId),
    clear: (companionId: string): Promise<void> => ipcRenderer.invoke('message:clear', companionId),
  },

  // ── Settings ───────────────────────────────────────────────────────────
  settings: {
    get: (key: string): Promise<string | undefined> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
  },

  // ── AI Chat ────────────────────────────────────────────────────────────
  ai: {
    chat: (companionId: string, content: string): Promise<Message> =>
      ipcRenderer.invoke('ai:chat', { companionId, content }),
    onChunk: (cb: (data: { companionId: string; text: string }) => void) => {
      const handler = (_: IpcRendererEvent, data: unknown) => cb(data as { companionId: string; text: string })
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.off('ai:chunk', handler)
    },
    onDone: (cb: (data: { companionId: string; message: Message }) => void) => {
      const handler = (_: IpcRendererEvent, data: unknown) => cb(data as { companionId: string; message: Message })
      ipcRenderer.on('ai:done', handler)
      return () => ipcRenderer.off('ai:done', handler)
    },
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
