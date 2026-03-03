
import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { MultiplayerProvider } from './hooks/useMultiplayer';
import { GameLayout } from './components/layout/GameLayout';

/**
 * AppContent - Componente principal del juego
 * 
 * NOTA: MultiplayerProvider está OUTSIDE de GameProvider para evitar
 * que se desmonte con cada actualización del gameState.
 * 
 * Las conexiones WebRTC (Trystero) deben mantenerse estables y solo
 * limpiarse cuando el usuario sale explícitamente de la sala.
 */
const AppContent: React.FC = () => {
  return <GameLayout />;
};

/**
 * App - Árbol de Providers
 * 
 * Orden CRÍTICO:
 * 1. MultiplayerProvider (más externo - no depende del juego)
 * 2. GameProvider (interno - se re-renderiza con el estado)
 * 
 * Esto previene que las conexiones P2P se interrumpan con cada update.
 */
const App: React.FC = () => (
    <LanguageProvider>
      <ToastProvider>
        <MultiplayerProvider>
          <GameProvider>
            <AppContent />
          </GameProvider>
        </MultiplayerProvider>
      </ToastProvider>
    </LanguageProvider>
);

export default App;
