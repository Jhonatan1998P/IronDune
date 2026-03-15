/**
 * useSwipe Hook
 * 
 * Detects horizontal swipe gestures for mobile interactions.
 * Optimized for performance by using direct DOM manipulation for the transform.
 */

import { useState, useCallback, useRef } from 'react';

interface SwipeState {
    isSwiping: boolean;
    direction: 'left' | 'right' | null;
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
        direction: null
    });

    const startX = useRef<number>(0);
    const currentX = useRef<number>(0);
    const elementRef = useRef<HTMLDivElement>(null);
    const isSwipingRef = useRef<boolean>(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = startX.current;
        isSwipingRef.current = true;
        
        setSwipeState({
            isSwiping: true,
            direction: null
        });
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isSwipingRef.current) return;

        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;
        const direction = diff > 0 ? 'right' : 'left';

        // Direct DOM manipulation for performance
        if (elementRef.current) {
            elementRef.current.style.transform = `translateX(${diff}px)`;
            elementRef.current.style.transition = 'none';
        }

        // Only update state if direction changes to minimize re-renders
        setSwipeState(prev => {
            if (prev.direction !== direction) {
                return { ...prev, direction: direction as 'left' | 'right' };
            }
            return prev;
        });
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!isSwipingRef.current) return;

        const diff = currentX.current - startX.current;
        const absDiff = Math.abs(diff);

        // Reset transform with transition
        if (elementRef.current) {
            elementRef.current.style.transform = '';
            elementRef.current.style.transition = 'transform 0.3s ease-out';
        }

        if (absDiff >= threshold) {
            if (diff > 0 && onSwipeRight) {
                onSwipeRight();
            } else if (diff < 0 && onSwipeLeft) {
                onSwipeLeft();
            }
        }

        isSwipingRef.current = false;
        setSwipeState({
            isSwiping: false,
            direction: null
        });

        startX.current = 0;
        currentX.current = 0;
    }, [threshold, onSwipeLeft, onSwipeRight]);

    const resetSwipe = useCallback(() => {
        if (elementRef.current) {
            elementRef.current.style.transform = '';
            elementRef.current.style.transition = 'transform 0.3s ease-out';
        }
        isSwipingRef.current = false;
        setSwipeState({
            isSwiping: false,
            direction: null
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
