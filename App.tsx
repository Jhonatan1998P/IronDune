
import React, { useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast';
import { MultiplayerProvider } from './hooks/useMultiplayer';
import { GameLayout } from './components/layout/GameLayout';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './components/auth/AuthView';
import { TimeSyncService } from './lib/timeSync';
import { GameBootstrap } from './stores/gameBootstrap';

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
  <ToastProvider>
    <MultiplayerProvider>
      <GameBootstrap>
        <AppContent />
      </GameBootstrap>
    </MultiplayerProvider>
  </ToastProvider>
);

export default App;
