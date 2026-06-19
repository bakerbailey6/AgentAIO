/**
 * Safe, eval-free helpers for the control-flow nodes (§9.3 zero-trust).
 *
 * Workflows must never run arbitrary user expressions. Instead:
 * - {@link getPath} reads a dot-path out of a value (no code execution);
 * - {@link applyTemplate} substitutes `{{path}}` placeholders (string building);
 * - {@link evalPredicate} evaluates a *structured* predicate (`{path, op, value}`).
 *
 * There is deliberately no string-expression parser and no `eval`/`Function`.
 *
 * @module
 */

/** Read a dot-path (e.g. `"input.user.name"`) from a value; `undefined` on any miss. */
export function getPath(value: unknown, path: string): unknown {
  if (!path) return value
  let cur: unknown = value
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/**
 * Replace each `{{path}}` in `template` with the value at `path` in `ctx`.
 * Missing values become the empty string; objects are JSON-stringified (so a
 * template like `{"n": {{input}}}` round-trips), everything else uses `String`.
 */
export function applyTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const v = getPath(ctx, path)
    if (v === undefined || v === null) return ''
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  })
}

/** The comparison operators a {@link Predicate} can use. */
export type PredicateOp = 'truthy' | 'falsy' | 'eq' | 'neq' | 'gt' | 'lt'

/** A structured (parser-free) predicate over an input value. */
export interface Predicate {
  /** Optional dot-path into the input; omitted means the whole input. */
  path?: string
  op: PredicateOp
  /** Comparison operand for eq/neq/gt/lt (ignored by truthy/falsy). */
  value?: unknown
}

/** Evaluate a structured predicate against `input` (no eval). */
export function evalPredicate(input: unknown, pred: Predicate): boolean {
  const target = pred.path ? getPath(input, pred.path) : input
  switch (pred.op) {
    case 'truthy':
      return !!target
    case 'falsy':
      return !target
    case 'eq':
      return target === pred.value
    case 'neq':
      return target !== pred.value
    case 'gt':
      return Number(target) > Number(pred.value)
    case 'lt':
      return Number(target) < Number(pred.value)
    default:
      return false
  }
}
