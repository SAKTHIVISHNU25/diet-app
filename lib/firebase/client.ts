'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured } from './config';

/**
 * Client-side Firebase.
 *
 * Used for two things only: signing in/out, and uploading meal photos. All data
 * reads and writes go through the server (Admin SDK), so the Realtime Database
 * client SDK is deliberately not initialised here.
 */

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables in .env.local.',
    );
  }

  if (!app) {
    // Fast refresh can re-run this module; reuse the existing app.
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }

  return app;
}

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
    // The server session is a cookie, but local persistence keeps the client
    // SDK signed in too, so token refresh works without a round trip.
    void setPersistence(authInstance, browserLocalPersistence).catch(() => {
      // Private browsing can block storage; sign-in still works for the session.
    });
  }
  return authInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
