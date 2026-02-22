import { useRef, useState, useCallback, type ReactNode } from 'react';

interface SwipeableHistoryRowProps {
    children: ReactNode;
    onRestore: () => void;
    restoreLabel: string;
}

const SWIPE_THRESHOLD = 80; // px to trigger action
const MAX_SWIPE = 120;      // max visual distance

export default function SwipeableHistoryRow({ children, onRestore, restoreLabel }: SwipeableHistoryRowProps) {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const isHorizontal = useRef<boolean | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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

        // If vertical scroll, don't interfere
        if (!isHorizontal.current) return;

        // Only allow left swipe (negative dx)
        if (dx >= 0) {
            setOffsetX(0);
            return;
        }

        e.preventDefault(); // Prevent scroll when swiping horizontally
        setIsSwiping(true);
        const clamped = Math.max(-MAX_SWIPE, dx);
        setOffsetX(clamped);
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (offsetX < -SWIPE_THRESHOLD && !isRestoring) {
            // Trigger restore
            setIsRestoring(true);
            setOffsetX(-MAX_SWIPE);

            // Brief delay for visual feedback, then restore
            setTimeout(() => {
                onRestore();
            }, 250);
        } else {
            // Snap back
            setOffsetX(0);
        }
        setIsSwiping(false);
        isHorizontal.current = null;
    }, [offsetX, onRestore, isRestoring]);

    const progress = Math.min(1, Math.abs(offsetX) / SWIPE_THRESHOLD);
    const isTriggered = Math.abs(offsetX) >= SWIPE_THRESHOLD;

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{ touchAction: isSwiping ? 'none' : 'pan-y' }}
        >
            {/* Restore action background (revealed on swipe) */}
            <div
                className="absolute inset-y-0 right-0 flex items-center justify-end px-5 transition-colors duration-150"
                style={{
                    width: `${MAX_SWIPE}px`,
                    backgroundColor: isTriggered
                        ? 'var(--color-green, #059669)'
                        : `rgba(5, 150, 105, ${0.15 + progress * 0.45})`,
                }}
            >
                <div className="flex items-center gap-1.5 text-white">
                    {/* Restore icon */}
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            opacity: 0.5 + progress * 0.5,
                            transform: `rotate(${isTriggered ? 0 : -90 + progress * 90}deg)`,
                            transition: isSwiping ? 'none' : 'transform 0.2s ease',
                        }}
                    >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span
                        className="text-[12px] font-semibold whitespace-nowrap"
                        style={{ opacity: progress }}
                    >
                        {restoreLabel}
                    </span>
                </div>
            </div>

            {/* Foreground content */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
                className="relative bg-white"
            >
                {children}
            </div>
        </div>
    );
}
