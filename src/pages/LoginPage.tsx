import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { saveLocalFirebaseConfig, getEffectiveFirebaseConfig } from '../lib/firebase';
import { ShieldCheck, Lock, Mail, Key, AlertCircle, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export const LoginPage: React.FC = () => {
  const { login, error, clearError, isFirebaseConfigured, recheckFirebaseConfig } = useAuth();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(!isFirebaseConfigured);

  // Configuration fields for Firebase public credentials if missing in env
  const effectiveConfig = getEffectiveFirebaseConfig();
  const [apiKeyInput, setApiKeyInput] = useState(effectiveConfig.apiKey || '');
  const [appIdInput, setAppIdInput] = useState(effectiveConfig.appId || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await login(email, password);
    } catch {
      // Error is set in auth context
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    saveLocalFirebaseConfig(apiKeyInput.trim(), appIdInput.trim());
    recheckFirebaseConfig();
    setShowConfig(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#050505] text-[#111111] dark:text-[#FFFFFF] flex flex-col justify-center items-center p-4 antialiased transition-colors duration-150 relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white transition-colors"
          title="Alternar Tema"
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

        {/* Login Box */}
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

          {!isFirebaseConfigured && (
            <div className="mb-5 p-3.5 bg-neutral-50 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#111111] dark:text-white">
                <Settings className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
                Configuração Firebase Necessária
              </div>
              <p className="text-[#666666] dark:text-[#A1A1A1] leading-relaxed text-[11px]">
                Para autenticar administradores no projeto <span className="font-mono text-[#111111] dark:text-white">dashboard-proxy-menu</span>, informe a chave de API pública do Firebase.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs mt-1"
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? 'Ocultar Formulário' : 'Configurar Chave do Firebase'}
              </Button>
            </div>
          )}

          {showConfig ? (
            <form onSubmit={handleSaveConfig} className="space-y-4 mb-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
              <div className="text-xs font-semibold text-[#111111] dark:text-white pb-1">
                Configuração Web do Firebase
              </div>
              <Input
                label="Chave de API Web (VITE_FIREBASE_API_KEY)"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                required
                leftIcon={<Key className="w-4 h-4" />}
                helperText="Localizada no Console Firebase > Configurações do Projeto"
              />
              <Input
                label="ID do Aplicativo (Opcional)"
                placeholder="1:123456789:web:abcdef"
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
              />
              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" size="sm" type="submit" className="w-full">
                  Salvar Configuração
                </Button>
              </div>
            </form>
          ) : null}

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
              disabled={!isFirebaseConfigured && !apiKeyInput}
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
          <div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-[#666666] hover:text-[#111111] dark:text-[#A1A1A1] dark:hover:text-white transition-colors text-[11px] font-mono underline"
            >
              {showConfig ? 'Fechar Configuração' : 'Configurações de Conexão Firebase'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-[#888888] dark:text-[#707070]">
            Todos os créditos de criação para <strong className="text-[#111111] dark:text-white">Pajé DEV</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
