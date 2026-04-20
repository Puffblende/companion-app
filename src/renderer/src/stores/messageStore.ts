import { create } from 'zustand'
import type { Message } from '../types/global'

interface MessageStore {
  messages: Record<string, Message[]>
  streaming: Record<string, string>
  isStreaming: Record<string, boolean>

  load: (companionId: string) => Promise<void>
  send: (companionId: string, content: string) => Promise<void>
  clear: (companionId: string) => Promise<void>
}

export const useMessageStore = create<MessageStore>((set) => ({
  messages: {},
  streaming: {},
  isStreaming: {},

  load: async (companionId: string) => {
    const msgs = await window.api.message.list(companionId)
    set(s => ({ messages: { ...s.messages, [companionId]: msgs } }))
  },

  send: async (companionId: string, content: string) => {
    // Optimistically add user message
    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      companion_id: companionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    set(s => ({
      messages: { ...s.messages, [companionId]: [...(s.messages[companionId] ?? []), userMsg] },
      streaming: { ...s.streaming, [companionId]: '' },
      isStreaming: { ...s.isStreaming, [companionId]: true },
    }))

    const unsubChunk = window.api.ai.onChunk(({ companionId: cid, text }) => {
      if (cid !== companionId) return
      set(s => ({
        streaming: { ...s.streaming, [cid]: (s.streaming[cid] ?? '') + text },
      }))
    })

    const unsubDone = window.api.ai.onDone(({ companionId: cid, message }) => {
      if (cid !== companionId) return
      set(s => {
        const prev = s.messages[cid] ?? []
        // Replace the temp user message with persisted messages
        return {
          messages: { ...s.messages, [cid]: [...prev.filter(m => !m.id.startsWith('tmp-')), message] },
          streaming: { ...s.streaming, [cid]: '' },
          isStreaming: { ...s.isStreaming, [cid]: false },
        }
      })
      unsubChunk()
      unsubDone()
    })

    try {
      await window.api.ai.chat(companionId, content)
    } catch (err) {
      unsubChunk()
      unsubDone()
      set(s => ({
        isStreaming: { ...s.isStreaming, [companionId]: false },
        streaming: { ...s.streaming, [companionId]: '' },
      }))
      throw err
    }

    // Reload from DB to sync persisted user message
    const msgs = await window.api.message.list(companionId)
    set(s => ({ messages: { ...s.messages, [companionId]: msgs } }))
  },

  clear: async (companionId: string) => {
    await window.api.message.clear(companionId)
    set(s => ({
      messages: { ...s.messages, [companionId]: [] },
      streaming: { ...s.streaming, [companionId]: '' },
      isStreaming: { ...s.isStreaming, [companionId]: false },
    }))
  },
}))
