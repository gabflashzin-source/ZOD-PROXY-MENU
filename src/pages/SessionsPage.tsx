import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { enterpriseStore, isAppMatch } from '../lib/enterpriseStore';
import { normalizeLicense } from '../lib/licenseUtils';
import type { LicenseKey, ConnectedDevice, ActiveSession } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { StatusText } from '../components/ui/StatusText';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Activity,
  Search,
  RefreshCw,
  LogOut,
  ExternalLink,
  Shield,
  Smartphone,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Filter,
} from 'lucide-react';

interface SessionsPageProps {
  onNavigateToLicense: (licenseId: string) => void;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({ onNavigateToLicense }) => {
  const { canMutate, user, role } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Disconnect Confirmation Modal
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [sessionToDisconnect, setSessionToDisconnect] = useState<ActiveSession | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [keysRes, devRes] = await Promise.allSettled([
        api.getKeys({ limit: 250 }),
        api.getDevices(),
      ]);

      if (keysRes.status === 'fulfilled' && Array.isArray(keysRes.value?.keys)) {
        setKeys(keysRes.value.keys.map(normalizeLicense));
      }
      if (devRes.status === 'fulfilled' && Array.isArray(devRes.value?.devices)) {
        setDevices(devRes.value.devices);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao carregar telemetria de sessões';
      toast.error('Erro de sincronização', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 15000); // auto-refresh heartbeat
    return () => clearInterval(interval);
  }, [loadData]);

