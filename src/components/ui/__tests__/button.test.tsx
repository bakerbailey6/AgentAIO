import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, buttonVariants } from '../button'

describe('Button', () => {
  it('renders a native button with its children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies the default variant and size classes', () => {
    render(<Button>Default</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-primary')
    expect(btn.className).toContain('h-8')
  })

  it('applies the destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button').className).toContain('text-destructive')
  })

  it('applies the small size classes', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button').className).toContain('h-7')
  })

  it('merges a custom className', () => {
    render(<Button className="custom-xyz">X</Button>)
    expect(screen.getByRole('button').className).toContain('custom-xyz')
  })

  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('exposes buttonVariants for standalone class generation', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border-border')
  })
})
