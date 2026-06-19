'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send } from 'lucide-react'
import { initDb, AgentRepository, SessionRepository } from '@/lib/storage'
import { AGENT_REGISTRY, resolveAgentRuntimeType } from '@/lib/agents/registry'
import { getEventBus } from '@/lib/event-bus'
import type { AgentSession, AgentStatus } from '@/lib/interfaces'
import type { ChatMessage } from '@/lib/chat/types'
import type { AgentEvent } from '@/lib/interfaces'
import type { Db } from '@/lib/storage'
import ChatMessageComponent from './ChatMessage'

interface ChatPanelProps {
  agentId: string | null
  onClose: () => void
}

export default function ChatPanel({ agentId, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [agentName, setAgentName] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const activeRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // I4: DB singleton ref — initialized once per agentId load
  const dbRef = useRef<Db | null>(null)
  // Mirror of messages state for safe reads inside async callbacks
  const messagesRef = useRef<ChatMessage[]>([])

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Load agent info and most recent session on agentId change
  useEffect(() => {
    if (!agentId) return
    activeRef.current = true
    setMessages([])
    messagesRef.current = []
    setStreamingContent('')
    setInput('')

    async function load() {
      // I4: open DB once and store in ref
      const db = await initDb()
      dbRef.current = db

      const agentRepo = new AgentRepository(db)
      const sessionRepo = new SessionRepository(db)

      const agentRow = await agentRepo.findById(agentId!)
      if (!agentRow) return
      setAgentName(agentRow.name)

      // Load or create a session
      const sessions = await sessionRepo.findByAgentId(agentId!)
      if (sessions.length > 0) {
        const latest = sessions[0]
        setSessionId(latest.id)
        const loaded = (latest.messages as ChatMessage[]) ?? []
        setMessages(loaded)
        messagesRef.current = loaded
      } else {
        const newId = await sessionRepo.create({ agentId: agentId!, messages: [], tokenCount: 0, costEstimate: 0 })
        setSessionId(newId)
      }
    }

    load().catch(console.error)
    return () => { activeRef.current = false }
  }, [agentId])

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = messagesEndRef.current
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !agentId || !sessionId) return

    // I3: capture agentId as a local const before any awaits
    const currentAgentId: string = agentId
    const currentSessionId: string = sessionId

    // I4: reuse the singleton DB; it was initialised in the load useEffect
    const db = dbRef.current!

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const currentInput = input.trim()
    setInput('')

    // Snapshot messages before the state update so we have the full list
    // including the user message without relying on async state reads
    const messagesAtSend = [...messagesRef.current, userMsg]
    setMessages(messagesAtSend)
    messagesRef.current = messagesAtSend

    setIsStreaming(true)
    setStreamingContent('')
    // I1: do NOT re-arm activeRef here; the load useEffect owns it

    let persisted = false

    try {
      const agentRepo = new AgentRepository(db)
      const agentRow = await agentRepo.findById(currentAgentId)
      if (!agentRow) throw new Error('Agent not found')

      const provider = AGENT_REGISTRY.get(resolveAgentRuntimeType(agentRow.type))
      if (!provider) throw new Error(`No provider for type: ${agentRow.type}`)

      const session: AgentSession = {
        id: currentSessionId,
        agentId: currentAgentId,
        permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
      }

      // Emit running status
      getEventBus().emit({
        type: 'agent:status-changed',
        agentId: currentAgentId,
        status: 'running',
        timestamp: Date.now(),
      })

      let accumulated = ''

      const iterable = provider.run(session, currentInput)
      for await (const event of iterable) {
        if (!activeRef.current) break

        const e = event as AgentEvent
        if (e.type === 'text-delta') {
          const delta = (e.payload as { delta: string }).delta ?? ''
          accumulated += delta
          setStreamingContent(accumulated)
          getEventBus().emit({
            type: 'agent:action',
            agentId: currentAgentId,
            action: 'text',
            detail: delta,
            timestamp: Date.now(),
          })
        } else if (e.type === 'status-change') {
          const status = (e.payload as { status: AgentStatus }).status
          getEventBus().emit({ type: 'agent:status-changed', agentId: currentAgentId, status, timestamp: Date.now() })
        } else if (e.type === 'approval-request') {
          const req = e.payload as import('@/lib/interfaces').ApprovalRequest
          getEventBus().emit({ type: 'agent:approval-requested', request: req, timestamp: Date.now() })
        }
      }

      // C1: build the final messages array outside the state setter, then
      //     call setMessages and updateMessages separately (no side effects
      //     inside the setState callback).
      if (accumulated && activeRef.current) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: Date.now(),
        }
        // Use messagesAtSend (the snapshot that includes the user message)
        const allMessages = [...messagesAtSend, assistantMsg]
        setMessages(allMessages)
        messagesRef.current = allMessages
        const sessionRepo = new SessionRepository(db)
        await sessionRepo.updateMessages(currentSessionId, allMessages)
        persisted = true
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      // I3: use captured currentAgentId — no non-null assertion needed
      getEventBus().emit({ type: 'agent:status-changed', agentId: currentAgentId, status: 'idle', timestamp: Date.now() })

      // I2: always persist at least the user message (best-effort)
      if (!persisted) {
        try {
          const sessionRepo = new SessionRepository(db)
          // messagesRef.current has the most up-to-date list (may include
          // assistant reply if the success path ran); messagesAtSend is the
          // floor — the user message is always present in either.
          await sessionRepo.updateMessages(currentSessionId, messagesRef.current)
        } catch { /* best-effort */ }
      }
    }
  }, [input, isStreaming, agentId, sessionId])

  if (!agentId) return null

  return (
    <div className="absolute inset-y-0 right-0 w-[420px] bg-[#0d0d0f] border-l border-white/[0.08] flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div>
          <div className="text-[13px] font-semibold text-zinc-200">{agentName}</div>
          <div className="text-[11px] text-zinc-500">Session</div>
        </div>
        <button onClick={onClose} aria-label="Close chat" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-zinc-600 text-center">
              Send a message to start chatting<br />
              <span className="text-zinc-700 text-[11px]">with {agentName}</span>
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}
        {isStreaming && streamingContent && (
          <ChatMessageComponent
            message={{ id: 'streaming', role: 'assistant', content: streamingContent, timestamp: Date.now() }}
            isStreaming
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 leading-relaxed"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            aria-label="Send"
            className="p-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        {isStreaming && (
          <p className="text-[10px] text-zinc-600 mt-1.5">Generating…</p>
        )}
      </div>
    </div>
  )
}
