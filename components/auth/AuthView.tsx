
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { GlassButton } from '../ui/GlassButton';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../ui/Toast';
import { Shield, Mail, Lock, UserPlus, LogIn, AlertTriangle, WifiOff, Database, User, ChevronDown } from 'lucide-react';
import { APP_VERSION, AVAILABLE_FLAGS } from '../../constants';
import { getFlagEmoji } from '../../utils/engine/rankings';

export const AuthView: React.FC = () => {
  const { t } = useLanguage();
  const { showError, showSuccess, showWarning } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('US');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validar conexión inicial
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
          // Si hay error de base de datos pero no es "no encontrado"
          console.error('DB Connection error:', error);
          showError(t.common.auth.db_connection_error || 'Error de conexión con la base de datos');
        }
      } catch (err) {
        showError(t.common.auth.server_connection_error || 'Error de conexión con el servidor');
      }
    };
    checkConnection();
  }, [showError, t]);

  const validatePassword = (pass: string) => {
    if (pass.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
    if (!/\d/.test(pass)) {
      return "La contraseña debe incluir al menos un número";
    }
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const passwordError = validatePassword(password);
    if (!isLogin && passwordError) {
      showWarning(passwordError);
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            showError("Credenciales inválidas. Verifica tu correo y contraseña.");
          } else if (error.message.includes('network') || error.status === 0) {
            showError("Fallo de conexión con el servidor. Reintenta en unos momentos.");
          } else {
            showError(error.message);
          }
          throw error;
        }
        showSuccess("Conexión establecida. Bienvenido, Comandante.");
      } else {
        // Registro con metadatos
        if (!username.trim() || username.length < 3) {
          showWarning("El nombre de usuario debe tener al menos 3 caracteres");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              username: username.trim(),
              flag: selectedFlag
            }
          }
        });
        
        if (error) {
          showError(error.message);
          throw error;
        }
        showSuccess("Registro completado. Revisa tu correo para confirmar la cuenta.");
      }
    } catch (err: any) {
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 p-6 font-tech">
        <div className="max-w-md w-full p-8 rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-xl space-y-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold text-red-400 uppercase tracking-widest">
            {t.common.auth.setup_required}
          </h1>
          <p className="text-sm text-slate-400">
            Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
          </p>
          <div className="p-4 bg-slate-900/50 rounded border border-white/5 text-left text-xs font-mono overflow-auto">
            <p className="text-slate-500 mb-2"># .env</p>
            <p>VITE_SUPABASE_URL=your_url</p>
            <p>VITE_SUPABASE_ANON_KEY=your_key</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 p-6 font-tech relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-10 animate-pulse-slow"></div>
        <div className="scanlines opacity-40"></div>
      </div>

      <div className="max-w-md w-full p-8 rounded-xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl space-y-8 relative z-10 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        <div className="text-center space-y-2">
          <div className="relative inline-block p-4 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4 group">
            <div className="absolute inset-0 bg-cyan-500/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Shield className="relative w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            IRON DUNE
          </h1>
          <p className="text-cyan-400/60 text-[10px] tracking-[0.3em] uppercase">
            {t.common.ui.app_subtitle}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 ml-1 font-mono">
                    {t.common.auth.username || 'Username'}
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-800 text-cyan-50"
                      placeholder="Commander Name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 ml-1 font-mono">
                    {t.common.auth.flag || 'Alliance Flag'}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowFlagPicker(!showFlagPicker)}
                      className="w-full flex items-center justify-between bg-slate-950/50 border border-white/10 rounded-lg py-3 px-4 text-sm hover:border-cyan-500/30 transition-all text-cyan-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none">{getFlagEmoji(selectedFlag)}</span>
                        <span className="font-mono tracking-widest">{selectedFlag}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showFlagPicker ? 'rotate-180' : ''}`} />
                    </button>

                    {showFlagPicker && (
                      <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-slate-900 border border-cyan-500/30 rounded-xl grid grid-cols-6 gap-2 z-50 max-h-48 overflow-y-auto custom-scrollbar shadow-2xl animate-in fade-in slide-in-from-top-2">
                        {AVAILABLE_FLAGS.map((flag) => (
                          <button
                            key={flag}
                            type="button"
                            onClick={() => {
                              setSelectedFlag(flag);
                              setShowFlagPicker(false);
                            }}
                            className={`flex flex-col items-center p-2 rounded-lg hover:bg-cyan-500/10 transition-colors ${selectedFlag === flag ? 'bg-cyan-500/20 border border-cyan-500/40' : ''}`}
                          >
                            <span className="text-xl">{getFlagEmoji(flag)}</span>
                            <span className="text-[8px] text-slate-500 mt-1">{flag}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 ml-1 font-mono">
                {t.common.auth.email}
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-800 text-cyan-50"
                  placeholder="commander@sector-7.io"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 ml-1 font-mono">
                {t.common.auth.password}
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-800 text-cyan-50"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            className="w-full py-4 text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {t.common.auth.loading}
              </span>
            ) : isLogin ? (
              <span className="flex items-center gap-2 tracking-[0.1em]">
                <LogIn className="w-4 h-4" />
                {t.common.auth.login_btn}
              </span>
            ) : (
              <span className="flex items-center gap-2 tracking-[0.1em]">
                <UserPlus className="w-4 h-4" />
                {t.common.auth.register_btn}
              </span>
            )}
          </GlassButton>
        </form>

        <div className="text-center pt-4 border-t border-white/5 space-y-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] font-mono"
          >
            {isLogin ? t.common.auth.no_account : t.common.auth.already_have_account}
          </button>
          
          <div className="flex items-center justify-center gap-4 pt-2 opacity-20">
             <WifiOff className="w-4 h-4 text-slate-400" />
             <Database className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="mt-8 text-[9px] text-slate-700 font-mono tracking-[0.4em] uppercase">
        Secure Tactical Link {APP_VERSION} // Supabase AES-256
      </div>
    </div>
  );
};
