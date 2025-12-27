// Komodo API client wrapper
import type { KomodoCredentials } from './crypto';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface KomodoClient {
  read: <T>(type: string, params?: Record<string, unknown>) => Promise<ApiResponse<T>>;
  write: <T>(type: string, params?: Record<string, unknown>) => Promise<ApiResponse<T>>;
  execute: <T>(type: string, params?: Record<string, unknown>) => Promise<ApiResponse<T>>;
  testConnection: () => Promise<boolean>;
}

/* =========================
   Entity Types
   ========================= */

export interface StackListItem {
  id: string;
  name: string;
  state?: string;
  status?: string;
  server_id?: string;
  tags?: string[];
}

export interface DeploymentListItem {
  id: string;
  name: string;
  state?: string;
  status?: string;
  image?: string;
  server_id?: string;
  serverName?: string;
  serverId?: string;
  stats?: string;
}

export interface ServerListItem {
  id: string;
  name: string;
  state?: string;
  status?: string;
  region?: string;
  address?: string;
  cpu_perc?: number;
  mem_used_gb?: number;
  mem_total_gb?: number;
  disk_used_gb?: number;
  disk_total_gb?: number;
}

export interface BuildListItem {
  id: string;
  name: string;
  state?: string;
  status?: string;
  version?: string;
}

export interface RepoListItem {
  id: string;
  name: string;
  state?: string;
  status?: string;
  repo?: string;
  branch?: string;
}

export interface ProcedureListItem {
  id: string;
  name: string;
  state?: string;
}

export interface AlerterListItem {
  id: string;
  name: string;
  state?: string;
}

export interface UserInfo {
  id: string;
  username: string;
  enabled: boolean;
  admin: boolean;
  create_server_permissions: boolean;
  create_build_permissions: boolean;
}

/* =========================
   Client Implementation
   ========================= */

export function createKomodoClient(credentials: KomodoCredentials): KomodoClient {
  const {
    protocol,
    host,
    port,
    apiKey,
    apiSecret,
  } = credentials;

  const baseUrl = `${protocol}://${host}:${port}`;

  async function makeRequest<T>(
    path: string,
    type: string,
    params: Record<string, unknown> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${path}`;
    console.log(`[Komodo API] ${type} -> ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Secret': apiSecret,
        },
        body: JSON.stringify({ type, params }),
        signal: controller.signal,
        // Android WebView needs these
        mode: 'cors',
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      console.log(`[Komodo API] Response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMessage = errorData.error;
        } catch {
          // ignore JSON parse failure
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      console.error(`[Komodo API] Error: ${errorMessage}`, error);
      
      // Provide more helpful error messages for Android
      if (errorMessage.includes('abort')) {
        return { success: false, error: 'Request timed out. Check your network connection.' };
      }
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        return { 
          success: false, 
          error: 'Network error. Ensure the server is reachable and allows connections from this device.' 
        };
      }
      
      return { success: false, error: errorMessage };
    }
  }

  return {
    read: <T>(type: string, params?: Record<string, unknown>) =>
      makeRequest<T>('/read', type, params),

    write: <T>(type: string, params?: Record<string, unknown>) =>
      makeRequest<T>('/write', type, params),

    execute: <T>(type: string, params?: Record<string, unknown>) =>
      makeRequest<T>('/execute', type, params),

    testConnection: async () => {
      console.log('[Komodo API] Testing connection...');
      const result = await makeRequest('/read', 'GetVersion', {});
      console.log('[Komodo API] Connection test result:', result.success);
      return result.success;
    },
  };
}
