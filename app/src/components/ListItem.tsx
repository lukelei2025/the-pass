import { useState } from 'react';
import type { Item } from '../types';
import { copyToClipboard, generateNotionFormat, mapCategory } from '../lib/constants';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import TodoEditorDialog from './TodoEditorDialog';

interface ListItemProps {
    item: Item;
}

export default function ListItem({ item }: ListItemProps) {
    const { updateItem } = useStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        alert(t.item.copiedNotion);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t.item.deleteConfirm)) {
            updateItem(item.id, { status: 'composted', processedAt: Date.now() });
        }
    };

    const handleExpand = () => {
        setIsExpanded(!isExpanded);
    };

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
                            className={`text-[13px] text-[var(--color-ink)] truncate hover:text-[var(--color-accent)] hover:underline transition-colors inline-block max-w-full group/link ${isExpanded ? 'font-medium' : 'font-normal'}`}
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
                    <div className="space-y-3">
                        {/* Display Note Content */}
                        <div
                            onClick={() => setIsDialogOpen(true)}
                            className={`text-[14px] leading-relaxed text-[var(--color-ink)] whitespace-pre-wrap cursor-text hover:bg-[rgba(0,0,0,0.02)] -mx-2 px-2 py-1 rounded transition-colors ${!item.details ? 'text-[var(--color-ink-tertiary)] italic' : ''}`}
                            title="Click to edit note"
                        >
                            {item.details || t.item.noNote}
                        </div>

                        {/* Tags Display */}
                        {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {item.tags.map(tag => (
                                    <span key={tag} className="text-[11px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/5 px-1.5 py-0.5 rounded">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-6 pt-2 border-t border-[var(--color-border)]/50">
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                {t.item.copyNotion}
                            </button>
                            <button
                                onClick={() => setIsDialogOpen(true)}
                                className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                {t.item.editNote}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-red)] transition-colors ml-auto"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                {t.common.delete}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TodoEditorDialog
                item={item}
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />
        </div>
    );
}
