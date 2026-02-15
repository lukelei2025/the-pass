import { useState } from 'react';
import { useStore } from '../store/useStore';
import { mapCategory } from '../lib/constants';
import { getUrgencyIndicatorColor } from '../lib/styles/categoryStyles';
import type { Item, Urgency } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useIsMobile } from '../hooks/useMediaQuery';

import ActionDrawer from './ActionDrawer';
import CategoryTag from './ui/CategoryTag';
import TodoEditorDialog from './TodoEditorDialog';

interface ItemCardProps {
  item: Item;
  urgency: Urgency;
  remainingText: string;
}

export default function ItemCard({ item, urgency, remainingText }: ItemCardProps) {
  const { updateItem } = useStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTargetStatus, setEditTargetStatus] = useState<Item['status'] | undefined>(undefined);
  const safeCategory = mapCategory(item.category);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const indicatorColor = getUrgencyIndicatorColor(urgency);
  const isTodo = item.status === 'todo';

  const handleAction = async (action: 'cooked' | 'todo' | 'frozen' | 'composted') => {
    // Special handling for Todo/Frozen: Open editor instead of immediate update
    if (action === 'todo' || action === 'frozen') {
      setEditTargetStatus(action);
      setIsEditorOpen(true);
      return;
    }

    await updateItem(item.id, { status: action, processedAt: Date.now() });
  };

  const handleCardClick = () => {
    if (isTodo) {
      setIsEditorOpen(true);
      if (isMobile) {
        setIsDrawerOpen(true);
      }
    } else if (isMobile) {
      setIsDrawerOpen(true);
    }
  };

  const getDeadlineColor = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) return 'text-[var(--color-red)] bg-red-50'; // Overdue
    if (diff < 24 * 60 * 60 * 1000) return 'text-[var(--color-orange)] bg-orange-50'; // < 24h
    return 'text-[var(--color-green)] bg-green-50'; // > 24h
  };

  const formatDeadline = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group flex flex-col h-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 relative overflow-hidden cursor-pointer ${!isTodo && !isMobile ? 'md:cursor-default' : ''}`}
    >
      {!isTodo && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Category Tag */}
            <CategoryTag category={safeCategory}>
              {t.categories[safeCategory]}
            </CategoryTag>

            {/* Platform Tag */}
            {item.type === 'link' && item.source && !item.source.startsWith('http') && (
              <span className="px-2 py-0.5 rounded text-[13px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
                {item.source}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)]">
            <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
            {remainingText}
          </div>
        </div>
      )}

      {isTodo && item.deadline && (
        <div className="flex items-center justify-end mb-3">
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded ${getDeadlineColor(item.deadline)}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            {formatDeadline(item.deadline)}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-[3rem]">
        {item.type === 'link' && (item.originalUrl || (item.source && item.source.startsWith('http'))) ? (
          <div className="flex flex-col gap-1.5">
            <a
              href={item.originalUrl || item.source}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[var(--color-accent)] transition-colors w-fit group/link"
            >
              <p className="text-[14px] leading-relaxed font-medium line-clamp-3">
                {item.title || item.content}
                <span className="inline-block ml-1 opacity-40 text-[10px] group-hover/link:translate-x-0.5 transition-transform">↗</span>
              </p>
            </a>
            {item.title && item.content && (
              <p className="text-[13px] leading-snug text-[var(--color-ink-secondary)] line-clamp-3 font-normal">
                {item.content}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-[var(--color-ink)] line-clamp-4 font-normal">
            {item.content}
          </p>
        )}

        {/* Todo Details */}
        {isTodo && item.details && (
          <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-border)]">
            <p className="text-[13px] text-[var(--color-ink-secondary)] whitespace-pre-wrap">
              {item.details}
            </p>
          </div>
        )}
      </div>

      {/* Source Link Subtle */}
      {item.type === 'link' && item.originalUrl && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-secondary)] w-fit max-w-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          <span className="truncate opacity-60">{t.item.linkMetadata}</span>
        </div>
      )}

      {/* Desktop Hover Actions */}
      <div className="hidden md:flex absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[var(--color-border)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ padding: 0 }}>
        <button onClick={(e) => { e.stopPropagation(); handleAction('cooked'); }} title={`${t.actions.clear} (Cmd+Enter)`} className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-green)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="text-[13px] font-semibold">{t.actions.clear}</span>
        </button>
        {/* Only show 'Todo' button if NOT already in todo */}
        {!isTodo && (
          <button onClick={(e) => { e.stopPropagation(); handleAction('todo'); }} title={t.actions.todo} className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-blue)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18L12 3 3 21z" /></svg>
            <span className="text-[13px] font-semibold">{t.actions.todo}</span>
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleAction('frozen'); }} title={t.actions.stash} className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-blue)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          <span className="text-[13px] font-semibold">{t.actions.stash}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleAction('composted'); }} title={t.actions.void} className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-red)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          <span className="text-[13px] font-semibold">{t.actions.void}</span>
        </button>
      </div>

      {/* Mobile Bottom Sheet (Only for non-Todo items) */}
      <ActionDrawer
        item={item}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
        }}
        onAction={handleAction}
        hideBackdrop={isTodo && isMobile && isEditorOpen}
        excludeAction={isTodo ? 'todo' : undefined}
      />

      {/* Todo Editor Dialog */}
      <TodoEditorDialog
        item={item}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setIsDrawerOpen(false);
          setEditTargetStatus(undefined);
        }}
        newStatus={editTargetStatus}
      />
    </div>
  );
}
