/**
 * In-process typed pub/sub used to decouple event producers from the React UI.
 *
 * Listeners are stored per event `type` in a `Map<type, Set<handler>>`, so emit
 * is O(listeners-for-that-type) and registration order is preserved. See
 * {@link EventBus} for the contract and `AppEvent` for the event vocabulary.
 *
 * @module
 */
import type { AppEvent, EventBus, Unsubscribe } from '@/lib/interfaces'

/**
 * Create a fresh, isolated event bus.
 *
 * Prefer {@link getEventBus} for the app-wide singleton; this is mainly useful
 * in tests where each case needs its own bus.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<(event: AppEvent) => void>>()

  function on<T extends AppEvent>(type: T['type'], handler: (event: T) => void): Unsubscribe {
    if (!listeners.has(type)) listeners.set(type, new Set())
    const typedHandler = handler as (event: AppEvent) => void
    listeners.get(type)!.add(typedHandler)
    return () => off(type, handler)
  }

  function off<T extends AppEvent>(type: T['type'], handler: (event: T) => void): void {
    listeners.get(type)?.delete(handler as (event: AppEvent) => void)
  }

  function emit<T extends AppEvent>(event: T): void {
    listeners.get(event.type)?.forEach((handler) => handler(event))
  }

  return { on, off, emit }
}

let _bus: EventBus | null = null

/**
 * Return the app-wide event bus, creating it on first use.
 *
 * This is the bus the canvas, hooks, and agent runtimes all share so that, for
 * example, a status event emitted by a provider reaches the card subscribed via
 * {@link useAgentStatus}.
 */
export function getEventBus(): EventBus {
  if (!_bus) _bus = createEventBus()
  return _bus
}
