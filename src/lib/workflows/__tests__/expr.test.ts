import { describe, it, expect } from 'vitest'
import { getPath, applyTemplate, evalPredicate } from '@/lib/workflows/expr'

describe('getPath', () => {
  it('reads a nested dot-path', () => {
    expect(getPath({ a: { b: 2 } }, 'a.b')).toBe(2)
  })
  it('returns undefined on a miss', () => {
    expect(getPath({ a: {} }, 'a.b.c')).toBeUndefined()
    expect(getPath(null, 'a')).toBeUndefined()
  })
  it('returns the whole value for an empty path', () => {
    expect(getPath(42, '')).toBe(42)
  })
})

describe('applyTemplate', () => {
  it('substitutes a dot-path value', () => {
    expect(applyTemplate('Hi {{input.name}}', { input: { name: 'Ada' } })).toBe('Hi Ada')
  })
  it('renders an unknown path as empty', () => {
    expect(applyTemplate('x={{input.missing}}', { input: {} })).toBe('x=')
  })
  it('JSON-stringifies objects and stringifies scalars (round-trips JSON templates)', () => {
    expect(applyTemplate('{"n": {{input}}}', { input: 5 })).toBe('{"n": 5}')
    expect(applyTemplate('{{input}}', { input: { a: 1 } })).toBe('{"a":1}')
  })
})

describe('evalPredicate', () => {
  it('truthy / falsy', () => {
    expect(evalPredicate({ x: 1 }, { path: 'x', op: 'truthy' })).toBe(true)
    expect(evalPredicate({ x: 0 }, { path: 'x', op: 'truthy' })).toBe(false)
    expect(evalPredicate({ x: 0 }, { path: 'x', op: 'falsy' })).toBe(true)
  })
  it('eq / neq against the whole input', () => {
    expect(evalPredicate('go', { op: 'eq', value: 'go' })).toBe(true)
    expect(evalPredicate('go', { op: 'neq', value: 'stop' })).toBe(true)
  })
  it('gt / lt with numeric coercion', () => {
    expect(evalPredicate(5, { op: 'gt', value: 3 })).toBe(true)
    expect(evalPredicate(2, { op: 'lt', value: 3 })).toBe(true)
    expect(evalPredicate(2, { op: 'gt', value: 3 })).toBe(false)
  })
})
