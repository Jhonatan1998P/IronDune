
import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider, useGame } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { P2PProvider } from './context/P2PContext';
import { GameLayout } from './components/layout/GameLayout';

const AppContent: React.FC = () => {
  return (
    <GameLayout />
  );
};

const App: React.FC = () => {
  const { gameState } = useGame();
  
  return (
    <LanguageProvider>
      <ToastProvider>
        <GameProvider>
          <P2PProvider playerName={gameState.playerName} playerScore={gameState.empirePoints}>
            <AppContent />
          </P2PProvider>
        </GameProvider>
      </ToastProvider>
    </LanguageProvider>
  );
};

export default App;