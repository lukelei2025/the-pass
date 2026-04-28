import { describe, expect, it, vi } from 'vitest'
import { buildManualTodoInput } from './todos'

describe('manual todo helpers', () => {
  it('builds a todo item input for creating todos directly from the todo view', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00+08:00'))

    const input = buildManualTodoInput('  跟进合同细节  ')

    expect(input).toMatchObject({
      content: '跟进合同细节',
      title: '跟进合同细节',
      type: 'text',
      category: 'others',
      status: 'todo',
      details: null,
      tags: null,
      deadline: null,
    })
    expect(input.processedAt).toBe(new Date('2026-04-28T12:00:00+08:00').getTime())

    vi.useRealTimers()
  })
})
