import { describe, expect, it } from 'vitest'
import type { ThoughtContainer, ThoughtEntry } from '../types'
import { buildThoughtCSV, exportThoughtToCSV } from './exportThoughts'

const container: ThoughtContainer = {
  id: 'c-1',
  title: '产品灵感',
  description: '长期记录产品相关的念头',
  tags: ['产品', '灵感'],
  createdAt: 1000,
  updatedAt: 2000,
}

const entries: ThoughtEntry[] = [
  {
    id: 'e-1',
    containerId: 'c-1',
    title: '把输入变成分流',
    content: '记录从输入到分发的完整体验。',
    tags: ['交互', '流程'],
    recordedAt: new Date('2026-04-27T10:00:00+08:00').getTime(),
    createdAt: 5000,
    updatedAt: 5000,
  },
  {
    id: 'e-2',
    containerId: 'c-1',
    title: '补上导出能力',
    content: '改成单卡片 CSV，保持轻量。',
    tags: [],
    recordedAt: new Date('2026-04-28T10:00:00+08:00').getTime(),
    createdAt: 6000,
    updatedAt: 7000,
  },
]

describe('thought csv export', () => {
  it('builds a single csv string with container metadata and entry rows', () => {
    const csv = buildThoughtCSV({
      container,
      entries,
    })

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"卡片标题","产品灵感"')
    expect(csv).toContain('"卡片描述","长期记录产品相关的念头"')
    expect(csv).toContain('"卡片标签","产品, 灵感"')
    expect(csv).toContain('"记录日期","小标题","具体内容","标签","创建时间","更新时间"')
    expect(csv.indexOf('补上导出能力')).toBeLessThan(csv.indexOf('把输入变成分流'))
  })

  it('exports one csv file for the selected container', async () => {
    let downloadedContent = ''
    let downloadedFileName = ''

    await exportThoughtToCSV({
      container,
      entries,
      downloader: async ({ content, fileName }) => {
        downloadedContent = content
        downloadedFileName = fileName
      },
    })

    expect(downloadedFileName).toMatch(/^thoughts_产品灵感_\d{4}-\d{2}-\d{2}\.csv$/)
    expect(downloadedContent).toContain('"卡片标题","产品灵感"')
  })
})
