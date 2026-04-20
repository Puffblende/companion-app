import { create } from 'zustand'

interface SettingsStore {
  apiKey: string
  loaded: boolean
  load: () => Promise<void>
  setApiKey: (key: string) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  apiKey: '',
  loaded: false,

  load: async () => {
    const key = await window.api.settings.get('anthropic_api_key')
    set({ apiKey: key ?? '', loaded: true })
  },

  setApiKey: async (key: string) => {
    await window.api.settings.set('anthropic_api_key', key)
    set({ apiKey: key })
  },
}))
