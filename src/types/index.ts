export type AdminRole = 'OWNER' | 'ADMIN' | 'SUPPORT';

export type LicenseStatus = 'active' | 'pending' | 'expired' | 'suspended' | 'banned' | 'archived';

export type ActivationMode = 'immediate' | 'first_use';

export interface AdminUser {
  uid: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  createdAt?: string;
  lastLogin?: string;
}

export interface ConnectedDevice {
  id: string;
  deviceId: string;
  deviceName?: string;
  deviceModel?: string;
  licenseId: string;
  clientName?: string;
  firstConnectedAt?: string;
  lastActivityAt?: string;
  status: 'active' | 'offline' | 'unlinked';
  ipAddress?: string;
}

export interface LicenseKey {
  id: string;
  key?: string;
  keyPrefix?: string;
  keySuffix?: string;
  clientName: string;
  orderReference?: string;
  notes?: string;
  status: LicenseStatus;
  duration: number; // Duration in seconds or days depending on unit, -1 for lifetime
  durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'lifetime';
  deviceLimit: number; // -1 for unlimited, or positive integer
  devicesUsed?: number;
  activationMode: ActivationMode;
  createdAt: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  lastActivity?: string | null;
  devices?: ConnectedDevice[];
  metadata?: Record<string, unknown>;
  appId?: string;
  appName?: string;
  isLifetime?: boolean;
  customerId?: string;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  actorEmail?: string;
  role: AdminRole | string;
  action: string;
  target: string;
  result: 'success' | 'failure' | 'rejected';
  timestamp: string;
  appId?: string;
  appName?: string;
  details?: Record<string, unknown>;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface HealthCheckResponse {
  success: boolean;
  service: string;
  status: string;
  version: string;
}

export interface CreateLicensePayload {
  clientName: string;
  orderReference?: string;
  notes?: string;
  duration: number;
  durationUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'lifetime';
  deviceLimit: number;
  activationMode: ActivationMode;
  appId?: string;
  isLifetime?: boolean;
}

export interface RenewLicensePayload {
  duration: number;
  durationUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'lifetime';
  reason?: string;
}

// ==========================================
// ZOD STORE ENTERPRISE TYPES
// ==========================================

export type AppOperatingModel = 'keys' | 'subscriptions' | 'timed_plans' | 'lifetime' | 'custom';
export type AppStatus = 'active' | 'maintenance' | 'deprecated' | 'draft';

export interface ZodApplication {
  id: string; // unique slug e.g. 'proxy-menu'
  name: string;
  slug: string;
  description: string;
  icon: string;
  coverImage?: string;
  version: string;
  category: string;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
  operatingModel: AppOperatingModel;
  licensingConfig: {
    keyFormat: string; // e.g. "ZOD-XXXX-XXXX-XXXX"
    keyLength: number;
    durations: number[]; // e.g. [1, 7, 15, 30, -1] (-1 is lifetime)
    defaultDeviceLimit: number;
    activationMode: ActivationMode;
    allowRenewals: boolean;
    allowRevocations: boolean;
  };
  infrastructure: {
    provider: 'cloudflare_worker' | 'firebase' | 'custom_api';
    workerEndpoint?: string;
    firestoreCollection?: string;
    status: 'connected' | 'configured' | 'pending';
    lastVerifiedAt?: string;
  };
  enabledModules: {
    overview: boolean;
    licenses: boolean;
    stock: boolean;
    customers: boolean;
    devices: boolean;
    sessions: boolean;
    logs: boolean;
    settings: boolean;
    integrations: boolean;
  };
  stats?: {
    totalKeys: number;
    activeKeys: number;
    devicesCount: number;
    customersCount: number;
  };
}

export type ProductPlanType = 'daily' | 'weekly' | 'monthly' | 'lifetime' | 'custom';
export type ProductStatus = 'active' | 'out_of_stock' | 'paused' | 'archived';

export interface ZodProduct {
  id: string;
  appId: string;
  appName: string;
  name: string;
  description: string;
  planType: ProductPlanType;
  duration: number; // Days or -1 for lifetime
  durationUnit: 'days' | 'hours' | 'lifetime';
  deviceLimit: number; // -1 for unlimited
  price: number;
  currency: 'BRL' | 'USD';
  stockQuantity: number;
  status: ProductStatus;
  features: string[];
  deliveryMethod: 'instant_key' | 'webhook' | 'manual';
  createdAt: string;
  updatedAt?: string;
}

export interface StockKeyItem {
  id: string;
  key: string;
  appId: string;
  appName: string;
  productId?: string;
  productName?: string;
  duration: number;
  durationUnit: 'days' | 'hours' | 'lifetime';
  deviceLimit: number;
  status: 'available' | 'reserved' | 'sold' | 'used' | 'expired' | 'revoked';
  batchId?: string;
  orderReference?: string;
  soldTo?: string;
  soldAt?: string;
  createdAt: string;
}

export interface StockBatch {
  id: string;
  appId: string;
  appName: string;
  productId?: string;
  productName?: string;
  quantity: number;
  duration: number;
  durationUnit: 'days' | 'hours' | 'lifetime';
  deviceLimit: number;
  keys: string[];
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface ZodCustomer {
  id: string;
  name: string;
  email?: string;
  discordId?: string;
  discordTag?: string;
  status: 'active' | 'suspended' | 'banned';
  appIds: string[];
  licensesCount: number;
  devicesCount: number;
  totalSpent: number;
  notes?: string;
  createdAt: string;
  lastActivityAt?: string;
  associatedLicenses?: string[];
}

export interface DiscordRole {
  id: string;
  name: string;
  color?: string;
  membersCount?: number;
}

export interface DiscordIntegrationConfig {
  guildId: string;
  guildName: string;
  botStatus: 'connected' | 'disconnected' | 'missing_permissions' | 'configured';
  memberCount: number;
  onlineCount: number;
  requiredIntents: string[];
  roles: DiscordRole[];
  lastSyncAt?: string;
  lastEvent?: string;
  syncedCustomersCount: number;
  autoRoleOnPurchase: boolean;
  customerRoleId?: string;
}

export interface PurinCashIntegrationConfig {
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  environment: 'production' | 'sandbox';
  status: 'active' | 'pending_verification' | 'disabled';
  autoDeliverKeys: boolean;
  targetAppId: string;
  lastEventReceived?: string;
  eventsProcessed: number;
  eventsCount: number;
  recentWebhooks?: Array<{
    id: string;
    event: string;
    status: 'success' | 'failed' | 'ignored';
    orderId?: string;
    amount?: number;
    timestamp: string;
    error?: string;
  }>;
}

export interface ActiveSession {
  sessionId: string;
  licenseId: string;
  licenseKeyDisplay: string;
  appId: string;
  appName: string;
  clientName: string;
  orderReference?: string;
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  ipAddress?: string;
  status: 'active' | 'idle' | 'disconnected';
  firstConnectedAt?: string;
  lastActivityAt?: string;
  duration?: number;
  isLifetime?: boolean;
}

