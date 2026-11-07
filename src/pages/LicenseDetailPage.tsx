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
} from 'lucide-react';

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
      const data = await api.getKey(licenseId);
      setLicense(data);
      // Pre-populate edit fields
      setEditClientName(data.clientName || '');
      setEditOrderRef(data.orderReference || '');
      setEditNotes(data.notes || '');
      setEditDeviceLimit(data.deviceLimit ?? 1);
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

  const rawDevices = (license as any)?.devices;
  const toDeviceStatus = (st?: unknown): 'active' | 'offline' | 'unlinked' => {
    const clean = String(st || 'active').toLowerCase().trim();
    if (clean === 'unlinked') return 'unlinked';
    if (clean === 'offline') return 'offline';
    return 'active';
  };

  const connectedDevices: ConnectedDevice[] = useMemo(() => {
    if (!rawDevices) return [];
    if (Array.isArray(rawDevices)) {
      return rawDevices.map((d: any, idx: number) => ({
        id: String(d?.id || d?.deviceId || d?.device_id || `dev-${idx}`),
        deviceId: String(d?.deviceId || d?.device_id || d?.id || `DEV-${idx}`),
        deviceName: d?.deviceName || d?.device_name || d?.name || 'Dispositivo Cliente',
        deviceModel: d?.deviceModel || d?.device_model || d?.model,
        licenseId: license.id,
        firstConnectedAt: typeof d?.firstConnectedAt === 'string' ? d.firstConnectedAt : d?.first_connected_at,
        lastActivityAt: typeof d?.lastActivityAt === 'string' ? d.lastActivityAt : d?.last_activity_at,
        status: toDeviceStatus(d?.status || d?.state),
      }));
    }
    if (typeof rawDevices === 'object' && rawDevices !== null) {
      return Object.entries(rawDevices).map(([k, v]: [string, any], idx: number) => {
        const valObj = typeof v === 'object' && v !== null ? v : {};
        return {
          id: String(valObj?.id || valObj?.deviceId || valObj?.device_id || k),
          deviceId: String(valObj?.deviceId || valObj?.device_id || k),
          deviceName: valObj?.deviceName || valObj?.device_name || valObj?.name || 'Dispositivo Cliente',
          deviceModel: valObj?.deviceModel || valObj?.device_model || valObj?.model,
          licenseId: license.id,
          firstConnectedAt: typeof valObj?.firstConnectedAt === 'string' ? valObj.firstConnectedAt : valObj?.first_connected_at,
          lastActivityAt: typeof valObj?.lastActivityAt === 'string' ? valObj.lastActivityAt : valObj?.last_activity_at,
          status: toDeviceStatus(valObj?.status || valObj?.state),
        };
      });
    }
    return [];
  }, [rawDevices, license?.id]);

  const activeDevices = connectedDevices.filter((d) => d.status !== 'unlinked');

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight text-[#111111] dark:text-white font-mono">{keyDisplay}</h1>
              <Button
                variant="outline"
                size="xs"
                onClick={handleCopyKey}
                icon={copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                title="Copiar Chave Completa"
              >
                {copied ? 'Copiada' : 'Copiar Key'}
              </Button>
              <StatusText status={license.status} />
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
          </div>
        )}
      </div>

      {/* Main Grid: Details + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata & Connected Devices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Core Information */}
          <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#888888] dark:text-[#707070]" />
              <span>Configuração da Licença</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Cliente</span>
                <span className="text-[#111111] dark:text-neutral-100 font-sans font-medium text-xs mt-0.5 block truncate">
                  {license.clientName || 'Cliente Geral'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Referência</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block truncate">
                  {license.orderReference || '—'}
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
                  {license.activationMode === 'first_use' ? 'No 1º Uso' : 'Imediato'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Data de Criação</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block">
                  {license.createdAt ? new Date(license.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Expiração</span>
                <span className="text-[#111111] dark:text-neutral-200 mt-0.5 block">
                  {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Ativa'}
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
                          {dev.firstConnectedAt ? new Date(dev.firstConnectedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#666666] dark:text-neutral-400 text-[11px]">
                          {dev.lastActivityAt ? new Date(dev.lastActivityAt).toLocaleDateString() : '—'}
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
