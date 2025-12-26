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
   Entity Types (unchanged)
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

  // ✅ Correct base URL construction
  const baseUrl = `${protocol}://${host}:${port}`;

  async function makeRequest<T>(
    path: string,
    type: string,
    params: Record<string, unknown> = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Secret': apiSecret,
        },
        body: JSON.stringify({ type, params }),
      });

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
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
      const result = await makeRequest('/read', 'GetVersion', {});
      return result.success;
    },
  };
}
