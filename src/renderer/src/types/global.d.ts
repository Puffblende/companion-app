export {}

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

declare global {
  interface Window {
    api: {
      getPathForFile: (file: File) => string
      readFile: (filePath: string) => Promise<Uint8Array>

      companion: {
        list: () => Promise<Companion[]>
        get: (id: string) => Promise<Companion | undefined>
        create: (data: Omit<Companion, 'id' | 'created_at'>) => Promise<Companion>
        update: (id: string, data: Partial<Omit<Companion, 'id' | 'created_at'>>) => Promise<Companion>
        delete: (id: string) => Promise<void>
      }

      message: {
        list: (companionId: string) => Promise<Message[]>
        clear: (companionId: string) => Promise<void>
      }

      settings: {
        get: (key: string) => Promise<string | undefined>
        set: (key: string, value: string) => Promise<void>
      }

      ai: {
        chat: (companionId: string, content: string) => Promise<Message>
        onChunk: (cb: (data: { companionId: string; text: string }) => void) => () => void
        onDone: (cb: (data: { companionId: string; message: Message }) => void) => () => void
      }
    }
  }
}
