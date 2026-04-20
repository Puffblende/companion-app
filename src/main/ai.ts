import Anthropic from '@anthropic-ai/sdk'
import type { Companion, Message } from './database'

function buildSystemPrompt(companion: Companion): string {
  const traits: string[] = []

  if (companion.introversion < 25) traits.push('sehr gesprächig, offen und extrovertiert – du liebst es, Gespräche zu initiieren')
  else if (companion.introversion < 45) traits.push('eher extrovertiert, gesellig und kommunikativ')
  else if (companion.introversion < 55) traits.push('ausgeglichen zwischen introvertiert und extrovertiert')
  else if (companion.introversion < 75) traits.push('eher introvertiert, nachdenklich und tiefsinnig')
  else traits.push('sehr introvertiert und tiefsinnig – du bevorzugst tiefe, bedeutungsvolle Gespräche')

  if (companion.seriousness < 25) traits.push('sehr verspielt, witzig und humorvoll')
  else if (companion.seriousness < 45) traits.push('eher verspielt und locker')
  else if (companion.seriousness < 55) traits.push('ausgewogen zwischen ernst und verspielt')
  else if (companion.seriousness < 75) traits.push('eher ernst und fokussiert')
  else traits.push('sehr ernst, tiefgründig und zielgerichtet')

  if (companion.formality < 25) traits.push('sehr informell und casual in deiner Sprache')
  else if (companion.formality < 45) traits.push('eher informell und ungezwungen')
  else if (companion.formality < 55) traits.push('weder besonders formell noch informell')
  else if (companion.formality < 75) traits.push('eher formell und gepflegt in deiner Ausdrucksweise')
  else traits.push('sehr formell und kultiviert in deiner Sprache')

  if (companion.energy < 25) traits.push('sehr ruhig, gelassen und besonnen')
  else if (companion.energy < 45) traits.push('eher ruhig und bedächtig')
  else if (companion.energy < 55) traits.push('ausgeglichen in deiner Energie')
  else if (companion.energy < 75) traits.push('eher energetisch und enthusiastisch')
  else traits.push('sehr energetisch, begeistert und enthusiastisch')

  if (companion.empathy < 25) traits.push('sehr analytisch und logisch denkend')
  else if (companion.empathy < 45) traits.push('eher analytisch mit einem Sinn für Logik')
  else if (companion.empathy < 55) traits.push('ausgewogen zwischen empathisch und analytisch')
  else if (companion.empathy < 75) traits.push('sehr einfühlsam und emotional verständnisvoll')
  else traits.push('extrem empathisch und emotional feinfühlig')

  const base = `Du bist ${companion.name}, ein AI-Companion. Du sprichst immer auf Deutsch, außer der Nutzer spricht eine andere Sprache.

Deine Persönlichkeit:
${traits.map(t => `- Du bist ${t}`).join('\n')}

Du bist kein Assistent – du bist ein echter Companion und Freund. Du erinnerst dich an frühere Gespräche und baust eine echte Beziehung auf. Antworte natürlich und authentisch, nicht wie ein Chatbot.`

  if (companion.system_prompt.trim()) {
    return `${base}\n\nZusätzliche Anweisungen:\n${companion.system_prompt}`
  }
  return base
}

export async function streamMessage(
  companion: Companion,
  history: Message[],
  userMessage: string,
  apiKey: string,
  onChunk: (text: string) => void
): Promise<string> {
  const client = new Anthropic({ apiKey })

  const messages = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  messages.push({ role: 'user', content: userMessage })

  let fullText = ''

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(companion),
        // @ts-ignore – cache_control is valid at runtime
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text
      onChunk(event.delta.text)
    }
  }

  return fullText
}
