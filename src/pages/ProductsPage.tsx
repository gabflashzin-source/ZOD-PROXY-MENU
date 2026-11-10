import React, { useState, useEffect, useMemo } from 'react';
import { ZodApplication, LicenseKey, ConnectedDevice } from '../types';
import { enterpriseStore, isAppMatch } from '../lib/enterpriseStore';
import { api, ApiError } from '../lib/api';
import { normalizeLicense } from '../lib/licenseUtils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TableSkeleton } from '../components/ui/Skeleton';
import {
  Layers,
  Search,
  ExternalLink,
  Shield,
  Smartphone,
  Cpu,
  Lock,
  Server,
  Activity,
  CheckCircle2,
  Clock,
  KeyRound,
  Users,
  RefreshCw,
} from 'lucide-react';

interface ProductsPageProps {
  onSelectProduct: (productId: string) => void;
}

interface EnrichedProductStats {
  totalKeys: number;
  activeKeys: number;
  customersCount: number;
  devicesCount: number;
  lastActivityAt?: string;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ onSelectProduct }) => {
  const [products, setProducts] = useState<ZodApplication[]>([]);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const codeApps = enterpriseStore.getApplications();
      setProducts(codeApps);

      const [keysRes, devRes] = await Promise.allSettled([
        api.getKeys({ limit: 300 }),
        api.getDevices(),
      ]);

      if (keysRes.status === 'fulfilled' && Array.isArray(keysRes.value?.keys)) {
        setKeys(keysRes.value.keys.map(normalizeLicense));
      }
      if (devRes.status === 'fulfilled' && Array.isArray(devRes.value?.devices)) {
        setDevices(devRes.value.devices);
      }
    } catch (err) {
      console.error('Failed to load products page data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute real data stats per product strictly isolated
  const productStatsMap = useMemo(() => {
    const map = new Map<string, EnrichedProductStats>();

    for (const prod of products) {
      const prodKeys = keys.filter((k) => isAppMatch(prod.id, k.appId));
      const activeKeys = prodKeys.filter((k) => k.status === 'active').length;
      
      const customerNames = new Set<string>();
      let devCount = 0;
      let latestAct: string | undefined = undefined;

      prodKeys.forEach((k) => {
        if (k.clientName) customerNames.add(k.clientName.trim().toLowerCase());
        if (Array.isArray(k.devices)) devCount += k.devices.length;

        const candidateDate = k.lastActivity || k.activatedAt || k.createdAt;
        if (candidateDate) {
          if (!latestAct || new Date(candidateDate).getTime() > new Date(latestAct).getTime()) {
            latestAct = candidateDate;
          }
        }
      });

      map.set(prod.id, {
        totalKeys: prodKeys.length,
        activeKeys,
        customersCount: customerNames.size,
        devicesCount: devCount,
        lastActivityAt: latestAct,
      });
    }

    return map;
  }, [products, keys]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, search, categoryFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  const getProductIcon = (prod: ZodApplication) => {
    if (prod.id === 'azod' || prod.id === 'proxy-menu') {
      return <Shield className="w-5 h-5 text-emerald-500" />;
    }
    if (prod.id === 'azod-loader') {
      return <Cpu className="w-5 h-5 text-neutral-400" />;
    }
    return <Lock className="w-5 h-5 text-neutral-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Produtos ZOD STORE
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1] font-semibold">
              {products.length} {products.length === 1 ? 'Produto' : 'Produtos'}
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Ecossistema centralizado da ZOD STORE. Cada produto possui seu ambiente administrativo próprio e isolamento completo de dados, chaves e telemetria.
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Buscar por nome, slug ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] font-semibold'
                : 'text-[#666666] dark:text-[#A1A1A1] hover:bg-neutral-100 dark:hover:bg-[#161616]'
            }`}
          >
            Todos ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] font-semibold'
                  : 'text-[#666666] dark:text-[#A1A1A1] hover:bg-neutral-100 dark:hover:bg-[#161616]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => {
            const isFlagship = prod.id === 'azod' || prod.id === 'proxy-menu';
            const stats = productStatsMap.get(prod.id) || {
              totalKeys: 0,
              activeKeys: 0,
              customersCount: 0,
              devicesCount: 0,
            };

            return (
              <div
                key={prod.id}
                onClick={() => onSelectProduct(prod.id)}
                className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] hover:border-[#111111] dark:hover:border-white/40 transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-2xs group relative overflow-hidden"
              >
                {isFlagship && (
                  <div className="absolute top-0 right-0 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[9px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                    Flagship ZOD
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#141414] border border-[#E8E8E8] dark:border-[#252525] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getProductIcon(prod)}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <h3 className="font-bold text-base text-[#111111] dark:text-white tracking-tight truncate group-hover:underline">
                        {prod.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#888888] dark:text-[#707070] font-mono mt-0.5">
                        <span>v{prod.version}</span>
                        <span>·</span>
                        <span className="truncate">{prod.category}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#666666] dark:text-[#A1A1A1] leading-relaxed line-clamp-2">
                    {prod.description}
                  </p>
                </div>

                {/* Real Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-lg bg-neutral-50 dark:bg-[#121212] border border-[#E8E8E8] dark:border-[#1C1C1C]">
                  <div>
                    <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] block uppercase">
                      Chaves
                    </span>
                    <span className="font-mono font-bold text-sm tabular-nums text-[#111111] dark:text-white">
                      {stats.totalKeys}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] block uppercase">
                      Clientes
                    </span>
                    <span className="font-mono font-bold text-sm tabular-nums text-[#111111] dark:text-white">
                      {stats.customersCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] block uppercase">
                      Hardwares
                    </span>
                    <span className="font-mono font-bold text-sm tabular-nums text-[#111111] dark:text-white">
                      {stats.devicesCount}
                    </span>
                  </div>
                </div>

                {/* Badges & Meta */}
                <div className="pt-2 border-t border-[#E8E8E8] dark:border-[#1C1C1C] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#888888] dark:text-[#707070]">Infraestrutura:</span>
                    <span className="text-[#111111] dark:text-neutral-200 font-medium">
                      {prod.infrastructure.provider === 'cloudflare_worker'
                        ? 'CF Worker v4.0.0'
                        : prod.infrastructure.provider === 'firebase'
                        ? 'Firestore Direto'
                        : 'API REST'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#888888] dark:text-[#707070]">Atividade Recente:</span>
                    <span className="text-[#111111] dark:text-neutral-200 font-medium">
                      {stats.lastActivityAt
                        ? new Date(stats.lastActivityAt).toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: 'short',
                          })
                        : 'Aguardando uso'}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Ambiente Operacional</span>
                    </div>

                    <span className="text-xs font-semibold text-[#111111] dark:text-white flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Acessar Painel <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="py-12 text-center border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-xl space-y-2">
          <Layers className="w-8 h-8 text-[#888888] dark:text-[#707070] mx-auto" />
          <div className="text-sm font-semibold text-[#111111] dark:text-white">
            Nenhum produto encontrado
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1]">
            Não há produtos cadastrados correspondentes à busca textual.
          </p>
        </div>
      )}
    </div>
  );
};
