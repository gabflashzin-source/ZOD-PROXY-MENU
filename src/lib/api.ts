import { initFirebase } from './firebase';
import type {
  AdminUser,
  LicenseKey,
  AuditLogItem,
  SystemSettings,
  HealthCheckResponse,
  CreateLicensePayload,
  RenewLicensePayload,
  LicenseStatus,
  AdminRole,
  ConnectedDevice,
} from '../types';

export const CLOUDFLARE_WORKER_URL = 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev';
export const PROXY_API_BASE_URL = '/api/worker';
export const DEFAULT_API_BASE_URL = PROXY_API_BASE_URL;
const STORAGE_API_BASE_URL = 'zod_api_base_url';

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const storedUrl = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_API_BASE_URL) : null)?.trim();

  // If a stored URL or env URL was pointing directly to the Cloudflare Worker domain,
  // map it to the same-origin proxy (/api/worker) to prevent browser CORS preflight
  // failures (Cloudflare Worker v4.0 returns HTTP 500 on OPTIONS preflight requests).
  if (storedUrl) {
    if (
      storedUrl === CLOUDFLARE_WORKER_URL ||
      storedUrl.includes('gabrieldacechen6.workers.dev') ||
      storedUrl === '/api/worker'
    ) {
      return PROXY_API_BASE_URL;
    }
    return storedUrl.replace(/\/+$/, '');
  }

  if (envUrl) {
    if (
      envUrl === CLOUDFLARE_WORKER_URL ||
      envUrl.includes('gabrieldacechen6.workers.dev') ||
      envUrl === '/api/worker'
    ) {
      return PROXY_API_BASE_URL;
    }
    return envUrl.replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== 'undefined') {
    if (url) {
      const cleanUrl = url.trim();
      // If user sets the direct worker URL, normalize to proxy to keep dashboard operational
      if (cleanUrl === CLOUDFLARE_WORKER_URL || cleanUrl.includes('gabrieldacechen6.workers.dev')) {
        localStorage.setItem(STORAGE_API_BASE_URL, PROXY_API_BASE_URL);
      } else {
        localStorage.setItem(STORAGE_API_BASE_URL, cleanUrl);
      }
    } else {
      localStorage.removeItem(STORAGE_API_BASE_URL);
    }
  }
}

export class ApiError extends Error {
  public status: number;
  public detail?: string;
  public endpoint: string;
  public isEndpointUnimplemented: boolean;

  constructor(status: number, message: string, endpoint: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.detail = detail;
    this.isEndpointUnimplemented = status === 404 || message.toLowerCase().includes('not found') || message.toLowerCase().includes('unimplemented');
  }
}

// Global registry of endpoint availability
const endpointSupportRegistry: Record<string, boolean> = {};

export function getEndpointSupport(endpointKey: string): boolean | undefined {
  return endpointSupportRegistry[endpointKey];
}

export function markEndpointSupport(endpointKey: string, supported: boolean) {
  endpointSupportRegistry[endpointKey] = supported;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  retryOn401?: boolean;
}

