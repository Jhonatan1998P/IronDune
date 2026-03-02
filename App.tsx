
import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider, useGame } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { P2PProvider } from './context/P2PContext';
import { GameLayout } from './components/layout/GameLayout';

const AppContent: React.FC = () => {
  const { gameState } = useGame();
  
  return (
    <P2PProvider playerName={gameState.playerName} playerScore={gameState.empirePoints}>
      <GameLayout />
    </P2PProvider>
  );
};

const App: React.FC = () => (
    <LanguageProvider>
      <ToastProvider>
        <GameProvider>
          <AppContent />
        </GameProvider>
      </ToastProvider>
    </LanguageProvider>
);

export default App;