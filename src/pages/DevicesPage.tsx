import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import type { LicenseKey } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusText } from '../components/ui/StatusText';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import {
  Smartphone,
  Search,
  RefreshCw,
  Unlink,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface DevicesPageProps {
  onNavigateToLicense: (licenseId: string) => void;
}

export interface EnrichedDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  licenseId: string;
  licenseClient: string;
  licenseKeyDisplay: string;
  status: string;
  firstConnectedAt?: string;
  lastActivityAt?: string;
  appVersion?: string;
  ipAddress?: string;
}

// Robust timestamp parser supporting ISO strings, epoch seconds/millis, and Firestore timestamps
function parseTimestamp(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    const secs = obj.seconds ?? obj._seconds;
    if (typeof secs === 'number') {
      return new Date(secs * 1000).toISOString();
    }
  }
  return undefined;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

// Normalizes any device representation (camelCase or snake_case from Android client)
function normalizeDevice(rawDev: any, lic?: LicenseKey): EnrichedDevice {
  const deviceId =
    rawDev?.deviceId ||
    rawDev?.device_id ||
    rawDev?.id ||
    rawDev?.hwid ||
    rawDev?.hardware_id ||
    'UNKNOWN-HWID';

  const deviceName =
    rawDev?.deviceName ||
    rawDev?.device_name ||
    rawDev?.name ||
    'Dispositivo Cliente';

  const deviceModel =
    rawDev?.deviceModel ||
    rawDev?.device_model ||
    rawDev?.model ||
    rawDev?.platform ||
    'Android';

  const rawStatus = rawDev?.status || rawDev?.state || 'active';
  const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'active';

  const rawLastActivity =
    rawDev?.lastActivityAt ||
    rawDev?.last_activity_at ||
    rawDev?.lastActivity ||
    rawDev?.last_seen ||
    rawDev?.lastSeen ||
    rawDev?.timestamp ||
    rawDev?.updatedAt ||
    rawDev?.updated_at;

  const rawFirstConnected =
    rawDev?.firstConnectedAt ||
    rawDev?.first_connected_at ||
    rawDev?.activatedAt ||
    rawDev?.activated_at ||
    rawDev?.createdAt ||
    rawDev?.created_at;

  const licenseId = String(rawDev?.licenseId || rawDev?.license_id || lic?.id || '');
  const licenseClient = String(rawDev?.licenseClient || rawDev?.clientName || lic?.clientName || 'Cliente Geral');

  const licenseKeyDisplay =
    rawDev?.licenseKeyDisplay ||
    (lic?.keyPrefix
      ? `${lic.keyPrefix}••••${lic.keySuffix || ''}`
      : lic?.key || lic?.id || '—');

  return {
    id: `${licenseId}-${deviceId}`,
    deviceId: String(deviceId),
    deviceName: String(deviceName),
    deviceModel: String(deviceModel),
    licenseId,
    licenseClient,
    licenseKeyDisplay: String(licenseKeyDisplay),
    status,
    lastActivityAt: parseTimestamp(rawLastActivity),
    firstConnectedAt: parseTimestamp(rawFirstConnected),
    appVersion: rawDev?.appVersion || rawDev?.app_version,
    ipAddress: rawDev?.ip || rawDev?.ipAddress || rawDev?.ip_address,
  };
}

