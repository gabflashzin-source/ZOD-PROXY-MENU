import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldCheck, Lock, Mail, AlertCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export const LoginPage: React.FC = () => {
  const { login, error, clearError } = useAuth();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await login(email, password);
    } catch {
      // Error is caught and surfaced via auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#050505] text-[#111111] dark:text-[#FFFFFF] flex flex-col justify-center items-center p-4 antialiased transition-colors duration-150 relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
          title="Alternar Tema"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#111111] dark:bg-white text-white dark:text-[#050505] font-bold text-base mb-3 tracking-widest shadow-md">
            AZOD
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">AZOD Manager</h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1 font-mono">
            Acesso Administrativo · Projeto <span className="font-semibold text-[#111111] dark:text-neutral-200">dashboard-proxy-menu</span>
          </p>
        </div>

        {/* Direct Login Card */}
        <div className="bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-2xl p-6 shadow-xl backdrop-blur-xs">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="leading-relaxed block">{error}</span>
                <button
                  onClick={clearError}
                  className="mt-1 text-[11px] underline text-red-500 hover:text-red-700 dark:hover:text-red-300"
                >
                  Dispensar
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail Administrativo"
              type="email"
              placeholder="admin@azod.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Senha de Acesso"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              Entrar no Dashboard
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#E8E8E8] dark:border-[#1C1C1C] text-center">
            <p className="text-[11px] text-[#888888] dark:text-[#707070] font-mono">
              Protegido por Firebase Auth & Cloudflare Worker v4.0
            </p>
          </div>
        </div>

        {/* Footer info & credits */}
        <div className="mt-6 text-center space-y-2">
          <div className="text-[11px] font-mono text-[#888888] dark:text-[#707070]">
            Todos os créditos de criação para <strong className="text-[#111111] dark:text-white">Pajé DEV</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
