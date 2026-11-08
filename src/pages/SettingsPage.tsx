import React, { useState, useEffect } from 'react';
import { api, ApiError, getApiBaseUrl, setApiBaseUrl, CLOUDFLARE_WORKER_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import type { SystemSettings, HealthCheckResponse } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useTheme } from '../lib/theme';
import {
  Settings,
  Server,
  Shield,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sun,
  Moon,
  Laptop,
  User,
  Heart,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { getEffectiveFirebaseConfig } from '../lib/firebase';

type SettingsTab = 'appearance' | 'account' | 'system' | 'security' | 'credits';

export const SettingsPage: React.FC = () => {
  const { isOwner, isAdmin, user, role } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const [settings, setSettings] = useState<SystemSettings>({
    maintenanceMode: false,
    maintenanceMessage: '',
    minAppVersion: '1.0.0',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverEndpointSupported, setServerEndpointSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Worker Health
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);

  // Custom API Base URL override state
  const [customApiUrl, setCustomApiUrl] = useState(getApiBaseUrl());

  const firebaseConfig = getEffectiveFirebaseConfig();

  const loadSettingsAndHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, settingsRes] = await Promise.allSettled([
        api.getHealth(),
        api.getSettings(),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }

      if (settingsRes.status === 'fulfilled') {
        setSettings(settingsRes.value);
        setServerEndpointSupported(true);
      } else {
        const err = settingsRes.reason;
        console.warn('Settings endpoint response:', err);
        if (err instanceof ApiError && err.isEndpointUnimplemented) {
          setServerEndpointSupported(false);
          setError(
            'O Worker retornou 404 para GET /admin/settings. As configurações operacionais são mantidas em memória nesta versão do script.'
          );
        } else {
          setError(err?.message || 'Falha ao recuperar configurações do Worker.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de comunicação de rede');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndHealth();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Permissão Negada', 'Apenas administradores podem atualizar parâmetros do sistema.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setServerEndpointSupported(true);
      toast.success('Configurações salvas e validadas no Worker');
    } catch (err: unknown) {
      console.error('Failed to save settings:', err);
      if (err instanceof ApiError && err.isEndpointUnimplemented) {
        setServerEndpointSupported(false);
        toast.error(
          'Recurso Não Implementado no Worker',
          'PATCH /admin/settings não está implementado na versão atual do Worker. Não é possível persistir.'
        );
      } else {
        const msg = err instanceof ApiError ? err.message : 'Falha ao salvar configurações';
        toast.error('Erro ao salvar', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiUrl = () => {
    setApiBaseUrl(customApiUrl.trim());
    toast.success('URL Base da API atualizada');
    loadSettingsAndHealth();
  };

  const handleResetApiUrl = () => {
    setApiBaseUrl('');
    setCustomApiUrl(CLOUDFLARE_WORKER_URL);
    toast.success('URL restaurada para o Cloudflare Worker v4.0');
    loadSettingsAndHealth();
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Aparência', icon: <Sun className="w-4 h-4" /> },
    { id: 'account', label: 'Conta & Sessão', icon: <User className="w-4 h-4" /> },
    { id: 'system', label: 'Sistema & Worker', icon: <Server className="w-4 h-4" /> },
    { id: 'security', label: 'Segurança & RBAC', icon: <Shield className="w-4 h-4" /> },
    { id: 'credits', label: 'Experiência & Autoria', icon: <Heart className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
            Central de Configurações
          </h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Personalize a aparência, audite a infraestrutura e gerencie os parâmetros do AZOD.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSettingsAndHealth}
          loading={loading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Recarregar
        </Button>
      </div>

      {/* Categorized Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E8E8E8] dark:border-[#252525]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-neutral-200 text-[#111111] dark:bg-[#161616] dark:text-white font-semibold shadow-2xs'
                  : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: APARÊNCIA */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-5 shadow-2xs">
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-white">Tema Visual do Dashboard</h3>
              <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                Escolha entre a experiência de alto contraste escuro (#050505) ou minimalismo claro (#F7F7F7).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Dark Option */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-black dark:border-white ring-1 ring-black dark:ring-white bg-neutral-50 dark:bg-[#161616]'
                    : 'border-[#E8E8E8] dark:border-[#252525] hover:border-neutral-400 bg-white dark:bg-[#090909]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white">
                    <Moon className="w-4 h-4" />
                    <span>Modo Escuro</span>
                  </div>
                  {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-[#050505] border border-[#252525] space-y-1.5">
                  <div className="h-2 w-12 bg-white rounded-full opacity-80" />
                  <div className="h-1.5 w-full bg-[#161616] rounded-full" />
                </div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] font-mono mt-2">
                  Fundo #050505 · Superfície #111111
                </div>
              </button>

              {/* Light Option */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-black dark:border-white ring-1 ring-black dark:ring-white bg-neutral-50 dark:bg-[#161616]'
                    : 'border-[#E8E8E8] dark:border-[#252525] hover:border-neutral-400 bg-white dark:bg-[#090909]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Modo Claro</span>
                  </div>
                  {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-[#F7F7F7] border border-[#E8E8E8] space-y-1.5">
                  <div className="h-2 w-12 bg-[#111111] rounded-full opacity-80" />
                  <div className="h-1.5 w-full bg-white rounded-full" />
                </div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] font-mono mt-2">
                  Fundo #F7F7F7 · Superfície #FFFFFF
                </div>
              </button>

              {/* System Option */}
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'border-black dark:border-white ring-1 ring-black dark:ring-white bg-neutral-50 dark:bg-[#161616]'
                    : 'border-[#E8E8E8] dark:border-[#252525] hover:border-neutral-400 bg-white dark:bg-[#090909]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white">
                    <Laptop className="w-4 h-4" />
                    <span>Seguir Sistema</span>
                  </div>
                  {theme === 'system' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] space-y-1.5">
                  <div className="h-2 w-12 bg-neutral-400 rounded-full" />
                  <div className="h-1.5 w-full bg-neutral-300 dark:bg-neutral-700 rounded-full" />
                </div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] font-mono mt-2">
                  Automático com base no SO
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTA */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-5 shadow-2xs">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white">Conta Administrativa Atual</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">E-mail Conectado</span>
                <span className="text-[#111111] dark:text-white font-semibold mt-1 block truncate">{user?.email}</span>
              </div>

              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Privilégio Ativo</span>
                <span className="text-[#111111] dark:text-white font-semibold mt-1 block">{role || 'ADMIN'}</span>
              </div>

              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Firebase UID</span>
                <span className="text-[#666666] dark:text-neutral-400 mt-1 block truncate select-all">{user?.uid}</span>
              </div>

              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Status da Sessão</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold mt-1 block flex items-center gap-1.5 font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Autenticado & Ativo
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SISTEMA & WORKER */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {serverEndpointSupported === false && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300">Aviso do Endpoint /admin/settings</h4>
                <p className="text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  O Cloudflare Worker conectado ainda não possui o endpoint <code className="font-mono">/admin/settings</code> publicado. Os dados não são mockados localmente e refletirão as respostas reais da API.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-5 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[#E8E8E8] dark:border-[#1C1C1C] pb-3">
                <Settings className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
                <h2 className="text-sm font-semibold text-[#111111] dark:text-white">Operações de Licenciamento</h2>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#161616]/40">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#111111] dark:text-white flex items-center gap-2">
                        <span>Modo de Manutenção</span>
                        {settings.maintenanceMode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666666] dark:text-[#A1A1A1] leading-relaxed max-w-lg">
                        Quando ativo, aplicativos clientes recebem código 503 com mensagem de manutenção ao validar licenças.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={settings.maintenanceMode}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, maintenanceMode: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white dark:peer-checked:after:bg-[#050505]" />
                    </label>
                  </div>

                  <Textarea
                    label="Mensagem de Manutenção"
                    placeholder="O sistema de licenças está passando por manutenção programada. Tente novamente em breve."
                    value={settings.maintenanceMessage}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
                    }
                    rows={2}
                  />

                  <Input
                    label="Versão Mínima do Aplicativo Cliente"
                    placeholder="1.0.0"
                    value={settings.minAppVersion}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, minAppVersion: e.target.value }))
                    }
                  />

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={saving}
                      disabled={serverEndpointSupported === false || !isAdmin}
                      icon={<Save className="w-3.5 h-3.5" />}
                    >
                      Salvar Parâmetros no Worker
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Infrastructure Box */}
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#E8E8E8] dark:border-[#1C1C1C] pb-3">
              <Server className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
              <h2 className="text-sm font-semibold text-[#111111] dark:text-white">Conexão da API</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Cloudflare Worker API</span>
                <div className="text-[#111111] dark:text-white mt-1 break-all text-xs font-semibold">
                  https://dashboard-proxy-api.gabrieldacechen6.workers.dev
                </div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-2 flex items-center gap-1.5 font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Status: {health?.status || 'Online'} (v{health?.version || '4.0.0'})</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Firebase Auth</span>
                <div className="text-[#111111] dark:text-white mt-1 font-semibold">{firebaseConfig.projectId}</div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-2 flex items-center gap-1.5 font-sans">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Domínio: {firebaseConfig.authDomain}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5 font-sans">
                <span className="text-xs font-medium text-[#111111] dark:text-neutral-200">
                  Rota Base da API (Endpoint Ativo)
                </span>
                <button
                  type="button"
                  onClick={handleResetApiUrl}
                  className="text-[11px] text-[#666666] hover:text-black dark:text-[#A1A1A1] dark:hover:text-white underline cursor-pointer"
                >
                  Restaurar Cloudflare Worker Padrão
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="https://..."
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleSaveApiUrl}>
                  Atualizar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SEGURANÇA & RBAC */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-5 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#E8E8E8] dark:border-[#1C1C1C] pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-[#111111] dark:text-white">Arquitetura de Segurança</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-[#666666] dark:text-[#A1A1A1]">
              <div className="p-4 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#161616]/40 space-y-2">
                <h4 className="font-semibold text-[#111111] dark:text-white font-sans text-xs flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Autenticação Token Bearer
                </h4>
                <p>
                  Todas as requisições autenticadas enviam o Firebase ID Token no cabeçalho <code className="text-[#111111] dark:text-white font-mono">Authorization: Bearer &lt;token&gt;</code>. O Cloudflare Worker valida a assinatura e aplica regras de segurança.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#161616]/40 space-y-2">
                <h4 className="font-semibold text-[#111111] dark:text-white font-sans text-xs">
                  Hierarquia de Cargos (RBAC)
                </h4>
                <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                  <li><strong className="text-[#111111] dark:text-white">OWNER:</strong> Controle irrestrito, criação/exclusão de administradores e mutações.</li>
                  <li><strong className="text-[#111111] dark:text-white">ADMIN:</strong> Emissão, renovação, suspensão e desvinculação de licenças de hardware.</li>
                  <li><strong className="text-[#111111] dark:text-white">SUPPORT:</strong> Acesso estritamente somente-leitura para consultas e suporte.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: EXPERIÊNCIA & AUTORIA (CRÉDITOS OBRIGATÓRIOS) */}
      {activeTab === 'credits' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-8 space-y-6 text-center shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-[#050505] flex items-center justify-center font-bold text-xl mx-auto tracking-widest shadow-md">
              AZOD
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight">
                AZOD Software License Manager
              </h2>
              <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1 font-mono">
                Plataforma Administrativa de Licenciamento & Bind de Hardware · v4.0.0
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-xl bg-neutral-50 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] space-y-1">
              <div className="text-xs text-[#888888] dark:text-[#707070] uppercase font-mono tracking-wider">
                Créditos de Engenharia & Criação
              </div>
              <div className="text-base font-bold text-[#111111] dark:text-white tracking-tight">
                Todos os créditos de criação para Pajé DEV
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-left max-w-lg mx-auto pt-2">
              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909]">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Engine Edge</span>
                <span className="text-[#111111] dark:text-white font-semibold mt-0.5 block">Cloudflare v4.0</span>
              </div>
              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909]">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Armazenamento</span>
                <span className="text-[#111111] dark:text-white font-semibold mt-0.5 block">Google Firestore</span>
              </div>
              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909]">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Identidade</span>
                <span className="text-[#111111] dark:text-white font-semibold mt-0.5 block">Firebase Auth</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
