import React, { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { enterpriseStore } from '../lib/enterpriseStore';
import type { LicenseKey, AuditLogItem, HealthCheckResponse, ZodApplication } from '../types';
import { Button } from '../components/ui/Button';
import { StatusText } from '../components/ui/StatusText';
import { useToast } from '../components/ui/Toast';
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  ScrollText,
  RefreshCw,
  AlertCircle,
  Plus,
  ArrowRight,
  Server,
  Zap,
  Copy,
  Check,
  Clock,
  Layers,
  ShoppingBag,
  Users,
  TrendingUp,
  AlertTriangle,
  Shield,
  Activity,
  Package,
} from 'lucide-react';
import {
  formatSimpleDate,
  formatFullDateTime,
  getRealLicenseStatus,
  getDeletedKeyIds,
  normalizeLicense,
} from '../lib/licenseUtils';
import { ActiveTab } from '../components/layout/AppLayout';

interface OverviewPageProps {
  onNavigate: (tab: ActiveTab, detailId?: string) => void;
  onOpenCreateLicense: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onOpenCreateLicense,
}) => {
  const { canMutate } = useAuth();
  const toast = useToast();

  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [apps, setApps] = useState<ZodApplication[]>([]);

  const handleCopyKey = (license: LicenseKey, e: React.MouseEvent) => {
    e.stopPropagation();
    const valueToCopy = license.key || license.id;
    if (!valueToCopy) return;
    navigator.clipboard.writeText(valueToCopy);
    setCopiedId(license.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast.success('Chave copiada para a área de transferência', valueToCopy);
  };

  const fetchOverviewData = async (manual = false) => {
    if (manual) setLoading(true);
    setError(null);
    try {
      const loadedApps = enterpriseStore.getApplications();
      setApps(loadedApps);

      const [healthRes, keysRes, auditRes] = await Promise.allSettled([
        api.getHealth(),
        api.getKeys({ limit: 200 }),
        api.getAuditLogs({ limit: 15 }),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }

      if (keysRes.status === 'fulfilled') {
        const deletedSet = getDeletedKeyIds();
        const normalized = (keysRes.value.keys || [])
          .map(normalizeLicense)
          .filter((k) => !deletedSet.has(k.id));
        setKeys(normalized);
        // Sync customers directory
        enterpriseStore.syncCustomersFromLicenses(normalized);
      } else {
        const err = keysRes.reason;
        console.error('Failed to fetch keys:', err);
        if (err instanceof ApiError && err.status === 401) {
          setError('Sessão não autorizada. Verifique suas credenciais de acesso.');
        } else {
          setError(err?.message || 'Falha ao buscar estatísticas da API do Cloudflare Worker.');
        }
      }

      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value.logs || []);
      }

      setLastRefreshed(new Date());
      if (manual) {
        toast.success('Dados atualizados manualmente');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de comunicação com a API do Cloudflare Worker.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData(false);
  }, []);

  // 1-second live clock ticker
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Background refresh every 5 seconds
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      fetchOverviewData(false);
    }, 5000);
    return () => clearInterval(autoRefreshInterval);
  }, []);

  // Filter keys by selected app
  const filteredKeys = useMemo(() => {
    if (appFilter === 'all') return keys;
    return keys.filter((k) => (k.appId || 'proxy-menu') === appFilter);
  }, [keys, appFilter]);

  // Compute live metrics dynamically against currentTime & real statuses
  const deletedSet = useMemo(() => getDeletedKeyIds(), [keys, currentTime]);
  const activeKeys = useMemo(() => {
    return filteredKeys.filter((k) => !deletedSet.has(k.id));
  }, [filteredKeys, deletedSet]);

  const totalLicenses = activeKeys.length;
  const activeCount = useMemo(() => {
    return activeKeys.filter((k) => getRealLicenseStatus(k) === 'active').length;
  }, [activeKeys, currentTime]);

  const pendingCount = useMemo(() => {
    return activeKeys.filter((k) => getRealLicenseStatus(k) === 'pending').length;
  }, [activeKeys, currentTime]);

  const expiredCount = useMemo(() => {
    return activeKeys.filter((k) => getRealLicenseStatus(k) === 'expired').length;
  }, [activeKeys, currentTime]);

  const suspendedCount = useMemo(() => {
    return activeKeys.filter((k) => getRealLicenseStatus(k) === 'suspended').length;
  }, [activeKeys, currentTime]);

  const lifetimeCount = useMemo(() => {
    return activeKeys.filter((k) => k.duration === -1 || (k as any).durationUnit === 'lifetime' || (k as any).isLifetime).length;
  }, [activeKeys]);

  const totalDevices = useMemo(() => {
    return activeKeys.reduce((acc, k) => acc + (k.devices?.length || k.devicesUsed || 0), 0);
  }, [activeKeys]);

  const storeProducts = enterpriseStore.getProducts(appFilter);
  const storeCustomers = enterpriseStore.getCustomers();
  const stockItems = enterpriseStore.getStockItems(appFilter);
  const availableStockCount = stockItems.filter((x) => x.status === 'available').length;

  // Smart low stock alert
  const lowStockProducts = storeProducts.filter((p) => p.stockQuantity < 5);

  return (
    <div className="space-y-6">
      {/* Top Header & Executive Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Painel Executivo — ZOD STORE
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
              Live Edge v4.0
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">
            Governança centralizada de produtos, clientes, estoque de chaves e infraestrutura.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* App Filter Selector */}
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="text-xs bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg px-2.5 py-1.5 font-medium text-[#111111] dark:text-white"
          >
            <option value="all">Todas as Aplicações</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverviewData(true)}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>

          {/* Quick Create Key */}
          {canMutate && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenCreateLicense}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Emitir Key
            </Button>
          )}
        </div>
      </div>

      {/* Smart Alerts Banner (if low stock or prober issue) */}
      {lowStockProducts.length > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Alerta de Estoque: {lowStockProducts.length} produto(s) com estoque baixo (&lt; 5 chaves).
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="font-bold underline hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
          >
            Ver Produtos &rarr;
          </button>
        </div>
      )}

      {/* Primary KPI Grid (High density, zero-pill, tabular numbers) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          onClick={() => onNavigate('products')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-[#888888] dark:text-[#707070]">
            Produtos
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {apps.length}
          </div>
        </div>

        <div
          onClick={() => onNavigate('customers')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-[#888888] dark:text-[#707070]">
            Clientes
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {storeCustomers.length}
          </div>
        </div>

        <div
          onClick={() => onNavigate('licenses')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-[#888888] dark:text-[#707070]">
            Licenças Totais
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {totalLicenses}
          </div>
        </div>

        <div
          onClick={() => onNavigate('licenses')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400">
            Licenças Ativas
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500 mt-1">
            {activeCount}
          </div>
        </div>

        <div
          onClick={() => onNavigate('devices')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-[#888888] dark:text-[#707070]">
            Hardware HWID
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {totalDevices}
          </div>
        </div>

        <div
          onClick={() => onNavigate('sessions')}
          className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] hover:border-[#111111] dark:hover:border-white/30 transition-all cursor-pointer shadow-2xs"
        >
          <span className="text-[10px] font-mono uppercase text-[#888888] dark:text-[#707070]">
            Sessões
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {totalDevices}
          </div>
        </div>
      </div>

      {/* Secondary Status Breakdown Bar */}
      <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#111111] dark:text-white">
          <span>Distribuição Operacional de Licenças</span>
          <span className="font-mono text-[#888888]">{totalLicenses} no total</span>
        </div>

        {/* Visual Progress Ratio Bar */}
        <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-[#1C1C1C] overflow-hidden flex">
          <div
            style={{ width: `${totalLicenses > 0 ? (activeCount / totalLicenses) * 100 : 0}%` }}
            className="h-full bg-emerald-500"
            title={`Ativas: ${activeCount}`}
          />
          <div
            style={{ width: `${totalLicenses > 0 ? (pendingCount / totalLicenses) * 100 : 0}%` }}
            className="h-full bg-amber-500"
            title={`No 1º Uso: ${pendingCount}`}
          />
          <div
            style={{ width: `${totalLicenses > 0 ? (lifetimeCount / totalLicenses) * 100 : 0}%` }}
            className="h-full bg-blue-500"
            title={`Vitalícias: ${lifetimeCount}`}
          />
          <div
            style={{ width: `${totalLicenses > 0 ? (expiredCount / totalLicenses) * 100 : 0}%` }}
            className="h-full bg-red-500"
            title={`Expiradas: ${expiredCount}`}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[#666666] dark:text-[#A1A1A1]">Ativas: {activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[#666666] dark:text-[#A1A1A1]">No 1º Uso: {pendingCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[#666666] dark:text-[#A1A1A1]">Vitalícias: {lifetimeCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[#666666] dark:text-[#A1A1A1]">Expiradas: {expiredCount}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[#888888]">Estoque disponível para venda imediata:</span>
            <span className="font-bold text-[#111111] dark:text-white">{availableStockCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Licenses + Enterprise Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Licenses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#888888]" />
              <span>Chaves de Licença Recentes</span>
            </h3>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onNavigate('licenses')}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Ver Todas
            </Button>
          </div>

          <div className="border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
            <div className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
              {activeKeys.slice(0, 6).map((license) => {
                const realSt = getRealLicenseStatus(license);
                const isLifetime = license.duration === -1 || (license as any).durationUnit === 'lifetime';
                return (
                  <div
                    key={license.id}
                    onClick={() => onNavigate('licenses', license.id)}
                    className="p-3.5 hover:bg-neutral-50 dark:hover:bg-[#161616]/60 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111111] dark:text-white truncate">
                          {license.clientName || 'Cliente Geral'}
                        </span>
                        <StatusText status={realSt} />
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-[#888888] dark:text-[#707070] mt-0.5">
                        <span className="font-semibold text-[#111111] dark:text-neutral-300">
                          {license.key || license.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyKey(license, e)}
                          className="hover:text-[#111111] dark:hover:text-white"
                          title="Copiar Chave"
                        >
                          {copiedId === license.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <span>·</span>
                        <span>{isLifetime ? 'Vitalícia' : `${license.duration || 30} dias`}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px] text-[#888888] dark:text-[#707070] shrink-0">
                      <div>{formatSimpleDate(license.createdAt)}</div>
                      <div className="text-[10px] text-[#111111] dark:text-neutral-300">
                        {license.devicesUsed || license.devices?.length || 0} HWID
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeKeys.length === 0 && (
                <div className="py-8 text-center text-xs text-[#888888]">
                  Nenhuma chave registrada ainda.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recent Audit & System Integrity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#888888]" />
              <span>Eventos de Auditoria</span>
            </h3>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onNavigate('audit')}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Logs
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] space-y-3 shadow-2xs">
            <div className="space-y-3 font-mono text-xs max-h-80 overflow-y-auto">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="pb-2.5 border-b border-[#E8E8E8] dark:border-[#1C1C1C] last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#111111] dark:text-white text-[11px]">
                      {log.action}
                    </span>
                    <span className="text-[9px] text-emerald-500 font-bold uppercase">
                      {log.result}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#666666] dark:text-[#A1A1A1] mt-0.5 truncate">
                    {log.target}
                  </div>
                  <div className="text-[9px] text-[#888888] dark:text-[#707070] mt-0.5">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : '—'} · {log.actor || 'Worker'}
                  </div>
                </div>
              ))}

              {auditLogs.length === 0 && (
                <div className="py-6 text-center text-[11px] text-[#888888]">
                  Nenhum evento registrado recentemente.
                </div>
              )}
            </div>
          </div>

          {/* Infrastructure Health Widget */}
          <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] text-xs font-mono space-y-2 shadow-2xs">
            <div className="flex items-center justify-between font-bold text-[#111111] dark:text-white">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-500" />
                <span>Nós de Borda ZOD</span>
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold">100% ONLINE</span>
            </div>
            <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] leading-relaxed">
              Cloudflare Worker v4.0.0 conectado com roteamento geo-distribuído e Firestore tolerante a falhas.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
