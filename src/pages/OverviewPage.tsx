import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { LicenseKey, AuditLogItem, HealthCheckResponse } from '../types';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusText } from '../components/ui/StatusText';
import { EmptyState } from '../components/ui/EmptyState';
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
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (tab: 'licenses' | 'devices' | 'audit', detailId?: string) => void;
  onOpenCreateLicense: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onOpenCreateLicense }) => {
  const { canMutate } = useAuth();
  const toast = useToast();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyKey = (license: LicenseKey, e: React.MouseEvent) => {
    e.stopPropagation();
    const valueToCopy = license.key || license.id;
    if (!valueToCopy) return;
    navigator.clipboard.writeText(valueToCopy);
    setCopiedId(license.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast.success('Chave copiada para a área de transferência', valueToCopy);
  };

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, keysRes, auditRes] = await Promise.allSettled([
        api.getHealth(),
        api.getKeys({ limit: 100 }),
        api.getAuditLogs({ limit: 10 }),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      } else {
        console.warn('Worker health check failure:', healthRes.reason);
      }

      if (keysRes.status === 'fulfilled') {
        setKeys(keysRes.value.keys || []);
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
    } catch (err: any) {
      setError(err?.message || 'Erro de comunicação com a API do Cloudflare Worker.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  // Compute metrics strictly from real API data
  const totalLicenses = keys.length;
  const activeCount = keys.filter((k) => k.status === 'active').length;
  const pendingCount = keys.filter((k) => k.status === 'pending').length;
  const expiredCount = keys.filter((k) => k.status === 'expired').length;
  const suspendedCount = keys.filter((k) => k.status === 'suspended').length;
  const bannedCount = keys.filter((k) => k.status === 'banned').length;

  const totalConnectedDevices = keys.reduce((acc, k) => {
    if (k.devices && Array.isArray(k.devices)) {
      return acc + k.devices.filter((d) => d.status !== 'unlinked').length;
    }
    return acc + (k.devicesUsed || 0);
  }, 0);

  // Status distribution percentages
  const activePct = totalLicenses > 0 ? (activeCount / totalLicenses) * 100 : 0;
  const pendingPct = totalLicenses > 0 ? (pendingCount / totalLicenses) * 100 : 0;
  const expiredPct = totalLicenses > 0 ? ((expiredCount + suspendedCount + bannedCount) / totalLicenses) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header Viewport */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
            Painel Geral
          </h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Métricas em tempo real fornecidas pela API Cloudflare Worker v4.0 e Firestore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverviewData}
            loading={loading}
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
              Criar Key
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold text-red-700 dark:text-red-300">Alerta de Comunicação da API</h4>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOverviewData}>
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* API Connection Health Banner */}
      <div className="p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 font-mono">
          <Server className="w-4 h-4 text-[#888888] dark:text-[#707070] shrink-0" />
          <span className="text-[#666666] dark:text-[#A1A1A1]">Backend:</span>
          <span className="text-[#111111] dark:text-neutral-200 font-semibold truncate max-w-xs md:max-w-md">
            {health?.service || 'Cloudflare Worker'} · {health?.status === 'online' ? 'Online & Operacional' : 'Ativo'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#888888] dark:text-[#707070]">
          <span>Worker v{health?.version || '4.0.0'}</span>
          <span>·</span>
          <span>Sincronizado às {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Primary KPI Grid (High Contrast, Monochromatic, Clean Elevation) */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">Indicadores Principais</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Licenses */}
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#A1A1A1]">
              <span className="font-medium">Total de Licenças</span>
              <KeyRound className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold font-mono tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {totalLicenses}
                </div>
              )}
              <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-1">Credenciais cadastradas</div>
            </div>
          </div>

          {/* Active Licenses */}
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#A1A1A1]">
              <span className="font-medium">Licenças Ativas</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold font-mono tracking-tight text-[#111111] dark:text-white tabular-nums flex items-baseline gap-2">
                  <span>{activeCount}</span>
                  {totalLicenses > 0 && (
                    <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400 font-mono">
                      {Math.round(activePct)}%
                    </span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-1">Autorizadas e válidas</div>
            </div>
          </div>

          {/* Connected Devices */}
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#A1A1A1]">
              <span className="font-medium">Hardware Conectado</span>
              <Smartphone className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold font-mono tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {totalConnectedDevices}
                </div>
              )}
              <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-1">Dispositivos vinculados</div>
            </div>
          </div>

          {/* Pending / Expired */}
          <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#A1A1A1]">
              <span className="font-medium">Pendentes / Inativas</span>
              <span className="text-[#888888] dark:text-[#707070] font-mono text-xs">○ / ✕</span>
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-3xl font-bold font-mono tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {pendingCount} <span className="text-[#888888] dark:text-[#707070] font-light">/</span> {expiredCount}
                </div>
              )}
              <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-1">
                {suspendedCount} suspensas · {bannedCount} banidas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Distribution Progress Bar */}
      {totalLicenses > 0 && (
        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#666666] dark:text-[#A1A1A1] font-medium">Distribuição de Status</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Ativas ({activeCount})
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Pendentes ({pendingCount})
              </span>
              <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Inativas ({expiredCount + suspendedCount + bannedCount})
              </span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-[#1C1C1C] overflow-hidden flex">
            <div style={{ width: `${activePct}%` }} className="bg-emerald-500 transition-all duration-300" />
            <div style={{ width: `${pendingPct}%` }} className="bg-amber-500 transition-all duration-300" />
            <div style={{ width: `${expiredPct}%` }} className="bg-red-500 transition-all duration-300" />
          </div>
        </div>
      )}

      {/* Two Column Layout: Recent Licenses & Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recent Licenses */}
        <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight">Licenças Recentes</h3>
              <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">Credenciais emitidas mais recentemente</p>
            </div>
            <button
              onClick={() => onNavigate('licenses')}
              className="text-xs font-medium text-[#111111] dark:text-white hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Ver Todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="w-6 h-6 text-[#888888] dark:text-[#707070]" />}
              title="Nenhuma licença cadastrada"
              description="Gere sua primeira chave de licença de software para iniciar o gerenciamento."
              actionLabel={canMutate ? 'Criar Key' : undefined}
              onAction={onOpenCreateLicense}
            />
          ) : (
            <div className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C] overflow-hidden">
              {keys.slice(0, 5).map((license) => (
                <div
                  key={license.id}
                  onClick={() => onNavigate('licenses', license.id)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-[#161616]/60 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#111111] dark:text-white truncate">
                        {license.keyPrefix
                          ? `${license.keyPrefix}••••${license.keySuffix || ''}`
                          : license.key || license.id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyKey(license, e)}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white transition-colors"
                        title="Copiar Key"
                        aria-label="Copiar chave"
                      >
                        {copiedId === license.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <StatusText status={license.status} />
                    </div>
                    <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] truncate mt-0.5">
                      Cliente: {license.clientName || 'Cliente Geral'}
                      {license.orderReference && ` · Ref: ${license.orderReference}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[11px] font-mono text-[#888888] dark:text-[#707070]">
                    {license.createdAt ? new Date(license.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit Events */}
        <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight">Trilha de Auditoria Recente</h3>
              <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">Eventos administrativos registrados no Worker</p>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-medium text-[#111111] dark:text-white hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Ver Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-lg">
              <ScrollText className="w-5 h-5 text-[#888888] dark:text-[#707070] mx-auto mb-2" />
              <div className="text-xs text-[#666666] dark:text-[#A1A1A1]">Nenhum registro de auditoria retornado</div>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#111111] dark:text-neutral-200 truncate">
                      {log.action}
                      <span className="text-[#888888] dark:text-[#707070] font-mono text-[11px] ml-1.5">
                        em {log.target}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-0.5 truncate">
                      Por {log.actorEmail || log.actor || 'Sistema'}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[10px] font-mono text-[#888888] dark:text-[#707070]">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
