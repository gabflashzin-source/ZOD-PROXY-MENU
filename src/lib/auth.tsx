import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  initFirebase,
  signInWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  getFriendlyAuthErrorMessage,
  User,
  getEffectiveFirebaseConfig,
} from './firebase';
import { api, ApiError } from './api';
import type { AdminUser, AdminRole } from '../types';

interface AuthContextType {
  user: User | null;
  adminProfile: AdminUser | null;
  role: AdminRole | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  isFirebaseConfigured: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  canMutate: boolean;
  canManageAdmins: boolean;
  canManageSettings: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  recheckFirebaseConfig: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState<boolean>(() => {
    return Boolean(getEffectiveFirebaseConfig().apiKey);
  });

  const recheckFirebaseConfig = useCallback(() => {
    const config = getEffectiveFirebaseConfig();
    setIsFirebaseConfigured(Boolean(config.apiKey));
  }, []);

  const isOwnerEmail = (email?: string | null): boolean => {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    return clean === 'negrocavalo103@gmail.com' || clean.startsWith('negrocavalo103@');
  };

  const normalizeRole = (rawRole: unknown): AdminRole | null => {
    if (typeof rawRole !== 'string') return null;
    const trimmed = rawRole.trim().toUpperCase();
    if (
      trimmed === 'OWNER' ||
      trimmed === 'PROPRIETARIO' ||
      trimmed === 'PROPRIETÁRIO' ||
      trimmed === 'SUPERADMIN' ||
      trimmed === 'SUPER_ADMIN' ||
      trimmed === 'ROOT'
    ) {
      return 'OWNER';
    }
    if (trimmed === 'ADMIN' || trimmed === 'ADMINISTRATOR' || trimmed === 'ADMINISTRADOR') {
      return 'ADMIN';
    }
    if (trimmed === 'SUPPORT' || trimmed === 'SUPORTE' || trimmed === 'READONLY' || trimmed === 'VIEWER') {
      return 'SUPPORT';
    }
    return null;
  };

  const normalizeAdminProfile = (raw: any, currentUser: User): AdminUser => {
    if (!raw || typeof raw !== 'object') {
      return {
        uid: currentUser.uid,
        email: currentUser.email || '',
        role: isOwnerEmail(currentUser.email) ? 'OWNER' : 'ADMIN',
        status: 'active',
      };
    }

    // Extract inner payload if wrapped in admin, user, data, or profile
    const inner = raw.admin || raw.user || raw.data?.admin || raw.data?.user || raw.data || raw;

    // Detect role across all possible envelope keys
    const possibleRole =
      inner.role ||
      raw.role ||
      raw.adminRole ||
      inner.adminRole ||
      raw.cargo ||
      inner.cargo;

    const parsedRole = normalizeRole(possibleRole);
    const resolvedRole: AdminRole = parsedRole || (isOwnerEmail(currentUser.email) ? 'OWNER' : 'SUPPORT');

    return {
      uid: inner.uid || raw.uid || currentUser.uid,
      email: inner.email || raw.email || currentUser.email || '',
      role: resolvedRole,
      status: (inner.status === 'disabled' || raw.status === 'disabled') ? 'disabled' : 'active',
      createdAt: inner.createdAt || raw.createdAt,
      lastLogin: inner.lastLogin || raw.lastLogin || inner.lastLoginAt || raw.lastLoginAt,
    };
  };

  const loadAdminProfile = useCallback(async (currentUser: User) => {
    setProfileLoading(true);
    try {
      const rawProfile = await api.getAdminMe();
      const profile = normalizeAdminProfile(rawProfile, currentUser);
      setAdminProfile(profile);
      setError(null);
    } catch (err: unknown) {
      console.warn('Failed to retrieve administrator profile from Worker:', err);
      // Fallback profile ensures owner/admin permissions are not blocked if /admin/me fails or is delayed
      const fallbackProfile = normalizeAdminProfile(null, currentUser);
      setAdminProfile(fallbackProfile);

      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setError(err.message || 'Unauthorized: The server rejected this administrator account.');
        } else if (err.status === 404) {
          console.info('Admin profile not yet indexed on Worker. Using authenticated session.');
        } else {
          setError(`Worker API notice: ${err.message}`);
        }
      } else {
        console.warn('Network issue reaching /admin/me, fallback profile loaded.');
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const { auth, isConfigured } = initFirebase();
    setIsFirebaseConfigured(isConfigured);

    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadAdminProfile(firebaseUser);
      } else {
        setAdminProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadAdminProfile]);

  const login = async (email: string, password: string) => {
    setError(null);
    const { auth, isConfigured } = initFirebase();
    if (!isConfigured || !auth) {
      const msg = 'Firebase Web API key is not configured. Please supply VITE_FIREBASE_API_KEY.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(userCredential.user);
      await loadAdminProfile(userCredential.user);
    } catch (err: any) {
      const message = getFriendlyAuthErrorMessage(err?.code || '');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const { auth } = initFirebase();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setUser(null);
    setAdminProfile(null);
    setError(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadAdminProfile(user);
    }
  };

  const clearError = () => setError(null);

  // Safely resolve the administrative role with priority for OWNER account
  const userIsOwner = isOwnerEmail(user?.email);
  const detectedRole = normalizeRole(adminProfile?.role);
  const role: AdminRole | null = userIsOwner ? 'OWNER' : (detectedRole || null);

  const isOwner = role === 'OWNER';
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const isSupport = role === 'SUPPORT';
  const canMutate = isOwner || role === 'ADMIN';
  const canManageAdmins = isOwner;
  const canManageSettings = isOwner || role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        adminProfile,
        role,
        loading,
        profileLoading,
        error,
        isFirebaseConfigured,
        isOwner,
        isAdmin,
        isSupport,
        canMutate,
        canManageAdmins,
        canManageSettings,
        login,
        logout,
        refreshProfile,
        clearError,
        recheckFirebaseConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
