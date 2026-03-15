
import React, { useState, useEffect } from 'react';
import { resourceStore } from '../../store/ResourceStore';

interface Props {
  endTime: number;
  onComplete?: () => void;
  format?: 'short' | 'long';
  className?: string;
}

/**
 * CountdownTimer — Componente de alta precisión para tiempos de juego.
 * Sincronizado con el tiempo del servidor mediante resourceStore.
 */
export const CountdownTimer: React.FC<Props> = ({ 
    endTime, 
    onComplete, 
    format = 'long', 
    className = "" 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(Math.max(0, endTime - resourceStore.getServerTime()));

  useEffect(() => {
    const remaining = endTime - resourceStore.getServerTime();
    if (remaining <= 0) {
        setTimeLeft(0);
        onComplete?.();
        return;
    }

    setTimeLeft(remaining);

    const timer = setInterval(() => {
      const now = resourceStore.getServerTime();
      const diff = endTime - now;
      
      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        onComplete?.();
      } else {
        setTimeLeft(diff);
      }
    }, 1000); // 1s es suficiente para timers de construcción

    return () => clearInterval(timer);
  }, [endTime, onComplete]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (format === 'short') {
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (timeLeft <= 0) {
      return <span className={`font-mono text-green-400 ${className}`}>Completado</span>;
  }

  return (
    <span className={`font-mono text-amber-400 ${className}`}>
      {formatTime(timeLeft)}
    </span>
  );
};
