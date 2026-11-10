import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  Auth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

const STORAGE_KEY_API_KEY = 'zod_firebase_api_key';
const STORAGE_KEY_APP_ID = 'zod_firebase_app_id';
const STORAGE_KEY_AUTH_DOMAIN = 'zod_firebase_auth_domain';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
}

export const DEFAULT_FIREBASE_API_KEY = 'AIzaSyB7QfgeKJ9fKYNHyQ3Kl8G-x2U-G-s7gz0';
export const DEFAULT_FIREBASE_PROJECT_ID = 'dashboard-proxy-menu';
export const DEFAULT_FIREBASE_AUTH_DOMAIN = 'dashboard-proxy-menu.firebaseapp.com';
export const DEFAULT_FIREBASE_APP_ID = '1:188098379949:web:b502ca1f658e85d4c0c624';
export const DEFAULT_FIREBASE_SENDER_ID = '188098379949';

export function getEffectiveFirebaseConfig(): FirebaseClientConfig {
  const envApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
  const storedApiKey = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEY) : null)?.trim();
  const apiKey = envApiKey || storedApiKey || DEFAULT_FIREBASE_API_KEY;

  const envProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim();
  const projectId = envProjectId || DEFAULT_FIREBASE_PROJECT_ID;

  const envAuthDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim();
  const storedAuthDomain = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_AUTH_DOMAIN) : null)?.trim();
  const authDomain = envAuthDomain || storedAuthDomain || DEFAULT_FIREBASE_AUTH_DOMAIN;

  const envAppId = (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim();
  const storedAppId = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_APP_ID) : null)?.trim();
  const appId = envAppId || storedAppId || DEFAULT_FIREBASE_APP_ID;

  const envSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined)?.trim();
  const messagingSenderId = envSenderId || DEFAULT_FIREBASE_SENDER_ID;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
  };
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function initFirebase(): { app: FirebaseApp | null; auth: Auth | null; isConfigured: boolean } {
  const config = getEffectiveFirebaseConfig();
  
  if (!config.apiKey) {
    return { app: null, auth: null, isConfigured: false };
  }

  try {
    if (getApps().length === 0) {
      appInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId || undefined,
        messagingSenderId: config.messagingSenderId || undefined,
      });
    } else {
      appInstance = getApp();
    }

    if (!authInstance && appInstance) {
      authInstance = getAuth(appInstance);
      // Ensure persistence across page reloads
      setPersistence(authInstance, browserLocalPersistence).catch((err) => {
        console.warn('Failed to set browser local persistence:', err);
      });
    }

    return { app: appInstance, auth: authInstance, isConfigured: true };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return { app: null, auth: null, isConfigured: false };
  }
}

export function saveLocalFirebaseConfig(apiKey: string, appId?: string, authDomain?: string) {
  if (typeof window !== 'undefined') {
    if (apiKey) localStorage.setItem(STORAGE_KEY_API_KEY, apiKey.trim());
    if (appId) localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
    if (authDomain) localStorage.setItem(STORAGE_KEY_AUTH_DOMAIN, authDomain.trim());
  }
}

export function clearLocalFirebaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    localStorage.removeItem(STORAGE_KEY_APP_ID);
    localStorage.removeItem(STORAGE_KEY_AUTH_DOMAIN);
  }
}

export function getFriendlyAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your administrator credentials.';
    case 'auth/invalid-email':
      return 'The email address format is invalid.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled. Contact the platform owner.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to too many failed attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network connection failure. Please check your internet connection.';
    case 'auth/requires-recent-login':
      return 'Security requirement: Please re-authenticate to complete this operation.';
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Firebase Web API key is invalid or not enabled for project dashboard-proxy-menu.';
    default:
      return 'Authentication failed. Please verify your credentials and try again.';
  }
}

export {
  signInWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
};
export type { User, Auth };
