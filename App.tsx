
import React, { useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { GameProvider } from './context/GameContext';
import { ToastProvider } from './components/ui/Toast';
import { MultiplayerProvider } from './hooks/useMultiplayer';
import { GameLayout } from './components/layout/GameLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { TimeSyncService } from './lib/timeSync';

/**
 * AppContent - Componente principal del juego
 */
const AppContent: React.FC = () => {
  const { session, loading } = useAuth();

  useEffect(() => {
    // Synchronize time with server on mount
    TimeSyncService.sync();
    
    // Periodically re-sync every 5 minutes to prevent drift
    const syncInterval = setInterval(() => {
      TimeSyncService.sync();
    }, 5 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-tech">
        <div className="text-cyan-500 animate-pulse tracking-[0.3em] uppercase">
          Establishing Secure Link...
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return <GameLayout />;
};

/**
 * App - Árbol de Providers
 */
const App: React.FC = () => (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <MultiplayerProvider>
            <GameProvider>
              <AppContent />
            </GameProvider>
          </MultiplayerProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
);

export default App;
