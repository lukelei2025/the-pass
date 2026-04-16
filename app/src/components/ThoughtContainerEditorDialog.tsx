import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'
import { useStore } from '../store/useStore'
import type { ThoughtContainer } from '../types'

interface ThoughtContainerEditorDialogProps {
  container?: ThoughtContainer
  onClose: () => void
}

export default function ThoughtContainerEditorDialog({
  container,
  onClose,
}: ThoughtContainerEditorDialogProps) {
  const { t } = useTranslation()
  const { createThoughtContainer, updateThoughtContainer } = useStore()
  const [title, setTitle] = useState(() => container?.title || '')
  const [description, setDescription] = useState(() => container?.description || '')
  const [tags, setTags] = useState<string[]>(() => container?.tags || [])
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
    if (!title.trim()) return

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      tags: tags.length ? tags : null,
    }

    if (container) {
      await updateThoughtContainer(container.id, payload)
    } else {
      await createThoughtContainer(payload)
    }

    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
            {container ? t.thoughtContainerEditor.editTitle : t.thoughtContainerEditor.createTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtContainerEditor.name}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="macos-input w-full p-3 text-[14px]"
              placeholder={t.thoughtContainerEditor.namePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.thoughtContainerEditor.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="macos-input w-full p-3 resize-none h-24 text-[14px]"
              placeholder={t.thoughtContainerEditor.descriptionPlaceholder}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)] mr-1">{t.thoughtContainerEditor.tags}</label>
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
                placeholder={t.thoughtContainerEditor.tagPlaceholder}
              />
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-ink-tertiary)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[var(--color-accent)] transition-all"
                title={t.thoughtContainerEditor.addTag}
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
              {t.thoughtContainerEditor.save}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
