"use strict";
const electron = require("electron");
const path = require("path");
const promises = require("node:fs/promises");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
let db;
function initDatabase() {
  const dbPath = path.join(electron.app.getPath("userData"), "companion.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS companions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#7c3aed',
      system_prompt TEXT NOT NULL DEFAULT '',
      introversion INTEGER NOT NULL DEFAULT 50,
      seriousness INTEGER NOT NULL DEFAULT 50,
      formality INTEGER NOT NULL DEFAULT 50,
      energy INTEGER NOT NULL DEFAULT 50,
      empathy INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      companion_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const row = db.prepare("SELECT COUNT(*) as count FROM companions").get();
  if (row.count === 0) {
    db.prepare(`
      INSERT INTO companions (id, name, color, system_prompt, introversion, seriousness, formality, energy, empathy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), "Aria", "#7c3aed", "", 50, 40, 40, 60, 70);
  }
}
function getCompanions() {
  return db.prepare("SELECT * FROM companions ORDER BY created_at").all();
}
function getCompanion(id) {
  return db.prepare("SELECT * FROM companions WHERE id = ?").get(id);
}
function createCompanion(data) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO companions (id, name, color, system_prompt, introversion, seriousness, formality, energy, empathy)
    VALUES (@id, @name, @color, @system_prompt, @introversion, @seriousness, @formality, @energy, @empathy)
  `).run({ id, ...data });
  return getCompanion(id);
}
function updateCompanion(id, data) {
  const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(", ");
  if (!fields) return;
  db.prepare(`UPDATE companions SET ${fields} WHERE id = @id`).run({ id, ...data });
}
function deleteCompanion(id) {
  db.prepare("DELETE FROM companions WHERE id = ?").run(id);
}
function getMessages(companionId, limit = 50) {
  return db.prepare(
    "SELECT * FROM messages WHERE companion_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(companionId, limit).reverse();
}
function addMessage(companionId, role, content) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO messages (id, companion_id, role, content) VALUES (?, ?, ?, ?)").run(id, companionId, role, content);
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
}
function clearMessages(companionId) {
  db.prepare("DELETE FROM messages WHERE companion_id = ?").run(companionId);
}
function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value;
}
function setSetting(key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
function buildSystemPrompt(companion) {
  const traits = [];
  if (companion.introversion < 25) traits.push("sehr gesprächig, offen und extrovertiert – du liebst es, Gespräche zu initiieren");
  else if (companion.introversion < 45) traits.push("eher extrovertiert, gesellig und kommunikativ");
  else if (companion.introversion < 55) traits.push("ausgeglichen zwischen introvertiert und extrovertiert");
  else if (companion.introversion < 75) traits.push("eher introvertiert, nachdenklich und tiefsinnig");
  else traits.push("sehr introvertiert und tiefsinnig – du bevorzugst tiefe, bedeutungsvolle Gespräche");
  if (companion.seriousness < 25) traits.push("sehr verspielt, witzig und humorvoll");
  else if (companion.seriousness < 45) traits.push("eher verspielt und locker");
  else if (companion.seriousness < 55) traits.push("ausgewogen zwischen ernst und verspielt");
  else if (companion.seriousness < 75) traits.push("eher ernst und fokussiert");
  else traits.push("sehr ernst, tiefgründig und zielgerichtet");
  if (companion.formality < 25) traits.push("sehr informell und casual in deiner Sprache");
  else if (companion.formality < 45) traits.push("eher informell und ungezwungen");
  else if (companion.formality < 55) traits.push("weder besonders formell noch informell");
  else if (companion.formality < 75) traits.push("eher formell und gepflegt in deiner Ausdrucksweise");
  else traits.push("sehr formell und kultiviert in deiner Sprache");
  if (companion.energy < 25) traits.push("sehr ruhig, gelassen und besonnen");
  else if (companion.energy < 45) traits.push("eher ruhig und bedächtig");
  else if (companion.energy < 55) traits.push("ausgeglichen in deiner Energie");
  else if (companion.energy < 75) traits.push("eher energetisch und enthusiastisch");
  else traits.push("sehr energetisch, begeistert und enthusiastisch");
  if (companion.empathy < 25) traits.push("sehr analytisch und logisch denkend");
  else if (companion.empathy < 45) traits.push("eher analytisch mit einem Sinn für Logik");
  else if (companion.empathy < 55) traits.push("ausgewogen zwischen empathisch und analytisch");
  else if (companion.empathy < 75) traits.push("sehr einfühlsam und emotional verständnisvoll");
  else traits.push("extrem empathisch und emotional feinfühlig");
  const base = `Du bist ${companion.name}, ein AI-Companion. Du sprichst immer auf Deutsch, außer der Nutzer spricht eine andere Sprache.

Deine Persönlichkeit:
${traits.map((t) => `- Du bist ${t}`).join("\n")}

Du bist kein Assistent – du bist ein echter Companion und Freund. Du erinnerst dich an frühere Gespräche und baust eine echte Beziehung auf. Antworte natürlich und authentisch, nicht wie ein Chatbot.`;
  if (companion.system_prompt.trim()) {
    return `${base}

Zusätzliche Anweisungen:
${companion.system_prompt}`;
  }
  return base;
}
async function streamMessage(companion, history, userMessage, apiKey, onChunk) {
  const client = new Anthropic({ apiKey });
  const messages = history.map((m) => ({
    role: m.role,
    content: m.content
  }));
  messages.push({ role: "user", content: userMessage });
  let fullText = "";
  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(companion),
        // @ts-ignore – cache_control is valid at runtime
        cache_control: { type: "ephemeral" }
      }
    ],
    messages
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }
  return fullText;
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self' blob: 'unsafe-inline'"]
      }
    });
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  initDatabase();
  electron.ipcMain.handle("fs:readFile", async (_e, filePath) => {
    return await promises.readFile(filePath);
  });
  electron.ipcMain.handle("companion:list", () => getCompanions());
  electron.ipcMain.handle("companion:get", (_e, id) => getCompanion(id));
  electron.ipcMain.handle("companion:create", (_e, data) => createCompanion(data));
  electron.ipcMain.handle("companion:update", (_e, id, data) => {
    updateCompanion(id, data);
    return getCompanion(id);
  });
  electron.ipcMain.handle("companion:delete", (_e, id) => deleteCompanion(id));
  electron.ipcMain.handle("message:list", (_e, companionId) => getMessages(companionId));
  electron.ipcMain.handle("message:clear", (_e, companionId) => clearMessages(companionId));
  electron.ipcMain.handle("settings:get", (_e, key) => getSetting(key));
  electron.ipcMain.handle("settings:set", (_e, key, value) => setSetting(key, value));
  electron.ipcMain.handle("ai:chat", async (event, { companionId, content }) => {
    const apiKey = getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("NO_API_KEY");
    const companion = getCompanion(companionId);
    if (!companion) throw new Error("COMPANION_NOT_FOUND");
    addMessage(companionId, "user", content);
    const history = getMessages(companionId, 40);
    const historyWithoutLast = history.slice(0, -1);
    const responseText = await streamMessage(
      companion,
      historyWithoutLast,
      content,
      apiKey,
      (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("ai:chunk", { companionId, text: chunk });
        }
      }
    );
    const msg = addMessage(companionId, "assistant", responseText);
    if (!event.sender.isDestroyed()) {
      event.sender.send("ai:done", { companionId, message: msg });
    }
    return msg;
  });
  utils.electronApp.setAppUserModelId("com.companion.app");
  electron.app.on("browser-window-created", (_, window) => utils.optimizer.watchWindowShortcuts(window));
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
