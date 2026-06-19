/** A single message in an agent chat panel. */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /**
   * Display-only message (a surfaced error or a "no response" notice). Ephemeral
   * messages are shown in the transcript but never persisted to `sessions.messages`,
   * so they don't pollute the conversation history replayed to the model.
   */
  ephemeral?: boolean
}
