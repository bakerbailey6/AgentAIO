import type { AppEvent, EventBus, Unsubscribe } from '@/lib/interfaces'

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

// Singleton for use across the app
let _bus: EventBus | null = null
export function getEventBus(): EventBus {
  if (!_bus) _bus = createEventBus()
  return _bus
}
