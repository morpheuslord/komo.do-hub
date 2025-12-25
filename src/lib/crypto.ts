// Simple encryption utilities for storing credentials locally
// Uses Web Crypto API for AES-GCM encryption when available
// Falls back to plaintext storage on Android WebView

const ENCRYPTION_KEY_NAME = 'komodo-encryption-key';
const CREDENTIALS_KEY = 'komodo-credentials';

/* =========================
   Capability Check
   ========================= */

function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.crypto &&
    !!window.crypto.subtle &&
    typeof window.crypto.subtle.generateKey === 'function'
  );
}

/* =========================
   Key Management
   ========================= */

async function getOrCreateKey(): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('WebCrypto not available');
  }

  const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);

  if (storedKey) {
    const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyString = btoa(
    String.fromCharCode(...new Uint8Array(exportedKey))
  );

  localStorage.setItem(ENCRYPTION_KEY_NAME, keyString);
  return key;
}

/* =========================
   Encrypt / Decrypt
   ========================= */

export async function encrypt(data: string): Promise<string> {
  if (!isWebCryptoAvailable()) {
    // Android WebView fallback
    return data;
  }

  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  const combined = new Uint8Array(
    iv.length + new Uint8Array(encrypted).length
  );
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedData: string): Promise<string> {
  if (!isWebCryptoAvailable()) {
    // Android WebView fallback
    return encryptedData;
  }

  const key = await getOrCreateKey();
  const combined = Uint8Array.from(
    atob(encryptedData),
    c => c.charCodeAt(0)
  );

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

/* =========================
   Credentials Model
   ========================= */

export interface KomodoCredentials {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  apiKey: string;
  apiSecret: string;
}

/* =========================
   Storage Helpers
   ========================= */

export async function saveCredentials(
  credentials: KomodoCredentials
): Promise<void> {
  // Try encrypted path
  try {
    const encrypted = await encrypt(JSON.stringify(credentials));
    localStorage.setItem(CREDENTIALS_KEY, encrypted);
  } catch {
    // Absolute fallback (should not happen, but safe)
    localStorage.setItem(
      CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );
  }
}

export async function loadCredentials(): Promise<KomodoCredentials | null> {
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;

  // Try plaintext first (Android fallback)
  try {
    return JSON.parse(stored) as KomodoCredentials;
  } catch {
    // Not plaintext, try decrypt
  }

  try {
    const decrypted = await decrypt(stored);
    return JSON.parse(decrypted) as KomodoCredentials;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
  localStorage.removeItem(ENCRYPTION_KEY_NAME);
}
