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
  duration: number; // Duration in seconds or days depending on unit
  durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  deviceLimit: number; // -1 for unlimited, or positive integer
  devicesUsed?: number;
  activationMode: ActivationMode;
  createdAt: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  lastActivity?: string | null;
  devices?: ConnectedDevice[];
  metadata?: Record<string, unknown>;
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
  durationUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  deviceLimit: number;
  activationMode: ActivationMode;
}

export interface RenewLicensePayload {
  duration: number;
  durationUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  reason?: string;
}
