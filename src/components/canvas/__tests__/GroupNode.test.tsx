import { render, screen } from '@testing-library/react'
import type { NodeProps } from 'reactflow'
import { GroupNode, GroupNodeDef, type GroupNodeData } from '../GroupNode'

// GroupNode only uses `data` and `selected` from NodeProps; the rest are
// irrelevant to rendering, so build a minimal prop object and cast.
function renderGroup(data: GroupNodeData, selected = false) {
  const props = { data, selected } as unknown as NodeProps<GroupNodeData>
  return render(<GroupNode {...props} />)
}

describe('GroupNode', () => {
  it('renders the group label', () => {
    renderGroup({ label: 'Research Squad' })
    expect(screen.getByText(/Research Squad/)).toBeInTheDocument()
  })

  it('does not apply the selected border class when not selected', () => {
    const { container } = renderGroup({ label: 'G' }, false)
    expect((container.firstChild as HTMLElement).className).not.toContain('border-violet-500/60')
  })

  it('applies the selected border class when selected', () => {
    const { container } = renderGroup({ label: 'G' }, true)
    expect((container.firstChild as HTMLElement).className).toContain('border-violet-500/60')
  })
})

describe('GroupNodeDef', () => {
  it('declares the group node type and component', () => {
    expect(GroupNodeDef.nodeType).toBe('group')
    expect(GroupNodeDef.CardComponent).toBe(GroupNode)
  })

  it('produces sensible default data', () => {
    expect(GroupNodeDef.defaultData()).toEqual({ label: 'New Group' })
  })
})
