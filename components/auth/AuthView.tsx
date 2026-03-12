
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GlassButton } from '../ui/GlassButton';
import { useLanguage } from '../../context/LanguageContext';
import { Shield, Mail, Lock, UserPlus, LogIn, AlertTriangle } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Supabase signUp might not auto-login depending on config
      }
    } catch (err: any) {
      setError(err.message || t.common.auth.error_auth_failed);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-metal-300 p-6 font-tech">
        <div className="max-w-md w-full p-8 rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-xl space-y-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold text-red-400 uppercase tracking-widest">
            {t.common.auth.setup_required}
          </h1>
          <p className="text-sm text-metal-400">
            Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
          </p>
          <div className="p-4 bg-black/40 rounded border border-white/5 text-left text-xs font-mono overflow-auto">
            <p className="text-metal-500 mb-2"># .env</p>
            <p>VITE_SUPABASE_URL=your_url</p>
            <p>VITE_SUPABASE_ANON_KEY=your_key</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-metal-300 p-6 font-tech relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-md w-full p-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl space-y-8 relative z-10 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-block p-4 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.2em]">
            IRON DUNE
          </h1>
          <p className="text-cyan-500/60 text-xs tracking-widest uppercase">
            {t.common.ui.app_subtitle}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-metal-400 ml-1">
                {t.common.auth.email}
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-metal-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-metal-700"
                  placeholder="commander@sector-7.io"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-metal-400 ml-1">
                {t.common.auth.password}
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-metal-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-metal-700"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-shake">
              {error}
            </div>
          )}

          <GlassButton
            type="submit"
            variant="primary"
            className="w-full py-4 text-sm font-bold shadow-lg"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {t.common.auth.loading}
              </span>
            ) : isLogin ? (
              <span className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                {t.common.auth.login_btn}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                {t.common.auth.register_btn}
              </span>
            )}
          </GlassButton>
        </form>

        <div className="text-center pt-4 border-t border-white/5">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-metal-500 hover:text-cyan-400 transition-colors uppercase tracking-widest"
          >
            {isLogin ? t.common.auth.no_account : t.common.auth.already_have_account}
          </button>
        </div>
      </div>

      <div className="mt-8 text-[10px] text-metal-600 uppercase tracking-[0.3em]">
        Secure Tactical Link v1.0 // Supabase Encrypted
      </div>
    </div>
  );
};
