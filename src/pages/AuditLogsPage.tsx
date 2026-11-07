import React, { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import type { AuditLogItem } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ScrollText,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({ limit: 150 });
      setLogs(res.logs || []);
    } catch (err: unknown) {
      console.error('Failed to load audit logs:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao carregar a trilha de auditoria do Cloudflare Worker.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const actor = (log.actorEmail || log.actor || '').toLowerCase();
      const target = (log.target || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const role = (log.role || '').toLowerCase();
      return actor.includes(q) || target.includes(q) || action.includes(q) || role.includes(q);
    });
  }, [logs, searchQuery, actionFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Strip any accidental sensitive tokens from displayed details
  const sanitizeDetails = (details?: Record<string, unknown>) => {
    if (!details) return null;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(details)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('privatekey') ||
        lower.includes('credentials')
      ) {
        clean[k] = '[PROTEGIDO POR SEGURANÇA]';
      } else {
        clean[k] = v;
      }
    }
    return clean;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
            Trilha de Auditoria & Governança
          </h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Registro imutável de intervenções administrativas, mutações de chave e autorizações.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAuditLogs}
          loading={loading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Atualizar Logs
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Buscar por responsável, ação ou recurso..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white dark:bg-[#111111] text-[#111111] dark:text-neutral-200 border border-[#E8E8E8] dark:border-[#252525] rounded-lg text-xs px-3 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          >
            <option value="all">Todas as Ações</option>
            <option value="create">Criação de Licença</option>
            <option value="renew">Renovação</option>
            <option value="status">Mutação de Status</option>
            <option value="unlink">Desvinculação de HWID</option>
            <option value="admin">Contas de Administradores</option>
            <option value="settings">Configurações do Sistema</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between">
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="w-6 h-6 text-[#888888] dark:text-[#707070]" />}
          title={searchQuery ? 'Nenhum log encontrado' : 'Nenhum registro de auditoria'}
          description="Operações administrativas realizadas pelo Cloudflare Worker serão listadas aqui."
          actionLabel={searchQuery ? 'Limpar Busca' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <div className="border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#161616]/40 text-[#666666] dark:text-[#A1A1A1]">
                  <th className="py-3 px-4 font-medium">Timestamp (UTC)</th>
                  <th className="py-3 px-4 font-medium">Autor & Cargo</th>
                  <th className="py-3 px-4 font-medium">Ação Realizada</th>
                  <th className="py-3 px-4 font-medium">Recurso Afetado</th>
                  <th className="py-3 px-4 font-medium">Resultado</th>
                  <th className="py-3 px-4 font-medium text-right">Inspecionar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                {paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-neutral-50 dark:hover:bg-[#161616]/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#666666] dark:text-[#A1A1A1] text-[11px]">
                      {log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#111111] dark:text-white font-mono text-xs truncate max-w-[180px]">
                        {log.actorEmail || log.actor || 'Sistema'}
                      </div>
                      <div className="text-[10px] text-[#888888] dark:text-[#707070] font-mono uppercase mt-0.5">
                        {log.role || 'ADMIN'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#111111] dark:text-neutral-200 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#666666] dark:text-neutral-400 text-[11px] truncate max-w-[160px]">
                      {log.target}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        {log.result === 'success' ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Sucesso</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-700 dark:text-red-400">Falha</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="xs" className="h-7 px-2 text-xs text-[#888888] dark:text-[#A1A1A1]">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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

      {/* Inspect Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Inspeção de Evento de Auditoria"
          description={`Identificador do Registro: ${selectedLog.id}`}
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 dark:bg-[#161616]/60 rounded-xl border border-[#E8E8E8] dark:border-[#252525]">
              <div>
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Responsável</span>
                <span className="text-[#111111] dark:text-white mt-0.5 block truncate">
                  {selectedLog.actorEmail || selectedLog.actor}
                </span>
              </div>
              <div>
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Cargo</span>
                <span className="text-[#111111] dark:text-neutral-300 mt-0.5 block">{selectedLog.role}</span>
              </div>
              <div>
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Ação</span>
                <span className="text-[#111111] dark:text-white mt-0.5 block">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">Resultado</span>
                <span className="text-[#111111] dark:text-neutral-300 mt-0.5 block capitalize">{selectedLog.result}</span>
              </div>
            </div>

            <div>
              <span className="text-[#666666] dark:text-[#A1A1A1] block mb-1 font-sans text-xs font-medium">Recurso Alvo</span>
              <div className="p-2.5 bg-neutral-50 dark:bg-[#161616]/40 rounded-lg border border-[#E8E8E8] dark:border-[#252525] text-[#111111] dark:text-neutral-200 break-all">
                {selectedLog.target}
              </div>
            </div>

            {selectedLog.details && (
              <div>
                <span className="text-[#666666] dark:text-[#A1A1A1] block mb-1 font-sans text-xs font-medium">
                  Carga Útil de Metadados (JSON)
                </span>
                <pre className="p-3 bg-neutral-50 dark:bg-[#161616]/40 rounded-lg border border-[#E8E8E8] dark:border-[#252525] text-[#111111] dark:text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(sanitizeDetails(selectedLog.details), null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Fechar Inspetor
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
