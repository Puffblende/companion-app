"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // ── File system ────────────────────────────────────────────────────────
  getPathForFile: (file) => electron.webUtils.getPathForFile(file),
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  // ── Companions ─────────────────────────────────────────────────────────
  companion: {
    list: () => electron.ipcRenderer.invoke("companion:list"),
    get: (id) => electron.ipcRenderer.invoke("companion:get", id),
    create: (data) => electron.ipcRenderer.invoke("companion:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("companion:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("companion:delete", id)
  },
  // ── Messages ───────────────────────────────────────────────────────────
  message: {
    list: (companionId) => electron.ipcRenderer.invoke("message:list", companionId),
    clear: (companionId) => electron.ipcRenderer.invoke("message:clear", companionId)
  },
  // ── Settings ───────────────────────────────────────────────────────────
  settings: {
    get: (key) => electron.ipcRenderer.invoke("settings:get", key),
    set: (key, value) => electron.ipcRenderer.invoke("settings:set", key, value)
  },
  // ── AI Chat ────────────────────────────────────────────────────────────
  ai: {
    chat: (companionId, content) => electron.ipcRenderer.invoke("ai:chat", { companionId, content }),
    onChunk: (cb) => {
      const handler = (_, data) => cb(data);
      electron.ipcRenderer.on("ai:chunk", handler);
      return () => electron.ipcRenderer.off("ai:chunk", handler);
    },
    onDone: (cb) => {
      const handler = (_, data) => cb(data);
      electron.ipcRenderer.on("ai:done", handler);
      return () => electron.ipcRenderer.off("ai:done", handler);
    }
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (e) {
    console.error(e);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
