import { createContext, useContext, useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

const ConnectionContext = createContext();

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider = ({ children }) => {
  const [activeConnection, setActiveConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDynamicConnected, setIsDynamicConnected] = useState(false);

  // In-memory cache: schemaName -> ERD data (cleared on disconnect/refresh)
  // This avoids polluting persistence DB with another company's DB schemas
  const dynamicSchemaCacheRef = useRef({});

  const getDynamicSchemaCache = () => dynamicSchemaCacheRef.current;

  const setDynamicSchemaCache = (schemaName, data) => {
    dynamicSchemaCacheRef.current[schemaName] = data;
  };

  const clearDynamicSchemaCache = () => {
    dynamicSchemaCacheRef.current = {};
  };

  // Load connection from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('db_connection_token');
    const info = sessionStorage.getItem('db_connection_info');
    
    if (token && info) {
      setActiveConnection({
        token,
        info: JSON.parse(info)
      });
      setIsConnected(true);
      setIsDynamicConnected(true);
    }

    // Listen for connection expired events
    const handleConnectionExpired = (event) => {
      console.warn('Connection expired:', event.detail?.message);
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

    return () => {
      window.removeEventListener('connection-expired', handleConnectionExpired);
    };
  }, []);

  const connect = (connectionData) => {
    sessionStorage.setItem('db_connection_token', connectionData.token);
    sessionStorage.setItem('db_connection_info', JSON.stringify(connectionData.connectionInfo));
    
    setActiveConnection({
      token: connectionData.token,
      info: connectionData.connectionInfo
    });
    setIsConnected(true);
    setIsDynamicConnected(true);
  };

  // Returns the prefix used for persistence DB keys for dynamic schemas
  const getDynamicPrefix = () => {
    const info = activeConnection?.info || JSON.parse(sessionStorage.getItem('db_connection_info') || 'null');
    return info?.connectionId ? `dynamic_${info.connectionId}_` : null;
  };

  const disconnect = async () => {
    const currentConnection = activeConnection;
    const prefix = getDynamicPrefix();

    // Clear cache and state immediately
    clearDynamicSchemaCache();
    sessionStorage.removeItem('db_connection_token');
    sessionStorage.removeItem('db_connection_info');
    sessionStorage.removeItem('reverseERD_lastSelectedSchema');
    setActiveConnection(null);
    setIsConnected(false);
    setIsDynamicConnected(false);

    // Notify app to restore original schemas, pass prefix for cleanup
    window.dispatchEvent(new CustomEvent('dynamic-connection-ended', { detail: { prefix } }));
    
    // Best-effort backend cleanup
    if (currentConnection) {
      try {
        await fetch(`${API_BASE_URL}/connection/${currentConnection.info.connectionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${currentConnection.token}` }
        });
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  };

  const getAuthHeader = () => {
    if (!activeConnection) return {};
    return {
      'Authorization': `Bearer ${activeConnection.token}`
    };
  };

  return (
    <ConnectionContext.Provider value={{
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
    }}>
      {children}
    </ConnectionContext.Provider>
  );
};
