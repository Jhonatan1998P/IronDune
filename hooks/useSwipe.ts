/**
 * useSwipe Hook
 * 
 * Detects horizontal swipe gestures for mobile interactions.
 * Returns swipe direction and provides reset functionality.
 */

import { useState, useCallback, useRef } from 'react';

interface SwipeState {
    isSwiping: boolean;
    direction: 'left' | 'right' | null;
    swipeDistance: number;
}

interface UseSwipeOptions {
    threshold?: number; // Minimum distance to trigger swipe (default: 80px)
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
}

export const useSwipe = ({
    threshold = 80,
    onSwipeLeft,
    onSwipeRight
}: UseSwipeOptions = {}) => {
    const [swipeState, setSwipeState] = useState<SwipeState>({
        isSwiping: false,
        direction: null,
        swipeDistance: 0
    });

    const startX = useRef<number>(0);
    const currentX = useRef<number>(0);
    const elementRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = startX.current;
        setSwipeState({
            isSwiping: true,
            direction: null,
            swipeDistance: 0
        });
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!swipeState.isSwiping) return;

        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;
        const distance = Math.abs(diff);
        const direction = diff > 0 ? 'right' : 'left';

        setSwipeState(prev => ({
            ...prev,
            isSwiping: true,
            direction: direction as 'left' | 'right',
            swipeDistance: diff
        }));
    }, [swipeState.isSwiping]);

    const handleTouchEnd = useCallback(() => {
        if (!swipeState.isSwiping) return;

        const diff = currentX.current - startX.current;
        const absDiff = Math.abs(diff);

        if (absDiff >= threshold) {
            if (diff > 0 && onSwipeRight) {
                onSwipeRight();
            } else if (diff < 0 && onSwipeLeft) {
                onSwipeLeft();
            }
        }

        setSwipeState({
            isSwiping: false,
            direction: null,
            swipeDistance: 0
        });

        startX.current = 0;
        currentX.current = 0;
    }, [swipeState.isSwiping, threshold, onSwipeLeft, onSwipeRight]);

    const resetSwipe = useCallback(() => {
        setSwipeState({
            isSwiping: false,
            direction: null,
            swipeDistance: 0
        });
        startX.current = 0;
        currentX.current = 0;
    }, []);

    return {
        swipeState,
        elementRef,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        resetSwipe
    };
};

export default useSwipe;
