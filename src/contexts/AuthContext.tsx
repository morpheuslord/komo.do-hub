import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { KomodoCredentials, loadCredentials, saveCredentials, clearCredentials } from '@/lib/crypto';
import { createKomodoClient, KomodoClient } from '@/lib/komodo-api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  credentials: KomodoCredentials | null;
  client: KomodoClient | null;
  login: (credentials: KomodoCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [credentials, setCredentials] = useState<KomodoCredentials | null>(null);
  const [client, setClient] = useState<KomodoClient | null>(null);

  useEffect(() => {
    async function loadStoredCredentials() {
      try {
        // Check for bypass mode
        const bypass = localStorage.getItem('komodo_bypass');
        if (bypass === 'true') {
          // Set mock credentials for dev mode
          const mockCreds: KomodoCredentials = {
            apiUrl: 'https://demo.komo.do',
            apiKey: 'bypass-key',
            apiSecret: 'bypass-secret',
          };
          setCredentials(mockCreds);
          setClient(createKomodoClient(mockCreds));
          setIsLoading(false);
          return;
        }

        const stored = await loadCredentials();
        if (stored) {
          const komodoClient = createKomodoClient(stored);
          const isValid = await komodoClient.testConnection();
          if (isValid) {
            setCredentials(stored);
            setClient(komodoClient);
          } else {
            clearCredentials();
          }
        }
      } catch (error) {
        console.error('Failed to load credentials:', error);
        clearCredentials();
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredCredentials();
  }, []);

  const login = useCallback(async (newCredentials: KomodoCredentials) => {
    try {
      const komodoClient = createKomodoClient(newCredentials);
      const isValid = await komodoClient.testConnection();
      
      if (!isValid) {
        return { success: false, error: 'Failed to connect. Check your credentials and API URL.' };
      }
      
      await saveCredentials(newCredentials);
      setCredentials(newCredentials);
      setClient(komodoClient);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    localStorage.removeItem('komodo_bypass');
    setCredentials(null);
    setClient(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!credentials && !!client,
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
