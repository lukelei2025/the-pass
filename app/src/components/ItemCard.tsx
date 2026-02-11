import { useState } from 'react';
import { useStore } from '../store/useStore';
import { CATEGORY_INFO, copyToClipboard, generateTodoistFormat, generateNotionFormat } from '../lib/constants';
import type { Item, Urgency } from '../types';

interface ItemCardProps {
  item: Item;
  urgency: Urgency;
  remainingText: string;
}

export default function ItemCard({ item, urgency, remainingText }: ItemCardProps) {
  const { updateItem } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  // Status Colors
  const indicatorColor = {
    normal: 'bg-[#34C759]',
    warning: 'bg-[#FF9F0A]',
    alert: 'bg-[#FF3B30]',
    urgent: 'bg-[#FF3B30] animate-pulse',
  }[urgency];

  const handleAction = async (action: 'cooked' | 'todo' | 'frozen' | 'composted') => {
    let copied = false;
    if (action === 'todo') {
      copied = await copyToClipboard(generateTodoistFormat(item.content, item.category));
    } else if (action === 'frozen') {
      copied = await copyToClipboard(generateNotionFormat(item.content, item.category, item.source));
    }
    await updateItem(item.id, { status: action, processedAt: Date.now() });
    if (copied) alert('Copied to clipboard');
  };

  return (
    <div
      onClick={() => window.innerWidth < 768 && setIsExpanded(!isExpanded)}
      className="group flex flex-col h-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Category Tag */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide 
            ${item.category === 'inspiration' ? 'bg-[var(--bg-tag-orange)] text-[var(--color-orange)]' :
              item.category === 'work' ? 'bg-[var(--bg-tag-blue)] text-[var(--color-blue)]' :
                item.category === 'personal' ? 'bg-[var(--bg-tag-green)] text-[var(--color-green)]' :
                  item.category === 'article' ? 'bg-[var(--bg-tag-purple)] text-[var(--color-purple)]' :
                    'bg-[var(--bg-tag-gray)] text-[var(--color-gray)]'
            }`}>
            {CATEGORY_INFO[item.category].name}
          </span>

          {/* Platform Tag */}
          {item.type === 'link' && item.source && !item.source.startsWith('http') && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
              {item.source}
            </span>
          )}
        </div>

        {/* Time with Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)]">
          <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
          {remainingText}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-[3rem]">
        {item.type === 'link' && (item.originalUrl || (item.source && item.source.startsWith('http'))) ? (
          <div className="flex flex-col gap-1.5">
            <a
              href={item.originalUrl || item.source}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[var(--color-accent)] transition-colors block group/link"
            >
              <p className="text-[14px] leading-relaxed font-medium line-clamp-3">
                {/* Prefer item.title for new items, fallback to item.content for legacy */}
                {item.title || item.content}
                <span className="inline-block ml-1 opacity-40 text-[10px] group-hover/link:translate-x-0.5 transition-transform">↗</span>
              </p>
            </a>
            {/* If we have a separate title and there is content (note), show the note below */}
            {item.title && item.content && (
              <p className="text-[13px] leading-snug text-[var(--color-ink-secondary)] line-clamp-3 font-normal">
                {item.content}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-[var(--color-ink)] line-clamp-4 font-normal">
            {item.content}
            {/* Try to show title for text items if it exists, though usually text items use content */}
          </p>
        )}
      </div>

      {/* Source Link (If title is displayed above, show URL below subtly) */}
      {item.type === 'link' && item.originalUrl && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-secondary)] w-fit max-w-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          <span className="truncate opacity-60">Link metadata identified</span>
        </div>
      )}

      {/* Desktop Hover Actions */}
      <div className="hidden md:flex absolute bottom-0 left-0 right-0 p-2 bg-white/95 backdrop-blur-sm border-t border-[var(--color-border)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); handleAction('cooked'); }} title="Done (Cmd+Enter)" className="flex-1 h-8 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-green)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleAction('todo'); }} title="To-Do" className="flex-1 h-8 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-blue)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleAction('frozen'); }} title="Freeze" className="flex-1 h-8 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-blue)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleAction('composted'); }} title="Trash" className="flex-1 h-8 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] hover:bg-[var(--color-red)] hover:text-white text-[var(--color-ink-secondary)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Mobile Expanded Actions */}
      {isExpanded && (
        <div className="md:hidden mt-4 pt-3 border-t border-[var(--color-border)] flex gap-2 animate-in fade-in slide-in-from-top-2">
          <button onClick={(e) => { e.stopPropagation(); handleAction('cooked'); }} className="flex-1 h-10 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] text-[var(--color-green)] font-medium">DONE</button>
          <button onClick={(e) => { e.stopPropagation(); handleAction('composted'); }} className="flex-1 h-10 flex items-center justify-center rounded bg-[rgba(0,0,0,0.04)] text-[var(--color-red)] font-medium">TRASH</button>
        </div>
      )}
    </div>
  );
}
