
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GlassButton } from '../ui/GlassButton';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../ui/Toast';
import { Shield, Mail, Lock, UserPlus, LogIn, AlertTriangle, User } from 'lucide-react';
import { APP_VERSION } from '../../constants';

export const AuthView: React.FC = () => {
  const { t } = useLanguage();
  const { showError, showSuccess, showWarning, showInfo } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (): string | null => {
    if (!email.trim()) return 'El correo electrónico es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Correo electrónico inválido.';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
    if (!isLogin) {
      const uname = username.trim();
      if (!uname) return 'El nombre de comandante es obligatorio.';
      if (uname.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
      if (uname.length > 20) return 'El nombre no puede superar los 20 caracteres.';
      if (!/^[a-zA-Z0-9_]+$/.test(uname)) return 'Solo letras, números y guión bajo (_).';
    }
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      showWarning(validationError);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // ── LOGIN ──────────────────────────────────────────────────────────────
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            showError('Credenciales inválidas. Verifica tu correo y contraseña.');
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            showWarning('Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.');
          } else {
            showError(error.message);
          }
          return;
        }
        showSuccess('Conexión establecida. Bienvenido, Comandante.');
      } else {
        // ── REGISTRO ───────────────────────────────────────────────────────────
        const uname = username.trim();

        // Comprobar si el username ya existe
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', uname)
          .maybeSingle();

        if (existingProfile) {
          showError('Ese nombre de comandante ya está en uso. Elige otro.');
          return;
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          showError(error.message);
          return;
        }

        if (data.user) {
          // Crear perfil inmediatamente
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username: uname,
            role: 'user',
            empire_points: 0,
            game_state: {},
            updated_at: new Date().toISOString(),
          });

          if (profileError) {
            console.error('[Auth] Error creando perfil:', profileError);
            // No bloquear el flujo — el perfil se puede crear al guardar el juego
          }

          // Crear registro de economía inicial
          await supabase.from('player_economy').insert({
            player_id: data.user.id,
            money: 10000,
            oil: 5000,
            ammo: 2000,
            gold: 0,
            diamond: 0,
            bank_balance: 0,
            last_calc_time: Date.now(),
          }).then(({ error: eErr }) => {
            if (eErr) console.warn('[Auth] Error creando economía inicial:', eErr);
          });

          if (data.session) {
            // Si no requiere confirmación de email → sesión directa
            showSuccess(`¡Bienvenido al campo de batalla, ${uname}!`);
          } else {
            // Requiere confirmación de email
            showInfo('Registro completado. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.');
            setIsLogin(true);
          }
        }
      }
    } catch (err: any) {
      console.error('[Auth] Error inesperado:', err);
      showError('Error de conexión con el servidor. Reintenta en unos momentos.');
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
            Configuración requerida
          </h1>
          <p className="text-sm text-slate-400">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 p-6 font-tech relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-10 animate-pulse-slow" />
        <div className="scanlines opacity-40" />
      </div>

      <div className="max-w-md w-full p-8 rounded-xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl space-y-8 relative z-10 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="relative inline-block p-4 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4 group">
            <div className="absolute inset-0 bg-cyan-500/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <Shield className="relative w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            IRON DUNE
          </h1>
          <p className="text-cyan-400/60 text-[10px] tracking-[0.3em] uppercase">
            {t.common.ui.app_subtitle}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleAuth} className="space-y-4">
          {/* Username (solo en registro) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 ml-1 font-mono">
                Nombre de Comandante
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  required={!isLogin}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-700 text-cyan-50"
                  placeholder="iron_commander"
                  maxLength={20}
                />
              </div>
              <p className="text-[9px] text-slate-600 ml-1">Solo letras, números y _ (3-20 caracteres)</p>
            </div>
          )}

          {/* Email */}
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
                autoComplete="email"
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-700 text-cyan-50"
                placeholder="commander@sector-7.io"
              />
            </div>
          </div>

          {/* Contraseña */}
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
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-slate-700 text-cyan-50"
                placeholder="••••••••"
              />
            </div>
            {!isLogin && (
              <p className="text-[9px] text-slate-600 ml-1">Mínimo 6 caracteres con al menos un número</p>
            )}
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            className="w-full py-4 text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all mt-2"
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

        {/* Cambiar modo */}
        <div className="text-center pt-2 border-t border-white/5">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setUsername('');
            }}
            className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] font-mono"
          >
            {isLogin ? t.common.auth.no_account : t.common.auth.already_have_account}
          </button>
        </div>
      </div>

      <div className="mt-8 text-[9px] text-slate-700 font-mono tracking-[0.4em] uppercase">
        Secure Tactical Link {APP_VERSION} // Supabase AES-256
      </div>
    </div>
  );
};
