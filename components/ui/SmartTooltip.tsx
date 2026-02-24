import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface SmartTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
  placement?: 'top' | 'bottom' | 'right' | 'left';
  triggerMode?: 'click' | 'hover';
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({ 
  content, 
  children, 
  className = '', 
  placement = 'top',
  triggerMode = 'click'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
          setIsVisible(true);
      }, 200);
  }, []);

  const hide = useCallback(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
          setIsVisible(false);
      }, 150); 
  }, []);

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (triggerMode === 'hover') {
          if (isVisible && timeoutRef.current) clearTimeout(timeoutRef.current);
          setIsVisible(false);
          return;
      }
      e.stopPropagation();
      setIsVisible(v => !v);
  }, [triggerMode, isVisible]);

  const updatePosition = useCallback(() => {
     if (!triggerRef.current || !tooltipRef.current) return;
     const triggerRect = triggerRef.current.getBoundingClientRect();
     const tooltipRect = tooltipRef.current.getBoundingClientRect();
     const padding = 10;
     
     let top = 0;
     let left = 0;

     // Logic specifically tuned for "Hover Card" feel
     switch(placement) {
         case 'bottom':
             top = triggerRect.bottom + 10;
             left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
             break;
         case 'right':
             top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
             left = triggerRect.right + 10;
             break;
         case 'left':
             top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
             left = triggerRect.left - tooltipRect.width - 10;
             break;
         case 'top':
         default:
             top = triggerRect.top - tooltipRect.height - 10;
             left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
             break;
     }
     
     // Boundary Detection (Flip logic)
     const winW = window.innerWidth;
     const winH = window.innerHeight;

     // Flip Vertical
     if (top < padding && placement === 'top') top = triggerRect.bottom + 10;
     if (top + tooltipRect.height > winH - padding && placement === 'bottom') top = triggerRect.top - tooltipRect.height - 10;

     // Clamp Horizontal
     if (left < padding) left = padding;
     if (left + tooltipRect.width > winW - padding) left = winW - tooltipRect.width - padding;
     
     setCoords({ top, left });
  }, [placement]);

  useLayoutEffect(() => { if (isVisible) updatePosition(); }, [isVisible, updatePosition, content]);

  useEffect(() => {
    if (!isVisible) return;
    const clickOutside = (e: Event) => {
        if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
            setIsVisible(false);
        }
    };
    
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', clickOutside);
    document.addEventListener('touchstart', clickOutside);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => { 
        window.removeEventListener('resize', updatePosition);
        document.removeEventListener('mousedown', clickOutside); 
        document.removeEventListener('touchstart', clickOutside);
        window.removeEventListener('scroll', updatePosition, true); 
    };
  }, [isVisible, updatePosition]);

  const handlers = triggerMode === 'hover' ? {
      onMouseEnter: show,
      onMouseLeave: hide,
      onTouchStart: show
  } : {
      onClick: handleClick,
      onMouseEnter: undefined,
      onMouseLeave: undefined,
      onTouchStart: undefined
  };

  return (
    <>
      {React.cloneElement(children, {
          ref: triggerRef,
          className: `${(children as any).props.className || ''} ${triggerMode === 'click' ? 'cursor-pointer' : 'cursor-help'}`,
          ...handlers
      } as any)}
      
      {isVisible && createPortal(
        <div 
            ref={tooltipRef} 
            style={{ top: coords.top, left: coords.left }} 
            className={`fixed z-[9999] animate-[fadeIn_0.15s_ease-out] w-max max-w-[85vw] sm:max-w-[320px] ${className}`}
            onMouseEnter={triggerMode === 'hover' ? show : undefined}
            onMouseLeave={triggerMode === 'hover' ? hide : undefined}
        >
           <div className="bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] p-3 text-left relative overflow-hidden ring-1 ring-cyan-500/20">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_#06b6d4]"></div>
              <div className="relative z-10 max-h-[60vh] overflow-y-auto custom-scrollbar overscroll-contain">{content}</div>
           </div>
        </div>, document.body
      )}
    </>
  );
};