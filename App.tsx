
import React, { useMemo } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider, useGame } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { P2PProvider } from './context/P2PContext';
import { GameLayout } from './components/layout/GameLayout';

const AppContent: React.FC = () => {
  const { gameState } = useGame();
  
  const p2pProps = useMemo(() => ({
    playerName: gameState.playerName,
    playerScore: gameState.empirePoints
  }), [gameState.playerName, gameState.empirePoints]);
  
  return (
    <P2PProvider {...p2pProps}>
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
