import type { LicenseKey, LicenseStatus } from '../types';

const STORAGE_DELETED_KEYS = 'azod_deleted_license_keys';

// Retrieve set of deleted key IDs from localStorage
export function getDeletedKeyIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_KEYS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

// Mark key as deleted locally so it immediately vanishes from listings
export function markKeyAsDeletedLocally(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getDeletedKeyIds();
    ids.add(id);
    localStorage.setItem(STORAGE_DELETED_KEYS, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

// Parse any timestamp representation (ISO string, epoch seconds/ms, Firestore object)
export function parseTimestampToDate(val: unknown): Date | null {
  if (!val) return null;

  // If already a Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // If Firestore Timestamp with toDate() method
  if (typeof val === 'object' && val !== null && typeof (val as any).toDate === 'function') {
    try {
      const d = (val as any).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      // fallback
    }
  }

  // If object with seconds / _seconds (Firestore raw JSON)
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    const secs = obj.seconds ?? obj._seconds;
    if (typeof secs === 'number') {
      const d = new Date(secs * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // If number (timestamp in ms or seconds)
  if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // If string
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Check if numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const ms = num < 10000000000 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Format full date with time in Brazilian Portuguese
export function formatFullDateTime(val: unknown): string {
  const d = parseTimestampToDate(val);
  if (!d) return '—';
  try {
    const dateStr = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${dateStr} às ${timeStr}`;
  } catch {
    return d.toISOString();
  }
}

// Format simple date
export function formatSimpleDate(val: unknown): string {
  const d = parseTimestampToDate(val);
  if (!d) return '—';
  try {
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// Compute the accurate, authoritative real-time status of a license
export function getRealLicenseStatus(lic: Partial<LicenseKey> | null | undefined): LicenseStatus | 'deleted' {
  if (!lic) return 'active';

  // Check local deletion registry
  if (lic.id && getDeletedKeyIds().has(lic.id)) {
    return 'deleted';
  }

  const rawStatus = String(lic.status || '').toLowerCase().trim();
  if (rawStatus === 'deleted' || (lic as any).deleted === true) {
    return 'deleted';
  }

  if (rawStatus === 'banned' || rawStatus === 'revoked') {
    return 'banned';
  }

  if (rawStatus === 'suspended') {
    return 'suspended';
  }

  if (rawStatus === 'archived') {
    return 'archived';
  }

  // Check expiration timestamp
  const rawExpiresAt = lic.expiresAt || (lic as any).expires_at || (lic as any).expiration;
  if (rawExpiresAt) {
    const expDate = parseTimestampToDate(rawExpiresAt);
    if (expDate && expDate.getTime() <= Date.now()) {
      return 'expired';
    }
  }

  // Check pending first_use status
  const rawActivatedAt = lic.activatedAt || (lic as any).activated_at;
  const activationMode = lic.activationMode || (lic as any).activation_mode;
  if (activationMode === 'first_use' && !rawActivatedAt && rawStatus !== 'active') {
    return 'pending';
  }

  if (rawStatus === 'pending') {
    return 'pending';
  }

  return 'active';
}

export interface RemainingTimeInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isLifetime: boolean;
  isPending: boolean;
  totalMs: number;
  text: string;
}

// Calculates exact remaining duration until expiration down to the second
export function getRemainingTime(input: unknown): RemainingTimeInfo {
  // Check if input is a license object
  if (typeof input === 'object' && input !== null && ('key' in input || 'id' in input || 'clientName' in input)) {
    const lic = input as any;
    const rawExpiresAt = lic.expiresAt || lic.expires_at || lic.expiration;
    const rawActivatedAt = lic.activatedAt || lic.activated_at || lic.firstConnectedAt;
    const activationMode = lic.activationMode || lic.activation_mode;

    if (activationMode === 'first_use' && !rawActivatedAt) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isLifetime: false,
        isPending: true,
        totalMs: 0,
        text: 'Aguardando 1º uso',
      };
    }

    if (!rawExpiresAt) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isLifetime: true,
        isPending: false,
        totalMs: Infinity,
        text: 'Licença Vitalícia',
      };
    }

    return getRemainingTime(rawExpiresAt);
  }

  const d = parseTimestampToDate(input);
  if (!d) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: false,
      isLifetime: true,
      isPending: false,
      totalMs: Infinity,
      text: 'Vitalícia',
    };
  }

  const now = Date.now();
  const totalMs = d.getTime() - now;
  const isExpired = totalMs <= 0;
  const absMs = Math.abs(totalMs);

  const seconds = Math.floor((absMs / 1000) % 60);
  const minutes = Math.floor((absMs / (1000 * 60)) % 60);
  const hours = Math.floor((absMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(absMs / (1000 * 60 * 60 * 24));

  let text = '';
  if (days > 0) {
    text = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    text = `${minutes}m ${seconds}s`;
  } else {
    text = `${seconds}s`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired,
    isLifetime: false,
    isPending: false,
    totalMs,
    text,
  };
}

// Normalizes a license object coming from the Cloudflare Worker API
export function normalizeLicense(lic: any): LicenseKey {
  if (!lic) return lic;

  const rawCreatedAt = lic.createdAt || lic.created_at || lic.created || lic.timestamp;
  const rawExpiresAt = lic.expiresAt || lic.expires_at || lic.expiration;
  const rawActivatedAt = lic.activatedAt || lic.activated_at || lic.firstConnectedAt || lic.first_connected_at;

  const createdAtDate = parseTimestampToDate(rawCreatedAt);
  const expiresAtDate = parseTimestampToDate(rawExpiresAt);
  const activatedAtDate = parseTimestampToDate(rawActivatedAt);

  const computedStatus = getRealLicenseStatus({
    ...lic,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : undefined,
    activatedAt: activatedAtDate ? activatedAtDate.toISOString() : undefined,
  });

  return {
    ...lic,
    id: String(lic.id || lic.keyId || lic.key || ''),
    clientName: lic.clientName || lic.client_name || 'Cliente Geral',
    orderReference: lic.orderReference || lic.order_reference,
    notes: lic.notes || lic.note,
    deviceLimit: typeof lic.deviceLimit === 'number' ? lic.deviceLimit : (typeof lic.device_limit === 'number' ? lic.device_limit : 1),
    devicesUsed: typeof lic.devicesUsed === 'number' ? lic.devicesUsed : (Array.isArray(lic.devices) ? lic.devices.length : 0),
    activationMode: lic.activationMode || lic.activation_mode || 'first_use',
    createdAt: createdAtDate ? createdAtDate.toISOString() : (rawCreatedAt ? String(rawCreatedAt) : new Date().toISOString()),
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : (rawExpiresAt ? String(rawExpiresAt) : null),
    activatedAt: activatedAtDate ? activatedAtDate.toISOString() : (rawActivatedAt ? String(rawActivatedAt) : null),
    status: (computedStatus === 'deleted' ? 'archived' : computedStatus) as LicenseStatus,
  };
}