// Safely extracts devices from any license document (handles array, map, or summary)
function extractDevicesFromLicense(lic: LicenseKey): EnrichedDevice[] {
  if (!lic) return [];
  const list: EnrichedDevice[] = [];

  const rawDevices = (lic as any).devices;
  if (Array.isArray(rawDevices)) {
    for (const dev of rawDevices) {
      if (typeof dev === 'object' && dev !== null) {
        list.push(normalizeDevice(dev, lic));
      } else if (typeof dev === 'string' && dev.trim()) {
        list.push(normalizeDevice({ device_id: dev.trim() }, lic));
      }
    }
  } else if (typeof rawDevices === 'object' && rawDevices !== null) {
    for (const [key, devVal] of Object.entries(rawDevices)) {
      if (typeof devVal === 'object' && devVal !== null) {
        list.push(normalizeDevice({ device_id: key, ...(devVal as any) }, lic));
      } else {
        list.push(normalizeDevice({ device_id: key }, lic));
      }
    }
  }

  return list;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({ onNavigateToLicense }) => {
  const { canMutate } = useAuth();
  const toast = useToast();

  const [devicesList, setDevicesList] = useState<EnrichedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Query licenses to aggregate devices
      const res = await api.getKeys({ limit: 200 });
      const licenses: LicenseKey[] = Array.isArray(res?.keys) ? res.keys : [];

      const aggregated: EnrichedDevice[] = [];
      const seenIds = new Set<string>();

      for (const lic of licenses) {
        const fromLic = extractDevicesFromLicense(lic);
        for (const dev of fromLic) {
          const uniqueKey = `${dev.licenseId}::${dev.deviceId}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            aggregated.push(dev);
          }
        }
      }

      // Step 2: Try direct /admin/devices endpoint in case backend maintains a central registry
      try {
        const directDevs = await api.getDevices();
        if (Array.isArray(directDevs?.devices)) {
          for (const d of directDevs.devices) {
            const normalized = normalizeDevice(d);
            const uniqueKey = `${normalized.licenseId}::${normalized.deviceId}`;
            if (!seenIds.has(uniqueKey)) {
              seenIds.add(uniqueKey);
              aggregated.push(normalized);
            }
          }
        }
      } catch {
        // /admin/devices is optional
      }

      setDevicesList(aggregated);
    } catch (err: unknown) {
      console.error('Failed to load device keys:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao carregar dispositivos do Cloudflare Worker.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devicesList;
    const q = searchQuery.toLowerCase().trim();
    return devicesList.filter((d) => {
      const name = (d.deviceName || '').toLowerCase();
      const model = (d.deviceModel || '').toLowerCase();
      const id = (d.deviceId || '').toLowerCase();
      const client = (d.licenseClient || '').toLowerCase();
      const keyDisp = (d.licenseKeyDisplay || '').toLowerCase();
      return (
        name.includes(q) ||
        model.includes(q) ||
        id.includes(q) ||
        client.includes(q) ||
        keyDisp.includes(q)
      );
    });
  }, [devicesList, searchQuery]);

  const handleUnlink = (device: EnrichedDevice) => {
    if (!canMutate) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Desvincular Dispositivo',
      message: `Desconectar o dispositivo "${device.deviceName || device.deviceId}" da licença de "${device.licenseClient}"? O software cliente perderá o acesso imediatamente.`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.unlinkDevice(device.licenseId, device.deviceId);
          toast.success('Dispositivo desvinculado com sucesso');
          await fetchDevices();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha na desvinculação';
          toast.error('Erro ao desvincular', msg);
        } finally {
          setActionLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <ErrorBoundary fallbackTitle="Registro de Dispositivos" onReset={fetchDevices}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Registro de Hardware (HWID)
            </h1>
            <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
              Assinaturas de hardware e terminais móveis autorizados pelo Cloudflare Worker.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
        </div>

        {/* Search and Counts */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="max-w-md w-full">
            <Input
              placeholder="Buscar por nome, modelo, HWID ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="text-xs font-mono text-[#888888] dark:text-[#707070] self-center">
            Dispositivos Registrados: <span className="text-[#111111] dark:text-white font-semibold tabular-nums">{filteredDevices.length}</span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDevices}>
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Device List Table */}
        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : filteredDevices.length === 0 ? (
          <EmptyState
            icon={<Smartphone className="w-6 h-6 text-[#888888] dark:text-[#707070]" />}
            title={searchQuery ? 'Nenhum dispositivo encontrado' : 'Nenhum hardware conectado'}
            description={
              searchQuery
                ? `Nenhum dispositivo corresponde a "${searchQuery}". Tente outro termo.`
                : 'Os dispositivos aparecerão aqui automaticamente quando os clientes realizarem autenticações no app.'
            }
            actionLabel={searchQuery ? 'Limpar Busca' : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
          />
        ) : (
          <div className="space-y-4">
            {/* Mobile Device Cards (< 640px) */}
            <div className="block sm:hidden space-y-3">
              {filteredDevices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[#111111] dark:text-white truncate">
                        {dev.deviceName || 'Dispositivo Cliente'}
                      </div>
                      <div className="text-[10px] text-[#888888] dark:text-[#707070] font-mono mt-0.5">
                        {dev.deviceModel || 'Android'}
                        {dev.appVersion && ` · v${dev.appVersion}`}
                      </div>
                    </div>
                    <StatusText status={dev.status} />
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-[#161616]/60 border border-[#E8E8E8] dark:border-[#252525] space-y-1">
                    <span className="text-[10px] text-[#888888] dark:text-[#707070] uppercase font-mono block">
                      Identificador de Hardware (HWID)
                    </span>
                    <span className="font-mono text-xs text-[#111111] dark:text-neutral-200 break-all select-all block">
                      {dev.deviceId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#A1A1A1] pt-0.5">
                    <div>
                      {dev.licenseId ? (
                        <button
                          onClick={() => onNavigateToLicense(dev.licenseId)}
                          className="text-left font-medium text-[#111111] dark:text-white hover:underline flex items-center gap-1"
                        >
                          <span>{dev.licenseClient}</span>
                          <ExternalLink className="w-3 h-3 text-[#888888]" />
                        </button>
                      ) : (
                        <span>Sem licença</span>
                      )}
                    </div>
                    <span className="tabular-nums">
                      {formatDate(dev.lastActivityAt)}
                    </span>
                  </div>

                  {canMutate && dev.status !== 'unlinked' && dev.licenseId && (
                    <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlink(dev)}
                        className="w-full text-xs h-8 justify-center"
                        icon={<Unlink className="w-3.5 h-3.5" />}
                      >
                        Desvincular Hardware
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#161616]/40 text-[#666666] dark:text-[#A1A1A1]">
                      <th className="py-3 px-4 font-medium">Dispositivo & Modelo</th>
                      <th className="py-3 px-4 font-medium">Identificador (HWID)</th>
                      <th className="py-3 px-4 font-medium">Licença Vinculada</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Última Atividade</th>
                      <th className="py-3 px-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                    {filteredDevices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-neutral-50 dark:hover:bg-[#161616]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#111111] dark:text-white">
                            {dev.deviceName || 'Dispositivo Cliente'}
                          </div>
                          <div className="text-[11px] text-[#888888] dark:text-[#707070] font-mono">
                            {dev.deviceModel || 'Android'}
                            {dev.appVersion && ` · v${dev.appVersion}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#666666] dark:text-neutral-400 text-[11px] select-all">
                          {dev.deviceId}
                        </td>
                        <td className="py-3 px-4">
                          {dev.licenseId ? (
                            <button
                              onClick={() => onNavigateToLicense(dev.licenseId)}
                              className="text-left group flex items-center gap-1.5 hover:underline transition-colors"
                            >
                              <div>
                                <div className="text-[#111111] dark:text-white font-medium">
                                  {dev.licenseClient}
                                </div>
                                <div className="text-[10px] text-[#888888] dark:text-[#707070] font-mono">
                                  {dev.licenseKeyDisplay}
                                </div>
                              </div>
                              <ExternalLink className="w-3 h-3 text-[#888888] dark:text-[#707070] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <span className="text-[#888888] dark:text-[#707070] font-mono text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusText status={dev.status} />
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[#666666] dark:text-neutral-400 text-[11px] whitespace-nowrap">
                          {formatDate(dev.lastActivityAt)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canMutate && dev.status !== 'unlinked' && dev.licenseId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlink(dev)}
                              className="h-7 px-2.5 text-xs text-[#666666] dark:text-neutral-300"
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
            </div>
          </div>
        )}

        {/* Confirm Unlink Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Desvincular Hardware"
          loading={actionLoading}
          isDestructive={true}
        />
      </div>
    </ErrorBoundary>
  );
};
