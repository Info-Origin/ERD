import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { ActiveConnection, ConnectionInfo, ERDData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

interface ConnectionContextValue {
  activeConnection: ActiveConnection | null;
  isConnected: boolean;
  isDynamicConnected: boolean;
  connect: (connectionData: { token: string; connectionInfo: ConnectionInfo }) => void;
  disconnect: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
  getDynamicPrefix: () => string | null;
  getDynamicSchemaCache: () => Record<string, ERDData>;
  setDynamicSchemaCache: (schemaName: string, data: ERDData) => void;
  clearDynamicSchemaCache: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

export const useConnection = (): ConnectionContextValue => {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnection must be used within ConnectionProvider');
  return context;
};

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [activeConnection, setActiveConnection] = useState<ActiveConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDynamicConnected, setIsDynamicConnected] = useState(false);

  const dynamicSchemaCacheRef = useRef<Record<string, ERDData>>({});

  const getDynamicSchemaCache = () => dynamicSchemaCacheRef.current;
  const setDynamicSchemaCache = (schemaName: string, data: ERDData) => {
    dynamicSchemaCacheRef.current[schemaName] = data;
  };
  const clearDynamicSchemaCache = () => {
    dynamicSchemaCacheRef.current = {};
  };

  useEffect(() => {
    const token = sessionStorage.getItem('db_connection_token');
    const info = sessionStorage.getItem('db_connection_info');

    if (token && info) {
      setActiveConnection({ token, info: JSON.parse(info) as ConnectionInfo });
      setIsConnected(true);
      setIsDynamicConnected(true);
    }

    const handleConnectionExpired = () => {
      const prefix = getDynamicPrefix();
      setActiveConnection(null);
      setIsConnected(false);
      setIsDynamicConnected(false);
      clearDynamicSchemaCache();
      sessionStorage.removeItem('db_connection_token');
      sessionStorage.removeItem('db_connection_info');
      sessionStorage.removeItem('reverseERD_lastSelectedSchema');
      window.dispatchEvent(new CustomEvent('dynamic-connection-ended', { detail: { prefix } }));
    };

    window.addEventListener('connection-expired', handleConnectionExpired);
    return () => window.removeEventListener('connection-expired', handleConnectionExpired);
  }, []);

  const connect = (connectionData: { token: string; connectionInfo: ConnectionInfo }) => {
    sessionStorage.setItem('db_connection_token', connectionData.token);
    sessionStorage.setItem('db_connection_info', JSON.stringify(connectionData.connectionInfo));
    setActiveConnection({ token: connectionData.token, info: connectionData.connectionInfo });
    setIsConnected(true);
    setIsDynamicConnected(true);
  };

  const getDynamicPrefix = (): string | null => {
    const info =
      activeConnection?.info ??
      (JSON.parse(sessionStorage.getItem('db_connection_info') || 'null') as ConnectionInfo | null);
    return info?.connectionId ? `dynamic_${info.connectionId}_` : null;
  };

  const disconnect = async () => {
    const currentConnection = activeConnection;
    const prefix = getDynamicPrefix();

    clearDynamicSchemaCache();
    sessionStorage.removeItem('db_connection_token');
    sessionStorage.removeItem('db_connection_info');
    sessionStorage.removeItem('reverseERD_lastSelectedSchema');
    setActiveConnection(null);
    setIsConnected(false);
    setIsDynamicConnected(false);

    window.dispatchEvent(new CustomEvent('dynamic-connection-ended', { detail: { prefix } }));

    if (currentConnection) {
      try {
        await fetch(`${API_BASE_URL}/connection/${currentConnection.info.connectionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${currentConnection.token}` },
        });
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  };

  const getAuthHeader = (): Record<string, string> => {
    if (!activeConnection) return {};
    return { Authorization: `Bearer ${activeConnection.token}` };
  };

  return (
    <ConnectionContext.Provider
      value={{
        activeConnection,
        isConnected,
        isDynamicConnected,
        connect,
        disconnect,
        getAuthHeader,
        getDynamicPrefix,
        getDynamicSchemaCache,
        setDynamicSchemaCache,
        clearDynamicSchemaCache,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};
