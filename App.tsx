
import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider } from './context/GameContext';
import { GameLayout } from './components/layout/GameLayout';

const App: React.FC = () => (
    <LanguageProvider>
      <GameProvider>
        <GameLayout />
      </GameProvider>
    </LanguageProvider>
);

export default App;
