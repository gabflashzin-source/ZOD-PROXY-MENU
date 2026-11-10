import {
  ZodApplication,
  ZodProduct,
  ZodCustomer,
  StockBatch,
  StockKeyItem,
  DiscordIntegrationConfig,
  PurinCashIntegrationConfig,
  AuditLogItem,
  LicenseKey,
} from '../types';

const STORAGE_APPS = 'zod_enterprise_applications';
const STORAGE_PRODUCTS = 'zod_enterprise_products';
const STORAGE_CUSTOMERS = 'zod_enterprise_customers';
const STORAGE_STOCK_BATCHES = 'zod_enterprise_stock_batches';
const STORAGE_STOCK_ITEMS = 'zod_enterprise_stock_items';
const STORAGE_DISCORD = 'zod_enterprise_discord_config';
const STORAGE_PURINCASH = 'zod_enterprise_purincash_config';
const STORAGE_SELECTED_APP = 'zod_enterprise_selected_app';
const STORAGE_AUDIT = 'zod_enterprise_audit_logs';

export const DEFAULT_AZOD_APP: ZodApplication = {
  id: 'azod',
  name: 'AZOD',
  slug: 'azod',
  description: 'Módulo principal de segurança e overlay Android com controle de hardware HWID, handshake v4.0 e licenciamento de alta precisão.',
  icon: 'Shield',
  version: '4.0.0',
  category: 'Android Security',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  operatingModel: 'keys',
  licensingConfig: {
    keyFormat: 'ZOD-XXXX-XXXX-XXXX',
    keyLength: 16,
    durations: [1, 7, 15, 30, -1], // -1 = lifetime
    defaultDeviceLimit: 1,
    activationMode: 'first_use',
    allowRenewals: true,
    allowRevocations: true,
  },
  infrastructure: {
    provider: 'cloudflare_worker',
    workerEndpoint: 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev',
    firestoreCollection: 'keys',
    status: 'connected',
    lastVerifiedAt: new Date().toISOString(),
  },
  enabledModules: {
    overview: true,
    licenses: true,
    stock: true,
    customers: true,
    devices: true,
    sessions: true,
    logs: true,
    settings: true,
    integrations: true,
  },
  stats: {
    totalKeys: 0,
    activeKeys: 0,
    devicesCount: 0,
    customersCount: 0,
  },
};

export const DEFAULT_AZOD_LOADER_APP: ZodApplication = {
  id: 'azod-loader',
  name: 'AZOD Loader',
  slug: 'azod-loader',
  description: 'Injetor e client desktop com inicialização segura, verificação de integridade e telemetria de inicialização.',
  icon: 'Cpu',
  version: '2.1.0',
  category: 'Desktop Client',
  status: 'active',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  operatingModel: 'keys',
  licensingConfig: {
    keyFormat: 'LOADER-XXXX-XXXX',
    keyLength: 14,
    durations: [7, 30, -1],
    defaultDeviceLimit: 1,
    activationMode: 'first_use',
    allowRenewals: true,
    allowRevocations: true,
  },
  infrastructure: {
    provider: 'cloudflare_worker',
    workerEndpoint: 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev',
    firestoreCollection: 'keys',
    status: 'connected',
    lastVerifiedAt: new Date().toISOString(),
  },
  enabledModules: {
    overview: true,
    licenses: true,
    stock: true,
    customers: true,
    devices: true,
    sessions: true,
    logs: true,
    settings: true,
    integrations: true,
  },
  stats: {
    totalKeys: 0,
    activeKeys: 0,
    devicesCount: 0,
    customersCount: 0,
  },
};

export const DEFAULT_AZOD_BYPASS_APP: ZodApplication = {
  id: 'azod-bypass',
  name: 'AZOD Bypass',
  slug: 'azod-bypass',
  description: 'Módulo avançado de proteção anti-detecção em tempo real, mascaramento de chamadas de sistema e integridade de memória.',
  icon: 'Lock',
  version: '1.5.0',
  category: 'Security Module',
  status: 'active',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  operatingModel: 'keys',
  licensingConfig: {
    keyFormat: 'BYPASS-XXXX-XXXX',
    keyLength: 15,
    durations: [15, 30, -1],
    defaultDeviceLimit: 1,
    activationMode: 'first_use',
    allowRenewals: true,
    allowRevocations: true,
  },
  infrastructure: {
    provider: 'cloudflare_worker',
    workerEndpoint: 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev',
    firestoreCollection: 'keys',
    status: 'connected',
    lastVerifiedAt: new Date().toISOString(),
  },
  enabledModules: {
    overview: true,
    licenses: true,
    stock: true,
    customers: true,
    devices: true,
    sessions: true,
    logs: true,
    settings: true,
    integrations: true,
  },
  stats: {
    totalKeys: 0,
    activeKeys: 0,
    devicesCount: 0,
    customersCount: 0,
  },
};

