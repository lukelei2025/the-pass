import { useMemo, useState } from 'react'
import { getLatestThoughtTimestamp, getThoughtEntriesForContainer, THOUGHT_DELETE_ICON_PATH } from '../lib/thoughts'
import { useStore } from '../store/useStore'
import { useTranslation } from '../hooks/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'
import ThoughtContainerEditorDialog from '../components/ThoughtContainerEditorDialog'
import ThoughtEditorDialog from '../components/ThoughtEditorDialog'
import SwipeableHistoryRow from '../components/SwipeableHistoryRow'
import type { ThoughtContainer, ThoughtEntry } from '../types'

export default function ThoughtsView() {
  const {
    thoughtContainers,
    thoughtEntries,
    selectedThoughtContainerId,
    setSelectedThoughtContainerId,
    deleteThoughtContainer,
    deleteThoughtEntry,
  } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [editingContainer, setEditingContainer] = useState<ThoughtContainer | undefined>(undefined)
  const [isContainerDialogOpen, setIsContainerDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ThoughtEntry | undefined>(undefined)
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false)

  const selectedContainer = thoughtContainers.find((container) => container.id === selectedThoughtContainerId)
  const selectedEntries = useMemo(() => {
    if (!selectedThoughtContainerId) return []
    return getThoughtEntriesForContainer(thoughtEntries, selectedThoughtContainerId)
  }, [selectedThoughtContainerId, thoughtEntries])

  const openNewContainerDialog = () => {
    setEditingContainer(undefined)
    setIsContainerDialogOpen(true)
  }

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return '--'
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
    })
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm(t.thoughts.deleteEntryConfirm)) return
    await deleteThoughtEntry(entryId)
  }

  if (!selectedContainer) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
          <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.thoughts.title}</h2>
          <button
            onClick={openNewContainerDialog}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--color-accent)] text-white hover:brightness-110 transition-all"
          >
            {t.thoughts.newContainer}
          </button>
        </div>

        {thoughtContainers.length > 0 ? (
          <div className="content-grid">
            {thoughtContainers.map((container) => {
              const entries = getThoughtEntriesForContainer(thoughtEntries, container.id)
              const latestUpdate = getLatestThoughtTimestamp(entries) || container.updatedAt

              return (
                <button
                  key={container.id}
                  onClick={() => setSelectedThoughtContainerId(container.id)}
                  className="text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
                        {container.title || t.thoughts.untitledContainer}
                      </h3>
                      {container.description && (
                        <p className="mt-1 text-[13px] text-[var(--color-ink-secondary)] line-clamp-2">
                          {container.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-[var(--color-ink-tertiary)]">
                      {entries.length} {t.thoughts.entries}
                    </span>
                  </div>

                  {container.tags && container.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {container.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-[var(--color-ink-tertiary)]">
                    {t.thoughts.latestUpdate} {formatTimestamp(latestUpdate)}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 opacity-60">
            <div className="w-16 h-16 bg-[rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-center mb-4 text-[var(--color-ink-tertiary)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 9a2.5 2.5 0 115 0c0 1.06-.53 1.7-1.2 2.26-.77.65-1.55 1.25-1.55 2.24" /><path d="M12 17h.01" /><path d="M8.5 20h7" /><path d="M9 3.5A7 7 0 005 10c0 2.2.86 3.72 2.3 5.03.43.4.7.95.7 1.53V17h8v-.44c0-.58.27-1.13.7-1.53C18.14 13.72 19 12.2 19 10a7 7 0 00-10-6.5z" /></svg>
            </div>
            <p className="text-[15px] font-medium text-[var(--color-ink-secondary)]">{t.thoughts.empty}</p>
          </div>
        )}

        {isContainerDialogOpen && (
          <ThoughtContainerEditorDialog
            container={editingContainer}
            onClose={() => {
              setEditingContainer(undefined)
              setIsContainerDialogOpen(false)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] gap-4">
        <div className="min-w-0">
          <button
            onClick={() => setSelectedThoughtContainerId(null)}
            className="text-[13px] text-[var(--color-accent)] font-medium mb-2"
          >
            ← {t.thoughts.backToContainers}
          </button>
          <h2 className="text-[20px] font-semibold text-[var(--color-ink)] truncate">{selectedContainer.title}</h2>
          {selectedContainer.description && (
            <p className="mt-1 text-[13px] text-[var(--color-ink-secondary)]">{selectedContainer.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              setEditingContainer(selectedContainer)
              setIsContainerDialogOpen(true)
            }}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--color-ink-secondary)] bg-[rgba(0,0,0,0.04)] hover:text-[var(--color-ink)]"
          >
            {t.thoughts.editContainer}
          </button>
          <button
            onClick={async () => {
              if (!window.confirm(t.thoughts.deleteContainerConfirm)) return
              await deleteThoughtContainer(selectedContainer.id)
            }}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--color-red)] bg-red-50 hover:bg-red-100"
          >
            {t.thoughts.deleteContainer}
          </button>
          <button
            onClick={() => {
              setEditingEntry(undefined)
              setIsEntryDialogOpen(true)
            }}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--color-accent)] text-white hover:brightness-110"
          >
            {t.thoughts.addEntry}
          </button>
        </div>
      </div>

      {selectedContainer.tags && selectedContainer.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedContainer.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-full text-[12px] font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {selectedEntries.length > 0 ? (
        <div className="bg-white border border-[var(--color-border)] rounded-[12px] overflow-hidden shadow-sm">
          {selectedEntries.map((entry, index) => {
            const rowContent = (
              <div
                className={`group p-4 hover:bg-[var(--color-surface-hover)] transition-colors ${index < selectedEntries.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => {
                      setEditingEntry(entry)
                      setIsEntryDialogOpen(true)
                    }}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-[var(--color-ink-tertiary)]">
                        {new Date(entry.recordedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">{entry.title}</h3>
                    <p className="mt-1 text-[13px] text-[var(--color-ink-secondary)] whitespace-pre-wrap line-clamp-3">
                      {entry.content}
                    </p>
                    {entry.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      void handleDeleteEntry(entry.id)
                    }}
                    title={t.thoughts.deleteEntry}
                    className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 items-center justify-center rounded-md text-[var(--color-ink-tertiary)] hover:text-[var(--color-red)] hover:bg-red-50 flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d={THOUGHT_DELETE_ICON_PATH} />
                    </svg>
                  </button>
                </div>
              </div>
            )

            if (!isMobile) {
              return <div key={entry.id}>{rowContent}</div>
            }

            return (
              <SwipeableHistoryRow
                key={entry.id}
                onAction={() => {
                  void handleDeleteEntry(entry.id)
                }}
                actionLabel={t.thoughts.deleteEntry}
                iconPath={THOUGHT_DELETE_ICON_PATH}
                actionClassName="text-[var(--color-red)] active:bg-red-100"
              >
                {rowContent}
              </SwipeableHistoryRow>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-24 text-[var(--color-ink-tertiary)] text-[14px]">
          {t.thoughts.emptyContainer}
        </div>
      )}

      {isContainerDialogOpen && (
        <ThoughtContainerEditorDialog
          container={editingContainer}
          onClose={() => {
            setEditingContainer(undefined)
            setIsContainerDialogOpen(false)
          }}
        />
      )}

      {isEntryDialogOpen && (
        <ThoughtEditorDialog
          entry={editingEntry}
          initialContainerId={selectedContainer.id}
          onClose={() => {
            setEditingEntry(undefined)
            setIsEntryDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