async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const { auth } = initFirebase();
  if (!auth || !auth.currentUser) {
    return null;
  }
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.error('Failed to get Firebase ID token:', err);
    return null;
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${baseUrl}${cleanEndpoint}`;
  const retryOn401 = options.retryOn401 ?? true;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Only attach Content-Type when there is a payload or method requires it
  const method = (options.method || 'GET').toUpperCase();
  if (options.body !== undefined || (method !== 'GET' && method !== 'HEAD')) {
    headers['Content-Type'] = 'application/json';
  }

  if (!options.skipAuth) {
    const token = await getAuthToken(false);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchInit: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    fetchInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchInit);
  } catch (netErr: unknown) {
    // If a direct request failed (e.g. browser CORS preflight failed on workers.dev),
    // automatically fallback to the local same-origin proxy (/api/worker).
    if (!url.startsWith(PROXY_API_BASE_URL) && !url.includes('/api/worker')) {
      const fallbackUrl = `${PROXY_API_BASE_URL}${cleanEndpoint}`;
      console.warn(`Direct request to ${url} failed with network error. Retrying via proxy: ${fallbackUrl}`);
      try {
        response = await fetch(fallbackUrl, fetchInit);
        url = fallbackUrl;
      } catch (proxyErr: unknown) {
        const msg = proxyErr instanceof Error ? proxyErr.message : 'Network error';
        throw new ApiError(0, `Network failure reaching Cloudflare Worker API: ${msg}`, endpoint);
      }
    } else {
      const msg = netErr instanceof Error ? netErr.message : 'Network error';
      throw new ApiError(0, `Network failure reaching Cloudflare Worker API: ${msg}`, endpoint);
    }
  }

  // Handle 401 with single token refresh retry
  if (response.status === 401 && retryOn401 && !options.skipAuth) {
    const refreshedToken = await getAuthToken(true);
    if (refreshedToken) {
      headers['Authorization'] = `Bearer ${refreshedToken}`;
      try {
        response = await fetch(url, { ...fetchInit, headers });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error during retry';
        throw new ApiError(0, `Network failure on retried request: ${msg}`, endpoint);
      }
    }
  }

  let rawData: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      rawData = await response.json();
    } catch {
      throw new ApiError(response.status, 'Invalid JSON returned from server', endpoint);
    }
  } else {
    try {
      rawData = await response.text();
    } catch {
      rawData = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let detailMessage: string | undefined = undefined;

    if (rawData && typeof rawData === 'object') {
      const errObj = rawData as Record<string, unknown>;
      if (typeof errObj.error === 'string') errorMessage = errObj.error;
      else if (typeof errObj.message === 'string') errorMessage = errObj.message;
      if (typeof errObj.detail === 'string') detailMessage = errObj.detail;
    } else if (typeof rawData === 'string' && rawData.length > 0) {
      errorMessage = rawData;
    }

    // Friendly translation of common HTTP errors
    if (response.status === 401) {
      errorMessage = errorMessage || 'Unauthorized. Session expired or missing authentication token.';
    } else if (response.status === 403) {
      errorMessage = errorMessage || 'Forbidden. Your administrator role has insufficient permissions.';
    } else if (response.status === 404) {
      markEndpointSupport(endpoint, false);
      errorMessage = errorMessage || `Endpoint not found on Worker (${endpoint}).`;
    } else if (response.status === 409) {
      errorMessage = errorMessage || 'Conflict. The requested resource or key state already exists.';
    } else if (response.status === 429) {
      errorMessage = errorMessage || 'Rate limited. Too many administrative requests.';
    } else if (response.status >= 500) {
      errorMessage = errorMessage || `Worker Server Error (${response.status}).`;
    }

    throw new ApiError(response.status, errorMessage, endpoint, detailMessage);
  }

  // Register endpoint as supported on successful call
  markEndpointSupport(endpoint, true);

  // If response object has { success: true, data: ... }, unpack data if present
  if (rawData && typeof rawData === 'object' && 'data' in rawData) {
    return (rawData as { data: T }).data;
  }

  return rawData as T;
}

// High-level API Adapter methods
export const api = {
  // 1. Health check
  async getHealth(): Promise<HealthCheckResponse> {
    return apiRequest<HealthCheckResponse>('/health', { skipAuth: true });
  },

  // 2. Admin profile & role verification
  async getAdminMe(): Promise<AdminUser> {
    return apiRequest<AdminUser>('/admin/me');
  },

  // 3. License management
  async getKeys(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
  }): Promise<{ keys: LicenseKey[]; total?: number; page?: number; limit?: number }> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sortBy) query.set('sortBy', params.sortBy);

    const qs = query.toString();
    const endpoint = `/admin/keys${qs ? `?${qs}` : ''}`;
    const result = await apiRequest<any>(endpoint);

    // Normalize result in case Worker returns an array directly or { keys, total }
    if (Array.isArray(result)) {
      return { keys: result, total: result.length };
    }
    if (result && Array.isArray(result.keys)) {
      return result;
    }
    return { keys: [], total: 0 };
  },

  async getKey(id: string): Promise<LicenseKey> {
    return apiRequest<LicenseKey>(`/admin/keys/${encodeURIComponent(id)}`);
  },

  async createKey(payload: CreateLicensePayload): Promise<{ key: string; license: LicenseKey } | LicenseKey> {
    return apiRequest<any>('/admin/keys', {
      method: 'POST',
      body: payload,
    });
  },

  async renewKey(id: string, payload: RenewLicensePayload): Promise<{ success: boolean; license?: LicenseKey }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(id)}/renew`, {
      method: 'POST',
      body: payload,
    });
  },

  async updateKeyStatus(id: string, status: LicenseStatus, reason?: string): Promise<{ success: boolean; license?: LicenseKey }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, reason },
    });
  },

  async updateKeyMetadata(id: string, metadata: {
    clientName?: string;
    orderReference?: string;
    notes?: string;
    deviceLimit?: number;
  }): Promise<{ success: boolean; license?: LicenseKey }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(id)}/metadata`, {
      method: 'PATCH',
      body: metadata,
    });
  },

  async archiveKey(id: string): Promise<{ success: boolean }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
  },

  // 4. Device management
  async getDevices(): Promise<{ devices: ConnectedDevice[]; total?: number }> {
    const result = await apiRequest<any>('/admin/devices');
    if (Array.isArray(result)) {
      return { devices: result, total: result.length };
    }
    if (result && Array.isArray(result.devices)) {
      return result;
    }
    if (result && Array.isArray(result.data)) {
      return { devices: result.data, total: result.data.length };
    }
    return { devices: [], total: 0 };
  },

  async unlinkDevice(keyId: string, deviceId: string): Promise<{ success: boolean }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(keyId)}/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  },

  async unlinkAllDevices(keyId: string): Promise<{ success: boolean; unlinkedCount?: number }> {
    return apiRequest<any>(`/admin/keys/${encodeURIComponent(keyId)}/devices/unlink-all`, {
      method: 'POST',
    });
  },

  // 5. Audit logs
  async getAuditLogs(params?: {
    search?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLogItem[]; total?: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.action) query.set('action', params.action);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/admin/audit${qs ? `?${qs}` : ''}`;
    const result = await apiRequest<any>(endpoint);

    if (Array.isArray(result)) {
      return { logs: result, total: result.length };
    }
    if (result && Array.isArray(result.logs)) {
      return result;
    }
    return { logs: [], total: 0 };
  },

  // 6. Admin management (OWNER only)
  async getAdmins(): Promise<AdminUser[]> {
    const result = await apiRequest<any>('/admin/admins');
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.admins)) return result.admins;
    return [];
  },

  async createAdmin(payload: { email: string; role: AdminRole; password?: string }): Promise<AdminUser> {
    return apiRequest<AdminUser>('/admin/admins', {
      method: 'POST',
      body: payload,
    });
  },

  async updateAdmin(uid: string, payload: { role?: AdminRole; status?: 'active' | 'disabled' }): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/admins/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  // 7. System settings
  async getSettings(): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/admin/settings');
  },

  async updateSettings(payload: Partial<SystemSettings>): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/admin/settings', {
      method: 'PATCH',
      body: payload,
    });
  },
};
