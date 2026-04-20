import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export interface Companion {
  id: string
  name: string
  color: string
  system_prompt: string
  introversion: number
  seriousness: number
  formality: number
  energy: number
  empathy: number
  created_at: string
}

export interface Message {
  id: string
  companion_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

let db: Database.Database

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'companion.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

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
  `)

  const row = db.prepare('SELECT COUNT(*) as count FROM companions').get() as { count: number }
  if (row.count === 0) {
    db.prepare(`
      INSERT INTO companions (id, name, color, system_prompt, introversion, seriousness, formality, energy, empathy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), 'Aria', '#7c3aed', '', 50, 40, 40, 60, 70)
  }
}

export function getCompanions(): Companion[] {
  return db.prepare('SELECT * FROM companions ORDER BY created_at').all() as Companion[]
}

export function getCompanion(id: string): Companion | undefined {
  return db.prepare('SELECT * FROM companions WHERE id = ?').get(id) as Companion | undefined
}

export function createCompanion(data: Omit<Companion, 'id' | 'created_at'>): Companion {
  const id = randomUUID()
  db.prepare(`
    INSERT INTO companions (id, name, color, system_prompt, introversion, seriousness, formality, energy, empathy)
    VALUES (@id, @name, @color, @system_prompt, @introversion, @seriousness, @formality, @energy, @empathy)
  `).run({ id, ...data })
  return getCompanion(id)!
}

export function updateCompanion(id: string, data: Partial<Omit<Companion, 'id' | 'created_at'>>): void {
  const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
  if (!fields) return
  db.prepare(`UPDATE companions SET ${fields} WHERE id = @id`).run({ id, ...data })
}

export function deleteCompanion(id: string): void {
  db.prepare('DELETE FROM companions WHERE id = ?').run(id)
}

export function getMessages(companionId: string, limit = 50): Message[] {
  return db.prepare(
    'SELECT * FROM messages WHERE companion_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(companionId, limit).reverse() as Message[]
}

export function addMessage(companionId: string, role: 'user' | 'assistant', content: string): Message {
  const id = randomUUID()
  db.prepare('INSERT INTO messages (id, companion_id, role, content) VALUES (?, ?, ?, ?)').run(id, companionId, role, content)
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message
}

export function clearMessages(companionId: string): void {
  db.prepare('DELETE FROM messages WHERE companion_id = ?').run(companionId)
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}
