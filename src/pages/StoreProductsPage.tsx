import React, { useState, useEffect } from 'react';
import { ZodProduct, ZodApplication, StockBatch, StockKeyItem } from '../types';
import { enterpriseStore } from '../lib/enterpriseStore';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  ShoppingBag,
  Package,
  Plus,
  Copy,
  Check,
  Download,
  Trash2,
  Edit,
  Tag,
  Shield,
  Clock,
  Sparkles,
  Layers,
  ArrowUpDown,
  FileText,
} from 'lucide-react';

export const StoreProductsPage: React.FC = () => {
  const { canMutate } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'products' | 'stock'>('products');
  const [products, setProducts] = useState<ZodProduct[]>([]);
  const [apps, setApps] = useState<ZodApplication[]>([]);
  const [selectedAppFilter, setSelectedAppFilter] = useState('all');

  // Stock
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);
  const [stockItems, setStockItems] = useState<StockKeyItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Create/Edit Product Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodAppId, setProdAppId] = useState('proxy-menu');
  const [prodPlanType, setProdPlanType] = useState<any>('monthly');
  const [prodDuration, setProdDuration] = useState('30');
  const [prodDeviceLimit, setProdDeviceLimit] = useState(1);
  const [prodPrice, setProdPrice] = useState('80.00');
  const [prodDesc, setProdDesc] = useState('');
  const [prodFeatures, setProdFeatures] = useState('');

  // Batch Generation Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchAppId, setBatchAppId] = useState('proxy-menu');
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [batchDuration, setBatchDuration] = useState('30');
  const [batchDeviceLimit, setBatchDeviceLimit] = useState(1);
  const [batchNotes, setBatchNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  // Latest Generated Batch Result
  const [lastGeneratedBatch, setLastGeneratedBatch] = useState<StockBatch | null>(null);

  const loadData = () => {
    const loadedApps = enterpriseStore.getApplications();
    setApps(loadedApps);
    setProducts(enterpriseStore.getProducts(selectedAppFilter));
    setStockBatches(enterpriseStore.getStockBatches(selectedAppFilter));
    setStockItems(enterpriseStore.getStockItems(selectedAppFilter));
  };

  useEffect(() => {
    loadData();
  }, [selectedAppFilter]);

  const handleOpenCreateProduct = () => {
    setEditingProductId(null);
    setProdName('');
    setProdAppId(apps[0]?.id || 'proxy-menu');
    setProdPlanType('monthly');
    setProdDuration('30');
    setProdDeviceLimit(1);
    setProdPrice('80.00');
    setProdDesc('');
    setProdFeatures('Ativação no 1º Uso\nVínculo seguro de HWID\nSuporte VIP');
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: ZodProduct) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdAppId(p.appId);
    setProdPlanType(p.planType);
    setProdDuration(String(p.duration));
    setProdDeviceLimit(p.deviceLimit);
    setProdPrice(p.price.toFixed(2));
    setProdDesc(p.description);
    setProdFeatures(p.features.join('\n'));
    setProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    const targetApp = apps.find((a) => a.id === prodAppId) || apps[0];
    const dur = parseInt(prodDuration, 10);

    const newProd: ZodProduct = {
      id: editingProductId || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      appId: targetApp.id,
      appName: targetApp.name,
      name: prodName.trim(),
      description: prodDesc.trim() || 'Produto comercial ZOD STORE.',
      planType: prodPlanType,
      duration: isNaN(dur) ? 30 : dur,
      durationUnit: dur === -1 ? 'lifetime' : 'days',
      deviceLimit: Number(prodDeviceLimit) || 1,
      price: parseFloat(prodPrice) || 0,
      currency: 'BRL',
      stockQuantity: editingProductId
        ? products.find((p) => p.id === editingProductId)?.stockQuantity || 0
        : 10,
      status: 'active',
      features: prodFeatures
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      deliveryMethod: 'instant_key',
      createdAt: new Date().toISOString(),
    };

    enterpriseStore.saveProduct(newProd);
    toast.success('Produto salvo com sucesso!', newProd.name);
    setProductModalOpen(false);
    loadData();
  };

  const handleDeleteProduct = (id: string) => {
    if (!canMutate) return;
    enterpriseStore.deleteProduct(id);
    toast.success('Produto removido da loja');
    loadData();
  };

  const handleGenerateBatch = () => {
    if (!canMutate) return;
    setGenerating(true);
    try {
      const targetApp = apps.find((a) => a.id === batchAppId) || apps[0];
      const dur = parseInt(batchDuration, 10);
      const batch = enterpriseStore.createStockBatch({
        appId: targetApp.id,
        appName: targetApp.name,
        quantity: Math.min(200, Math.max(1, batchQuantity)),
        duration: isNaN(dur) ? 30 : dur,
        durationUnit: dur === -1 ? 'lifetime' : 'days',
        deviceLimit: Number(batchDeviceLimit) || 1,
        createdBy: 'Admin ZOD',
        notes: batchNotes.trim() || undefined,
      });

      setLastGeneratedBatch(batch);
      setBatchModalOpen(false);
      toast.success(`Lote de ${batch.quantity} chaves gerado com sucesso!`);
      loadData();
    } catch {
      toast.error('Falha ao gerar lote de chaves');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopySingle = (k: string, id: string) => {
    navigator.clipboard.writeText(k);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
    toast.success('Chave copiada para a área de transferência', k);
  };

  const handleCopyAllBatch = (keys: string[]) => {
    navigator.clipboard.writeText(keys.join('\n'));
    toast.success(`${keys.length} chaves copiadas em lote!`);
  };

  const handleExportTxt = (keys: string[], name: string) => {
    const blob = new Blob([keys.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '_')}_keys_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo TXT exportado com sucesso');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              Loja & Estoque de Chaves
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#666666] dark:text-[#A1A1A1] font-semibold">
              ZOD STORE
            </span>
          </div>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Gestão comercial de produtos, planos, preços e estoque de licenças com entrega imediata e prevenção de duplicidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canMutate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchModalOpen(true)}
                icon={<Package className="w-3.5 h-3.5" />}
              >
                Gerar Lote de Chaves
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateProduct}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Novo Produto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-[#161616] rounded-lg border border-[#E8E8E8] dark:border-[#252525] self-start">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'products'
                ? 'bg-white dark:bg-[#252525] text-[#111111] dark:text-white font-semibold shadow-2xs'
                : 'text-[#666666] dark:text-[#A1A1A1]'
            }`}
          >
            Produtos Comerciais ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'stock'
                ? 'bg-white dark:bg-[#252525] text-[#111111] dark:text-white font-semibold shadow-2xs'
                : 'text-[#666666] dark:text-[#A1A1A1]'
            }`}
          >
            Estoque de Keys ({stockItems.filter((x) => x.status === 'available').length} disp.)
          </button>
        </div>

        {/* Filter by App */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#888888] font-mono">Filtrar por App:</span>
          <select
            value={selectedAppFilter}
            onChange={(e) => setSelectedAppFilter(e.target.value)}
            className="text-xs bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg px-2.5 py-1.5 font-medium text-[#111111] dark:text-white"
          >
            <option value="all">Todos os Aplicativos</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Tab View */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="p-5 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#111111] dark:hover:border-white/30 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-[#888888] dark:text-[#707070] uppercase">
                      {prod.appName}
                    </span>
                    <h3 className="text-sm font-bold text-[#111111] dark:text-white mt-0.5">
                      {prod.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono tabular-nums text-[#111111] dark:text-white">
                      R$ {prod.price.toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-emerald-500 font-mono font-medium">
                      {prod.stockQuantity} em estoque
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#666666] dark:text-[#A1A1A1] leading-relaxed">
                  {prod.description}
                </p>

                <div className="space-y-1.5 pt-1">
                  {prod.features.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-[11px] text-[#666666] dark:text-[#A1A1A1]"
                    >
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E8E8] dark:border-[#1C1C1C] flex items-center justify-between text-xs">
                <div className="text-[11px] font-mono text-[#888888] dark:text-[#707070]">
                  <span>{prod.duration === -1 ? 'Vitalícia' : `${prod.duration} dias`}</span>
                  <span> · </span>
                  <span>{prod.deviceLimit} HWID</span>
                </div>

                {canMutate && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleOpenEditProduct(prod)}
                      icon={<Edit className="w-3 h-3" />}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDeleteProduct(prod.id)}
                      icon={<Trash2 className="w-3 h-3" />}
                    >
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="col-span-3 py-12 text-center text-xs text-[#888888] dark:text-[#707070] border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-xl">
              Nenhum produto cadastrado para o filtro selecionado.
            </div>
          )}
        </div>
      )}

      {/* Stock Tab View */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-[#888888]">Disponíveis</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500 mt-1">
                {stockItems.filter((x) => x.status === 'available').length}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-[#888888]">Vendidas / Utilizadas</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
                {stockItems.filter((x) => x.status === 'used' || x.status === 'sold').length}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-[#888888]">Total de Lotes Gerados</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#111111] dark:text-white mt-1">
                {stockBatches.length}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-[#888888]">Integridade de Duplicidade</span>
              <div className="text-xs font-mono font-semibold text-emerald-500 mt-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>100% Únicas</span>
              </div>
            </div>
          </div>

          {/* Batches History */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white">
              Histórico de Lotes Gerados
            </h3>
            <div className="space-y-3">
              {stockBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="p-4 rounded-xl border border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#111111] dark:text-white">
                        Lote: {batch.appName} — {batch.quantity} Chaves
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] text-[#888888]">
                        {batch.duration === -1 ? 'Vitalícia' : `${batch.duration} dias`}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#888888] dark:text-[#707070] mt-0.5 block">
                      Criado em {new Date(batch.createdAt).toLocaleString('pt-BR')} por {batch.createdBy}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleCopyAllBatch(batch.keys)}
                      icon={<Copy className="w-3 h-3" />}
                    >
                      Copiar Todas ({batch.keys.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleExportTxt(batch.keys, batch.appName)}
                      icon={<Download className="w-3 h-3" />}
                    >
                      Exportar TXT
                    </Button>
                  </div>
                </div>
              ))}

              {stockBatches.length === 0 && (
                <div className="py-8 text-center text-xs text-[#888888] border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-xl">
                  Nenhum lote gerado ainda. Clique em "Gerar Lote de Chaves" para abastecer o estoque.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Product */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProductId ? 'Editar Produto Comercial' : 'Novo Produto Comercial'}
        description="Configure o pacote comercial para venda na ZOD STORE e entrega via PurinCash."
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input
            label="Nome do Produto"
            placeholder="Ex: Proxy Menu — 30 Dias"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Aplicativo Vinculado"
              value={prodAppId}
              onChange={(e) => setProdAppId(e.target.value)}
              options={apps.map((a) => ({ label: a.name, value: a.id }))}
            />
            <Select
              label="Tipo de Plano"
              value={prodPlanType}
              onChange={(e) => setProdPlanType(e.target.value as any)}
              options={[
                { label: 'Diário', value: 'daily' },
                { label: 'Semanal', value: 'weekly' },
                { label: 'Mensal', value: 'monthly' },
                { label: 'Vitalício / Permanente', value: 'lifetime' },
              ]}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Duração em Dias (-1 p/ vitalício)"
              value={prodDuration}
              onChange={(e) => setProdDuration(e.target.value)}
              required
            />
            <Input
              type="number"
              min="1"
              label="Limite HWID"
              value={prodDeviceLimit}
              onChange={(e) => setProdDeviceLimit(Number(e.target.value))}
              required
            />
            <Input
              label="Preço em Reais (R$)"
              value={prodPrice}
              onChange={(e) => setProdPrice(e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Descrição Comercial"
            value={prodDesc}
            onChange={(e) => setProdDesc(e.target.value)}
            rows={2}
          />

          <Textarea
            label="Destaques / Recursos (1 por linha)"
            placeholder="Ativação no 1º Uso&#10;Vínculo a 1 HWID&#10;Suporte VIP"
            value={prodFeatures}
            onChange={(e) => setProdFeatures(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setProductModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Salvar Produto
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Batch Generation */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="Gerar Lote de Chaves para Estoque"
        description="Gera tokens únicos no formato oficial ZOD-XXXX com verificação transacional anti-duplicidade."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Aplicativo Destino"
              value={batchAppId}
              onChange={(e) => setBatchAppId(e.target.value)}
              options={apps.map((a) => ({ label: a.name, value: a.id }))}
            />
            <Input
              type="number"
              min="1"
              max="200"
              label="Quantidade de Chaves"
              value={batchQuantity}
              onChange={(e) => setBatchQuantity(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Duração das Chaves"
              value={batchDuration}
              onChange={(e) => setBatchDuration(e.target.value)}
              options={[
                { label: '1 Dia', value: '1' },
                { label: '7 Dias', value: '7' },
                { label: '15 Dias', value: '15' },
                { label: '30 Dias (Mensal)', value: '30' },
                { label: 'Vitalícia / Permanente (-1)', value: '-1' },
              ]}
            />
            <Input
              type="number"
              min="1"
              label="Limite de Hardware (HWID)"
              value={batchDeviceLimit}
              onChange={(e) => setBatchDeviceLimit(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>

          <Input
            label="Anotações do Lote (Opcional)"
            placeholder="Ex: Lote para distribuidor ou reposição PurinCash"
            value={batchNotes}
            onChange={(e) => setBatchNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchModalOpen(false)}
              disabled={generating}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateBatch}
              loading={generating}
              icon={<Package className="w-3.5 h-3.5" />}
            >
              Emitir {batchQuantity} Chaves
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