export const DEFAULT_PROXY_MENU_APP = DEFAULT_AZOD_APP;

export const DEFAULT_CODE_APPLICATIONS: ZodApplication[] = [
  DEFAULT_AZOD_APP,
  DEFAULT_AZOD_LOADER_APP,
  DEFAULT_AZOD_BYPASS_APP,
];

export function isAppMatch(filterAppId: string, itemAppId?: string): boolean {
  if (!filterAppId || filterAppId === 'all') return true;
  if (filterAppId === 'azod' || filterAppId === 'proxy-menu') {
    return !itemAppId || itemAppId === 'azod' || itemAppId === 'proxy-menu';
  }
  return itemAppId === filterAppId;
}

export const DEFAULT_PROXY_PRODUCTS: ZodProduct[] = [
  {
    id: 'prod-pm-1d',
    appId: 'azod',
    appName: 'AZOD',
    name: 'AZOD — 1 Dia',
    description: 'Acesso completo por 24 horas a partir do primeiro login no APK.',
    planType: 'daily',
    duration: 1,
    durationUnit: 'days',
    deviceLimit: 1,
    price: 15.0,
    currency: 'BRL',
    stockQuantity: 18,
    status: 'active',
    features: ['Ativação no 1º Uso', 'Vínculo a 1 Hardware HWID', 'Suporte a bypass e hooks'],
    deliveryMethod: 'instant_key',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-pm-7d',
    appId: 'azod',
    appName: 'AZOD',
    name: 'AZOD — 7 Dias',
    description: 'Plano semanal com suporte prioritário e renovação facilitada.',
    planType: 'weekly',
    duration: 7,
    durationUnit: 'days',
    deviceLimit: 1,
    price: 35.0,
    currency: 'BRL',
    stockQuantity: 12,
    status: 'active',
    features: ['7 Dias de Validade Operacional', '1 Dispositivo com HWID Seguro', 'Desvinculação via Dashboard'],
    deliveryMethod: 'instant_key',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-pm-15d',
    appId: 'azod',
    appName: 'AZOD',
    name: 'AZOD — 15 Dias',
    description: 'Plano quinzenal para usuários frequentes e equipes de teste.',
    planType: 'monthly',
    duration: 15,
    durationUnit: 'days',
    deviceLimit: 1,
    price: 55.0,
    currency: 'BRL',
    stockQuantity: 8,
    status: 'active',
    features: ['15 Dias de Execução', 'Proteção Anti-Crash e Anti-Ban', 'Logs de auditoria e atividade'],
    deliveryMethod: 'instant_key',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-pm-30d',
    appId: 'azod',
    appName: 'AZOD',
    name: 'AZOD — 30 Dias (Mensal)',
    description: 'Acesso mensal completo com melhor custo-benefício comercial.',
    planType: 'monthly',
    duration: 30,
    durationUnit: 'days',
    deviceLimit: 1,
    price: 80.0,
    currency: 'BRL',
    stockQuantity: 25,
    status: 'active',
    features: ['30 Dias Contratuais', 'Prioridade em Atualizações', 'Vínculo com cargo no Discord'],
    deliveryMethod: 'instant_key',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-pm-lifetime',
    appId: 'azod',
    appName: 'AZOD',
    name: 'AZOD — Vitalícia (Permanente)',
    description: 'Licença permanente sem expiração nem necessidade de renovação periódica.',
    planType: 'lifetime',
    duration: -1,
    durationUnit: 'lifetime',
    deviceLimit: 1,
    price: 199.0,
    currency: 'BRL',
    stockQuantity: 5,
    status: 'active',
    features: ['Acesso Vitalício Garantido', 'Sem Vencimento ou Data Limite', 'Suporte VIP e Cargo Exclusivo'],
    deliveryMethod: 'instant_key',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const enterpriseStore = {
  // ==========================================
  // APPLICATIONS
  // ==========================================
  getApplications(): ZodApplication[] {
    if (typeof window === 'undefined') return DEFAULT_CODE_APPLICATIONS;
    try {
      const raw = localStorage.getItem(STORAGE_APPS);
      if (!raw) {
        localStorage.setItem(STORAGE_APPS, JSON.stringify(DEFAULT_CODE_APPLICATIONS));
        return DEFAULT_CODE_APPLICATIONS;
      }
      let parsed: ZodApplication[] = JSON.parse(raw);
      // Ensure all code applications are present
      for (const codeApp of DEFAULT_CODE_APPLICATIONS) {
        const found = parsed.find((a) => a.id === codeApp.id || (codeApp.id === 'azod' && a.id === 'proxy-menu'));
        if (!found) {
          parsed.push(codeApp);
        } else if (found.id === 'proxy-menu') {
          // Normalize proxy-menu to azod
          found.id = 'azod';
          found.name = 'AZOD';
          found.slug = 'azod';
        }
      }
      localStorage.setItem(STORAGE_APPS, JSON.stringify(parsed));
      return parsed;
    } catch {
      return DEFAULT_CODE_APPLICATIONS;
    }
  },

  getApplicationById(id: string): ZodApplication | undefined {
    return this.getApplications().find((a) => a.id === id || a.slug === id || (id === 'proxy-menu' && a.id === 'azod') || (id === 'azod' && a.id === 'proxy-menu'));
  },

  saveApplication(app: ZodApplication): void {
    if (typeof window === 'undefined') return;
    const list = this.getApplications();
    const index = list.findIndex((a) => a.id === app.id || (app.id === 'azod' && a.id === 'proxy-menu'));
    if (index >= 0) {
      list[index] = { ...list[index], ...app, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...app, createdAt: app.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_APPS, JSON.stringify(list));
  },

  deleteApplication(id: string): boolean {
    if (id === 'azod' || id === 'proxy-menu') return false; // Protected flagship
    const list = this.getApplications().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_APPS, JSON.stringify(list));
    return true;
  },

  getSelectedAppId(): string {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem(STORAGE_SELECTED_APP) || 'all';
  },

  setSelectedAppId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_SELECTED_APP, id);
  },

  // ==========================================
  // PRODUCTS & STORE
  // ==========================================
  getProducts(appId?: string): ZodProduct[] {
    if (typeof window === 'undefined') return DEFAULT_PROXY_PRODUCTS;
    try {
      const raw = localStorage.getItem(STORAGE_PRODUCTS);
      let list: ZodProduct[] = raw ? JSON.parse(raw) : [];
      if (!list || list.length === 0) {
        list = [...DEFAULT_PROXY_PRODUCTS];
        localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(list));
      }
      if (appId && appId !== 'all') {
        return list.filter((p) => p.appId === appId);
      }
      return list;
    } catch {
      return DEFAULT_PROXY_PRODUCTS;
    }
  },

  saveProduct(product: ZodProduct): void {
    if (typeof window === 'undefined') return;
    const list = this.getProducts();
    const index = list.findIndex((p) => p.id === product.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...product, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...product, createdAt: product.createdAt || new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(list));
  },

  deleteProduct(id: string): void {
    if (typeof window === 'undefined') return;
    const list = this.getProducts().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(list));
  },

  // ==========================================
  // STOCK OF KEYS & BATCH GENERATION
  // ==========================================
  getStockBatches(appId?: string): StockBatch[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_STOCK_BATCHES);
      const list: StockBatch[] = raw ? JSON.parse(raw) : [];
      if (appId && appId !== 'all') {
        return list.filter((b) => b.appId === appId);
      }
      return list;
    } catch {
      return [];
    }
  },

  getStockItems(appId?: string): StockKeyItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_STOCK_ITEMS);
      const list: StockKeyItem[] = raw ? JSON.parse(raw) : [];
      if (appId && appId !== 'all') {
        return list.filter((k) => k.appId === appId);
      }
      return list;
    } catch {
      return [];
    }
  },

  /**
   * Generates a batch of unique, non-duplicable keys for an application and stores in stock.
   */
  createStockBatch(params: {
    appId: string;
    appName: string;
    productId?: string;
    productName?: string;
    quantity: number;
    duration: number;
    durationUnit: 'days' | 'hours' | 'lifetime';
    deviceLimit: number;
    createdBy: string;
    notes?: string;
    existingLiveKeys?: Set<string>;
  }): StockBatch {
    const existingStock = this.getStockItems();
    const usedKeysSet = new Set<string>(existingStock.map((k) => k.key.toUpperCase()));
    if (params.existingLiveKeys) {
      params.existingLiveKeys.forEach((k) => usedKeysSet.add(k.toUpperCase()));
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const generatedKeys: string[] = [];
    const newItems: StockKeyItem[] = [];

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous 0, O, 1, I
    const genSegment = () => {
      let seg = '';
      for (let i = 0; i < 4; i++) {
        seg += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return seg;
    };

    let attempts = 0;
    while (generatedKeys.length < params.quantity && attempts < params.quantity * 20) {
      attempts++;
      const candidateKey = `ZOD-${genSegment()}-${genSegment()}-${genSegment()}`;
      if (!usedKeysSet.has(candidateKey)) {
        usedKeysSet.add(candidateKey);
        generatedKeys.push(candidateKey);
        newItems.push({
          id: `item_${Date.now()}_${generatedKeys.length}`,
          key: candidateKey,
          appId: params.appId,
          appName: params.appName,
          productId: params.productId,
          productName: params.productName,
          duration: params.duration,
          durationUnit: params.durationUnit,
          deviceLimit: params.deviceLimit,
          status: 'available',
          batchId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const batch: StockBatch = {
      id: batchId,
      appId: params.appId,
      appName: params.appName,
      productId: params.productId,
      productName: params.productName,
      quantity: generatedKeys.length,
      duration: params.duration,
      durationUnit: params.durationUnit,
      deviceLimit: params.deviceLimit,
      keys: generatedKeys,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
      notes: params.notes,
    };

    const batches = this.getStockBatches();
    batches.unshift(batch);
    localStorage.setItem(STORAGE_STOCK_BATCHES, JSON.stringify(batches));

    const updatedItems = [...newItems, ...existingStock];
    localStorage.setItem(STORAGE_STOCK_ITEMS, JSON.stringify(updatedItems));

    // Update product stock counter if linked
    if (params.productId) {
      const products = this.getProducts();
      const p = products.find((x) => x.id === params.productId);
      if (p) {
        p.stockQuantity = (p.stockQuantity || 0) + generatedKeys.length;
        if (p.status === 'out_of_stock') p.status = 'active';
        localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
      }
    }

    return batch;
  },

  consumeStockKey(keyString: string, clientName: string, orderReference?: string): boolean {
    const items = this.getStockItems();
    const item = items.find((x) => x.key.toUpperCase() === keyString.toUpperCase());
    if (!item) return false;
    item.status = 'used';
    item.soldTo = clientName;
    item.orderReference = orderReference;
    item.soldAt = new Date().toISOString();
    localStorage.setItem(STORAGE_STOCK_ITEMS, JSON.stringify(items));
    return true;
  },

  // ==========================================
  // CUSTOMERS CENTRAL
  // ==========================================
  getCustomers(): ZodCustomer[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOMERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveCustomer(cust: ZodCustomer): void {
    if (typeof window === 'undefined') return;
    const list = this.getCustomers();
    const index = list.findIndex((c) => c.id === cust.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...cust };
    } else {
      list.push(cust);
    }
    localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(list));
  },

  /**
   * Syncs and groups live licenses from the Worker into unified customer records
   */
  syncCustomersFromLicenses(licenses: LicenseKey[]): ZodCustomer[] {
    const existing = this.getCustomers();
    const existingMap = new Map<string, ZodCustomer>(existing.map((c) => [c.name.toLowerCase().trim(), c]));

    const customerMap = new Map<string, {
      name: string;
      appIds: Set<string>;
      licenses: Set<string>;
      devicesCount: number;
      lastActivity?: string;
      earliestCreated?: string;
    }>();

    licenses.forEach((lic) => {
      const rawName = (lic.clientName || 'Cliente Geral').trim();
      const key = rawName.toLowerCase();
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: rawName,
          appIds: new Set<string>([lic.appId || 'azod']),
          licenses: new Set<string>(),
          devicesCount: 0,
          earliestCreated: lic.createdAt,
        });
      }

      const rec = customerMap.get(key)!;
      if (lic.key || lic.id) rec.licenses.add(lic.key || lic.id);
      rec.appIds.add(lic.appId || 'azod');
      rec.devicesCount += (lic.devices?.length || lic.devicesUsed || 0);

      if (lic.lastActivity) {
        if (!rec.lastActivity || new Date(lic.lastActivity) > new Date(rec.lastActivity)) {
          rec.lastActivity = lic.lastActivity;
        }
      }
    });

    const mergedCustomers: ZodCustomer[] = [];

    customerMap.forEach((val, key) => {
      const saved = existingMap.get(key);
      mergedCustomers.push({
        id: saved?.id || `cust_${Math.abs(key.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`,
        name: val.name,
        email: saved?.email,
        discordId: saved?.discordId,
        discordTag: saved?.discordTag,
        status: saved?.status || 'active',
        appIds: Array.from(val.appIds),
        licensesCount: val.licenses.size,
        devicesCount: val.devicesCount,
        totalSpent: saved?.totalSpent || (val.licenses.size * 50),
        notes: saved?.notes,
        createdAt: saved?.createdAt || val.earliestCreated || new Date().toISOString(),
        lastActivityAt: val.lastActivity || saved?.lastActivityAt,
        associatedLicenses: Array.from(val.licenses),
      });
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CUSTOMERS, JSON.stringify(mergedCustomers));
    }

    return mergedCustomers;
  },

  // ==========================================
  // DISCORD INTEGRATION
  // ==========================================
  getDiscordConfig(): DiscordIntegrationConfig {
    const defaultConfig: DiscordIntegrationConfig = {
      guildId: '123456789012345678',
      guildName: 'ZOD Official Hub',
      botStatus: 'configured',
      memberCount: 1420,
      onlineCount: 412,
      requiredIntents: ['GUILD_MEMBERS', 'DIRECT_MESSAGES', 'GUILD_PRESENCES'],
      roles: [
        { id: 'role-vip', name: 'ZOD VIP', color: '#FF2E93', membersCount: 145 },
        { id: 'role-customer', name: 'Cliente Verificado', color: '#10B981', membersCount: 890 },
        { id: 'role-proxy', name: 'Proxy Menu Member', color: '#6366F1', membersCount: 420 },
      ],
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      lastEvent: 'Membro verificado via autenticação de licença Proxy Menu',
      syncedCustomersCount: 890,
      autoRoleOnPurchase: true,
      customerRoleId: 'role-customer',
    };

    if (typeof window === 'undefined') return defaultConfig;
    try {
      const raw = localStorage.getItem(STORAGE_DISCORD);
      return raw ? JSON.parse(raw) : defaultConfig;
    } catch {
      return defaultConfig;
    }
  },

  saveDiscordConfig(cfg: DiscordIntegrationConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_DISCORD, JSON.stringify(cfg));
  },

  // ==========================================
  // PURINCASH INTEGRATION
  // ==========================================
  getPurinCashConfig(): PurinCashIntegrationConfig {
    const defaultConfig: PurinCashIntegrationConfig = {
      webhookUrl: 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev/webhooks/purincash',
      webhookSecretConfigured: true,
      environment: 'production',
      status: 'active',
      autoDeliverKeys: true,
      targetAppId: 'proxy-menu',
      lastEventReceived: new Date(Date.now() - 7200000).toISOString(),
      eventsProcessed: 68,
      eventsCount: 68,
      recentWebhooks: [
        {
          id: 'evt_purin_101',
          event: 'payment.approved',
          status: 'success',
          orderId: 'ORD-98214',
          amount: 80.0,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'evt_purin_102',
          event: 'payment.approved',
          status: 'success',
          orderId: 'ORD-98215',
          amount: 35.0,
          timestamp: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: 'evt_purin_103',
          event: 'payment.approved',
          status: 'success',
          orderId: 'ORD-98216',
          amount: 199.0,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };

    if (typeof window === 'undefined') return defaultConfig;
    try {
      const raw = localStorage.getItem(STORAGE_PURINCASH);
      return raw ? JSON.parse(raw) : defaultConfig;
    } catch {
      return defaultConfig;
    }
  },

  savePurinCashConfig(cfg: PurinCashIntegrationConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_PURINCASH, JSON.stringify(cfg));
  },

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  getAuditLogs(): AuditLogItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_AUDIT);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  logAction(log: Omit<AuditLogItem, 'id' | 'timestamp'>): void {
    if (typeof window === 'undefined') return;
    const entry: AuditLogItem = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const current = this.getAuditLogs();
    current.unshift(entry);
    if (current.length > 300) current.pop();
    localStorage.setItem(STORAGE_AUDIT, JSON.stringify(current));
  },
};
