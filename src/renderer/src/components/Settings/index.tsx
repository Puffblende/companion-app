import { useState, useEffect } from 'react'
import { useCompanionStore } from '@renderer/stores/companionStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useMessageStore } from '@renderer/stores/messageStore'
import type { Companion } from '@renderer/types/global'

const PERSONALITY_TRAITS = [
  { key: 'introversion' as const, left: 'Extrovertiert', right: 'Introvertiert' },
  { key: 'seriousness' as const, left: 'Verspielt', right: 'Ernst' },
  { key: 'formality' as const, left: 'Informell', right: 'Formell' },
  { key: 'energy' as const, left: 'Ruhig', right: 'Energetisch' },
  { key: 'empathy' as const, left: 'Analytisch', right: 'Empathisch' },
]

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777', '#0891b2']

export function Settings() {
  const { companions, activeId, update, create, remove } = useCompanionStore()
  const { apiKey, setApiKey } = useSettingsStore()
  const { clear } = useMessageStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState(apiKey)
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)

  const activeCompanion = companions.find(c => c.id === activeId)
  const editing = companions.find(c => c.id === editingId) ?? activeCompanion

  useEffect(() => {
    setApiKeyInput(apiKey)
  }, [apiKey])

  useEffect(() => {
    if (activeId && !editingId) setEditingId(activeId)
  }, [activeId])

  async function handleSaveApiKey() {
    await setApiKey(apiKeyInput.trim())
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

  async function handleSlider(key: keyof typeof PERSONALITY_TRAITS[0], value: number) {
    if (!editing) return
    await update(editing.id, { [key]: value })
  }

  async function handleField(key: keyof Companion, value: string) {
    if (!editing) return
    await update(editing.id, { [key]: value } as Partial<Omit<Companion, 'id' | 'created_at'>>)
  }

  async function handleCreateCompanion(name: string, color: string) {
    await create({
      name,
      color,
      system_prompt: '',
      introversion: 50,
      seriousness: 50,
      formality: 40,
      energy: 60,
      empathy: 60,
    })
    setShowNewForm(false)
  }

  async function handleDelete(id: string) {
    if (companions.length <= 1) return
    await remove(id)
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="flex flex-col text-zinc-100" style={{ padding: '20px', gap: '20px' }}>

      {/* API Key */}
      <section className="bg-zinc-800/50 rounded-2xl border border-zinc-700" style={{ padding: '20px' }}>
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Anthropic API Key</h2>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
            placeholder="sk-ant-..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-600 transition-colors font-mono"
          />
          <button
            onClick={handleSaveApiKey}
            className="rounded-xl bg-violet-700 hover:bg-violet-600 text-sm font-medium transition-colors"
            style={{ padding: '8px 20px', whiteSpace: 'nowrap' }}
          >
            {apiKeySaved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          Dein API Key wird lokal gespeichert und nie übertragen.
        </p>
      </section>

      {/* Companion selector */}
      <section className="bg-zinc-800/50 rounded-2xl border border-zinc-700" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">Companions</h2>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="text-xs px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            + Neu
          </button>
        </div>

        {showNewForm && (
          <NewCompanionForm
            onSave={handleCreateCompanion}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {companions.map(c => (
            <button
              key={c.id}
              onClick={() => setEditingId(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all ${
                editingId === c.id
                  ? 'ring-2 ring-violet-500 bg-zinc-700'
                  : 'bg-zinc-700/50 hover:bg-zinc-700'
              }`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* Companion editor */}
      {editing && (
        <section className="bg-zinc-800/50 rounded-2xl border border-zinc-700 flex flex-col" style={{ padding: '20px', gap: '20px' }}>
          <h2 className="text-sm font-semibold text-zinc-300">
            {editing.name} — Einstellungen
          </h2>

          {/* Name */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Name</label>
            <input
              type="text"
              defaultValue={editing.name}
              onBlur={e => handleField('name', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-600 transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => handleField('color', c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    editing.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-800' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Personality sliders */}
          <div>
            <label className="text-xs text-zinc-500 mb-3 block">Persönlichkeit</label>
            <div className="flex flex-col gap-3">
              {PERSONALITY_TRAITS.map(({ key, left, right }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>{left}</span>
                    <span>{right}</span>
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={(editing as unknown as Record<string, number>)[key]}
                      onChange={e => handleSlider(key as keyof typeof PERSONALITY_TRAITS[0], Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Eigene Anweisungen (optional)</label>
            <textarea
              defaultValue={editing.system_prompt}
              onBlur={e => handleField('system_prompt', e.target.value)}
              rows={4}
              placeholder="z.B. Du interessierst dich besonders für Philosophie und Musik…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-600 transition-colors resize-none placeholder:text-zinc-700"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => clear(editing.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors"
            >
              Verlauf löschen
            </button>
            {companions.length > 1 && (
              <button
                onClick={() => handleDelete(editing.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/60 text-red-400 transition-colors ml-auto"
              >
                Companion löschen
              </button>
            )}
          </div>
        </section>
      )}

      <div className="h-1" />
    </div>
  )
}

function NewCompanionForm({ onSave, onCancel }: { onSave: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7c3aed')
  const COLORS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777', '#0891b2']

  return (
    <div className="bg-zinc-900 rounded-xl p-3 mb-3 border border-zinc-700 flex flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name des Companions"
        autoFocus
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-violet-600"
      />
      <div className="flex gap-2">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => name.trim() && onSave(name.trim(), color)}
          disabled={!name.trim()}
          className="flex-1 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-sm disabled:opacity-40 transition-colors"
        >
          Erstellen
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  )
}
