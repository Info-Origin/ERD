import { createContext, useContext, useState, useEffect } from 'react';

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
    }

    // Listen for connection expired events
    const handleConnectionExpired = (event) => {
      console.warn('Connection expired:', event.detail?.message);
      setActiveConnection(null);
      setIsConnected(false);
      sessionStorage.removeItem('db_connection_token');
      sessionStorage.removeItem('db_connection_info');
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
  };

  const disconnect = async () => {
    // Clear token FIRST before making the disconnect API call
    const currentConnection = activeConnection;
    
    // Clear state and storage immediately
    sessionStorage.removeItem('db_connection_token');
    sessionStorage.removeItem('db_connection_info');
    setActiveConnection(null);
    setIsConnected(false);
    
    // Then try to close the connection on backend (best effort)
    if (currentConnection) {
      try {
        await fetch(`${API_BASE_URL}/connection/${currentConnection.info.connectionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${currentConnection.token}`
          }
        });
      } catch (error) {
        console.error('Error disconnecting:', error);
        // Ignore errors - connection is already cleared on frontend
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
      connect,
      disconnect,
      getAuthHeader
    }}>
      {children}
    </ConnectionContext.Provider>
  );
};
