
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store/useStore';
import type { Item } from '../types';

interface TodoEditorDialogProps {
    item: Item;
    isOpen: boolean;
    onClose: () => void;
    newStatus?: Item['status'];
}

export default function TodoEditorDialog({ item, isOpen, onClose, newStatus }: TodoEditorDialogProps) {
    const { t } = useTranslation();
    const { updateItem } = useStore();
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [content, setContent] = useState('');
    const [details, setDetails] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Determine if we are in "Frozen/Collection" mode
    // Either moving to frozen (newStatus) OR editing an existing frozen item
    const isFrozen = newStatus === 'frozen' || (!newStatus && item.status === 'frozen');

    useEffect(() => {
        if (isOpen && item) {
            if (item.deadline) {
                const date = new Date(item.deadline);
                // Format to YYYY-MM-DD
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setDeadlineDate(`${yyyy}-${mm}-${dd}`);

                // Format to HH:mm
                const hh = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                setDeadlineTime(`${hh}:${min}`);
            } else {
                setDeadlineDate('');
                setDeadlineTime('');
            }
            setContent(item.content || '');
            setDetails(item.details || '');
            setTags(item.tags || []);
        }
    }, [isOpen, item]);

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
        setTagInput('');
        setIsAddingTag(false); // Close input even if empty or duplicate
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        let deadlineTimestamp: number | null = null;

        if (deadlineDate) {
            const timeStr = deadlineTime || '23:59';
            const dateStr = `${deadlineDate}T${timeStr}`;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                deadlineTimestamp = date.getTime();
            }
        }

        const updates: Partial<Item> = {
            content: content.trim() || item.content,
            deadline: deadlineTimestamp,
            details: details.trim() || null,
            tags: tags.length > 0 ? tags : null,
        };

        if (newStatus) {
            updates.status = newStatus;
            updates.processedAt = Date.now();
        }

        await updateItem(item.id, updates);
        onClose();
    };

    if (!isOpen) return null;

    // Determine Title
    let title = t.todoEditor.editTodo;
    if (newStatus === 'frozen') {
        title = t.todoEditor.stashToCollection;
    } else if (isFrozen) {
        title = t.item.editNote;
    }
    return createPortal(
        <div
            className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            <div
                className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                        {title}
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
                        <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.todoEditor.title || '内容 / 标题'}</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="macos-input w-full p-3 resize-none h-20 text-[14px]"
                            placeholder={t.todoEditor.titlePlaceholder || '输入内容或标题...'}
                        />
                    </div>

                    {!isFrozen && (
                        <div className="space-y-2">
                            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{t.todoEditor.deadline}</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="date"
                                    value={deadlineDate}
                                    onChange={(e) => setDeadlineDate(e.target.value)}
                                    className="macos-input flex-1 p-2 text-[14px]"
                                />
                                <input
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="macos-input w-24 p-2 text-[14px]"
                                />
                                {(deadlineDate || deadlineTime) && (
                                    <button
                                        onClick={() => {
                                            setDeadlineDate('');
                                            setDeadlineTime('');
                                        }}
                                        className="p-1.5 text-[var(--color-ink-tertiary)] hover:text-[var(--color-danger)] transition-colors rounded-md hover:bg-[rgba(0,0,0,0.05)] flex-shrink-0"
                                        title={t.todoEditor.clearDeadline || "清除"}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
                            {isFrozen ? t.todoEditor.addNote : t.todoEditor.details}
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="macos-input w-full p-3 resize-none h-32 text-[14px]"
                            placeholder={isFrozen ? t.todoEditor.placeholderStash : t.todoEditor.placeholderDetails}
                        />
                    </div>

                    {isFrozen && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <label className="text-[13px] font-medium text-[var(--color-ink-secondary)] mr-1">{t.todoEditor.tags}</label>

                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[12px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
                                    #{tag}
                                    <button onClick={() => removeTag(tag)} className="ml-1 hover:text-[var(--color-ink)]">×</button>
                                </span>
                            ))}

                            {isAddingTag ? (
                                <input
                                    autoFocus
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTag();
                                        } else if (e.key === 'Escape') {
                                            setIsAddingTag(false);
                                            setTagInput('');
                                        }
                                    }}
                                    onBlur={handleAddTag}
                                    className="macos-input w-24 p-1 text-[12px] h-6"
                                    placeholder={t.todoEditor.tagPlaceholder}
                                />
                            ) : (
                                <button
                                    onClick={() => setIsAddingTag(true)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-ink-tertiary)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[var(--color-accent)] transition-all"
                                    title={t.todoEditor.addTag}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-[14px] font-medium text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.05)] rounded-lg transition-colors"
                        >
                            {t.todoEditor.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-[14px] font-medium text-white bg-[var(--color-accent)] hover:brightness-110 rounded-lg shadow-sm active:scale-95 transition-all"
                        >
                            {newStatus === 'frozen' ? t.todoEditor.stashItem : t.todoEditor.saveDetails}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
