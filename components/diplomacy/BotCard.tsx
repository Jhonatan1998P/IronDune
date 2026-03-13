/**
 * BotCard Component
 * 
 * Individual bot card for DiplomacyView with swipe support for mobile.
 * Optimized for performance with direct DOM manipulation.
 */

import React from 'react';
import { StaticBot } from '../../utils/engine/rankings';
import { useSwipe } from '../../hooks/useSwipe';
import { History, Gift } from 'lucide-react';

interface BotCardProps {
    bot: StaticBot;
    isMobile: boolean;
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    onClick?: () => void;
    onHistoryClick?: () => void;
    children?: React.ReactNode;
    className?: string;
}

export const BotCard: React.FC<BotCardProps> = ({
    isMobile,
    onSwipeRight,
    onSwipeLeft,
    onClick,
    children,
    className = ''
}) => {
    const swipeHandlers = useSwipe({
        threshold: 60,
        onSwipeRight,
        onSwipeLeft
    });

    return (
        <div
            ref={swipeHandlers.elementRef}
            onTouchStart={swipeHandlers.handleTouchStart}
            onTouchMove={swipeHandlers.handleTouchMove}
            onTouchEnd={swipeHandlers.handleTouchEnd}
            onClick={onClick}
            className={`
                bg-gray-800 border border-gray-700 rounded-xl p-3 md:p-4 flex flex-col space-y-2 md:space-y-3 shadow-md relative overflow-hidden
                ${isMobile ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
                ${swipeHandlers.swipeState.isSwiping ? 'z-20 shadow-xl' : 'z-10 transition-all'}
                ${className}
            `}
        >
            {/* Swipe indicator */}
            {isMobile && swipeHandlers.swipeState.direction === 'right' && (
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-blue-600/20 flex items-center justify-center z-0 animate-pulse">
                    <Gift className="w-6 h-6 text-blue-400" />
                </div>
            )}
            {isMobile && swipeHandlers.swipeState.direction === 'left' && (
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-cyan-600/20 flex items-center justify-center z-0 animate-pulse">
                    <History className="w-6 h-6 text-cyan-400" />
                </div>
            )}

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default BotCard;
