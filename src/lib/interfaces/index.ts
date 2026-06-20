/**
 * Barrel for the core extensibility contracts.
 *
 * These interfaces are the seams the whole app is built on — implement one and
 * register it to add an agent runtime, LLM provider, tool, or canvas node type
 * without touching existing code. Start here to understand the architecture.
 *
 * @module
 */
export type * from './agent-provider'
export type * from './llm-provider'
export type * from './tool-definition'
export type * from './canvas-node'
export type * from './workflow-node'
export type * from './event-bus'
