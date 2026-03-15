
import { useEffect, useRef } from 'react';
import { gameEventBus } from '../utils/eventBus';
import { GameEventType, GameEventCallback } from '../types/events';

/**
 * Hook para suscribirse a eventos globales dentro de componentes React.
 * Maneja automáticamente la limpieza (unsubscribe) al desmontar el componente.
 */
export function useEventSubscription<T extends GameEventType>(
  event: T,
  callback: GameEventCallback<T>
) {
  // Usamos useRef para mantener la referencia al callback más reciente
  // sin forzar que el efecto se reinicie si el callback cambia (patrón común en event listeners)
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: GameEventCallback<T> = (payload) => {
      if (callbackRef.current) {
        callbackRef.current(payload);
      }
    };

    gameEventBus.on(event, handler);

    return () => {
      gameEventBus.off(event, handler);
    };
  }, [event]);
}
