import { describe, it, expectTypeOf } from 'vitest'
import type {
  AgentProvider,
  LLMProvider,
  ToolDefinition,
  CanvasNode,
  EventBus,
  AppEvent,
} from '@/lib/interfaces'

describe('interfaces barrel export', () => {
  it('exports AgentProvider', () => {
    expectTypeOf<AgentProvider>().not.toBeUndefined()
  })
  it('exports LLMProvider', () => {
    expectTypeOf<LLMProvider>().not.toBeUndefined()
  })
  it('exports ToolDefinition', () => {
    expectTypeOf<ToolDefinition>().not.toBeUndefined()
  })
  it('exports CanvasNode', () => {
    expectTypeOf<CanvasNode>().not.toBeUndefined()
  })
  it('exports EventBus', () => {
    expectTypeOf<EventBus>().not.toBeUndefined()
  })
})
