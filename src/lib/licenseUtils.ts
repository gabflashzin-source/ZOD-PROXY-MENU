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

// Parse any timestamp representation (ISO string, epoch seconds/ms, Firestore object, Brazilian dates)
export function parseTimestampToDate(val: unknown): Date | null {
  if (!val) return null;

  // If already a Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // If Firestore Timestamp with toDate() or toMillis() method
  if (typeof val === 'object' && val !== null) {
    if (typeof (val as any).toDate === 'function') {
      try {
        const d = (val as any).toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {
        // fallback
      }
    }
    if (typeof (val as any).toMillis === 'function') {
      try {
        const ms = (val as any).toMillis();
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      } catch {
        // fallback
      }
    }

    // If object with seconds / _seconds / milliseconds (Firestore raw JSON)
    const obj = val as Record<string, unknown>;
    const rawSeconds = obj.seconds ?? obj._seconds ?? obj._seconds_ ?? (obj as any).seconds_;
    if (rawSeconds !== undefined && rawSeconds !== null) {
      const s = Number(rawSeconds);
      if (!isNaN(s) && s > 0) {
        const d = new Date(s * 1000);
        if (!isNaN(d.getTime())) return d;
      }
    }

    const rawMs = obj.milliseconds ?? obj._milliseconds ?? obj.ms ?? obj.time;
    if (rawMs !== undefined && rawMs !== null) {
      const ms = Number(rawMs);
      if (!isNaN(ms) && ms > 0) {
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Nested date/iso string
    const innerDate = obj.date || obj.value || obj.iso || obj.formatted || obj.timestamp;
    if (innerDate && typeof innerDate === 'string') {
      return parseTimestampToDate(innerDate);
    }
  }

  // If number (timestamp in ms or seconds)
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // If string
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '—' || trimmed === 'null' || trimmed === 'undefined') return null;

    // Check if numeric string (epoch seconds or ms)
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num <= 0) return null;
      const ms = num < 10000000000 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // Check Brazilian format: DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      const year = parseInt(brMatch[3], 10);
      const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
      const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
      const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
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
  if (!lic || typeof lic !== 'object') return lic;

  // 1. Order Reference with all field variations
  const orderReference = String(
    lic.orderReference ||
    lic.order_reference ||
    lic.orderRef ||
    lic.order_ref ||
    lic.reference ||
    lic.ref ||
    lic.orderId ||
    lic.order_id ||
    lic.order ||
    lic.pedido ||
    lic.referencia ||
    lic.client_reference ||
    lic.clientReference ||
    ''
  ).trim();

  // 2. Created At
  const rawCreatedAt =
    lic.createdAt ||
    lic.created_at ||
    lic.created ||
    lic.timestamp ||
    lic.creation_date ||
    lic.creationDate;
  const createdAtDate = parseTimestampToDate(rawCreatedAt);

  // 3. Activated At (First Activation / Handshake)
  const rawActivatedAt =
    lic.activatedAt ||
    lic.activated_at ||
    lic.firstConnectedAt ||
    lic.first_connected_at ||
    lic.firstActivation ||
    lic.first_activation ||
    lic.activationDate ||
    lic.activation_date ||
    lic.activated_date ||
    lic.first_use ||
    lic.firstUse ||
    lic.first_used_at ||
    lic.firstUsedAt ||
    lic.handshake_at ||
    lic.handshakeAt ||
    lic.lastHandshake;
  let activatedAtDate = parseTimestampToDate(rawActivatedAt);

  // 4. Expires At
  const rawExpiresAt =
    lic.expiresAt ||
    lic.expires_at ||
    lic.expiration ||
    lic.expirationDate ||
    lic.expiration_date ||
    lic.expire_at ||
    lic.expireAt ||
    lic.expires ||
    lic.valid_until ||
    lic.validUntil ||
    lic.expiry ||
    lic.expiry_date ||
    lic.due_date;
  let expiresAtDate = parseTimestampToDate(rawExpiresAt);

  // 5. Activation Mode
  const rawActivationMode = lic.activationMode || lic.activation_mode || (rawActivatedAt ? 'first_use' : 'first_use');

  // 6. Devices (handle all array, map, and key-based representations)
  const rawDevices =
    lic.devices ||
    lic.device_list ||
    lic.deviceList ||
    lic.connectedDevices ||
    lic.connected_devices ||
    lic.device_bindings ||
    lic.deviceBindings ||
    lic.bindings ||
    lic.hardware ||
    lic.hwids;

  let devices: any[] = [];
  if (Array.isArray(rawDevices)) {
    devices = rawDevices.map((d, idx) => {
      if (typeof d === 'object' && d !== null) return d;
      return { deviceId: String(d || `dev-${idx}`), deviceName: 'Dispositivo Cliente' };
    });
  } else if (typeof rawDevices === 'object' && rawDevices !== null) {
    devices = Object.entries(rawDevices).map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return { deviceId: k, ...(v as any) };
      }
      return { deviceId: k, deviceName: 'Dispositivo Cliente' };
    });
  }

  // If devices array is empty, check root level single-device fields
  const rootDeviceId = lic.deviceId || lic.device_id || lic.hwid || lic.hardware_id;
  if (devices.length === 0 && rootDeviceId) {
    devices.push({
      deviceId: String(rootDeviceId),
      deviceName: lic.deviceName || lic.device_name || lic.name || 'Dispositivo Cliente',
      deviceModel: lic.deviceModel || lic.device_model || lic.model || 'Android',
      firstConnectedAt: rawActivatedAt || rawCreatedAt,
      lastActivityAt: lic.lastActivityAt || lic.last_activity_at || lic.last_seen || rawActivatedAt || rawCreatedAt,
      status: lic.status || 'active',
      appVersion: lic.appVersion || lic.app_version,
      ipAddress: lic.ip || lic.ipAddress || lic.ip_address,
    });
  }

  // If activatedAtDate is not set, but devices has a firstConnectedAt timestamp:
  if (!activatedAtDate && devices.length > 0) {
    for (const d of devices) {
      const devConnected = d.firstConnectedAt || d.first_connected_at || d.createdAt || d.created_at || d.timestamp;
      const parsed = parseTimestampToDate(devConnected);
      if (parsed) {
        activatedAtDate = parsed;
        break;
      }
    }
  }

  // If expiresAtDate is not set, but duration is present:
  const duration = typeof lic.duration === 'number' ? lic.duration : (parseInt(lic.duration, 10) || null);
  const durationUnit = lic.durationUnit || lic.duration_unit || 'days';
  if (!expiresAtDate && duration && duration > 0) {
    const baseDate = activatedAtDate || (rawActivationMode === 'immediate' ? createdAtDate : null);
    if (baseDate) {
      let ms = duration * 86400000;
      if (durationUnit === 'hours') ms = duration * 3600000;
      else if (durationUnit === 'minutes') ms = duration * 60000;
      else if (durationUnit === 'seconds') ms = duration * 1000;
      expiresAtDate = new Date(baseDate.getTime() + ms);
    }
  }

  const computedStatus = getRealLicenseStatus({
    ...lic,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : undefined,
    activatedAt: activatedAtDate ? activatedAtDate.toISOString() : undefined,
  });

  return {
    ...lic,
    id: String(lic.id || lic.keyId || lic.key || ''),
    clientName: lic.clientName || lic.client_name || 'Cliente Geral',
    orderReference: orderReference || undefined,
    notes: lic.notes || lic.note,
    deviceLimit: typeof lic.deviceLimit === 'number' ? lic.deviceLimit : (typeof lic.device_limit === 'number' ? lic.device_limit : 1),
    devicesUsed: typeof lic.devicesUsed === 'number' ? lic.devicesUsed : devices.length,
    activationMode: rawActivationMode,
    duration: duration || lic.duration,
    durationUnit,
    devices,
    createdAt: createdAtDate ? createdAtDate.toISOString() : (rawCreatedAt ? String(rawCreatedAt) : new Date().toISOString()),
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    activatedAt: activatedAtDate ? activatedAtDate.toISOString() : null,
    status: (computedStatus === 'deleted' ? 'archived' : computedStatus) as LicenseStatus,
  };
}
