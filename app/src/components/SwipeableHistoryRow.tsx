import { useRef, useState, useCallback, type ReactNode } from 'react';

interface SwipeableHistoryRowProps {
    children: ReactNode;
    onRestore: () => void;
    restoreLabel: string;
}

const SWIPE_THRESHOLD = 28; // px needed to snap open
const REVEAL_WIDTH = 48;    // width of the icon area revealed

export default function SwipeableHistoryRow({ children, onRestore, restoreLabel }: SwipeableHistoryRowProps) {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const isHorizontal = useRef<boolean | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        isHorizontal.current = null;
        setIsSwiping(false);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const dx = e.touches[0].clientX - startX.current;
        const dy = e.touches[0].clientY - startY.current;

        // Determine swipe direction on first significant move
        if (isHorizontal.current === null) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                isHorizontal.current = Math.abs(dx) > Math.abs(dy);
            }
            return;
        }

        if (!isHorizontal.current) return;

        e.preventDefault();
        setIsSwiping(true);

        if (isOpen) {
            // Already open: allow swiping right to close
            const newOffset = -REVEAL_WIDTH + dx;
            setOffsetX(Math.min(0, Math.max(-REVEAL_WIDTH, newOffset)));
        } else {
            // Closed: only allow left swipe
            if (dx >= 0) { setOffsetX(0); return; }
            setOffsetX(Math.max(-REVEAL_WIDTH, dx));
        }
    }, [isOpen]);

    const handleTouchEnd = useCallback(() => {
        if (isOpen) {
            // If swiped right enough, close
            if (offsetX > -REVEAL_WIDTH / 2) {
                setOffsetX(0);
                setIsOpen(false);
            } else {
                setOffsetX(-REVEAL_WIDTH);
            }
        } else {
            // If swiped left enough, snap open
            if (offsetX < -SWIPE_THRESHOLD) {
                setOffsetX(-REVEAL_WIDTH);
                setIsOpen(true);
            } else {
                setOffsetX(0);
            }
        }
        setIsSwiping(false);
        isHorizontal.current = null;
    }, [offsetX, isOpen]);

    const handleRestore = useCallback(() => {
        onRestore();
        setOffsetX(0);
        setIsOpen(false);
    }, [onRestore]);

    return (
        <div
            className="relative overflow-hidden"
            style={{ touchAction: isSwiping ? 'none' : 'pan-y' }}
        >
            {/* Restore icon behind the row */}
            <div
                className="absolute inset-y-0 right-0 flex items-center justify-center"
                style={{ width: `${REVEAL_WIDTH}px` }}
            >
                <button
                    onClick={handleRestore}
                    title={restoreLabel}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--color-green)] active:bg-[rgba(5,150,105,0.15)] transition-colors"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                </button>
            </div>

            {/* Foreground content */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
                className="relative bg-white"
            >
                {children}
            </div>
        </div>
    );
}
