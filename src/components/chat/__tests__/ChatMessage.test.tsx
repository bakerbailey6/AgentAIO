import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatMessage from '../ChatMessage'
import type { ChatMessage as ChatMessageType } from '@/lib/chat/types'

const makeMessage = (over: Partial<ChatMessageType> = {}): ChatMessageType => ({
  id: 'm1',
  role: 'user',
  content: 'hello world',
  timestamp: 0,
  ...over,
})

describe('ChatMessage', () => {
  it('renders the message content', () => {
    render(<ChatMessage message={makeMessage({ content: 'hi there' })} />)
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('aligns a user message to the right', () => {
    const { container } = render(<ChatMessage message={makeMessage({ role: 'user' })} />)
    expect(container.firstChild).toHaveClass('justify-end')
  })

  it('aligns an assistant message to the left', () => {
    const { container } = render(<ChatMessage message={makeMessage({ role: 'assistant' })} />)
    expect(container.firstChild).toHaveClass('justify-start')
  })

  it('styles user and assistant bubbles differently', () => {
    const { container: userC } = render(<ChatMessage message={makeMessage({ role: 'user' })} />)
    const { container: asstC } = render(<ChatMessage message={makeMessage({ role: 'assistant' })} />)
    const userBubble = userC.querySelector('.rounded-2xl')
    const asstBubble = asstC.querySelector('.rounded-2xl')
    expect(userBubble?.className).not.toEqual(asstBubble?.className)
    expect(userBubble?.className).toContain('bg-indigo-500/20')
    expect(asstBubble?.className).toContain('bg-white/[0.05]')
  })

  it('does not render the streaming caret by default', () => {
    const { container } = render(<ChatMessage message={makeMessage()} />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  it('renders the streaming caret when isStreaming is true', () => {
    const { container } = render(<ChatMessage message={makeMessage()} isStreaming />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })
})
