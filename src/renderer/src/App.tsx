import { useState, useEffect, useRef } from 'react'
import { VrmViewer } from '@renderer/components/VrmViewer'
import { Settings } from '@renderer/components/Settings'
import { useCompanionStore } from '@renderer/stores/companionStore'
import { useMessageStore } from '@renderer/stores/messageStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

type View = 'companion' | 'settings' | 'memory'

export default function App() {
  const [view, setView] = useState<View>('companion')
  const [inputText, setInputText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { companions, activeId, setActive, active, load: loadCompanions } = useCompanionStore()
  const { messages, streaming, isStreaming, load: loadMessages, send } = useMessageStore()
  const { load: loadSettings, apiKey } = useSettingsStore()

  const companion = active()
  const companionMessages = messages[activeId ?? ''] ?? []
  const streamingText = streaming[activeId ?? ''] ?? ''
  const streaming_ = isStreaming[activeId ?? ''] ?? false

  // Initial load
  useEffect(() => {
    loadSettings()
    loadCompanions()
  }, [])

  // Load messages when active companion changes
  useEffect(() => {
    if (activeId) loadMessages(activeId)
  }, [activeId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [companionMessages.length, streamingText])

  async function handleSend() {
    const text = inputText.trim()
    if (!text || !activeId || streaming_) return
    setSendError(null)
    setInputText('')
    try {
      await send(activeId, text)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NO_API_KEY')) {
        setSendError('Kein API Key gesetzt – bitte in den Einstellungen eintragen.')
        setView('settings')
      } else {
        setSendError(`Fehler: ${msg}`)
      }
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden select-none">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col items-center gap-3 bg-zinc-900 border-r border-zinc-800"
        style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', paddingTop: '20px', paddingBottom: '20px' }}
      >
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center font-bold text-sm text-white mb-1">
          C
        </div>

        {/* Companion avatars */}
        <div className="flex flex-col gap-2 flex-1 w-full items-center pt-2">
          {companions.map(c => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              title={c.name}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                activeId === c.id
                  ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-zinc-900'
                  : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.color }}
            >
              {c.name[0]}
            </button>
          ))}

          <button
            title="Companion hinzufügen"
            onClick={() => setView('settings')}
            className="w-10 h-10 rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all text-lg"
          >
            +
          </button>
        </div>

        {/* Nav */}
        <div className="flex flex-col gap-1" style={{ paddingBottom: '4px' }}>
          <NavButton active={view === 'companion'} onClick={() => setView('companion')} title="Companion">◉</NavButton>
          <NavButton active={view === 'memory'} onClick={() => setView('memory')} title="Erinnerungen">⊡</NavButton>
          <NavButton active={view === 'settings'} onClick={() => setView('settings')} title="Einstellungen">⚙</NavButton>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex min-w-0">

        {/* Viewport */}
        <div className="flex-1 relative bg-zinc-950 flex flex-col items-center justify-center">
          <div
            className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle, #a1a1aa 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          />

          {view === 'companion' && <VrmViewer />}

          {view === 'memory' && (
            <div className="relative z-10 text-center">
              <p className="text-zinc-500 text-sm">Erinnerungen & Nutzerdaten</p>
              <p className="text-zinc-700 text-xs mt-1">Phase 5</p>
            </div>
          )}

          {view === 'settings' && (
            <div className="absolute inset-0 z-10 overflow-y-auto">
              <Settings />
            </div>
          )}
        </div>

        {/* ── Chat panel ─────────────────────────────────────────────────── */}
        <div
          className="flex flex-col border-l border-zinc-800 bg-zinc-900"
          style={{ width: 'var(--chat-panel-width)', minWidth: 'var(--chat-panel-width)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            {companion && (
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: companion.color }}>
                {companion.name[0]}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-200">{companion?.name ?? 'Companion'}</p>
              <p className="text-xs text-zinc-500">AI-Companion</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {companionMessages.length === 0 && !streaming_ && (
              <div className="flex gap-2 items-start">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: companion?.color ?? '#7c3aed' }}
                >
                  {companion?.name[0] ?? 'A'}
                </div>
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-zinc-200 max-w-[220px]">
                  {apiKey ? `Hallo! Ich bin ${companion?.name ?? 'dein Companion'}. Wie kann ich dir helfen?` : 'Bitte trage erst deinen API Key in den Einstellungen ein.'}
                </div>
              </div>
            )}

            {companionMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: companion?.color ?? '#7c3aed' }}
                  >
                    {companion?.name[0] ?? 'A'}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm max-w-[220px] whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-violet-700 text-white rounded-tr-sm'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming bubble */}
            {streaming_ && (
              <div className="flex gap-2 items-start">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: companion?.color ?? '#7c3aed' }}
                >
                  {companion?.name[0] ?? 'A'}
                </div>
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-zinc-200 max-w-[220px] whitespace-pre-wrap break-words">
                  {streamingText || <span className="animate-pulse text-zinc-500">…</span>}
                </div>
              </div>
            )}

            {sendError && (
              <p className="text-xs text-red-400 text-center px-2">{sendError}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 flex flex-col gap-2" style={{ padding: '12px' }}>
            <div className="flex gap-2">
              <button
                title="Spracheingabe (Phase 6)"
                className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-all flex-shrink-0"
              >
                ♪
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Schreibe eine Nachricht…"
                disabled={streaming_}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-600 transition-colors disabled:opacity-50"
              />

              <button
                onClick={handleSend}
                disabled={!inputText.trim() || streaming_}
                title="Senden"
                className="w-9 h-9 rounded-xl bg-violet-700 flex items-center justify-center text-white hover:bg-violet-600 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function NavButton({ active, onClick, title, children }: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all ${
        active ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}
