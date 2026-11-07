import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import {
  User,
  Shield,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, role, logout, refreshProfile } = useAuth();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      toast.success('Perfil sincronizado com o Cloudflare Worker');
    } catch {
      toast.error('Falha ao sincronizar perfil');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">Perfil do Administrador</h1>
        <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
          Credenciais autenticadas e privilégios determinados pelo servidor.
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] p-6 space-y-6 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] flex items-center justify-center font-bold text-lg text-[#111111] dark:text-white">
            <User className="w-7 h-7 text-[#666666] dark:text-[#A1A1A1]" />
          </div>
          <div>
            <div className="text-base font-bold text-[#111111] dark:text-white tracking-tight">{user?.email}</div>
            <div className="text-xs text-[#666666] dark:text-[#A1A1A1] font-mono mt-1 flex items-center gap-2">
              <span>Cargo:</span>
              <span className="font-semibold text-[#111111] dark:text-white uppercase px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525]">
                {role || 'ADMIN'}
              </span>
              <span>·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Autenticado via Firebase</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-4 border-t border-[#E8E8E8] dark:border-[#1C1C1C]">
          <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
            <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">
              Firebase UID
            </span>
            <span className="text-[#111111] dark:text-neutral-200 mt-1 block select-all truncate">{user?.uid}</span>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
            <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">
              Projeto Firebase
            </span>
            <span className="text-[#111111] dark:text-neutral-200 mt-1 block font-mono">dashboard-proxy-menu</span>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
            <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">
              Armazenamento de Sessão
            </span>
            <span className="text-[#111111] dark:text-neutral-200 mt-1 block">Local Storage Seguro</span>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50/50 dark:bg-[#161616]/40">
            <span className="text-[#888888] dark:text-[#707070] block text-[10px] uppercase font-sans">
              Validação no Servidor
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 mt-1 block flex items-center gap-1.5 font-sans font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Sessão autorizada pelo Worker
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E8E8E8] dark:border-[#1C1C1C]">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Revalidar Permissões no Worker
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={logout}
            icon={<LogOut className="w-3.5 h-3.5" />}
          >
            Encerrar Sessão
          </Button>
        </div>
      </div>

      {/* Security Governance Notice */}
      <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/50 dark:bg-[#161616]/40 text-xs text-[#666666] dark:text-[#A1A1A1] space-y-1.5">
        <div className="flex items-center gap-2 text-[#111111] dark:text-white font-semibold">
          <Lock className="w-4 h-4 text-emerald-500" />
          <span>Governança Criptográfica</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#666666] dark:text-[#A1A1A1]">
          Todas as requisições autenticadas transmitem um ID Token assinado pelo Firebase Auth. O Cloudflare Worker valida a assinatura e aplica os privilégios diretamente no Firestore.
        </p>
      </div>
    </div>
  );
};
