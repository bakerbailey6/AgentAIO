'use client'
import type { ChatMessage as ChatMessageType } from '@/lib/chat/types'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isEphemeral = message.ephemeral
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
        isEphemeral
          ? 'bg-red-500/10 text-red-300 border border-red-500/30'
          : isUser
          ? 'bg-indigo-500/20 text-zinc-100 border border-indigo-500/30'
          : 'bg-white/[0.05] text-zinc-200 border border-white/[0.08]'
      }`}>
        {message.content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 bg-indigo-400 rounded-sm ml-1 animate-pulse" />
        )}
      </div>
    </div>
  )
}
