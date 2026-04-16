import type { Item, ThoughtEntry, ThoughtEntryDraft } from '../types'

function generateThoughtId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function buildThoughtEntryFromItem(
  item: Item,
  draft: ThoughtEntryDraft & { containerId: string }
): ThoughtEntry {
  const now = Date.now()

  return {
    id: generateThoughtId(),
    containerId: draft.containerId,
    title: draft.title.trim() || item.title || item.content,
    content: draft.content.trim() || item.content,
    tags: draft.tags,
    recordedAt: draft.recordedAt,
    sourceItemId: item.id,
    createdAt: now,
    updatedAt: now,
  }
}

export function getThoughtEntriesForContainer(
  entries: ThoughtEntry[],
  containerId: string
): ThoughtEntry[] {
  return entries
    .filter((entry) => entry.containerId === containerId)
    .sort((a, b) => b.recordedAt - a.recordedAt)
}

export function getLatestThoughtTimestamp(entries: ThoughtEntry[]): number | null {
  if (entries.length === 0) return null
  return Math.max(...entries.map((entry) => Math.max(entry.updatedAt, entry.recordedAt)))
}
