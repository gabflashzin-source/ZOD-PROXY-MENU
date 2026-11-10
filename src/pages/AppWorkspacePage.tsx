import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ZodApplication, LicenseKey, ConnectedDevice, ZodCustomer, ActiveSession, AuditLogItem } from '../types';
import { enterpriseStore, isAppMatch } from '../lib/enterpriseStore';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { normalizeLicense } from '../lib/licenseUtils';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { StatusText } from '../components/ui/StatusText';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  ArrowLeft,
  Shield,
  KeyRound,
  Layers,
  Smartphone,
  Users,
  ScrollText,
  Settings,
  Server,
  Plus,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Package,
  Activity,
  CheckCircle2,
  Clock,
  Lock,
  Cpu,
  BarChart3,
  Wifi,
  LogOut,
  Unlink,
  AlertTriangle,
  Search,
} from 'lucide-react';

interface AppWorkspacePageProps {
  appId: string;
  onBack: () => void;
  onSelectLicense: (licenseId: string) => void;
  onOpenCreateLicense: () => void;
}

type WorkspaceSubTab =
  | 'overview'
  | 'keys'
  | 'customers'
  | 'devices'
  | 'sessions'
  | 'logs'
  | 'settings'
  | 'stats';

export const AppWorkspacePage: React.FC<AppWorkspacePageProps> = ({
  appId,
  onBack,
  onSelectLicense,
  onOpenCreateLicense,
}) => {
  const { canMutate, user, role } = useAuth();
  const toast = useToast();

  const [app, setApp] = useState<ZodApplication | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceSubTab>('overview');
  const [allKeys, setAllKeys] = useState<LicenseKey[]>([]);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters for subtabs
  const [keySearch, setKeySearch] = useState('');
  const [keyStatusFilter, setKeyStatusFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');

  // Device/Session disconnect modal
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [targetDevice, setTargetDevice] = useState<{ keyId: string; deviceId: string; clientName: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Settings form state
  const [editName, setEditName] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<any>('active');
  const [editKeyFormat, setEditKeyFormat] = useState('');
  const [editDeviceLimit, setEditDeviceLimit] = useState(1);

  const loadAppData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    const foundApp = enterpriseStore.getApplicationById(appId);
    if (foundApp) {
      setApp(foundApp);
      setEditName(foundApp.name);
      setEditVersion(foundApp.version);
      setEditDesc(foundApp.description);
      setEditStatus(foundApp.status);
      setEditKeyFormat(foundApp.licensingConfig?.keyFormat || 'ZOD-XXXX-XXXX-XXXX');
      setEditDeviceLimit(foundApp.licensingConfig?.defaultDeviceLimit || 1);
    }

    try {
      const [keysRes, devsRes, logsRes] = await Promise.allSettled([
        api.getKeys({ limit: 300 }),
        api.getDevices(),
        api.getAuditLogs({ limit: 100 }),
      ]);

      if (keysRes.status === 'fulfilled' && Array.isArray(keysRes.value?.keys)) {
        setAllKeys(keysRes.value.keys.map(normalizeLicense));
      }
      if (devsRes.status === 'fulfilled' && Array.isArray(devsRes.value?.devices)) {
        setDevices(devsRes.value.devices);
      }
      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value?.logs)) {
        setAuditLogs(logsRes.value.logs);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appId]);

  useEffect(() => {
    loadAppData();
  }, [loadAppData]);

  // STRICT DATA ISOLATION: Filter all entities by app.id
  const appKeys = useMemo(() => {
    if (!app) return [];
    return allKeys.filter((k) => isAppMatch(app.id, k.appId));
  }, [app, allKeys]);

  const filteredAppKeys = useMemo(() => {
    return appKeys.filter((k) => {
      const matchesStatus = keyStatusFilter === 'all' || k.status === keyStatusFilter;
      const q = keySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (k.key && k.key.toLowerCase().includes(q)) ||
        (k.clientName && k.clientName.toLowerCase().includes(q)) ||
        (k.orderReference && k.orderReference.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [appKeys, keyStatusFilter, keySearch]);

  // Isolated customers
  const appCustomers = useMemo(() => {
    const custMap = new Map<string, {
      name: string;
      orderReference?: string;
      keysCount: number;
      activeCount: number;
      devicesCount: number;
      lastActivity?: string;
      keys: LicenseKey[];
    }>();

    appKeys.forEach((k) => {
      const nameKey = (k.clientName || 'Cliente Autônomo').trim().toLowerCase();
      const existing = custMap.get(nameKey);
      const devCount = Array.isArray(k.devices) ? k.devices.length : 0;
      const actDate = k.lastActivity || k.activatedAt || k.createdAt;

      if (existing) {
        existing.keysCount += 1;
        if (k.status === 'active') existing.activeCount += 1;
        existing.devicesCount += devCount;
        existing.keys.push(k);
        if (actDate && (!existing.lastActivity || new Date(actDate) > new Date(existing.lastActivity))) {
          existing.lastActivity = actDate;
        }
      } else {
        custMap.set(nameKey, {
          name: k.clientName || 'Cliente Autônomo',
          orderReference: k.orderReference,
          keysCount: 1,
          activeCount: k.status === 'active' ? 1 : 0,
          devicesCount: devCount,
          lastActivity: actDate,
          keys: [k],
        });
      }
    });

    return Array.from(custMap.values());
  }, [appKeys]);

  const filteredAppCustomers = useMemo(() => {
    if (!customerSearch.trim()) return appCustomers;
    const q = customerSearch.toLowerCase().trim();
    return appCustomers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.orderReference && c.orderReference.toLowerCase().includes(q))
    );
  }, [appCustomers, customerSearch]);

  // Isolated devices
  const appDevices = useMemo(() => {
    const list: Array<{
      deviceId: string;
      deviceName: string;
      deviceModel: string;
      licenseId: string;
      clientName: string;
      licenseKeyDisplay: string;
      firstConnectedAt?: string;
      lastActivityAt?: string;
    }> = [];

    appKeys.forEach((k) => {
      if (Array.isArray(k.devices)) {
        k.devices.forEach((d) => {
          list.push({
            deviceId: d.deviceId || d.id || 'HWID-DESCONHECIDO',
            deviceName: d.deviceName || 'Hardware Cliente',
            deviceModel: d.deviceModel || 'Android / HWID Client',
            licenseId: k.id,
            clientName: k.clientName || 'Cliente Autônomo',
            licenseKeyDisplay: k.key || `${k.keyPrefix || 'ZOD'}-••••-••••`,
            firstConnectedAt: d.firstConnectedAt || k.activatedAt || k.createdAt,
            lastActivityAt: d.lastActivityAt || k.lastActivity || d.firstConnectedAt,
          });
        });
      }
    });

    return list;
  }, [appKeys]);

  // Isolated sessions
  const appSessions: ActiveSession[] = useMemo(() => {
    const now = Date.now();
    return appDevices.map((d) => {
      let isRecent = false;
      if (d.lastActivityAt) {
        try {
          const diffMin = Math.floor((now - new Date(d.lastActivityAt).getTime()) / (1000 * 60));
          isRecent = diffMin < 60;
        } catch {
          // ignore
        }
      }

      return {
        sessionId: `SES-${d.deviceId.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
        licenseId: d.licenseId,
        licenseKeyDisplay: d.licenseKeyDisplay,
        appId: app?.id || 'azod',
        appName: app?.name || 'AZOD',
        clientName: d.clientName,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceModel: d.deviceModel,
        status: isRecent ? 'active' : 'idle',
        firstConnectedAt: d.firstConnectedAt,
        lastActivityAt: d.lastActivityAt,
      };
    });
  }, [appDevices, app]);

  // Isolated logs
  const appLogs = useMemo(() => {
    if (!app) return [];
    return auditLogs.filter((l) => isAppMatch(app.id, l.appId));
  }, [app, auditLogs]);

  // Stock items from local enterprise store
  const availableStock = useMemo(() => {
    if (!app) return [];
    return enterpriseStore.getStockItems(app.id).filter((k) => k.status === 'available');
  }, [app]);

  // Copy helper
  const handleCopy = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Chave copiada!', txt);
  };

  // Device unlinking
  const handleUnlinkDevice = async () => {
    if (!targetDevice || !canMutate) return;
    setDisconnecting(true);

    try {
      await api.unlinkDevice(targetDevice.keyId, targetDevice.deviceId);

      enterpriseStore.logAction({
        actor: user?.email || 'admin@zod',
        actorEmail: user?.email || undefined,
        role: role || 'ADMIN',
        action: 'DEVICE_UNLINKED',
        target: `${targetDevice.clientName} (${targetDevice.deviceId})`,
        result: 'success',
        appId: app?.id,
        appName: app?.name,
      });

      toast.success('Dispositivo desvinculado com sucesso');
      setDisconnectModalOpen(false);
      setTargetDevice(null);
      loadAppData(true);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao desvincular hardware';
      toast.error('Erro ao desvincular', msg);
    } finally {
      setDisconnecting(false);
    }
  };

  // Save app settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !canMutate) return;

    const updated: ZodApplication = {
      ...app,
      name: editName.trim(),
      version: editVersion.trim(),
      description: editDesc.trim(),
      status: editStatus,
      licensingConfig: {
        ...app.licensingConfig,
        keyFormat: editKeyFormat.trim(),
        defaultDeviceLimit: Number(editDeviceLimit) || 1,
      },
      updatedAt: new Date().toISOString(),
    };

    enterpriseStore.saveApplication(updated);
    setApp(updated);

    enterpriseStore.logAction({
      actor: user?.email || 'admin@zod',
      actorEmail: user?.email || undefined,
      role: role || 'ADMIN',
      action: 'APP_SETTINGS_UPDATED',
      target: updated.name,
      result: 'success',
      appId: updated.id,
      appName: updated.name,
    });

    toast.success('Configurações salvas!', `Parâmetros do produto ${updated.name} foram atualizados.`);
  };

  if (!app) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="text-sm font-semibold text-[#111111] dark:text-white">Produto não encontrado</div>
        <Button variant="outline" size="sm" onClick={onBack}>
          Voltar aos Produtos
        </Button>
      </div>
    );
  }

  const isFlagship = app.id === 'azod' || app.id === 'proxy-menu';

  return (
    <div className="space-y-6">
      {/* Top Banner & Product Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-xs h-8 px-2"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Voltar
          </Button>

          <div className="w-10 h-10 rounded-xl bg-[#111111] dark:bg-white text-white dark:text-[#111111] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {isFlagship ? (
              <Shield className="w-5 h-5 text-emerald-400" />
            ) : app.id === 'azod-loader' ? (
              <Cpu className="w-5 h-5 text-neutral-300 dark:text-neutral-700" />
            ) : (
              <Lock className="w-5 h-5 text-neutral-300 dark:text-neutral-700" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
                {app.name}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1]">
                v{app.version}
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                {app.status}
              </span>
            </div>
            <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">
              Slug: <span className="font-mono text-[#111111] dark:text-neutral-200">{app.slug}</span> · Infra: {app.infrastructure.provider === 'cloudflare_worker' ? 'Cloudflare Worker v4.0' : 'Firestore Direto'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAppData(false)}
            loading={refreshing || loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
          {canMutate && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenCreateLicense}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Emitir Key para {app.name}
            </Button>
          )}
        </div>
      </div>

      {/* Horizontal Subtabs Bar (8 Subtabs: Overview, Keys, Customers, Devices, Sessions, Logs, Settings, Stats) */}
      <div className="flex items-center gap-1 border-b border-[#E8E8E8] dark:border-[#252525] pb-px overflow-x-auto text-xs font-medium">
        {[
          { id: 'overview', label: 'Visão Geral', icon: <Activity className="w-3.5 h-3.5" /> },
          { id: 'keys', label: `Chaves (${appKeys.length})`, icon: <KeyRound className="w-3.5 h-3.5" /> },
          { id: 'customers', label: `Clientes (${appCustomers.length})`, icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'devices', label: `Dispositivos (${appDevices.length})`, icon: <Smartphone className="w-3.5 h-3.5" /> },
          { id: 'sessions', label: `Sessões (${appSessions.length})`, icon: <Wifi className="w-3.5 h-3.5" /> },
          { id: 'logs', label: `Logs (${appLogs.length})`, icon: <ScrollText className="w-3.5 h-3.5" /> },
          { id: 'settings', label: 'Configurações', icon: <Settings className="w-3.5 h-3.5" /> },
          { id: 'stats', label: 'Estatísticas', icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap min-h-[42px] ${
              activeTab === tab.id
                ? 'border-[#111111] dark:border-white text-[#111111] dark:text-white font-semibold bg-neutral-100/50 dark:bg-[#161616]/50'
                : 'border-transparent text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* 1. TAB: OVERVIEW */}
      {/* ============================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
              <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
                Total de Chaves
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
                {appKeys.length}
              </div>
              <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
                Exclusivas de {app.name}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
              <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
                Chaves Ativas
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {appKeys.filter((l) => l.status === 'active').length}
              </div>
              <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
                Autorizadas no sistema
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
              <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
                Clientes Registrados
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
                {appCustomers.length}
              </div>
              <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
                Perfis com licença ativa
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
              <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
                Hardwares Conectados
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
                {appDevices.length}
              </div>
              <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
                Dispositivos HWID vinculados
              </p>
            </div>
          </div>

          {/* Recent Keys for this App */}
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#111111] dark:text-white">
                  Últimas Chaves Emitidas para {app.name}
                </h3>
                <p className="text-xs text-[#666666] dark:text-[#A1A1A1]">
                  Registros mais recentes gerados e vinculados a este produto
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('keys')}
              >
                Ver Todas ({appKeys.length})
              </Button>
            </div>

            {appKeys.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888] dark:text-[#707070]">
                Nenhuma chave emitida ainda para este produto.
              </div>
            ) : (
              <div className="space-y-2">
                {appKeys.slice(0, 5).map((lic) => (
                  <div
                    key={lic.id}
                    className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1F1F1F] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-[#111111] dark:hover:border-white/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-bold text-xs text-[#111111] dark:text-white">
                        {lic.key || `${lic.keyPrefix || 'ZOD'}-••••-••••`}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(lic.key || lic.id, lic.id)}
                        className="text-[#888888] hover:text-[#111111] dark:hover:text-white"
                        title="Copiar chave"
                      >
                        {copiedKey === lic.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-[#888888] dark:text-[#707070]">·</span>
                      <span className="font-medium text-[#666666] dark:text-[#A1A1A1]">
                        {lic.clientName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusText status={lic.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => onSelectLicense(lic.id)}
                      >
                        Detalhes
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. TAB: KEYS */}
      {/* ============================================================== */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909]">
            <div className="relative flex-1">
              <Input
                placeholder="Buscar chaves por código, cliente ou referência..."
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#888888]" />}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={keyStatusFilter}
                onChange={(e) => setKeyStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos os Status' },
                  { value: 'active', label: 'Ativas' },
                  { value: 'pending', label: 'Pendentes' },
                  { value: 'expired', label: 'Expiradas' },
                  { value: 'suspended', label: 'Suspensas' },
                ]}
              />
            </div>
          </div>

          {/* Keys Table */}
          {filteredAppKeys.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="w-5 h-5 text-neutral-400" />}
              title="Nenhuma chave encontrada"
              description="Não há chaves de licença associadas a este produto com os filtros atuais."
              actionLabel="Emitir Primeira Key"
              onAction={onOpenCreateLicense}
            />
          ) : (
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#121212]/50 text-[#888888] dark:text-[#707070] font-mono uppercase text-[11px]">
                      <th className="py-3 px-4">Chave / Código</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Duração</th>
                      <th className="py-3 px-4">Hardwares</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                    {filteredAppKeys.map((lic) => (
                      <tr key={lic.id} className="hover:bg-neutral-50/50 dark:hover:bg-[#121212]/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#111111] dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{lic.key || `${lic.keyPrefix || 'ZOD'}-••••-••••`}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(lic.key || lic.id, `k-${lic.id}`)}
                              className="text-[#888888] hover:text-[#111111] dark:hover:text-white"
                            >
                              {copiedKey === `k-${lic.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#111111] dark:text-white">
                          {lic.clientName}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {lic.isLifetime || lic.duration === -1 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Vitalícia</span>
                          ) : (
                            <span>{lic.duration} {lic.durationUnit || 'dias'}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {Array.isArray(lic.devices) ? lic.devices.length : 0} / {lic.deviceLimit === -1 ? '∞' : lic.deviceLimit}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusText status={lic.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSelectLicense(lic.id)}
                          >
                            Ver Detalhes
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. TAB: CUSTOMERS */}
      {/* ============================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909]">
            <Input
              placeholder="Buscar clientes de este produto por nome ou referência..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-[#888888]" />}
            />
          </div>

          {filteredAppCustomers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-5 h-5 text-neutral-400" />}
              title="Nenhum cliente registrado para este produto"
              description="Quando você emitir licenças para este produto, os clientes aparecerão isolados aqui."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppCustomers.map((c) => (
                <div
                  key={c.name}
                  className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#111111] dark:text-white">
                        {c.name}
                      </h4>
                      {c.orderReference && (
                        <p className="text-[11px] font-mono text-[#888888] dark:text-[#707070]">
                          Ref: {c.orderReference}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] text-[#666666] dark:text-[#A1A1A1]">
                      {c.keysCount} {c.keysCount === 1 ? 'Chave' : 'Chaves'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-[#888888] dark:text-[#707070] pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C]">
                    <div className="flex justify-between">
                      <span>Chaves Ativas:</span>
                      <span className="text-emerald-500 font-semibold">{c.activeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hardwares Vinculados:</span>
                      <span className="text-[#111111] dark:text-neutral-200">{c.devicesCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. TAB: DEVICES */}
      {/* ============================================================== */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {appDevices.length === 0 ? (
            <EmptyState
              icon={<Smartphone className="w-5 h-5 text-neutral-400" />}
              title="Nenhum hardware vinculado a este produto"
              description="Nenhum dispositivo Android ou client foi autenticado com as chaves deste produto até o momento."
            />
          ) : (
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#121212]/50 text-[#888888] dark:text-[#707070] font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">Hardware HWID</th>
                    <th className="py-3 px-4">Modelo / Plataforma</th>
                    <th className="py-3 px-4">Cliente & Chave</th>
                    <th className="py-3 px-4">Última Atividade</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                  {appDevices.map((dev) => (
                    <tr key={`${dev.licenseId}-${dev.deviceId}`} className="hover:bg-neutral-50/50 dark:hover:bg-[#121212]/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#111111] dark:text-white truncate max-w-[200px]">
                        {dev.deviceId}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#666666] dark:text-[#A1A1A1]">
                        {dev.deviceModel}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#111111] dark:text-white">{dev.clientName}</div>
                        <div className="font-mono text-[11px] text-[#888888] dark:text-[#707070]">{dev.licenseKeyDisplay}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#666666] dark:text-[#A1A1A1]">
                        {dev.lastActivityAt ? new Date(dev.lastActivityAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canMutate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            onClick={() => {
                              setTargetDevice({ keyId: dev.licenseId, deviceId: dev.deviceId, clientName: dev.clientName });
                              setDisconnectModalOpen(true);
                            }}
                            icon={<Unlink className="w-3.5 h-3.5" />}
                          >
                            Desvincular
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. TAB: SESSIONS */}
      {/* ============================================================== */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {appSessions.length === 0 ? (
            <EmptyState
              icon={<Wifi className="w-5 h-5 text-neutral-400" />}
              title="Nenhuma sessão ativa neste produto"
              description="Nenhum cliente está conectado ativamente a este aplicativo no momento."
            />
          ) : (
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#121212]/50 text-[#888888] dark:text-[#707070] font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">Sessão ID</th>
                    <th className="py-3 px-4">Cliente / Chave</th>
                    <th className="py-3 px-4">Hardware HWID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                  {appSessions.map((ses) => (
                    <tr key={ses.sessionId} className="hover:bg-neutral-50/50 dark:hover:bg-[#121212]/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#111111] dark:text-white">
                        {ses.sessionId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#111111] dark:text-white">{ses.clientName}</div>
                        <div className="font-mono text-[11px] text-[#888888] dark:text-[#707070]">{ses.licenseKeyDisplay}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#666666] dark:text-[#A1A1A1] truncate max-w-[200px]">
                        {ses.deviceId}
                      </td>
                      <td className="py-3.5 px-4">
                        {ses.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativa
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Ociosa
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canMutate && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            onClick={() => {
                              setTargetDevice({ keyId: ses.licenseId, deviceId: ses.deviceId, clientName: ses.clientName });
                              setDisconnectModalOpen(true);
                            }}
                            icon={<LogOut className="w-3.5 h-3.5" />}
                          >
                            Desconectar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. TAB: LOGS */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {appLogs.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="w-5 h-5 text-neutral-400" />}
              title="Nenhum registro de auditoria isolado"
              description="Ações administrativas e eventos exclusivos deste aplicativo serão registrados aqui."
            />
          ) : (
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#121212]/50 text-[#888888] dark:text-[#707070] font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">Data & Hora</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Alvo</th>
                    <th className="py-3 px-4">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                  {appLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-[#121212]/30 transition-colors font-mono">
                      <td className="py-3 px-4 text-[#888888] dark:text-[#707070]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#111111] dark:text-white">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-[#666666] dark:text-[#A1A1A1]">
                        {log.actor}
                      </td>
                      <td className="py-3 px-4 text-[#111111] dark:text-neutral-200">
                        {log.target}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-500 font-bold uppercase text-[10px]">
                          {log.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. TAB: SETTINGS */}
      {/* ============================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] space-y-4 shadow-2xs">
            <h3 className="font-bold text-sm text-[#111111] dark:text-white">
              Parâmetros Básicos do Produto
            </h3>

            <div className="space-y-3">
              <Input
                label="Nome do Produto"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />

              <Input
                label="Versão Atual"
                value={editVersion}
                onChange={(e) => setEditVersion(e.target.value)}
                required
              />

              <Textarea
                label="Descrição Operacional"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />

              <Select
                label="Status Operacional"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={[
                  { value: 'active', label: 'Ativo e Operacional' },
                  { value: 'maintenance', label: 'Em Manutenção' },
                  { value: 'deprecated', label: 'Descontinuado' },
                ]}
              />
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] space-y-4 shadow-2xs">
            <h3 className="font-bold text-sm text-[#111111] dark:text-white">
              Regras de Licenciamento
            </h3>

            <div className="space-y-3">
              <Input
                label="Formato de Geração de Keys"
                value={editKeyFormat}
                onChange={(e) => setEditKeyFormat(e.target.value)}
                helperText="Ex: ZOD-XXXX-XXXX-XXXX ou LOADER-XXXX-XXXX"
              />

              <Input
                label="Limite Padrão de Dispositivos HWID"
                type="number"
                min={1}
                max={20}
                value={editDeviceLimit}
                onChange={(e) => setEditDeviceLimit(Number(e.target.value))}
              />
            </div>
          </div>

          {canMutate && (
            <div className="flex justify-end">
              <Button type="submit" variant="primary">
                Salvar Configurações
              </Button>
            </div>
          )}
        </form>
      )}

      {/* ============================================================== */}
      {/* 8. TAB: STATS */}
      {/* ============================================================== */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] space-y-4 shadow-2xs">
            <h3 className="font-bold text-sm text-[#111111] dark:text-white">
              Distribuição de Status de Chaves
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span className="text-emerald-500">Ativas:</span>
                <span className="font-bold">{appKeys.filter((k) => k.status === 'active').length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span className="text-amber-500">Pendentes (1º Uso):</span>
                <span className="font-bold">{appKeys.filter((k) => k.status === 'pending').length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span className="text-rose-500">Expiradas:</span>
                <span className="font-bold">{appKeys.filter((k) => k.status === 'expired').length}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-purple-500">Vitalícias:</span>
                <span className="font-bold">{appKeys.filter((k) => k.isLifetime || k.duration === -1).length}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] space-y-4 shadow-2xs">
            <h3 className="font-bold text-sm text-[#111111] dark:text-white">
              Métricas Operacionais
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span>Média HWID / Licença:</span>
                <span className="font-bold">
                  {appKeys.length > 0 ? (appDevices.length / appKeys.length).toFixed(1) : '0'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span>Chaves / Cliente:</span>
                <span className="font-bold">
                  {appCustomers.length > 0 ? (appKeys.length / appCustomers.length).toFixed(1) : '0'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Taxa de Ativação:</span>
                <span className="font-bold text-emerald-500">
                  {appKeys.length > 0
                    ? `${Math.round((appKeys.filter((k) => k.status === 'active').length / appKeys.length) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect/Unlink Confirmation Modal */}
      <ConfirmDialog
        isOpen={disconnectModalOpen}
        title="Desvincular Hardware"
        message={`Deseja forçar a desvinculação do hardware ${targetDevice?.deviceId} associado ao cliente ${targetDevice?.clientName}?`}
        confirmLabel="Confirmar Desvinculação"
        cancelLabel="Cancelar"
        isDestructive={true}
        loading={disconnecting}
        onConfirm={handleUnlinkDevice}
        onClose={() => {
          setDisconnectModalOpen(false);
          setTargetDevice(null);
        }}
      />
    </div>
  );
};
