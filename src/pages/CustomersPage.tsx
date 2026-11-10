import React, { useState, useEffect, useMemo } from 'react';
import { ZodCustomer, LicenseKey } from '../types';
import { enterpriseStore } from '../lib/enterpriseStore';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { normalizeLicense } from '../lib/licenseUtils';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { StatusText } from '../components/ui/StatusText';
import {
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  Smartphone,
  KeyRound,
  Shield,
  MessageSquare,
  DollarSign,
  Calendar,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit,
} from 'lucide-react';

interface CustomersPageProps {
  onNavigateToLicense: (licId: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigateToLicense }) => {
  const { canMutate } = useAuth();
  const toast = useToast();

  const [customers, setCustomers] = useState<ZodCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Customer Detail Modal
  const [selectedCustomer, setSelectedCustomer] = useState<ZodCustomer | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDiscord, setEditDiscord] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const res = await api.getKeys({ limit: 200 });
      if (res && Array.isArray(res.keys)) {
        const norm = res.keys.map(normalizeLicense);
        const synced = enterpriseStore.syncCustomersFromLicenses(norm);
        setCustomers(synced);
      } else {
        setCustomers(enterpriseStore.getCustomers());
      }
    } catch {
      setCustomers(enterpriseStore.getCustomers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const query = search.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(query) ||
        (c.discordId && c.discordId.toLowerCase().includes(query)) ||
        (c.discordTag && c.discordTag.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.associatedLicenses && c.associatedLicenses.some((l) => l.toLowerCase().includes(query)));
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customers, search, statusFilter]);

  const handleOpenDetail = (cust: ZodCustomer) => {
    setSelectedCustomer(cust);
    setEditNotes(cust.notes || '');
    setEditDiscord(cust.discordTag || cust.discordId || '');
  };

  const handleSaveCustomerProfile = () => {
    if (!selectedCustomer || !canMutate) return;
    setSavingCustomer(true);
    try {
      const updated: ZodCustomer = {
        ...selectedCustomer,
        notes: editNotes.trim() || undefined,
        discordTag: editDiscord.trim() || undefined,
      };
      enterpriseStore.saveCustomer(updated);
      setSelectedCustomer(updated);
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success('Perfil do cliente atualizado com sucesso');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleToggleCustomerStatus = (newStatus: 'active' | 'suspended' | 'banned') => {
    if (!selectedCustomer || !canMutate) return;
    const updated: ZodCustomer = {
      ...selectedCustomer,
      status: newStatus,
    };
    enterpriseStore.saveCustomer(updated);
    setSelectedCustomer(updated);
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    toast.success(`Status do cliente atualizado para ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Central de Clientes
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1] font-semibold">
              {customers.length} Registrados
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Diretório unificado de compradores, identificadores do Discord, histórico de licenças e dispositivos vinculados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCustomerData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sincronizar Clientes
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Buscar por nome, Discord, e-mail ou key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-[#888888] font-mono">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg px-2.5 py-1.5 font-medium text-[#111111] dark:text-white"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="banned">Banidos</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#161616]/40 text-[#666666] dark:text-[#A1A1A1]">
                <th className="py-3 px-4 font-medium">Cliente</th>
                <th className="py-3 px-4 font-medium">Discord ID</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Licenças</th>
                <th className="py-3 px-4 font-medium">Hardware HWID</th>
                <th className="py-3 px-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
              {filteredCustomers.map((cust) => (
                <tr
                  key={cust.id}
                  onClick={() => handleOpenDetail(cust)}
                  className="hover:bg-neutral-50 dark:hover:bg-[#161616]/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#111111] dark:text-white">
                      {cust.name}
                    </div>
                    {cust.notes && (
                      <span className="text-[10px] text-[#888888] dark:text-[#707070] line-clamp-1">
                        Obs: {cust.notes}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#666666] dark:text-neutral-400">
                    {cust.discordTag || cust.discordId || 'Não vinculado'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        cust.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : cust.status === 'banned'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {cust.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#111111] dark:text-neutral-200">
                    {cust.licensesCount} licença(s)
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#666666] dark:text-neutral-300">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#888888]" />
                      <span>{cust.devicesCount} dispositivo(s)</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-xs font-semibold text-[#111111] dark:text-white inline-flex items-center gap-1">
                      Ver Perfil <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#888888]">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Perfil de Cliente: ${selectedCustomer.name}`}
          description="Gestão de identidade, licenças associadas e dispositivos vinculados."
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Identificador do Discord"
                placeholder="Ex: usuario#0001 ou 123456789..."
                value={editDiscord}
                onChange={(e) => setEditDiscord(e.target.value)}
              />
              <div>
                <label className="text-xs font-medium text-[#111111] dark:text-neutral-200 block mb-1.5">
                  Status da Conta
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={selectedCustomer.status === 'active' ? 'primary' : 'outline'}
                    size="xs"
                    onClick={() => handleToggleCustomerStatus('active')}
                  >
                    Ativo
                  </Button>
                  <Button
                    variant={selectedCustomer.status === 'suspended' ? 'primary' : 'outline'}
                    size="xs"
                    onClick={() => handleToggleCustomerStatus('suspended')}
                  >
                    Suspender
                  </Button>
                  <Button
                    variant={selectedCustomer.status === 'banned' ? 'primary' : 'outline'}
                    size="xs"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleToggleCustomerStatus('banned')}
                  >
                    Banir
                  </Button>
                </div>
              </div>
            </div>

            <Textarea
              label="Notas Administrativas / Histórico de Contato"
              placeholder="Ex: Cliente VIP, compra aprovada via PurinCash, Discord verificado..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
            />

            {/* Associated Licenses Section */}
            <div className="space-y-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
              <span className="font-semibold text-[#111111] dark:text-white block">
                Chaves & Licenças Vinculadas ({selectedCustomer.associatedLicenses?.length || 0})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono">
                {selectedCustomer.associatedLicenses?.map((licKey, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50 dark:bg-[#161616] flex items-center justify-between"
                  >
                    <span className="text-[#111111] dark:text-neutral-200 truncate">{licKey}</span>
                    <button
                      type="button"
                      onClick={() => onNavigateToLicense(licKey)}
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                    >
                      Inspecionar Key <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8E8] dark:border-[#252525]">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCustomerProfile}
                loading={savingCustomer}
              >
                Salvar Informações
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
