import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import { exportThoughtToCSV } from '../lib/exportThoughts'
import { getThoughtEntriesForContainer } from '../lib/thoughts'
import type { ThoughtContainer, ThoughtEntry } from '../types'

interface ThoughtExportDialogProps {
  containers: ThoughtContainer[]
  entries: ThoughtEntry[]
  initialSelectedContainerId?: string | null
  onClose: () => void
}

export default function ThoughtExportDialog({
  containers,
  entries,
  initialSelectedContainerId = null,
  onClose,
}: ThoughtExportDialogProps) {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const defaultSelectedId = useMemo(() => {
    if (initialSelectedContainerId) return initialSelectedContainerId
    return containers[0]?.id || ''
  }, [containers, initialSelectedContainerId])
  const [selectedId, setSelectedId] = useState(defaultSelectedId)

  const handleExport = async () => {
    if (!selectedId || isExporting) return

    setIsExporting(true)

    try {
      const selectedContainer = containers.find((container) => container.id === selectedId)
      if (!selectedContainer) return

      await exportThoughtToCSV({
        container: selectedContainer,
        entries,
        labels: {
          untitledContainer: t.thoughts.untitledContainer,
          title: t.thoughts.exportSheetTitle,
          description: t.thoughts.exportSheetDescription,
          containerTags: t.thoughts.exportSheetContainerTags,
          entryTags: t.thoughts.exportSheetEntryTags,
          recordedAt: t.thoughts.exportSheetRecordedAt,
          entryTitle: t.thoughts.exportSheetEntryTitle,
          content: t.thoughts.exportSheetContent,
          createdAt: t.thoughts.exportSheetCreatedAt,
          updatedAt: t.thoughts.exportSheetUpdatedAt,
        },
      })

      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
              {t.thoughts.exportDialogTitle}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-ink-secondary)]">
              {t.thoughts.exportDialogHint}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
          {containers.map((container) => {
            const containerEntries = getThoughtEntriesForContainer(entries, container.id)
            const checked = selectedId === container.id

            return (
              <label
                key={container.id}
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <input
                  type="radio"
                  name="thought-export-container"
                  checked={checked}
                  onChange={() => setSelectedId(container.id)}
                  className="mt-1 h-4 w-4 border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-semibold text-[var(--color-ink)] truncate">
                      {container.title || t.thoughts.untitledContainer}
                    </p>
                    <span className="text-[11px] text-[var(--color-ink-tertiary)] whitespace-nowrap">
                      {containerEntries.length} {t.thoughts.entries}
                    </span>
                  </div>
                  {container.description && (
                    <p className="mt-1 text-[12px] text-[var(--color-ink-secondary)]">
                      {container.description}
                    </p>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.05)] rounded-lg transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedId || isExporting}
            className="px-4 py-2 text-[14px] font-medium text-white bg-[var(--color-accent)] hover:brightness-110 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? t.common.loading : t.thoughts.exportSelected}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
