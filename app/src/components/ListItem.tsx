import { useState, useRef, useEffect } from 'react';
import type { Item } from '../types';
import { copyToClipboard, generateNotionFormat, mapCategory } from '../lib/constants';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';

interface ListItemProps {
    item: Item;
}

export default function ListItem({ item }: ListItemProps) {
    const { updateItem } = useStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(item.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const safeCategory = mapCategory(item.category);
    const { t } = useTranslation();

    // Extract source domain or name for display
    const sourceTag = item.source && !item.source.startsWith('http') ? item.source : null;

    // Determine display title:
    // 1. item.title if exists (New items)
    // 2. item.content (Old items or text items) - legacy fallback
    const displayTitle = item.title || item.content;
    const isLink = item.type === 'link';
    const hasSeparateTitle = !!item.title;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // For Notion copy, we ideally want Title + URL + Note
        const contentToCopy = hasSeparateTitle
            ? `${item.title}\n${item.content}`
            : item.content;

        await copyToClipboard(generateNotionFormat(contentToCopy, safeCategory, item.source));
        alert('Copied Notion format');
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this item?')) {
            updateItem(item.id, { status: 'composted', processedAt: Date.now() });
        }
    };

    const handleSave = async () => {
        // Legacy Migration Logic:
        // If item has no title (Legacy), we assume the current 'content' is actually the Title.
        // The user's new input in 'editContent' is the real Note.
        // So we split them: title = old_content, content = new_note.
        if (!item.title && isLink) {
            await updateItem(item.id, {
                title: item.content,
                content: editContent
            });
        } else {
            // Standard Update
            if (editContent.trim() !== item.content) {
                await updateItem(item.id, { content: editContent });
            }
        }
        setIsEditing(false);
    };

    const handleExpand = () => {
        if (!isExpanded) {
            setIsExpanded(true);
            // Legacy Migration Helper:
            // If no separate title, and we open edit, start with empty note 
            // (assuming user wants to add a note to the link, not edit the title-as-note)
            if (!item.title && isLink) {
                setEditContent('');
            } else {
                setEditContent(item.content);
            }
        } else {
            setIsExpanded(false);
            setIsEditing(false);
        }
    };

    // Auto-focus textarea when editing starts
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [isEditing]);

    // Adjust textarea height
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [editContent, isEditing]);

    const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'numeric',
        day: 'numeric',
    });


    return (
        <div className={`border-b border-[var(--color-border)] last:border-0 transition-all duration-200 ${isExpanded ? 'bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
            {/* Collapsed View (Clickable Header) */}
            <div
                onClick={handleExpand}
                className="flex items-center gap-4 py-3 px-4 cursor-pointer group select-none"
            >
                <span className="text-[11px] text-[var(--color-ink-tertiary)] font-mono w-10 flex-shrink-0">
                    {dateStr}
                </span>

                {/* Content Preview / Title */}
                <div className="flex-1 min-w-0 pr-4 z-10">
                    {isLink && (item.originalUrl || item.source) ? (
                        <a
                            href={item.originalUrl || item.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`text-[13px] text-[var(--color-ink)] truncate hover:text-[var(--color-accent)] hover:underline transition-colors block group/link ${isExpanded ? 'font-medium' : 'font-normal'}`}
                            title={displayTitle}
                        >
                            {displayTitle}
                            <span className="inline-block ml-1 opacity-40 text-[10px] group-hover/link:translate-x-0.5 transition-transform">↗</span>
                        </a>
                    ) : (
                        <p className={`text-[13px] text-[var(--color-ink)] truncate ${isExpanded ? 'font-medium' : 'font-normal'}`}>
                            {displayTitle}
                        </p>
                    )}
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide 
            ${safeCategory === 'ideas' ? 'text-[var(--color-orange)] bg-[var(--bg-tag-orange)]' :
                            safeCategory === 'work' ? 'text-[var(--color-blue)] bg-[var(--bg-tag-blue)]' :
                                safeCategory === 'personal' ? 'text-[var(--color-green)] bg-[var(--bg-tag-green)]' :
                                    safeCategory === 'external' ? 'text-[var(--color-purple)] bg-[var(--bg-tag-purple)]' :
                                        'text-[var(--color-gray)] bg-[var(--bg-tag-gray)]'
                        }`}>
                        {t.categories[safeCategory]}
                    </span>

                    {sourceTag && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
                            {sourceTag}
                        </span>
                    )}

                    <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-[var(--color-ink-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 pl-[4.5rem] animate-in slide-in-from-top-1 fade-in duration-200">
                    {isEditing ? (
                        <div className="space-y-3">
                            <textarea
                                ref={textareaRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Add a note..."
                                className="w-full bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded-md p-3 text-[14px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
                                rows={3}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.05)] rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-accent)] hover:bg-[#0077ED] rounded"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Display Note Content. For legacy items (no separate title), this initially shows duplicate title. 
                   But we encourage editing to fix it. Ideally, legacy items are migrated on first edit. */}
                            <div
                                onClick={() => setIsEditing(true)}
                                className={`text-[14px] leading-relaxed text-[var(--color-ink)] whitespace-pre-wrap cursor-text hover:bg-[rgba(0,0,0,0.02)] -mx-2 px-2 py-1 rounded transition-colors ${(!item.content && hasSeparateTitle) ? 'text-[var(--color-ink-tertiary)] italic' : ''}`}
                                title="Click to edit note"
                            >
                                {(hasSeparateTitle || item.content !== displayTitle)
                                    ? (item.content || 'No note. Click to add...')
                                    : <span className="text-[var(--color-ink-tertiary)] italic">No note. Click to add...</span>
                                }
                            </div>

                            <div className="flex items-center gap-6 pt-2 border-t border-[var(--color-border)]/50">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                    Copy Notion
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    Edit Note
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-red)] transition-colors ml-auto"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
