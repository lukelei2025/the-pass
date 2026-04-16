import type { Item } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { createPortal } from 'react-dom';

interface ActionDrawerProps {
    item: Item;
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: 'cooked' | 'todo' | 'thought' | 'frozen' | 'composted') => void;
    hideBackdrop?: boolean;
    excludeAction?: 'cooked' | 'todo' | 'thought' | 'frozen' | 'composted';
}

export default function ActionDrawer({ isOpen, onClose, onAction, hideBackdrop, excludeAction }: ActionDrawerProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const actions = [
        { id: 'cooked' as const, label: t.actions.clear, color: 'text-[var(--color-green)]', bg: 'bg-[var(--bg-tag-green)]', icon: <path d="M20 6L9 17l-5-5" /> },
        { id: 'todo' as const, label: t.actions.todo, color: 'text-[var(--color-blue)]', bg: 'bg-[var(--bg-tag-blue)]', icon: <path d="M3 21h18L12 3 3 21z" /> },
        { id: 'thought' as const, label: t.actions.thought, color: 'text-[var(--color-orange)]', bg: 'bg-[var(--bg-tag-orange)]', icon: <><path d="M9.5 9a2.5 2.5 0 115 0c0 1.06-.53 1.7-1.2 2.26-.77.65-1.55 1.25-1.55 2.24" /><path d="M12 17h.01" /><path d="M8.5 20h7" /><path d="M9 3.5A7 7 0 005 10c0 2.2.86 3.72 2.3 5.03.43.4.7.95.7 1.53V17h8v-.44c0-.58.27-1.13.7-1.53C18.14 13.72 19 12.2 19 10a7 7 0 00-10-6.5z" /></> },
        { id: 'frozen' as const, label: t.actions.stash, color: 'text-[var(--color-purple)]', bg: 'bg-[var(--bg-tag-purple)]', icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
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
            <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-[20px] pt-3 px-4 pb-2 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1.5 bg-[rgba(0,0,0,0.1)] rounded-full mx-auto mb-4" />

                <div className={`grid gap-4 pb-2`} style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
                    {actions.map(action => (
                        <button
                            key={action.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                // Delay action slightly to allow drawer to close and prevent z-index conflict/touch ghosting
                                setTimeout(() => {
                                    onAction(action.id);
                                }, 50);
                            }}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <div className={`w-10 h-10 rounded-full ${action.bg} flex items-center justify-center ${action.color}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {action.icon}
                                </svg>
                            </div>
                            <span className={`text-[11px] font-semibold ${action.isRed ? 'text-[var(--color-red)]' : ''}`}>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
        , document.body);
}
