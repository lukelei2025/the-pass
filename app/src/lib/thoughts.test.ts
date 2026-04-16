import { describe, expect, it } from 'vitest'
import type { Item, ThoughtEntry } from '../types'
import {
  buildThoughtEntryFromItem,
  getThoughtEntriesForContainer,
} from './thoughts'

const baseItem: Item = {
  id: 'item-1',
  content: '记录一下这个想法的上下文',
  type: 'text',
  category: 'ideas',
  status: 'pending',
  createdAt: 1000,
  expiresAt: 2000,
  title: '一个新的产品灵感',
}

describe('thought domain helpers', () => {
  it('builds a thought entry from an item and draft input', () => {
    const entry = buildThoughtEntryFromItem(baseItem, {
      containerId: 'container-1',
      title: '拆解这个灵感',
      content: '先记下使用场景，再补用户动机',
      tags: ['产品', '灵感'],
      recordedAt: 3000,
    })

    expect(entry.containerId).toBe('container-1')
    expect(entry.sourceItemId).toBe('item-1')
    expect(entry.title).toBe('拆解这个灵感')
    expect(entry.content).toBe('先记下使用场景，再补用户动机')
    expect(entry.tags).toEqual(['产品', '灵感'])
    expect(entry.recordedAt).toBe(3000)
  })

  it('sorts entries by recorded date descending within the same container', () => {
    const entries: ThoughtEntry[] = [
      {
        id: 'entry-1',
        containerId: 'container-1',
        title: '较早记录',
        content: 'A',
        tags: [],
        recordedAt: 1000,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'entry-2',
        containerId: 'container-2',
        title: '其他容器',
        content: 'B',
        tags: [],
        recordedAt: 5000,
        createdAt: 5000,
        updatedAt: 5000,
      },
      {
        id: 'entry-3',
        containerId: 'container-1',
        title: '最新记录',
        content: 'C',
        tags: [],
        recordedAt: 4000,
        createdAt: 4000,
        updatedAt: 4000,
      },
    ]

    const result = getThoughtEntriesForContainer(entries, 'container-1')

    expect(result.map((entry) => entry.id)).toEqual(['entry-3', 'entry-1'])
  })
})
