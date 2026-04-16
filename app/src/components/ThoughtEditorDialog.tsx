import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import { useStore } from '../store/useStore'
import type { Item, ThoughtEntry } from '../types'

interface ThoughtEditorDialogProps {
  item?: Item
  entry?: ThoughtEntry
  initialContainerId?: string | null
  onClose: () => void
}

export default function ThoughtEditorDialog({
  item,
  entry,
  initialContainerId,
  onClose,
}: ThoughtEditorDialogProps) {
  const { t } = useTranslation()
  const {
    thoughtContainers,
    moveItemToThought,
    createThoughtContainer,
    createThoughtEntry,
    updateThoughtEntry,
  } = useStore()

  const hasContainers = thoughtContainers.length > 0

  const defaultDateTime = useMemo(() => {
    const date = new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  }, [])
  const fallbackContainer = initialContainerId || thoughtContainers[0]?.id || ''
  const [mode, setMode] = useState<'existing' | 'new'>(() => {
    if (entry) return 'existing'
    return hasContainers ? 'existing' : 'new'
  })
  const [containerId, setContainerId] = useState(() => entry?.containerId || fallbackContainer)
  const [containerTitle, setContainerTitle] = useState('')
  const [containerDescription, setContainerDescription] = useState('')
  const [title, setTitle] = useState(() => entry?.title || item?.title || item?.content || '')
  const [content, setContent] = useState(() => entry?.content || item?.details || item?.content || '')
  const [recordedAt, setRecordedAt] = useState(() =>
    entry ? new Date(entry.recordedAt).toISOString().slice(0, 16) : defaultDateTime
  )
  const [tags, setTags] = useState<string[]>(() => entry?.tags || item?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
    setIsAddingTag(false)
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return

    let nextContainerId = containerId
    if (mode === 'new' && !item) {
      if (!containerTitle.trim()) return
        nextContainerId = await createThoughtContainer({
          title: containerTitle.trim(),
          description: containerDescription.trim() || null,
          tags: null,
        })
    }

    const timestamp = new Date(recordedAt).getTime()
    const safeRecordedAt = Number.isNaN(timestamp) ? Date.now() : timestamp

    if (entry) {
      if (!nextContainerId) return
      await updateThoughtEntry(entry.id, {
        containerId: nextContainerId,
        title: title.trim(),
        content: content.trim(),
        tags,
        recordedAt: safeRecordedAt,
      })
    } else if (item) {
      await moveItemToThought(item.id, {
        containerId: mode === 'existing' ? nextContainerId : null,
        createContainer: mode === 'new',
        containerTitle: containerTitle.trim(),
        containerDescription: containerDescription.trim() || null,
        containerTags: null,
        title: title.trim(),
        content: content.trim(),
        tags,
        recordedAt: safeRecordedAt,
      })
    } else {
      if (!nextContainerId) return
      await createThoughtEntry({
        containerId: nextContainerId,
        title: title.trim(),
        content: content.trim(),
        tags,
        recordedAt: safeRecordedAt,
      })
    }

    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
            {entry ? t.thoughtEditor.editEntry : t.thoughtEditor.moveToThoughts}
          </h2>
          <button onClick={onClose} className="text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('existing')}
              className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${mode === 'existing' ? 'bg-[var(--color-accent)] text-white' : 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]'}`}
            >
              {t.thoughtEditor.useExisting}
            </button>
            <button
              onClick={() => setMode('new')}
              className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${mode === 'new' ? 'bg-[var(--color-accent)] text-white' : 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]'}`}
            >
              {t.thoughtEditor.createNew}
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.chooseContainer}</label>
              <select
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="macos-input w-full p-3 text-[14px]"
              >
                <option value="">{t.thoughtEditor.createFirstContainer}</option>
                {thoughtContainers.map((container) => (
                  <option key={container.id} value={container.id}>
                    {container.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.containerTitle}</label>
                <input
                  value={containerTitle}
                  onChange={(e) => setContainerTitle(e.target.value)}
                  className="macos-input w-full p-3 text-[14px]"
                  placeholder={t.thoughtEditor.containerTitlePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.containerDescription}</label>
                <textarea
                  value={containerDescription}
                  onChange={(e) => setContainerDescription(e.target.value)}
                  className="macos-input w-full p-3 resize-none h-20 text-[14px]"
                  placeholder={t.thoughtEditor.containerDescriptionPlaceholder}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.entryTitle}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="macos-input w-full p-3 text-[14px]"
              placeholder={t.thoughtEditor.entryTitlePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.entryContent}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="macos-input w-full p-3 resize-none h-28 text-[14px]"
              placeholder={t.thoughtEditor.entryContentPlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtEditor.recordedAt}</label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="macos-input w-full p-3 text-[14px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)] mr-1">{t.thoughtEditor.tags}</label>
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[12px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
                #{tag}
                <button onClick={() => setTags(tags.filter((item) => item !== tag))} className="ml-1 hover:text-[var(--color-ink)]">×</button>
              </span>
            ))}

            {isAddingTag ? (
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  } else if (e.key === 'Escape') {
                    setIsAddingTag(false)
                    setTagInput('')
                  }
                }}
                onBlur={handleAddTag}
                className="macos-input w-24 p-1 text-[12px] h-6"
                placeholder={t.thoughtEditor.tagPlaceholder}
              />
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-ink-tertiary)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[var(--color-accent)] transition-all"
                title={t.thoughtEditor.addTag}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.05)] rounded-lg transition-colors">
              {t.common.cancel}
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-[14px] font-medium text-white bg-[var(--color-accent)] hover:brightness-110 rounded-lg shadow-sm">
              {entry ? t.thoughtEditor.saveEntry : t.thoughtEditor.moveEntry}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
