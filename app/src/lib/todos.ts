import type { Item } from '../types'

export function buildManualTodoInput(content: string): Omit<Item, 'id' | 'createdAt' | 'expiresAt'> {
  const trimmedContent = content.trim()

  return {
    content: trimmedContent,
    title: trimmedContent,
    type: 'text',
    category: 'others',
    status: 'todo',
    processedAt: Date.now(),
    details: null,
    tags: null,
    deadline: null,
  }
}
