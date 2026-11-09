import React, { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import type { LicenseKey, ConnectedDevice, LicenseStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusText } from '../components/ui/StatusText';
import { Skeleton } from '../components/ui/Skeleton';
import {
  ArrowLeft,
  KeyRound,
  Smartphone,
  RotateCcw,
  Ban,
  Archive,
  Unlink,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Copy,
  Check,
  Trash2,
  Hourglass,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import {
  formatFullDateTime,
  formatSimpleDate,
  getRealLicenseStatus,
  getRemainingTime,
  markKeyAsDeletedLocally,
  normalizeLicense,
  parseTimestampToDate,
} from '../lib/licenseUtils';

interface LicenseDetailPageProps {
  licenseId: string;
  onBack: () => void;
}

export const LicenseDetailPage: React.FC<LicenseDetailPageProps> = ({ licenseId, onBack }) => {
  const { canMutate } = useAuth();
  const toast = useToast();

  const [license, setLicense] = useState<LicenseKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [externalDevices, setExternalDevices] = useState<ConnectedDevice[]>([]);

  // Second-by-second ticker for live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyKey = () => {
    const valueToCopy = license?.key || license?.id;
    if (!valueToCopy) return;
    navigator.clipboard.writeText(valueToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Chave de licença copiada', valueToCopy);
  };

  // Dialog States
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewDuration, setRenewDuration] = useState(30);
  const [renewUnit, setRenewUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days'>('days');
  const [renewReason, setRenewReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editOrderRef, setEditOrderRef] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeviceLimit, setEditDeviceLimit] = useState(1);

  // Destructive Confirm Dialogs
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: async () => {},
  });

  const fetchLicenseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keyRes, devsRes] = await Promise.allSettled([
        api.getKey(licenseId),
        api.getDevices(),
      ]);

      let data: any = null;
      if (keyRes.status === 'fulfilled') {
        data = keyRes.value;
      } else {
        throw keyRes.reason;
      }

      const normalized = normalizeLicense(data);
      setLicense(normalized);

      // Pre-populate edit fields
      setEditClientName(normalized.clientName || '');
      setEditOrderRef(normalized.orderReference || '');
      setEditNotes(normalized.notes || '');
      setEditDeviceLimit(normalized.deviceLimit ?? 1);

      // Merge devices from /admin/devices if available
      if (devsRes.status === 'fulfilled' && Array.isArray(devsRes.value?.devices)) {
        const matching = devsRes.value.devices.filter((d: any) => {
          const dLicId = String(d.licenseId || d.license_id || '');
          const dKey = String(d.key || d.licenseKey || '');
          return (
            dLicId === licenseId ||
            dLicId === normalized.id ||
            (normalized.key && dLicId === normalized.key) ||
            (normalized.key && dKey === normalized.key)
          );
        });
        setExternalDevices(matching);
      }
    } catch (err: unknown) {
      console.error('Failed to load license detail:', err);
      if (err instanceof ApiError) {
        if (err.isEndpointUnimplemented) {
          setError(
            `Endpoint GET /admin/keys/${licenseId} retornou 404. Esta chave específica pode não existir ou a rota individual não está ativa no Worker.`
          );
        } else {
          setError(err.message);
        }
      } else {
        setError('Falha ao comunicar com a API do Cloudflare Worker.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenseDetails();
  }, [licenseId]);

  // Handle Status Transitions
  const handleUpdateStatus = (newStatus: LicenseStatus, title: string, message: string) => {
    if (!canMutate) return;
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmLabel: `Definir como ${newStatus}`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.updateKeyStatus(licenseId, newStatus);
          toast.success(`Licença marcada como ${newStatus}`);
          await fetchLicenseDetails();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha ao atualizar status da licença';
          toast.error('Erro na atualização', msg);
        } finally {
          setActionLoading(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle Renew
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    setActionLoading(true);
    try {
      await api.renewKey(licenseId, {
        duration: Number(renewDuration),
        durationUnit: renewUnit,
        reason: renewReason || undefined,
      });
      toast.success('Licença renovada com sucesso');
      setRenewModalOpen(false);
      await fetchLicenseDetails();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Worker API rejeitou a renovação';
      toast.error('Falha na renovação', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Metadata
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    setActionLoading(true);
    try {
      await api.updateKeyMetadata(licenseId, {
        clientName: editClientName.trim(),
        orderReference: editOrderRef.trim() || undefined,
        notes: editNotes.trim() || undefined,
        deviceLimit: Number(editDeviceLimit),
      });
      toast.success('Detalhes da licença atualizados');
      setEditModalOpen(false);
      await fetchLicenseDetails();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha na atualização de metadados';
      toast.error('Erro ao salvar', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Archive
  const handleArchive = () => {
    if (!canMutate) return;
    setConfirmState({
      isOpen: true,
      title: 'Arquivar Chave de Licença',
      message: 'Tem certeza de que deseja arquivar esta licença? Ela será marcada como inativa e oculta de consultas de autorização de dispositivos.',
      confirmLabel: 'Arquivar Licença',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.archiveKey(licenseId);
          toast.success('Licença arquivada com sucesso');
          await fetchLicenseDetails();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha ao arquivar licença';
          toast.error('Erro ao arquivar', msg);
        } finally {
          setActionLoading(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle Permanent Deletion
  const handleDeleteKey = () => {
    if (!canMutate) return;
    setConfirmState({
      isOpen: true,
      title: 'Excluir Key Permanentemente',
      message: 'Tem certeza de que deseja excluir permanentemente esta chave de licença? Esta ação não pode ser desfeita. A chave sumirá imediatamente de todas as visualizações do painel.',
      confirmLabel: 'Excluir Permanentemente',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.deleteKey(licenseId);
          markKeyAsDeletedLocally(licenseId);
          toast.success('Chave de licença excluída com sucesso');
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          onBack();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha ao excluir chave';
          toast.error('Aviso de exclusão', msg);
          markKeyAsDeletedLocally(licenseId);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          onBack();
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Handle Unlink One Device
  const handleUnlinkDevice = (device: ConnectedDevice) => {
    if (!canMutate) return;
    setConfirmState({
      isOpen: true,
      title: 'Desvincular Dispositivo',
      message: `Desvincular o hardware "${device.deviceName || device.deviceId}" desta licença? O aplicativo cliente precisará reautenticar na próxima sessão.`,
      confirmLabel: 'Desvincular Hardware',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.unlinkDevice(licenseId, device.deviceId);
          toast.success('Dispositivo desvinculado com sucesso');
          await fetchLicenseDetails();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Worker API rejeitou a desvinculação';
          toast.error('Erro na desvinculação', msg);
        } finally {
          setActionLoading(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle Unlink All Devices
  const handleUnlinkAllDevices = () => {
    if (!canMutate) return;
    setConfirmState({
      isOpen: true,
      title: 'Desvincular Todos os Dispositivos',
      message: 'Tem certeza de que deseja desconectar e limpar TODAS as vinculações de hardware ativas para esta licença?',
      confirmLabel: 'Desconectar Todos',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.unlinkAllDevices(licenseId);
          toast.success('Todos os dispositivos foram desvinculados');
          await fetchLicenseDetails();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha ao desvincular dispositivos';
          toast.error('Erro em lote', msg);
        } finally {
          setActionLoading(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const toDeviceStatus = (st?: unknown): 'active' | 'offline' | 'unlinked' => {
    const clean = String(st || 'active').toLowerCase().trim();
    if (clean === 'unlinked') return 'unlinked';
    if (clean === 'offline') return 'offline';
    return 'active';
  };

  const connectedDevices: ConnectedDevice[] = useMemo(() => {
    if (!license) return [];
    const list: ConnectedDevice[] = [];
    const seenHwids = new Set<string>();

    const addDevice = (d: any, idx: number) => {
      if (!d) return;
      const hwid = String(d.deviceId || d.device_id || d.hwid || d.id || `dev-${idx}`).trim();
      if (!hwid || seenHwids.has(hwid)) return;
      seenHwids.add(hwid);

      const parsedFirst = parseTimestampToDate(
        d.firstConnectedAt || d.first_connected_at || d.createdAt || d.created_at || d.activatedAt || d.timestamp
      );
      const parsedLast = parseTimestampToDate(
        d.lastActivityAt || d.last_activity_at || d.last_seen || d.lastSeen || d.updatedAt || d.timestamp
      );

      list.push({
        id: String(d.id || hwid),
        deviceId: hwid,
        deviceName: d.deviceName || d.device_name || d.name || 'Dispositivo Cliente',
        deviceModel: d.deviceModel || d.device_model || d.model || 'Android',
        licenseId: license.id,
        firstConnectedAt: parsedFirst ? parsedFirst.toISOString() : undefined,
        lastActivityAt: parsedLast ? parsedLast.toISOString() : undefined,
        status: toDeviceStatus(d.status || d.state),
      });
    };

    // 1. Devices from normalized license
    if (Array.isArray(license.devices)) {
      license.devices.forEach((d: any, idx: number) => addDevice(d, idx));
    }

    // 2. Devices from raw license document
    const rawDevs = (license as any)?.device_list || (license as any)?.connected_devices || (license as any)?.devices;
    if (Array.isArray(rawDevs)) {
      rawDevs.forEach((d: any, idx: number) => addDevice(d, idx));
    } else if (typeof rawDevs === 'object' && rawDevs !== null) {
      Object.entries(rawDevs).forEach(([k, v], idx) => {
        if (typeof v === 'object' && v !== null) {
          addDevice({ deviceId: k, ...(v as any) }, idx);
        } else {
          addDevice({ deviceId: k }, idx);
        }
      });
    }

    // 3. Devices from external /admin/devices
    if (Array.isArray(externalDevices)) {
      externalDevices.forEach((d: any, idx: number) => addDevice(d, idx));
    }

    // 4. Root single device fields
    const rootHwid = (license as any)?.device_id || (license as any)?.deviceId || (license as any)?.hwid;
    if (rootHwid) {
      addDevice({
        deviceId: rootHwid,
        deviceName: (license as any)?.device_name || (license as any)?.deviceName,
        deviceModel: (license as any)?.device_model || (license as any)?.deviceModel,
        firstConnectedAt: license.activatedAt || license.createdAt,
        lastActivityAt: (license as any)?.last_activity_at || license.activatedAt,
        status: 'active',
      }, list.length);
    }

    return list;
  }, [license, externalDevices]);

  const activeDevices = connectedDevices.filter((d) => d.status !== 'unlinked');
  const realStatus = license ? getRealLicenseStatus(license) : 'active';

  const countdown = useMemo(() => {
    if (!license) return null;
    return getRemainingTime(license);
  }, [license, currentTime]);

  const firstActivationDate = useMemo(() => {
    if (!license) return null;
    return (
      license.activatedAt ||
      (license as any).activated_at ||
      (license as any).first_connected_at ||
      connectedDevices[0]?.firstConnectedAt ||
      null
    );
  }, [license, connectedDevices]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !license) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Voltar às Licenças
        </Button>
        <div className="p-6 bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-[#111111] dark:text-white font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Não foi possível carregar os detalhes da licença</span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] font-mono leading-relaxed">{error}</p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={fetchLicenseDetails}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const keyDisplay = license.keyPrefix
    ? `${license.keyPrefix}••••••••${license.keySuffix || ''}`
    : license.key || license.id;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-white font-mono break-all">{keyDisplay}</h1>
              <Button
                variant="outline"
                size="xs"
                onClick={handleCopyKey}
                icon={copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                title="Copiar Chave Completa"
              >
                {copied ? 'Copiada' : 'Copiar Key'}
              </Button>
              <StatusText status={realStatus} />
            </div>
            <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">
              Cliente: <span className="text-[#111111] dark:text-neutral-200 font-medium">{license.clientName}</span>
              {license.orderReference && ` · Pedido: ${license.orderReference}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {canMutate && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              icon={<Edit className="w-3.5 h-3.5" />}
            >
              Editar Detalhes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRenewModalOpen(true)}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Renovar Licença
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/40"
              onClick={handleDeleteKey}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Excluir Key
            </Button>
          </div>
        )}
      </div>

      {/* Countdown Timer Live Card */}
      {countdown && (
        <div
          className={`p-4 sm:p-5 rounded-xl border shadow-2xs transition-all ${
            countdown.isExpired
              ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
              : countdown.isLifetime
              ? 'bg-neutral-50 dark:bg-[#161616]/70 border-[#E8E8E8] dark:border-[#252525]'
              : countdown.isPending
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              : 'bg-neutral-900 text-white dark:bg-[#141414] border-neutral-800 dark:border-[#2a2a2a]'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Hourglass
                  className={`w-4 h-4 shrink-0 ${
                    countdown.isExpired
                      ? 'text-red-500 animate-pulse'
                      : countdown.isPending
                      ? 'text-amber-500'
                      : 'text-neutral-400'
                  }`}
                />
                <span className="text-xs uppercase tracking-wider font-semibold font-mono">
                  {countdown.isExpired
                    ? 'Validade Expirada'
                    : countdown.isLifetime
                    ? 'Licença Vitalícia'
                    : countdown.isPending
                    ? 'Aguardando 1º Acesso do Dispositivo'
                    : 'Tempo Restante até a Expiração'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-black/10 dark:bg-white/10 text-inherit border border-current/20">
                  Ao vivo (1s)
                </span>
              </div>
              <p className="text-xs opacity-85 font-sans leading-relaxed">
                {countdown.isExpired
                  ? 'Esta chave ultrapassou a data limite e foi desativada pelo sistema. Renove a licença para reativar.'
                  : countdown.isLifetime
                  ? 'Esta licença opera sem expiração programada.'
                  : countdown.isPending
                  ? `O prazo começará a contar no momento em que o aplicativo cliente efetuar o primeiro login (${license.duration || 30} ${license.durationUnit || 'dias'}).`
                  : `Expiração exata: ${formatFullDateTime(license.expiresAt)}`}
              </p>
            </div>

            {!countdown.isLifetime && !countdown.isPending && !countdown.isExpired && (
              <div className="grid grid-cols-4 gap-2 text-center font-mono shrink-0">
                <div className="p-2 sm:p-2.5 rounded-lg bg-white/10 dark:bg-black/30 border border-white/15 dark:border-white/10 min-w-[56px] sm:min-w-[66px]">
                  <div className="text-base sm:text-xl font-bold tracking-tight text-white tabular-nums">
                    {String(countdown.days).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-neutral-300 dark:text-neutral-400">Dias</div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-lg bg-white/10 dark:bg-black/30 border border-white/15 dark:border-white/10 min-w-[56px] sm:min-w-[66px]">
                  <div className="text-base sm:text-xl font-bold tracking-tight text-white tabular-nums">
                    {String(countdown.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-neutral-300 dark:text-neutral-400">Horas</div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-lg bg-white/10 dark:bg-black/30 border border-white/15 dark:border-white/10 min-w-[56px] sm:min-w-[66px]">
                  <div className="text-base sm:text-xl font-bold tracking-tight text-white tabular-nums">
                    {String(countdown.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-neutral-300 dark:text-neutral-400">Min</div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-lg bg-white/10 dark:bg-black/30 border border-white/15 dark:border-white/10 min-w-[56px] sm:min-w-[66px]">
                  <div className="text-base sm:text-xl font-bold tracking-tight text-emerald-400 tabular-nums">
                    {String(countdown.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-neutral-300 dark:text-neutral-400">Seg</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Details + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata & Connected Devices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Core Information */}
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
                <span>Configuração & Metadados da Licença</span>
              </h3>
              <StatusText status={realStatus} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs font-mono">
              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Cliente</span>
                <span className="text-[#111111] dark:text-neutral-100 font-sans font-medium text-xs mt-0.5 block truncate">
                  {license.clientName || 'Cliente Geral'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Referência do Pedido</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block truncate font-medium">
                  {license.orderReference || (license as any).order_reference || (license as any).reference || (license as any).orderId || 'Sem referência'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Limite de Hardware</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block">
                  {license.deviceLimit === -1 || license.deviceLimit === 0
                    ? 'Ilimitado'
                    : `${license.deviceLimit} Dispositivo(s)`}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Modo de Ativação</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block">
                  {license.activationMode === 'first_use' ? 'No 1º Uso' : 'Imediato (Criação)'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Data & Hora de Criação</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block font-semibold">
                  {formatFullDateTime(license.createdAt || (license as any).created_at)}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Data & Hora de Expiração</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block font-semibold">
                  {license.expiresAt
                    ? formatFullDateTime(license.expiresAt)
                    : license.activationMode === 'first_use' && !firstActivationDate
                    ? `Aguardando 1º uso (+${license.duration || 30} ${license.durationUnit === 'hours' ? 'hora(s)' : license.durationUnit === 'minutes' ? 'minuto(s)' : 'dia(s)'})`
                    : 'Vitalícia (Sem expiração)'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Primeiro Handshake / Ativação</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block font-semibold">
                  {firstActivationDate ? (
                    formatFullDateTime(firstActivationDate)
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Aguardando 1º login no APK</span>
                  )}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Duração Contratual</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block">
                  {license.duration
                    ? `${license.duration} ${
                        license.durationUnit === 'hours'
                          ? 'hora(s)'
                          : license.durationUnit === 'minutes'
                          ? 'minuto(s)'
                          : 'dia(s)'
                      }`
                    : 'Vitalícia'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Status Real Calculado</span>
                <span className="mt-1 block">
                  <StatusText status={realStatus} />
                </span>
              </div>
            </div>

            {license.notes && (
              <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C]">
                <span className="text-xs text-[#666666] dark:text-[#A1A1A1] font-medium block mb-1">Notas Administrativas</span>
                <p className="text-xs text-[#111111] dark:text-neutral-300 bg-neutral-50 dark:bg-[#161616]/40 p-3 rounded-lg border border-[#E8E8E8] dark:border-[#252525] leading-relaxed font-sans">
                  {license.notes}
                </p>
              </div>
            )}
          </div>

          {/* Card: Bound Hardware Devices */}
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
                  <span>Dispositivos de Hardware Vinculados</span>
                </h3>
                <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                  {activeDevices.length} vinculado(s) de{' '}
                  {license.deviceLimit === -1 ? 'ilimitados' : license.deviceLimit} permitidos
                </p>
              </div>

              {canMutate && activeDevices.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkAllDevices}
                  loading={actionLoading}
                  className="text-xs h-7 px-2.5 text-[#666666] dark:text-neutral-300"
                  icon={<Unlink className="w-3 h-3" />}
                >
                  Desvincular Todos
                </Button>
              )}
            </div>

            {connectedDevices.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-lg">
                <Smartphone className="w-6 h-6 text-[#888888] dark:text-[#707070] mx-auto mb-2" />
                <div className="text-xs text-[#111111] dark:text-neutral-300 font-medium">Nenhum hardware vinculado</div>
                <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                  O vínculo ocorre automaticamente quando o software cliente conecta com esta chave.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#888888] dark:text-[#707070] border-b border-[#E8E8E8] dark:border-[#1C1C1C] pb-2">
                      <th className="py-2 px-2 font-medium">Dispositivo & Modelo</th>
                      <th className="py-2 px-2 font-medium">Identificador (HWID)</th>
                      <th className="py-2 px-2 font-medium">Primeira Conexão</th>
                      <th className="py-2 px-2 font-medium">Última Atividade</th>
                      <th className="py-2 px-2 font-medium text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                    {connectedDevices.map((dev) => (
                      <tr key={dev.deviceId || dev.id} className="hover:bg-neutral-50 dark:hover:bg-[#161616]/40">
                        <td className="py-3 px-2">
                          <div className="font-semibold text-[#111111] dark:text-white">{dev.deviceName || 'Dispositivo Cliente'}</div>
                          {dev.deviceModel && (
                            <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] font-mono">{dev.deviceModel}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#666666] dark:text-neutral-400 text-[11px] select-all">
                          {dev.deviceId}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#666666] dark:text-neutral-400 text-[11px]">
                          {dev.firstConnectedAt ? formatFullDateTime(dev.firstConnectedAt) : '—'}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#666666] dark:text-neutral-400 text-[11px]">
                          {dev.lastActivityAt ? formatFullDateTime(dev.lastActivityAt) : '—'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {canMutate && dev.status !== 'unlinked' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlinkDevice(dev)}
                              className="text-xs h-7 px-2"
                              icon={<Unlink className="w-3 h-3" />}
                            >
                              Desvincular
                            </Button>
                          )}
                          {dev.status === 'unlinked' && (
                            <span className="text-[11px] text-[#888888] dark:text-[#707070] font-mono">Desvinculado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Status Controls */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight">
              Controles de Ciclo de Vida
            </h3>
            <p className="text-xs text-[#666666] dark:text-[#A1A1A1]">
              Transições administrativas de estado processadas diretamente pelo Cloudflare Worker.
            </p>

            <div className="space-y-2 pt-2">
              {license.status !== 'active' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full text-xs justify-start"
                  onClick={() =>
                    handleUpdateStatus(
                      'active',
                      'Reativar Licença',
                      'Reautorizar esta chave permitirá que dispositivos clientes façam autenticações com sucesso imediatamente.'
                    )
                  }
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                >
                  Reativar Licença
                </Button>
              )}

              {license.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start"
                  onClick={() =>
                    handleUpdateStatus(
                      'suspended',
                      'Suspender Temporariamente',
                      'A suspensão bloqueia a validação de novos handshakes mantendo os vínculos de hardware salvos.'
                    )
                  }
                  icon={<Clock className="w-4 h-4 text-amber-500" />}
                >
                  Suspender Temporariamente
                </Button>
              )}

              {license.status !== 'banned' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start text-red-600 dark:text-red-400"
                  onClick={() =>
                    handleUpdateStatus(
                      'banned',
                      'Banir Credencial de Licença',
                      'O banimento rejeita permanentemente qualquer requisição associada a esta chave.'
                    )
                  }
                  icon={<Ban className="w-4 h-4" />}
                >
                  Banir Licença
                </Button>
              )}

              {license.status !== 'archived' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start text-[#666666] dark:text-[#A1A1A1]"
                  onClick={handleArchive}
                  icon={<Archive className="w-4 h-4" />}
                >
                  Arquivar Licença
                </Button>
              )}

              {canMutate && (
                <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/40"
                    onClick={handleDeleteKey}
                    icon={<Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  >
                    Excluir Key Permanentemente
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#161616]/40 text-xs text-[#666666] dark:text-[#A1A1A1] space-y-2 font-mono">
            <div className="text-[#111111] dark:text-white font-semibold font-sans flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Garantia de Segurança</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#666666] dark:text-[#A1A1A1]">
              Alterações de status se propagam instantaneamente pelos nós de borda da Cloudflare e atualizam o Firestore.
            </p>
          </div>
        </div>
      </div>

      {/* Renew Modal */}
      <Modal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title="Renovar Licença de Software"
        description="Estenda a duração operacional desta licença no Worker."
      >
        <form onSubmit={handleRenewSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min="1"
              label="Quantidade"
              value={renewDuration}
              onChange={(e) => setRenewDuration(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            <Select
              label="Unidade de Tempo"
              value={renewUnit}
              onChange={(e) =>
                setRenewUnit(e.target.value as 'seconds' | 'minutes' | 'hours' | 'days')
              }
              options={[
                { label: 'Dias', value: 'days' },
                { label: 'Horas', value: 'hours' },
                { label: 'Minutos', value: 'minutes' },
                { label: 'Segundos', value: 'seconds' },
              ]}
            />
          </div>

          <Textarea
            label="Motivo da Renovação / Ref. do Pedido"
            placeholder="Ex: Renovação mensal aprovada via PIX..."
            value={renewReason}
            onChange={(e) => setRenewReason(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setRenewModalOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={actionLoading}>
              Confirmar Renovação
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Dados da Licença"
        description="Atualize o nome do cliente, referência e limite de dispositivos."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Nome do Cliente"
            value={editClientName}
            onChange={(e) => setEditClientName(e.target.value)}
            required
          />
          <Input
            label="Referência do Pedido"
            value={editOrderRef}
            onChange={(e) => setEditOrderRef(e.target.value)}
          />
          <Input
            type="number"
            min="-1"
            label="Limite de Dispositivos (-1 para ilimitado)"
            value={editDeviceLimit}
            onChange={(e) => setEditDeviceLimit(parseInt(e.target.value) || 1)}
            helperText="Defina como -1 ou 0 para permitir conexões ilimitadas."
          />
          <Textarea
            label="Notas Internas"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setEditModalOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={actionLoading}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reusable Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        loading={actionLoading}
        isDestructive={true}
      />
    </div>
  );
};
