import React, { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import type { LicenseKey } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusText } from '../components/ui/StatusText';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  KeyRound,
  Search,
  RefreshCw,
  Plus,
  ArrowUpDown,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  formatSimpleDate,
  getRealLicenseStatus,
  getDeletedKeyIds,
  normalizeLicense,
} from '../lib/licenseUtils';
import { enterpriseStore, isAppMatch } from '../lib/enterpriseStore';

interface LicensesPageProps {
  onSelectLicense: (id: string) => void;
  onOpenCreateModal: () => void;
}

export const LicensesPage: React.FC<LicensesPageProps> = ({
  onSelectLicense,
  onOpenCreateModal,
}) => {
  const { canMutate } = useAuth();
  const toast = useToast();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'clientName' | 'status' | 'expiresAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyKey = (license: LicenseKey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const valueToCopy = license.key || license.id;
    if (!valueToCopy) return;
    navigator.clipboard.writeText(valueToCopy);
    setCopiedId(license.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast.success('Chave de licença copiada', valueToCopy);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getKeys({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        limit: 200,
      });
      const deletedSet = getDeletedKeyIds();
      const normalizedKeys = (res.keys || [])
        .map(normalizeLicense)
        .filter((k) => !deletedSet.has(k.id));
      setKeys(normalizedKeys);
    } catch (err: unknown) {
      console.error('Failed to fetch licenses:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao carregar as licenças da API Cloudflare Worker.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [statusFilter]);

  // Filtered and sorted keys
  const filteredKeys = useMemo(() => {
    const deletedSet = getDeletedKeyIds();
    return keys
      .filter((k) => {
        // Excluída (some do painel)
        if (deletedSet.has(k.id)) return false;
        const realStatus = getRealLicenseStatus(k);
        if (statusFilter !== 'all' && realStatus !== statusFilter) {
          return false;
        }
        if (appFilter !== 'all' && !isAppMatch(appFilter, k.appId)) {
          return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const client = (k.clientName || '').toLowerCase();
        const order = (k.orderReference || '').toLowerCase();
        const id = (k.id || '').toLowerCase();
        const key = (k.key || '').toLowerCase();
        const prefix = (k.keyPrefix || '').toLowerCase();
        const suffix = (k.keySuffix || '').toLowerCase();
        return (
          client.includes(q) ||
          order.includes(q) ||
          id.includes(q) ||
          key.includes(q) ||
          prefix.includes(q) ||
          suffix.includes(q)
        );
      })
      .sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [keys, searchQuery, sortBy, sortOrder, statusFilter, appFilter]);

  const totalPages = Math.ceil(filteredKeys.length / pageSize) || 1;
  const paginatedKeys = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredKeys.slice(start, start + pageSize);
  }, [filteredKeys, currentPage, pageSize]);

  const toggleSort = (column: 'createdAt' | 'clientName' | 'status' | 'expiresAt') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const statusTabs = [
    { id: 'all', label: 'Todas as Licenças' },
    { id: 'active', label: 'Ativas' },
    { id: 'pending', label: 'Pendentes' },
    { id: 'expired', label: 'Expiradas' },
    { id: 'suspended', label: 'Suspensas' },
    { id: 'banned', label: 'Banidas' },
    { id: 'archived', label: 'Arquivadas' },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
            Gestão de Licenças
          </h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Controle, emissão criptográfica, renovação e limites de hardware de clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLicenses}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenCreateModal}
            disabled={!canMutate}
            icon={<Plus className="w-3.5 h-3.5" />}
            title={!canMutate ? 'Requer permissão de OWNER ou ADMIN' : undefined}
          >
            Criar Key
          </Button>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E8E8E8] dark:border-[#252525]">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-neutral-200 text-[#111111] dark:bg-[#161616] dark:text-white font-semibold shadow-2xs'
                  : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search and Table Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2 max-w-lg w-full">
          <div className="w-full">
            <Input
              placeholder="Buscar por cliente, pedido, chave ou ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <select
            value={appFilter}
            onChange={(e) => {
              setAppFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto text-xs bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg px-2.5 py-2 font-medium text-[#111111] dark:text-white shrink-0"
          >
            <option value="all">Todos os Apps</option>
            {enterpriseStore.getApplications().map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs font-mono text-[#888888] dark:text-[#707070] self-center">
          Mostrando <span className="text-[#111111] dark:text-white font-semibold tabular-nums">{filteredKeys.length}</span> registros
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start justify-between gap-4">
          <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
          <Button variant="outline" size="sm" onClick={fetchLicenses}>
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Licenses Data Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : filteredKeys.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="w-6 h-6 text-[#888888] dark:text-[#707070]" />}
          title={searchQuery ? 'Nenhuma licença encontrada' : 'Nenhuma licença nesta categoria'}
          description={
            searchQuery
              ? `Nenhum resultado corresponde a "${searchQuery}". Limpe a pesquisa ou altere o filtro.`
              : 'Não há registros cadastrados para a visualização selecionada.'
          }
          actionLabel={searchQuery ? 'Limpar Busca' : canMutate ? 'Criar Key' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : onOpenCreateModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Mobile Card List (< 640px) */}
          <div className="block sm:hidden space-y-3">
            {paginatedKeys.map((license) => {
              const realStatus = getRealLicenseStatus(license);
              const keyDisplay = license.keyPrefix
                ? `${license.keyPrefix}••••${license.keySuffix || ''}`
                : license.key || license.id;
              const devicesUsed = license.devicesUsed ?? (license.devices?.length || 0);
              const deviceLimitText =
                license.deviceLimit === -1 || license.deviceLimit === 0
                  ? '∞'
                  : String(license.deviceLimit);

              return (
                <div
                  key={license.id}
                  onClick={() => onSelectLicense(license.id)}
                  className="p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[#111111] dark:text-white truncate">
                        {license.clientName || 'Cliente Geral'}
                      </div>
                      {license.orderReference && (
                        <div className="text-[10px] text-[#888888] dark:text-[#707070] font-mono mt-0.5 truncate">
                          Ref: {license.orderReference}
                        </div>
                      )}
                    </div>
                    <StatusText status={realStatus} />
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-[#161616]/60 border border-[#E8E8E8] dark:border-[#252525] flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#111111] dark:text-neutral-200 truncate">
                      {keyDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyKey(license, e)}
                      className="px-2 py-1 rounded bg-white dark:bg-[#252525] border border-[#E8E8E8] dark:border-[#333333] text-[11px] font-mono font-medium flex items-center gap-1 shrink-0 hover:bg-neutral-100 dark:hover:bg-[#2c2c2c]"
                      aria-label="Copiar chave"
                    >
                      {copiedId === license.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 text-[10px]">Copiada</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#666666] dark:text-[#A1A1A1]" />
                          <span className="text-[10px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#666666] dark:text-[#A1A1A1] font-mono pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                      <span>{devicesUsed} / {deviceLimitText} disp.</span>
                    </div>
                    <div>
                      {license.expiresAt
                        ? `Expira: ${formatSimpleDate(license.expiresAt)}`
                        : license.activationMode === 'first_use' && !license.activatedAt
                        ? 'No 1º uso'
                        : 'Vitalícia'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C] flex items-center justify-between">
                    <span className="text-[10px] text-[#888888] dark:text-[#707070] font-mono">
                      {formatSimpleDate(license.createdAt)}
                    </span>
                    <span className="text-xs font-medium text-[#111111] dark:text-white flex items-center gap-1">
                      Ver Detalhes <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Data Table (>= 640px) */}
          <div className="hidden sm:block border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#161616]/40 text-[#666666] dark:text-[#A1A1A1] select-none">
                    <th
                      className="py-3 px-4 font-medium cursor-pointer hover:text-[#111111] dark:hover:text-white"
                      onClick={() => toggleSort('clientName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Cliente & Chave</span>
                        <ArrowUpDown className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 font-medium cursor-pointer hover:text-[#111111] dark:hover:text-white"
                      onClick={() => toggleSort('status')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium">Hardware / Dispositivos</th>
                    <th
                      className="py-3 px-4 font-medium cursor-pointer hover:text-[#111111] dark:hover:text-white"
                      onClick={() => toggleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Criação</span>
                        <ArrowUpDown className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 font-medium cursor-pointer hover:text-[#111111] dark:hover:text-white"
                      onClick={() => toggleSort('expiresAt')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Expiração</span>
                        <ArrowUpDown className="w-3 h-3 text-[#888888] dark:text-[#707070]" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                  {paginatedKeys.map((license) => {
                    const keyDisplay = license.keyPrefix
                      ? `${license.keyPrefix}••••${license.keySuffix || ''}`
                      : license.key || license.id;
                    const devicesUsed = license.devicesUsed ?? (license.devices?.length || 0);
                    const deviceLimitText =
                      license.deviceLimit === -1 || license.deviceLimit === 0
                        ? '∞'
                        : String(license.deviceLimit);

                    return (
                      <tr
                        key={license.id}
                        onClick={() => onSelectLicense(license.id)}
                        className="hover:bg-neutral-50 dark:hover:bg-[#161616]/60 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#111111] dark:text-white group-hover:underline">
                            {license.clientName || 'Cliente Geral'}
                          </div>
                          <div className="font-mono text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-0.5 flex items-center gap-2">
                            <span className="font-semibold">{keyDisplay}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyKey(license, e)}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#888888] hover:text-[#111111] dark:text-[#707070] dark:hover:text-white transition-colors"
                              title="Copiar Key"
                              aria-label="Copiar chave de licença"
                            >
                              {copiedId === license.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {license.orderReference && (
                              <span className="text-[#888888] dark:text-[#707070]">· Pedido: {license.orderReference}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusText status={getRealLicenseStatus(license)} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#111111] dark:text-neutral-300">
                          <span className="flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-[#888888] dark:text-[#707070]" />
                            <span>
                              {devicesUsed} / {deviceLimitText}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#666666] dark:text-[#A1A1A1] text-[11px]">
                          {formatSimpleDate(license.createdAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#666666] dark:text-[#A1A1A1] text-[11px]">
                          {license.duration === -1 || (license as any).durationUnit === 'lifetime' || (license as any).isLifetime ? (
                            <span className="text-blue-500 font-semibold">Vitalícia (Perpétua)</span>
                          ) : license.expiresAt ? (
                            formatSimpleDate(license.expiresAt)
                          ) : license.activationMode === 'first_use' && !license.activatedAt ? (
                            'No 1º uso'
                          ) : (
                            'Vitalícia'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleCopyKey(license, e)}
                              className="text-xs h-7 px-2.5"
                              icon={
                                copiedId === license.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )
                              }
                              title="Copiar Chave da Licença"
                            >
                              {copiedId === license.id ? 'Copiada' : 'Copiar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSelectLicense(license.id)}
                              className="text-xs h-7 px-2.5"
                              icon={<ExternalLink className="w-3 h-3" />}
                            >
                              Ver
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="p-3.5 border-t border-[#E8E8E8] dark:border-[#252525] flex items-center justify-between text-xs text-[#666666] dark:text-[#A1A1A1]">
            <div>
              Página <span className="text-[#111111] dark:text-white font-mono font-semibold">{currentPage}</span> de{' '}
              <span className="text-[#111111] dark:text-white font-mono font-semibold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-7 px-2.5"
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-7 px-2.5"
                icon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
