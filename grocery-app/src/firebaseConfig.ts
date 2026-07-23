// ─────────────────────────────────────────────────────────────────────────
// Firebase configuration for cloud sync (sharing lists between phones).
//
// Sharing is OFF until you paste your own Firebase project's values below.
// Until then the app works exactly as before: a private list on this phone.
//
// To turn on sharing, follow the steps in the README ("Turn on list sharing"),
// then replace the placeholder strings here with the values Firebase gives you
// (Project settings → General → Your apps → SDK setup and configuration).
//
// These values are NOT secret — Firebase web config is meant to be public.
// Access is controlled by the security rules in the README, not by hiding them.
// ─────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// True once real values have been filled in above.
export const isFirebaseConfigured =
  !!firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith('YOUR_') &&
  !!firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith('YOUR_');
