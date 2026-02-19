
import { GameEventType, GameEventPayloads, GameEventCallback } from '../types/events';

/**
 * Singleton Event Bus para desacoplar la lógica del juego de la UI.
 * Permite que módulos aislados se comuniquen sin dependencias directas.
 */
class EventBus {
  private listeners: Map<GameEventType, Set<GameEventCallback<any>>> = new Map();

  /**
   * Suscribe una función a un evento específico.
   */
  public on<T extends GameEventType>(event: T, callback: GameEventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Desuscribe una función de un evento.
   */
  public off<T extends GameEventType>(event: T, callback: GameEventCallback<T>): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * Emite un evento a todos los suscriptores.
   * La ejecución es síncrona para asegurar consistencia de estado,
   * pero los errores en los listeners son capturados para no romper el loop.
   */
  public emit<T extends GameEventType>(event: T, payload: GameEventPayloads[T]): void {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event)!.forEach(callback => {
      try {
        callback(payload);
      } catch (e) {
        console.error(`[EventBus] Error handling event ${event}:`, e);
      }
    });
  }

  /**
   * Limpia todos los listeners (Útil para reinicio total o tests)
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export const gameEventBus = new EventBus();
