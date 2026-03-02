
import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { GameLayout } from './components/layout/GameLayout';

const App: React.FC = () => (
    <LanguageProvider>
      <ToastProvider>
        <GameProvider>
          <GameLayout />
        </GameProvider>
      </ToastProvider>
    </LanguageProvider>
);

export default App;
