import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge `className` values, resolving conflicting Tailwind utilities.
 *
 * `clsx` flattens conditional class inputs; `twMerge` then de-duplicates
 * Tailwind classes so the last one wins (e.g. `cn('p-2', 'p-4')` → `'p-4'`).
 * The standard shadcn/ui helper, used throughout the components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
