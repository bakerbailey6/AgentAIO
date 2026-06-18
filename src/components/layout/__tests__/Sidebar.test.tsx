import { render, screen } from '@testing-library/react'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  it('renders navigation icons', () => {
    render(<Sidebar activeItem="home" onNavigate={() => {}} />)
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('Store')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('highlights the active item', () => {
    render(<Sidebar activeItem="store" onNavigate={() => {}} />)
    expect(screen.getByLabelText('Store').closest('button')).toHaveClass('bg-violet-600')
  })
})