  // Aggregate active sessions from connected devices and keys
  const sessions: ActiveSession[] = useMemo(() => {
    const list: ActiveSession[] = [];
    const now = Date.now();

    keys.forEach((lic) => {
      const devList = Array.isArray(lic.devices) ? lic.devices : [];
      const effectiveAppId = lic.appId || 'azod';
      const effectiveAppName = lic.appName || (effectiveAppId === 'azod' ? 'AZOD' : effectiveAppId);

      devList.forEach((dev) => {
        const devId = dev.deviceId || dev.id || 'HWID-DESCONHECIDO';
        const lastActStr = dev.lastActivityAt || lic.lastActivity || lic.activatedAt || dev.firstConnectedAt;
        let diffMinutes = 999999;

        if (lastActStr) {
          try {
            const d = new Date(lastActStr).getTime();
            if (!isNaN(d)) {
              diffMinutes = Math.floor((now - d) / (1000 * 60));
            }
          } catch {
            // ignore
          }
        }

        const isRecent = diffMinutes < 60;
        const sessionStatus: 'active' | 'idle' | 'disconnected' =
          lic.status === 'banned' || lic.status === 'suspended'
            ? 'disconnected'
            : isRecent
            ? 'active'
            : 'idle';

        list.push({
          sessionId: `SES-${devId.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
          licenseId: lic.id,
          licenseKeyDisplay: lic.key || `${lic.keyPrefix || 'ZOD'}-••••-••••`,
          appId: effectiveAppId,
          appName: effectiveAppName,
          clientName: lic.clientName || 'Cliente Autônomo',
          orderReference: lic.orderReference,
          deviceId: devId,
          deviceName: dev.deviceName || 'Dispositivo Autorizado',
          deviceModel: dev.deviceModel || 'Android / HWID Client',
          ipAddress: dev.ipAddress || 'Protegido / NAT',
          status: sessionStatus,
          firstConnectedAt: dev.firstConnectedAt || lic.activatedAt || lic.createdAt,
          lastActivityAt: lastActStr,
          duration: lic.duration,
          isLifetime: lic.isLifetime || lic.duration === -1,
        });
      });
    });

    return list;
  }, [keys]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchApp = isAppMatch(productFilter, s.appId);
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.sessionId.toLowerCase().includes(q) ||
        s.clientName.toLowerCase().includes(q) ||
        s.licenseKeyDisplay.toLowerCase().includes(q) ||
        s.deviceId.toLowerCase().includes(q) ||
        s.deviceModel.toLowerCase().includes(q) ||
        (s.orderReference && s.orderReference.toLowerCase().includes(q));

      return matchApp && matchStatus && matchSearch;
    });
  }, [sessions, productFilter, statusFilter, search]);

  // Metrics
  const activeCount = useMemo(() => sessions.filter((s) => s.status === 'active').length, [sessions]);
  const idleCount = useMemo(() => sessions.filter((s) => s.status === 'idle').length, [sessions]);
  const uniqueDevices = useMemo(() => new Set(sessions.map((s) => s.deviceId)).size, [sessions]);

  const handleCopy = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success('Copiado para a área de transferência', txt);
  };

  const handleConfirmDisconnect = async () => {
    if (!sessionToDisconnect || !canMutate) return;
    setDisconnecting(true);

    try {
      await api.unlinkDevice(sessionToDisconnect.licenseId, sessionToDisconnect.deviceId);
      
      enterpriseStore.logAction({
        actor: user?.email || 'admin@zod',
        actorEmail: user?.email || undefined,
        role: role || 'ADMIN',
        action: 'SESSION_DISCONNECTED',
        target: `${sessionToDisconnect.clientName} (${sessionToDisconnect.sessionId})`,
        result: 'success',
        appId: sessionToDisconnect.appId,
        appName: sessionToDisconnect.appName,
        details: {
          deviceId: sessionToDisconnect.deviceId,
          licenseId: sessionToDisconnect.licenseId,
        },
      });

      toast.success('Sessão desconectada!', `O hardware ${sessionToDisconnect.deviceId} foi desvinculado.`);
      setDisconnectModalOpen(false);
      setSessionToDisconnect(null);
      loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao desconectar sessão no Worker';
      toast.error('Erro na desconexão', msg);
    } finally {
      setDisconnecting(false);
    }
  };

  const availableProducts = useMemo(() => {
    return enterpriseStore.getApplications();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Sessões & Telemetria
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1] font-semibold">
              {sessions.length} {sessions.length === 1 ? 'Sessão' : 'Sessões'}
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Controle em tempo real das instâncias conectadas nos hardwares autenticados. Monitore atividade, heartbeats e encerre sessões com segurança.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(false)}
            loading={refreshing || loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
              Total de Sessões
            </span>
            <Activity className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {sessions.length}
          </div>
          <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
            Instâncias ativas em licenças
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
              Ativas Agora
            </span>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {activeCount}
          </div>
          <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
            Heartbeat recebido nos últimos 60min
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
              Sessões Ociosas
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {idleCount}
          </div>
          <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
            Sem tráfego recente no APK/Client
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] uppercase">
              Hardwares Únicos
            </span>
            <Smartphone className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {uniqueDevices}
          </div>
          <p className="text-[10px] text-[#888888] dark:text-[#707070] mt-1">
            Identificadores HWID validados
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1">
          <Input
            placeholder="Buscar por ID da sessão, chave, cliente, HWID ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-[#888888]" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Product Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todos os Produtos' },
                ...availableProducts.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-36">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'Todos os Status' },
                { value: 'active', label: 'Ativas (< 1h)' },
                { value: 'idle', label: 'Ociosas' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-5 h-5 text-neutral-400" />}
          title="Nenhuma sessão encontrada"
          description={
            search || productFilter !== 'all' || statusFilter !== 'all'
              ? 'Tente ajustar os filtros ou a busca textual.'
              : 'Nenhum dispositivo cliente está com sessão ativa registrada no momento.'
          }
          actionLabel={search || productFilter !== 'all' || statusFilter !== 'all' ? 'Limpar Filtros' : undefined}
          onAction={() => {
            setSearch('');
            setProductFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#121212]/50 text-[#888888] dark:text-[#707070] font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Sessão / Produto</th>
                    <th className="py-3 px-4">Cliente / Chave</th>
                    <th className="py-3 px-4">Hardware HWID & Modelo</th>
                    <th className="py-3 px-4">IP / Conexão</th>
                    <th className="py-3 px-4">Último Heartbeat</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                  {filteredSessions.map((session) => (
                    <tr
                      key={`${session.licenseId}-${session.deviceId}`}
                      className="hover:bg-neutral-50/50 dark:hover:bg-[#121212]/30 transition-colors"
                    >
                      {/* Session ID & Product */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5 font-bold text-[#111111] dark:text-white">
                          <span>{session.sessionId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(session.sessionId, `ses-${session.sessionId}`)}
                            className="text-[#888888] hover:text-[#111111] dark:hover:text-white"
                            title="Copiar ID da Sessão"
                          >
                            {copiedText === `ses-${session.sessionId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-[#888888] dark:text-[#707070] mt-0.5">
                          {session.appName}
                        </div>
                      </td>

                      {/* Client / Key */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#111111] dark:text-white truncate max-w-[160px]">
                          {session.clientName}
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                          <span className="truncate max-w-[130px]">{session.licenseKeyDisplay}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(session.licenseKeyDisplay, `key-${session.licenseKeyDisplay}`)}
                            className="text-[#888888] hover:text-[#111111] dark:hover:text-white"
                          >
                            {copiedText === `key-${session.licenseKeyDisplay}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Hardware HWID & Model */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1 text-[#111111] dark:text-neutral-200 truncate max-w-[190px]">
                          <Smartphone className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                          <span className="truncate" title={session.deviceId}>
                            {session.deviceId}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#888888] dark:text-[#707070] mt-0.5 truncate max-w-[190px]">
                          {session.deviceModel}
                        </div>
                      </td>

                      {/* IP / Network */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#666666] dark:text-[#A1A1A1]">
                        {session.ipAddress}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#666666] dark:text-[#A1A1A1]">
                        {session.lastActivityAt
                          ? new Date(session.lastActivityAt).toLocaleString(undefined, {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Pendente'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {session.status === 'active' ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Ativa</span>
                          </div>
                        ) : session.status === 'idle' ? (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Ociosa</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            <span>Desconectada</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => onNavigateToLicense(session.licenseId)}
                            title="Ver detalhes da chave"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>

                          {canMutate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:border-rose-500/50"
                              onClick={() => {
                                setSessionToDisconnect(session);
                                setDisconnectModalOpen(true);
                              }}
                              icon={<LogOut className="w-3.5 h-3.5" />}
                            >
                              Desconectar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (320px - 768px) */}
          <div className="md:hidden space-y-3">
            {filteredSessions.map((session) => (
              <div
                key={`${session.licenseId}-${session.deviceId}`}
                className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] shadow-2xs space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#111111] dark:text-white">
                        {session.sessionId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(session.sessionId, `ses-m-${session.sessionId}`)}
                        className="p-1 text-[#888888] hover:text-[#111111] dark:hover:text-white"
                      >
                        {copiedText === `ses-m-${session.sessionId}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-[#888888] dark:text-[#707070] font-mono mt-0.5">
                      {session.appName} · {session.clientName}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {session.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ativa
                      </span>
                    ) : session.status === 'idle' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-amber-600 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Ociosa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                        Inativa
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C] text-xs font-mono">
                  <div className="flex items-center justify-between text-[#888888] dark:text-[#707070]">
                    <span>Hardware HWID:</span>
                    <span className="text-[#111111] dark:text-neutral-200 font-medium truncate max-w-[180px]">
                      {session.deviceId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#888888] dark:text-[#707070]">
                    <span>Modelo:</span>
                    <span className="text-[#111111] dark:text-neutral-200 font-medium truncate max-w-[180px]">
                      {session.deviceModel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#888888] dark:text-[#707070]">
                    <span>Último Heartbeat:</span>
                    <span className="text-[#111111] dark:text-neutral-200">
                      {session.lastActivityAt
                        ? new Date(session.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Pendente'}
                    </span>
                  </div>
                </div>

                {/* Mobile Actions (Min 44px touch targets) */}
                <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToLicense(session.licenseId)}
                    className="flex-1 min-h-[44px] px-3 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50 dark:bg-[#141414] text-xs font-semibold text-[#111111] dark:text-white flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
                  >
                    <span>Ver Chave</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => {
                        setSessionToDisconnect(session);
                        setDisconnectModalOpen(true);
                      }}
                      className="min-h-[44px] px-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Desconectar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Disconnect Session Dialog */}
      <ConfirmDialog
        isOpen={disconnectModalOpen}
        title="Desconectar Sessão Ativa"
        message={`Deseja forçar a desconexão da sessão ${sessionToDisconnect?.sessionId} associada ao cliente ${sessionToDisconnect?.clientName}? O hardware ${sessionToDisconnect?.deviceId} será desvinculado e precisará de nova autenticação no APK.`}
        confirmLabel="Desconectar Hardware"
        cancelLabel="Manter Sessão"
        isDestructive={true}
        loading={disconnecting}
        onConfirm={handleConfirmDisconnect}
        onClose={() => {
          setDisconnectModalOpen(false);
          setSessionToDisconnect(null);
        }}
      />
    </div>
  );
};
