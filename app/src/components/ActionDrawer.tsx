import type { Item } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { createPortal } from 'react-dom';

interface ActionDrawerProps {
    item: Item;
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: 'cooked' | 'todo' | 'frozen' | 'composted') => void;
    hideBackdrop?: boolean;
    excludeAction?: 'cooked' | 'todo' | 'frozen' | 'composted';
}

export default function ActionDrawer({ isOpen, onClose, onAction, hideBackdrop, excludeAction }: ActionDrawerProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const actions = [
        { id: 'cooked' as const, label: t.actions.clear, color: 'text-[var(--color-green)]', bg: 'bg-[var(--bg-tag-green)]', icon: <path d="M20 6L9 17l-5-5" /> },
        { id: 'todo' as const, label: t.actions.todo, color: 'text-[var(--color-blue)]', bg: 'bg-[var(--bg-tag-blue)]', icon: <circle cx="12" cy="12" r="10" /> },
        { id: 'frozen' as const, label: t.actions.stash, color: 'text-[var(--color-purple)]', bg: 'bg-[var(--bg-tag-purple)]', icon: <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" /> },
        { id: 'composted' as const, label: t.actions.void, color: 'text-[var(--color-red)]', bg: 'bg-[var(--bg-tag-gray)]', icon: <path d="M18 6L6 18M6 6l12 12" />, isRed: true },
    ].filter(a => a.id !== excludeAction);

    return createPortal(
        <>
            {/* Backdrop */}
            {!hideBackdrop && (
                <div
                    className="fixed inset-0 bg-black/40 z-[9998] animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                />
            )}

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-[20px] p-4 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1.5 bg-[rgba(0,0,0,0.1)] rounded-full mx-auto mb-6" />

                <div className={`grid gap-4 pb-4`} style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
                    {actions.map(action => (
                        <button
                            key={action.id}
                            onClick={() => { onAction(action.id); onClose(); }}
                            className="flex flex-col items-center gap-2"
                        >
                            <div className={`w-12 h-12 rounded-full ${action.bg} flex items-center justify-center ${action.color}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    {action.icon}
                                </svg>
                            </div>
                            <span className={`text-[12px] font-semibold ${action.isRed ? 'text-[var(--color-red)]' : ''}`}>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
        , document.body);
}
