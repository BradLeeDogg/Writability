import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

// Lazy singletons — nothing touches the network until sharing is actually used.
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let authReady: Promise<void> | null = null;

function init(): boolean {
  if (!isFirebaseConfigured) return false;
  if (app) return true;

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // Long-polling auto-detection makes Firestore reliable on React Native.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  auth = getAuth(app);

  // Sign in anonymously so security rules can require an authenticated user,
  // without ever showing the person a login screen.
  authReady = new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth!, (user) => {
      if (user) {
        unsub();
        resolve();
      }
    });
    signInAnonymously(auth!).catch((e) => {
      console.warn('Anonymous sign-in failed:', e?.message ?? e);
      resolve();
    });
  });
  return true;
}

export function firestoreEnabled(): boolean {
  return isFirebaseConfigured;
}

export function getDb(): Firestore {
  if (!init() || !db) {
    throw new Error('Firebase is not configured. Add your config in firebaseConfig.ts.');
  }
  return db;
}

export async function ensureSignedIn(): Promise<void> {
  if (!init()) throw new Error('Firebase is not configured.');
  if (authReady) await authReady;
}
