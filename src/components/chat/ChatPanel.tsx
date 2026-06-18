'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send } from 'lucide-react'
import { initDb, AgentRepository, SessionRepository } from '@/lib/storage'
import { AGENT_REGISTRY } from '@/lib/agents/registry'
import { getEventBus } from '@/lib/event-bus'
import type { AgentSession, AgentStatus } from '@/lib/interfaces'
import type { ChatMessage } from '@/lib/chat/types'
import type { AgentEvent } from '@/lib/interfaces'
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

  // Load agent info and most recent session on agentId change
  useEffect(() => {
    if (!agentId) return
    activeRef.current = true
    setMessages([])
    setStreamingContent('')
    setInput('')

    async function load() {
      const db = await initDb()
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
        setMessages((latest.messages as ChatMessage[]) ?? [])
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

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const currentInput = input.trim()
    setInput('')
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingContent('')
    activeRef.current = true

    try {
      const db = await initDb()
      const agentRepo = new AgentRepository(db)
      const agentRow = await agentRepo.findById(agentId)
      if (!agentRow) throw new Error('Agent not found')

      const provider = AGENT_REGISTRY.get(agentRow.type)
      if (!provider) throw new Error(`No provider for type: ${agentRow.type}`)

      const session: AgentSession = {
        id: sessionId,
        agentId,
        permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
      }

      // Emit running status
      getEventBus().emit({
        type: 'agent:status-changed',
        agentId,
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
            agentId,
            action: 'text',
            detail: delta,
            timestamp: Date.now(),
          })
        } else if (e.type === 'status-change') {
          const status = (e.payload as { status: AgentStatus }).status
          getEventBus().emit({ type: 'agent:status-changed', agentId, status, timestamp: Date.now() })
        } else if (e.type === 'approval-request') {
          const req = e.payload as import('@/lib/interfaces').ApprovalRequest
          getEventBus().emit({ type: 'agent:approval-requested', request: req, timestamp: Date.now() })
        }
      }

      // Finalize streaming content as assistant message
      if (accumulated && activeRef.current) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: Date.now(),
        }
        setMessages(prev => {
          const updated = [...prev, assistantMsg]
          // Persist to DB
          const sessionRepo = new SessionRepository(db)
          sessionRepo.updateMessages(sessionId, updated).catch(console.error)
          return updated
        })
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
      getEventBus().emit({ type: 'agent:status-changed', agentId: agentId!, status: 'idle', timestamp: Date.now() })
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
