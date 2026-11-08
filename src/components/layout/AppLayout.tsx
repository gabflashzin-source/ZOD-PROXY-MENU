import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Smartphone,
  ScrollText,
  Users,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  RefreshCw,
  Server,
  Activity,
  Sun,
  Moon,
  Laptop,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useTheme, ThemeMode } from '../../lib/theme';

export type ActiveTab = 'overview' | 'licenses' | 'devices' | 'audit' | 'admins' | 'settings' | 'profile';

interface AppLayoutProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab, detailId?: string) => void;
  onOpenCreateLicense?: () => void;
  children: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[];
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onNavigate,
  onOpenCreateLicense,
  children,
}) => {
  const { user, role, logout, canMutate } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('azod_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('azod_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [apiVersion, setApiVersion] = useState<string>('4.0.0');
  const [pinging, setPinging] = useState(false);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const checkWorkerHealth = async () => {
    setPinging(true);
    try {
      const res = await api.getHealth();
      setApiOnline(res.success !== false);
      if (res.version) setApiVersion(res.version);
    } catch {
      setApiOnline(false);
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    checkWorkerHealth();
    const interval = setInterval(checkWorkerHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const navGroups: NavGroup[] = [
    {
      label: 'Visão Geral',
      items: [
        { id: 'overview', label: 'Painel Geral', icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Gestão Central',
      items: [
        { id: 'licenses', label: 'Licenças de Software', icon: <KeyRound className="w-4 h-4" /> },
        { id: 'devices', label: 'Dispositivos & HWID', icon: <Smartphone className="w-4 h-4" /> },
        { id: 'audit', label: 'Auditoria & Logs', icon: <ScrollText className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Administração',
      items: [
        { id: 'admins', label: 'Administradores', icon: <Users className="w-4 h-4" /> },
        { id: 'settings', label: 'Configurações', icon: <Settings className="w-4 h-4" /> },
        { id: 'profile', label: 'Perfil de Acesso', icon: <User className="w-4 h-4" /> },
      ],
    },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onNavigate(tab);
    setMobileMenuOpen(false);
  };

  const getBreadcrumbLabel = (tab: ActiveTab) => {
    switch (tab) {
      case 'overview':
        return { category: 'Visão Geral', page: 'Painel Geral' };
      case 'licenses':
        return { category: 'Gestão Central', page: 'Licenças' };
      case 'devices':
        return { category: 'Gestão Central', page: 'Dispositivos' };
      case 'audit':
        return { category: 'Gestão Central', page: 'Auditoria' };
      case 'admins':
        return { category: 'Administração', page: 'Administradores' };
      case 'settings':
        return { category: 'Administração', page: 'Configurações' };
      case 'profile':
        return { category: 'Administração', page: 'Meu Perfil' };
    }
  };

  const breadcrumb = getBreadcrumbLabel(activeTab);

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#050505] text-[#111111] dark:text-[#FFFFFF] flex flex-col md:flex-row antialiased transition-colors duration-150">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shrink-0 select-none transition-all duration-200 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E8E8E8] dark:border-[#252525]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#111111] dark:bg-white text-white dark:text-[#050505] flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-xs">
              AZOD
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-sm tracking-tight text-[#111111] dark:text-white block leading-none truncate">
                  AZOD Manager
                </span>
                <span className="text-[10px] text-[#888888] dark:text-[#707070] font-mono tracking-tight mt-1 block truncate">
                  v{apiVersion} · CF Worker v4.0
                </span>
              </div>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            className="text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Action Button */}
        {!sidebarCollapsed ? (
          <div className="p-3 border-b border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs"
              onClick={onOpenCreateLicense}
              disabled={!canMutate}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Criar Key
            </Button>
          </div>
        ) : (
          <div className="p-2 border-b border-[#E8E8E8] dark:border-[#252525] flex justify-center">
            <button
              onClick={onOpenCreateLicense}
              disabled={!canMutate}
              className="w-10 h-10 rounded-lg bg-[#111111] text-white hover:bg-[#252525] dark:bg-white dark:text-[#050505] dark:hover:bg-neutral-200 flex items-center justify-center transition-colors disabled:opacity-40"
              title="Criar Key"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Categories */}
        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#888888] dark:text-[#707070] font-mono">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                    } text-xs font-medium rounded-lg transition-all text-left ${
                      isActive
                        ? 'bg-neutral-200/70 text-[#111111] dark:bg-[#161616] dark:text-white font-semibold border border-neutral-300 dark:border-[#252525] shadow-2xs'
                        : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className={isActive ? 'text-[#111111] dark:text-white' : 'text-[#888888] dark:text-[#707070]'}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Worker Connectivity Card */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#090909]">
            <div className="p-2.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-white dark:bg-[#111111] space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#666666] dark:text-[#A1A1A1] flex items-center gap-1.5 font-mono">
                  <Server className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                  API Worker
                </span>
                <button
                  onClick={checkWorkerHealth}
                  className="text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white p-0.5 transition-colors"
                  title="Testar Conexão com Worker"
                  aria-label="Refresh API health"
                >
                  <RefreshCw className={`w-3 h-3 ${pinging ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full ${
                    apiOnline === true
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : apiOnline === false
                      ? 'bg-red-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="text-[#111111] dark:text-neutral-300 font-medium">
                  {apiOnline === true ? 'Conectado · Online' : apiOnline === false ? 'Inacessível' : 'Verificando...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* User Account / Profile */}
        <div className="p-3 border-t border-[#E8E8E8] dark:border-[#252525] flex items-center justify-between gap-2">
          {!sidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#111111] dark:text-white truncate font-mono">
                {user?.email || 'admin@azod'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-[#888888] dark:text-[#A1A1A1] font-mono uppercase tracking-wider">
                  Cargo:
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#161616] text-[#111111] dark:text-neutral-200 border border-[#E8E8E8] dark:border-[#252525]">
                  {role || 'ADMIN'}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] flex items-center justify-center text-xs font-bold font-mono">
                {(user?.email?.[0] || 'A').toUpperCase()}
              </div>
            </div>
          )}

          {!sidebarCollapsed && (
            <button
              onClick={logout}
              className="text-[#888888] hover:text-red-600 dark:text-[#707070] dark:hover:text-red-400 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Encerrar Sessão"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Obligatory Creator Credits Footer */}
        {!sidebarCollapsed && (
          <div className="px-3 py-2.5 border-t border-[#E8E8E8] dark:border-[#252525] bg-neutral-100/50 dark:bg-[#070707] text-center">
            <span className="text-[10px] font-mono tracking-tight text-[#666666] dark:text-[#A1A1A1] block">
              Todos os créditos de criação para <span className="font-semibold text-[#111111] dark:text-white">Pajé DEV</span>
            </span>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar: Breadcrumbs + Worker indicator + Theme switcher + Role + Quick action */}
        <header className="h-14 px-4 md:px-8 border-b border-[#E8E8E8] dark:border-[#252525] flex items-center justify-between gap-4 bg-white/90 dark:bg-[#050505]/90 backdrop-blur-md sticky top-0 z-30">
          {/* Left Zone: Breadcrumb hierarchy */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-[#666666] hover:text-[#111111] dark:text-[#A1A1A1] dark:hover:text-white p-1.5 -ml-1 rounded-md"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[#888888] dark:text-[#707070] min-w-0">
              <span className="font-mono font-bold text-[#111111] dark:text-white tracking-wider shrink-0">AZOD</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40 hidden sm:inline" />
              <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider shrink-0">
                {breadcrumb.category}
              </span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
              <span className="text-[#111111] dark:text-white font-semibold font-mono text-[11px] uppercase tracking-wider truncate">
                {breadcrumb.page}
              </span>
            </div>
          </div>

          {/* Right Zone: Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Live API Health dot in topbar */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] text-[11px] font-mono text-[#666666] dark:text-[#A1A1A1]"
              title={`Worker API v${apiVersion}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiOnline === true ? 'bg-emerald-500' : apiOnline === false ? 'bg-red-500' : 'bg-amber-500'
                }`}
              />
              <span>Worker v{apiVersion}</span>
            </div>

            {/* Theme Toggle Segmented Switcher */}
            <div className="flex items-center bg-neutral-100 dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg p-0.5">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white'
                }`}
                title="Modo Claro"
                aria-label="Switch to light theme"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#161616] text-white shadow-2xs font-semibold'
                    : 'text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white'
                }`}
                title="Modo Escuro"
                aria-label="Switch to dark theme"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('special')}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === 'special'
                    ? 'bg-[#FF2E93] text-white shadow-[0_0_10px_rgba(255,46,147,0.45)] font-semibold'
                    : 'text-[#888888] hover:text-[#FF2E93] dark:text-[#707070] dark:hover:text-[#FF2E93]'
                }`}
                title="Tema Especial (Rosa, Preto & Branco)"
                aria-label="Switch to special theme"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-md transition-colors hidden sm:block ${
                  theme === 'system'
                    ? 'bg-white dark:bg-[#161616] text-[#111111] dark:text-white shadow-2xs font-semibold'
                    : 'text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white'
                }`}
                title="Seguir Sistema"
                aria-label="Switch to system theme"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role indicator badge */}
            {role && (
              <span className="hidden md:inline-block text-[11px] font-mono text-[#111111] dark:text-neutral-200 border border-[#E8E8E8] dark:border-[#252525] px-2.5 py-1 rounded-md bg-white dark:bg-[#111111] font-semibold">
                {role}
              </span>
            )}

            {/* Quick Action in Header */}
            {canMutate && onOpenCreateLicense && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenCreateLicense}
                className="text-xs h-8 px-2.5 sm:px-3"
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">Criar Key</span>
                <span className="sm:hidden">Criar</span>
              </Button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-3 sm:p-4 md:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {children}
        </main>

        {/* Footer with Pajé DEV credit on every page */}
        <footer className="border-t border-[#E8E8E8] dark:border-[#252525] py-4 px-4 md:px-8 bg-white/50 dark:bg-[#070707]/60 text-center text-xs text-[#888888] dark:text-[#707070]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto font-mono text-[11px]">
            <span>AZOD Software License Manager · Cloudflare Worker v{apiVersion}</span>
            <span className="font-medium text-[#111111] dark:text-neutral-300">
              Todos os créditos de criação para Pajé DEV
            </span>
          </div>
        </footer>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs md:hidden flex animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          >
            <div className="w-72 sm:w-80 bg-white dark:bg-[#090909] border-r border-[#E8E8E8] dark:border-[#252525] h-full p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8] dark:border-[#252525]">
                  <div className="flex items-center gap-2.5">
                    <div
                      data-logo="azod"
                      className="w-7 h-7 rounded-lg bg-[#111111] dark:bg-white text-white dark:text-[#050505] flex items-center justify-center font-bold text-xs azod-logo-badge"
                    >
                      AZOD
                    </div>
                    <span className="font-semibold text-sm text-[#111111] dark:text-white">AZOD Manager</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white p-1 rounded-md"
                    aria-label="Fechar menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile categories */}
                <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-1">
                  {navGroups.map((group, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#888888] dark:text-[#707070] font-mono">
                        {group.label}
                      </div>
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-left transition-colors min-h-[44px] ${
                            activeTab === item.id
                              ? 'bg-neutral-200/80 text-[#111111] dark:bg-[#161616] dark:text-white font-semibold'
                              : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white'
                          }`}
                        >
                          <span className={activeTab === item.id ? 'text-[#111111] dark:text-white' : 'text-[#888888] dark:text-[#707070]'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Theme Selector inside Mobile Drawer */}
                <div className="pt-3 border-t border-[#E8E8E8] dark:border-[#252525]">
                  <div className="text-[10px] uppercase font-mono font-semibold text-[#888888] dark:text-[#707070] px-1 mb-2">
                    Tema da Interface
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                        theme === 'light'
                          ? 'border-[#111111] dark:border-white bg-neutral-100 font-semibold text-[#111111]'
                          : 'border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Claro</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                        theme === 'dark'
                          ? 'border-white bg-[#161616] font-semibold text-white'
                          : 'border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Escuro</span>
                    </button>
                    <button
                      onClick={() => setTheme('special')}
                      className={`col-span-2 flex items-center justify-between p-2 rounded-lg border text-left transition-colors ${
                        theme === 'special'
                          ? 'border-[#FF2E93] bg-[#220718] font-semibold text-[#FF2E93] shadow-[0_0_12px_rgba(255,46,147,0.3)]'
                          : 'border-[#E8E8E8] dark:border-[#252525] text-[#FF2E93]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF2E93]" />
                        <span>Especial Rosa & Preto</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FF2E93]/20 text-[#FF2E93]">NOVO</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E8E8] dark:border-[#252525] space-y-3">
                <div className="text-xs text-[#888888] dark:text-[#A1A1A1] font-mono truncate">
                  {user?.email}
                </div>
                <div className="text-[10px] text-center font-mono text-[#888888] dark:text-[#707070]">
                  Todos os créditos de criação para <strong className="text-[#111111] dark:text-white">Pajé DEV</strong>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start min-h-[40px]"
                  onClick={logout}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Encerrar Sessão
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
