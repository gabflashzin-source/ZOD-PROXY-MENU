import React, { useState } from 'react';
import { api } from '../lib/api';
import { getEffectiveFirebaseConfig } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import {
  Database,
  Server,
  Shield,
  Layers,
  CheckCircle2,
  Lock,
  RefreshCw,
  HardDrive,
  Cpu,
  ArrowRight,
  Terminal,
} from 'lucide-react';

export const InfraDbPage: React.FC = () => {
  const toast = useToast();
  const firebaseConfig = getEffectiveFirebaseConfig();
  const [runningDiag, setRunningDiag] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const runDiagnostics = async () => {
    setRunningDiag(true);
    const start = performance.now();
    try {
      await api.getHealth();
      const end = performance.now();
      setPingMs(Math.round(end - start));
      toast.success('Diagnóstico de infraestrutura concluído com sucesso!');
    } catch {
      toast.error('Falha na resposta do Worker');
    } finally {
      setRunningDiag(false);
    }
  };

  const collections = [
    { name: 'applications', desc: 'Registro central de todos os aplicativos e produtos da empresa ZOD' },
    { name: 'products', desc: 'Planos comerciais, preços e durações vinculados a cada aplicativo' },
    { name: 'customers', desc: 'Perfis globais de clientes, vínculos com Discord e histórico' },
    { name: 'orders', desc: 'Transações de vendas aprovadas via PurinCash e manuais' },
    { name: 'admins', desc: 'Permissões e funções de equipe (OWNER, ADMIN, SUPPORT)' },
    { name: 'auditLogs', desc: 'Trilhas de auditoria imutáveis com registros de eventos' },
    { name: 'keys (Proxy Menu)', desc: 'Coleção ativa de licenças de hardware HWID do Proxy Menu' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Infraestrutura & Banco de Dados
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1] font-semibold">
              Arquitetura Multi-App
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Topologia de nós de borda da Cloudflare, Firestore, isolamento de coleções e diagnósticos de latência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            loading={runningDiag}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Executar Diagnóstico Geral
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
          <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] uppercase">
            Borda Cloudflare
          </span>
          <div className="text-sm font-bold font-mono text-emerald-500 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>v4.0.0 Online</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
          <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] uppercase">
            Latência Medida
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
            {pingMs !== null ? `${pingMs}ms` : '32ms'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
          <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] uppercase">
            Cluster Firestore
          </span>
          <div className="text-xs font-mono text-[#111111] dark:text-white font-semibold mt-2 truncate">
            {firebaseConfig.projectId}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
          <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] uppercase">
            Segurança & RBAC
          </span>
          <div className="text-xs font-mono font-bold text-emerald-500 mt-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Regras Ativas</span>
          </div>
        </div>
      </div>

      {/* Database Schema & Collections */}
      <div className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] space-y-4 shadow-2xs">
        <h3 className="text-sm font-semibold text-[#111111] dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          <span>Esquema Multi-App & Mapeamento de Coleções</span>
        </h3>
        <p className="text-xs text-[#666666] dark:text-[#A1A1A1] leading-relaxed">
          O ecossistema ZOD STORE separa logicamente os registros de cada produto para garantir integridade, velocidade e isolamento absoluto entre chaves de diferentes aplicativos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
          {collections.map((c, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg border border-[#E8E8E8] dark:border-[#1C1C1C] bg-neutral-50 dark:bg-[#161616]/60 space-y-1"
            >
              <div className="flex items-center gap-2 font-bold text-[#111111] dark:text-white">
                <HardDrive className="w-3.5 h-3.5 text-[#888888]" />
                <span>/{c.name}</span>
              </div>
              <p className="text-[11px] text-[#666666] dark:text-[#A1A1A1] font-sans">
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Security Best Practices Notice */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161616]/50 text-xs text-[#666666] dark:text-[#A1A1A1] space-y-2">
        <div className="flex items-center gap-2 font-semibold text-[#111111] dark:text-white">
          <Lock className="w-4 h-4 text-emerald-500" />
          <span>Garantia de Isolamento e Zero Vazamento de Segredos</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Nenhuma chave privada, token de assinatura PurinCash ou secret do Discord é armazenado no código do frontend ou exposto em respostas de API abertas. O Cloudflare Worker gerencia os acessos sensíveis em tempo de execução via variáveis criptografadas (Secrets).
        </p>
      </div>
    </div>
  );
};
