import type { Item } from '../types';

interface ActionDrawerProps {
    item: Item;
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: 'cooked' | 'todo' | 'frozen' | 'composted') => void;
}

export default function ActionDrawer({ isOpen, onClose, onAction }: ActionDrawerProps) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[20px] pb-[env(safe-area-inset-bottom)] p-4 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1.5 bg-[rgba(0,0,0,0.1)] rounded-full mx-auto mb-6" />

                <div className="grid grid-cols-4 gap-4 pb-4">
                    <button
                        onClick={() => { onAction('cooked'); onClose(); }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-tag-green)] flex items-center justify-center text-[var(--color-green)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                        </div>
                        <span className="text-[12px] font-semibold">Fini</span>
                    </button>

                    <button
                        onClick={() => { onAction('todo'); onClose(); }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-tag-blue)] flex items-center justify-center text-[var(--color-blue)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /></svg>
                        </div>
                        <span className="text-[12px] font-semibold">Tick</span>
                    </button>

                    <button
                        onClick={() => { onAction('frozen'); onClose(); }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-tag-purple)] flex items-center justify-center text-[var(--color-purple)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" /></svg>
                        </div>
                        <span className="text-[12px] font-semibold">Stow</span>
                    </button>

                    <button
                        onClick={() => { onAction('composted'); onClose(); }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-tag-gray)] flex items-center justify-center text-[var(--color-red)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </div>
                        <span className="text-[12px] font-semibold text-[var(--color-red)]">Void</span>
                    </button>
                </div>
            </div>
        </>
    );
}
