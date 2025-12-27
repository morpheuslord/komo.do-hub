// Simple credential storage for Android-compatible local storage
// Uses base64 encoding with a simple XOR scramble for obfuscation
// This is NOT encryption but provides reasonable local protection

const CREDENTIALS_KEY = 'komodo-credentials';
const SCRAMBLE_KEY = 'K0m0d0-Scr4mbl3-K3y-2024'; // Obfuscation key

/* =========================
   XOR Scramble (works everywhere including Android WebView)
   ========================= */

function xorScramble(data: string, key: string): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}

function toBase64(str: string): string {
  try {
    // Handle Unicode properly
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  } catch {
    // Fallback for older browsers
    return btoa(unescape(encodeURIComponent(str)));
  }
}

function fromBase64(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    // Fallback
    return decodeURIComponent(escape(atob(base64)));
  }
}

/* =========================
   Encode / Decode
   ========================= */

function encodeCredentials(data: string): string {
  const scrambled = xorScramble(data, SCRAMBLE_KEY);
  return toBase64(scrambled);
}

function decodeCredentials(encoded: string): string {
  const scrambled = fromBase64(encoded);
  return xorScramble(scrambled, SCRAMBLE_KEY);
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
   Storage Helpers (Synchronous - works reliably on Android)
   ========================= */

export function saveCredentials(credentials: KomodoCredentials): void {
  try {
    const json = JSON.stringify(credentials);
    const encoded = encodeCredentials(json);
    localStorage.setItem(CREDENTIALS_KEY, encoded);
    console.log('[Komodo] Credentials saved successfully');
  } catch (error) {
    console.error('[Komodo] Failed to save credentials:', error);
    // Fallback: store as plain JSON (better than failing)
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  }
}

export function loadCredentials(): KomodoCredentials | null {
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) {
      console.log('[Komodo] No stored credentials found');
      return null;
    }

    // Try to decode (scrambled format)
    try {
      const decoded = decodeCredentials(stored);
      const creds = JSON.parse(decoded) as KomodoCredentials;
      console.log('[Komodo] Credentials loaded (encoded format)');
      return creds;
    } catch {
      // Try plain JSON fallback
      try {
        const creds = JSON.parse(stored) as KomodoCredentials;
        console.log('[Komodo] Credentials loaded (plain format)');
        return creds;
      } catch {
        console.error('[Komodo] Failed to parse stored credentials');
        return null;
      }
    }
  } catch (error) {
    console.error('[Komodo] Failed to load credentials:', error);
    return null;
  }
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
  console.log('[Komodo] Credentials cleared');
}

/* =========================
   Async wrappers for backward compatibility
   ========================= */

export async function saveCredentialsAsync(credentials: KomodoCredentials): Promise<void> {
  saveCredentials(credentials);
}

export async function loadCredentialsAsync(): Promise<KomodoCredentials | null> {
  return loadCredentials();
}
