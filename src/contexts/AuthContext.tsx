import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  KomodoCredentials,
  loadCredentials,
  saveCredentials,
  clearCredentials,
} from '@/lib/crypto';

import { createKomodoClient, KomodoClient } from '@/lib/komodo-api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  credentials: KomodoCredentials | null;
  client: KomodoClient | null;
  login: (
    credentials: KomodoCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [credentials, setCredentials] = useState<KomodoCredentials | null>(null);
  const [client, setClient] = useState<KomodoClient | null>(null);

  useEffect(() => {
    function loadStoredCredentials() {
      console.log('[Auth] Loading stored credentials...');
      
      try {
        /* =========================
           Bypass / Dev Mode
           ========================= */
        const bypass = localStorage.getItem('komodo_bypass');
        if (bypass === 'true') {
          console.log('[Auth] Bypass mode enabled');
          const mockCreds: KomodoCredentials = {
            protocol: 'https',
            host: 'demo.komo.do',
            port: 443,
            apiKey: 'bypass-key',
            apiSecret: 'bypass-secret',
          };

          const komodoClient = createKomodoClient(mockCreds);
          setCredentials(mockCreds);
          setClient(komodoClient);
          setIsLoading(false);
          return;
        }

        /* =========================
           Load Stored Credentials (synchronous)
           ========================= */
        const stored = loadCredentials();
        if (!stored) {
          console.log('[Auth] No stored credentials');
          setIsLoading(false);
          return;
        }

        console.log('[Auth] Found stored credentials, validating...');
        const komodoClient = createKomodoClient(stored);
        
        // Validate connection in background
        komodoClient.testConnection().then(isValid => {
          if (isValid) {
            console.log('[Auth] Credentials valid');
            setCredentials(stored);
            setClient(komodoClient);
          } else {
            console.log('[Auth] Credentials invalid, clearing');
            clearCredentials();
          }
          setIsLoading(false);
        }).catch(error => {
          console.error('[Auth] Validation error:', error);
          // Still set credentials - let user try to use them
          // Network might just be slow on Android
          setCredentials(stored);
          setClient(komodoClient);
          setIsLoading(false);
        });
        
      } catch (error) {
        console.error('[Auth] Failed to load credentials:', error);
        clearCredentials();
        setIsLoading(false);
      }
    }

    loadStoredCredentials();
  }, []);

  const login = useCallback(
    async (newCredentials: KomodoCredentials) => {
      console.log('[Auth] Attempting login...');
      
      try {
        const komodoClient = createKomodoClient(newCredentials);
        const isValid = await komodoClient.testConnection();

        if (!isValid) {
          console.log('[Auth] Connection test failed');
          return {
            success: false,
            error: 'Failed to connect. Check host, port, protocol, and credentials.',
          };
        }

        console.log('[Auth] Connection successful, saving credentials');
        saveCredentials(newCredentials);
        setCredentials(newCredentials);
        setClient(komodoClient);

        return { success: true };
      } catch (error) {
        console.error('[Auth] Login error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
    []
  );

  const logout = useCallback(() => {
    console.log('[Auth] Logging out');
    clearCredentials();
    localStorage.removeItem('komodo_bypass');
    setCredentials(null);
    setClient(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(credentials && client),
        isLoading,
        credentials,
        client,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
