import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { TabType } from './GameSidebar';
import { useLanguage } from '../context/LanguageContext';
import { GameState } from '../types';

interface TutorialOverlayProps {
    gameState: GameState; 
    activeTab: TabType;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ activeTab }) => {
    const { gameState } = useGame();
    const { t } = useLanguage();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const animationRef = useRef<number | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    const currentStep = TUTORIAL_STEPS.find(s => s.id === gameState.currentTutorialId);

    const getTargetElement = () => {
        if (!currentStep) return null;

        if (currentStep.targetTab !== activeTab) {
            const desktopTab = document.getElementById(`tab-${currentStep.targetTab}`);
            if (desktopTab && desktopTab.offsetParent !== null) {
                return desktopTab;
            }

            const mobileTab = document.getElementById(`mobile-tab-${currentStep.targetTab}`);
            const fab = document.getElementById('mobile-menu-fab');
            
            if (fab) {
                 const fabStyle = window.getComputedStyle(fab);
                 const fabOpacity = parseFloat(fabStyle.opacity);
                 if (fabOpacity > 0.5) return fab;
            }
            return mobileTab;
        } 
        
        if (currentStep.targetElementId) {
            const element = document.getElementById(currentStep.targetElementId);
            if (element && element.offsetParent !== null) return element;
        }

        if (currentStep.getTargetElementId) {
            const dynamicId = currentStep.getTargetElementId(gameState);
            if (dynamicId) {
                const element = document.getElementById(dynamicId);
                if (element && element.offsetParent !== null) return element;
            }
        }

        if (currentStep.targetElementId) {
            const element = document.getElementById(currentStep.targetElementId);
            if (element) return element;
        }

        return null;
    };

    const shouldShow = () => {
        if (!currentStep) return false;
        if (gameState.tutorialClaimable) return false;
        if (gameState.isTutorialMinimized) return false;
        if (!gameState.tutorialAccepted) return false;
        if (currentStep.progressCondition) {
            const result = currentStep.progressCondition(gameState);
            if ((typeof result === 'number' && result >= 0) || result === true) {
                return false;
            }
        }
        return true;
    };

    useEffect(() => {
        if (!shouldShow()) {
            setIsVisible(false);
            return;
        }

        const element = getTargetElement();
            
        if (element) {
            if (!scrollTimeoutRef.current) {
                let parent = element.parentElement;
                let scrollableFound = false;

                while (parent) {
                    const style = window.getComputedStyle(parent);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                        const parentRect = parent.getBoundingClientRect();
                        const elementRect = element.getBoundingClientRect();
                        
                        if (elementRect.top < parentRect.top || elementRect.bottom > parentRect.bottom) {
                            const elementTopRelative = elementRect.top - parentRect.top;
                            const targetScrollTop = parent.scrollTop + elementTopRelative - (parent.clientHeight / 2) + (element.clientHeight / 2);
                            
                            parent.scrollTo({
                                top: targetScrollTop,
                                behavior: 'smooth'
                            });
                        }
                        scrollableFound = true;
                        break;
                    }
                    parent = parent.parentElement;
                }

                if (!scrollableFound) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }

                scrollTimeoutRef.current = window.setTimeout(() => {
                    scrollTimeoutRef.current = null;
                }, 1000);
            }
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
        
        return () => {
            if(scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = null;
        }
    }, [currentStep, activeTab, gameState.tutorialClaimable, gameState.isTutorialMinimized, gameState.tutorialAccepted]);

    useEffect(() => {
        if (!shouldShow()) {
            setIsVisible(false);
            return;
        }

        const updateRect = () => {
             const element = getTargetElement();
             
             if (element) {
                 setIsVisible(true);
                 const rect = element.getBoundingClientRect();
                 
                 setTargetRect(prev => {
                     if (!prev || 
                         Math.abs(prev.top - rect.top) > 1 || 
                         Math.abs(prev.left - rect.left) > 1 ||
                         Math.abs(prev.width - rect.width) > 1
                        ) {
                         return rect;
                     }
                     return prev;
                 });
             } else {
                 setIsVisible(false);
             }
             animationRef.current = requestAnimationFrame(updateRect);
        };

        updateRect();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [currentStep, activeTab, gameState.tutorialClaimable, gameState.isTutorialMinimized, gameState.tutorialAccepted, gameState.activeResearch, gameState.activeMissions, gameState.activeConstructions, gameState.units]); 

    if (!isVisible || !targetRect) return null;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const spaceTop = targetRect.top;
    const spaceBottom = screenH - targetRect.bottom;
    const spaceRight = screenW - targetRect.right;

    let arrowRot = 0; 
    let arrowTop = 0;
    let arrowLeft = 0;

    if (spaceBottom > 150) {
        arrowRot = 180;
        arrowTop = targetRect.bottom + 10;
        arrowLeft = targetRect.left + (targetRect.width / 2) - 20; 
    } else if (spaceTop > 150) {
        arrowRot = 0;
        arrowTop = targetRect.top - 50; 
        arrowLeft = targetRect.left + (targetRect.width / 2) - 20;
    } else if (spaceRight > 150) {
        arrowRot = -90;
        arrowTop = targetRect.top + (targetRect.height / 2) - 20;
        arrowLeft = targetRect.right + 10;
    } else {
        arrowRot = 90;
        arrowTop = targetRect.top + (targetRect.height / 2) - 20;
        arrowLeft = targetRect.left - 50;
    }

    return (
        <div className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden transition-opacity duration-300 ease-in-out">
            <div 
                className="absolute rounded-xl transition-all duration-300 ease-out animate-tutorial-pulse"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 15px 2px rgba(6, 182, 212, 0.5) inset' 
                }}
            />

            <div 
                className="absolute transition-all duration-300 ease-out z-[9999] animate-tutorial-bounce"
                style={{ 
                    top: arrowTop,
                    left: arrowLeft,
                    transformOrigin: 'center center'
                }}
            >
                <div style={{ transform: `rotate(${arrowRot}deg)` }}>
                    <svg 
                        className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,1)] filter brightness-150" 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 2L12 18M12 18L7 13M12 18L17 13" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            <div 
                className="absolute transition-all duration-300 ease-out z-[9999]"
                style={{
                    top: arrowRot === 180 ? arrowTop + 50 : arrowRot === 0 ? arrowTop - 30 : arrowTop,
                    left: arrowRot === -90 ? arrowLeft + 50 : arrowRot === 90 ? arrowLeft - 100 : arrowLeft - 30,
                    width: 100,
                    textAlign: 'center'
                }}
            >
                <span className="font-tech text-[10px] text-cyan-300 bg-black/80 px-2 py-1 rounded border border-cyan-500/50 uppercase tracking-widest shadow-lg whitespace-nowrap">
                    {t.common.actions.click_here}
                </span>
            </div>

        </div>
    );
};