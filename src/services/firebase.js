// Firebase is optional: without VITE_FIREBASE_* the game builds and runs offline as before.
// The SDK is loaded on demand so it never delays the first frame.
const env = import.meta.env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Local runs against `firebase emulators:start`: VITE_FIREBASE_EMULATOR=127.0.0.1
const emulatorHost = env.VITE_FIREBASE_EMULATOR || '';

export const cloudEnabled = () =>
  !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

// Logins become addresses on the project's own domain; no mail is ever sent there.
export const loginDomain = () => `${firebaseConfig.projectId}.firebaseapp.com`;

let loading = null;

// Resolves to the SDK functions the services use, bound to one app instance.
export function loadFirebase() {
  if (!cloudEnabled()) return Promise.reject(new Error('Firebase is not configured'));
  loading ||= Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
  ]).then(([app, auth, firestore]) => {
    const instance = app.initializeApp(firebaseConfig);
    const authInstance = auth.initializeAuth(instance, {
      persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence],
    });
    const db = firestore.getFirestore(instance);
    if (emulatorHost) {
      auth.connectAuthEmulator(authInstance, `http://${emulatorHost}:9099`, {
        disableWarnings: true,
      });
      firestore.connectFirestoreEmulator(db, emulatorHost, 8080);
    }
    return { auth: authInstance, db, authApi: auth, firestore };
  });
  loading.catch(() => (loading = null));
  return loading;
}
