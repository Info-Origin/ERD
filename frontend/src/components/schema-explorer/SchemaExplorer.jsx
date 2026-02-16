import { useState, useRef, useEffect } from "react";
import { SearchBar } from "./SearchBar";
import { SchemaTree } from "./SchemaTree";
import { useApp } from "../../context/AppContext";
import { useConnection } from "../../context/ConnectionContext";
import { FiDatabase } from "react-icons/fi";
import { Loader } from "../common/Loader";
import { ConnectionModal } from "../modals/ConnectionModal";
import "./SchemaExplorer.css";

export const SchemaExplorer = ({ onToggleCollapse, isCollapsed }) => {
  const {
    schemas,
    schemasLoading,
    schemasError,
    selectedSchema,
    selectSchema,
    searchQuery,
    setSearchQuery,
    isAnyModalOpen,
    setIsAnyModalOpen,
    refetchSchemas,
  } = useApp();

  const { isConnected, activeConnection, connect, disconnect } = useConnection();

  const [schemaListHeight, setSchemaListHeight] = useState(200);
  const [showDisconnectConfirmation, setShowDisconnectConfirmation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // REMOVED: Structure editing state and functions
  // - isAddTableModalOpen, isAddColumnModalOpen, columnTableName
  // - addTable, addColumn functions

  const handleSchemaSelect = (schemaName) => {
    selectSchema(schemaName);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = schemaListHeight;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(100, Math.min(500, dragStartHeight.current + deltaY));
      setSchemaListHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // REMOVED: Structure editing handlers
  // - handleAddTable, handleOpenAddColumn functions

  const handleConnect = (connectionData) => {
    connect(connectionData);
    refetchSchemas(); // Refresh schemas after connection
  };

  const handleDisconnect = async () => {
    setShowDisconnectConfirmation(true);
  };

  const performDisconnect = async () => {
    await disconnect();
    setShowDisconnectConfirmation(false);
    // Wait a bit for state to update before refetching
    setTimeout(() => {
      refetchSchemas(); // This will now use .env connection
    }, 100);
  };

  const filteredSchemas = schemas.filter((schema) =>
    schema.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // If collapsed, return null (don't render anything)
  if (isCollapsed) {
    return null;
  }

  return (
    <div className="schema-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title">
          <FiDatabase /> Schemas
        </h2>
        <button 
          className="connection-button"
          onClick={() => {
            setIsConnectionModalOpen(true);
            setIsAnyModalOpen(true);
          }}
          title={isConnected ? `Connected to: ${activeConnection?.info?.name}` : "Connect to Database"}
        >
          <img src="/database-add.png" alt="Connect" className="connection-icon" />
        </button>
      </div>

      {/* Connection status indicator */}
      {isConnected && (
        <div className="connection-status">
          <span className="connection-status-text">
            Connected: {activeConnection?.info?.name}
          </span>
          <button 
            className="disconnect-button"
            onClick={handleDisconnect}
            title="Disconnect"
          >
            ×
          </button>
        </div>
      )}

      {/* PersistenceIndicator removed - now in VerticalToolbar */}

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search schemas..."
      />

      {schemasLoading ? (
        <div className="explorer-loading">
          <Loader size="md" text="Loading schemas..." />
        </div>
      ) : schemasError ? (
        <div className="explorer-error">
          <p>{schemasError}</p>
        </div>
      ) : (
        <>
          <div className="schemas-list" style={{ maxHeight: `${schemaListHeight}px` }}>
            {filteredSchemas.length === 0 ? (
              <div className="schemas-empty">
                <p>No schemas found</p>
              </div>
            ) : (
              filteredSchemas.map((schema) => (
                <div
                  key={schema}
                  className={`schema-item ${selectedSchema === schema && !isAnyModalOpen ? "schema-item-selected" : ""} ${isAnyModalOpen && selectedSchema === schema ? "schema-item-modal-open" : ""}`}
                  onClick={() => handleSchemaSelect(schema)}
                >
                  <FiDatabase className="schema-item-icon" />
                  <span className="schema-item-name" title={schema}>{schema}</span>
                </div>
              ))
            )}
          </div>
          
          {selectedSchema && (
            <>
              <div 
                className={`explorer-resize-handle ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
              >
                <div className="resize-handle-line" />
              </div>
              <SchemaTree />
            </>
          )}
        </>
      )}

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setIsAnyModalOpen(false);
        }}
        onConnect={handleConnect}
      />

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectConfirmation && (
        <div className="confirmation-overlay" onClick={() => setShowDisconnectConfirmation(false)}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <h3>Disconnect Database</h3>
            </div>
            <div className="confirmation-body">
              <div className="confirmation-icon">⚠️</div>
              <div className="confirmation-content">
                <p><span className="current-connection">Currently connected to: {activeConnection?.info?.name}</span></p>
                <p>Are you sure you want to disconnect? You'll switch back to the default database.</p>
              </div>
            </div>
            <div className="confirmation-actions">
              <button 
                onClick={() => setShowDisconnectConfirmation(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={performDisconnect} 
                className="btn-primary"
              >
                Yes, Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
