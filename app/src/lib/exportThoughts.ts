import type { ThoughtContainer, ThoughtEntry } from '../types'

interface ThoughtExportLabels {
  untitledContainer: string
  title: string
  description: string
  containerTags: string
  entryTags: string
  recordedAt: string
  entryTitle: string
  content: string
  createdAt: string
  updatedAt: string
}

interface ThoughtCSVParams {
  container: ThoughtContainer
  entries: ThoughtEntry[]
  labels?: Partial<ThoughtExportLabels>
}

interface ThoughtCSVDownloadPayload {
  content: string
  fileName: string
}

interface ExportThoughtToCSVParams extends ThoughtCSVParams {
  downloader?: (payload: ThoughtCSVDownloadPayload) => Promise<void> | void
}

const DEFAULT_LABELS: ThoughtExportLabels = {
  untitledContainer: '未命名卡片',
  title: '卡片标题',
  description: '卡片描述',
  containerTags: '卡片标签',
  entryTags: '标签',
  recordedAt: '记录日期',
  entryTitle: '小标题',
  content: '具体内容',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim().replace(/\s+/g, '_')
}

function serializeCSVRow(row: Array<string>): string {
  return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
}

async function downloadCSV({ content, fileName }: ThoughtCSVDownloadPayload): Promise<void> {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function buildThoughtCSV({
  container,
  entries,
  labels: labelsOverride,
}: ThoughtCSVParams): string {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }
  const title = container.title || labels.untitledContainer
  const rows: string[][] = [
    [labels.title, title],
    [labels.description, container.description || ''],
    [labels.containerTags, (container.tags || []).join(', ')],
    [],
    [labels.recordedAt, labels.entryTitle, labels.content, labels.entryTags, labels.createdAt, labels.updatedAt],
  ]

  entries
    .filter((entry) => entry.containerId === container.id)
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .forEach((entry) => {
      rows.push([
        formatDateTime(entry.recordedAt),
        entry.title,
        entry.content,
        entry.tags.join(', '),
        formatDateTime(entry.createdAt),
        formatDateTime(entry.updatedAt),
      ])
    })

  return `\uFEFF${rows.map(serializeCSVRow).join('\n')}`
}

export async function exportThoughtToCSV({
  container,
  entries,
  labels,
  downloader = downloadCSV,
}: ExportThoughtToCSVParams): Promise<void> {
  const content = buildThoughtCSV({ container, entries, labels })
  const fileDate = new Date().toISOString().slice(0, 10)
  const fileName = `thoughts_${sanitizeFileName(container.title || 'untitled')}_${fileDate}.csv`
  await downloader({ content, fileName })
}
