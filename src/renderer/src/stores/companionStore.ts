import { create } from 'zustand'
import type { Companion } from '../types/global'

interface CompanionStore {
  companions: Companion[]
  activeId: string | null
  loaded: boolean

  load: () => Promise<void>
  setActive: (id: string) => void
  active: () => Companion | undefined
  create: (data: Omit<Companion, 'id' | 'created_at'>) => Promise<Companion>
  update: (id: string, data: Partial<Omit<Companion, 'id' | 'created_at'>>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCompanionStore = create<CompanionStore>((set, get) => ({
  companions: [],
  activeId: null,
  loaded: false,

  load: async () => {
    const companions = await window.api.companion.list()
    set({
      companions,
      activeId: companions[0]?.id ?? null,
      loaded: true,
    })
  },

  setActive: (id: string) => set({ activeId: id }),

  active: () => {
    const { companions, activeId } = get()
    return companions.find(c => c.id === activeId)
  },

  create: async (data) => {
    const companion = await window.api.companion.create(data)
    set(s => ({ companions: [...s.companions, companion] }))
    return companion
  },

  update: async (id, data) => {
    const updated = await window.api.companion.update(id, data)
    set(s => ({
      companions: s.companions.map(c => c.id === id ? updated : c),
    }))
  },

  remove: async (id) => {
    await window.api.companion.delete(id)
    set(s => {
      const companions = s.companions.filter(c => c.id !== id)
      return {
        companions,
        activeId: s.activeId === id ? (companions[0]?.id ?? null) : s.activeId,
      }
    })
  },
}))
