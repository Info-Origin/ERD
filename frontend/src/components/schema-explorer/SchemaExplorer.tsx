import { useState, useRef, useEffect } from "react";
import { SearchBar } from "./SearchBar";
import { SchemaTree } from "./SchemaTree";
import { useApp } from "../../context/AppContext";
import { useConnection } from "../../context/ConnectionContext";
import { FiDatabase } from "react-icons/fi";
import { FaLock, FaLockOpen } from "react-icons/fa";
import { Loader } from "../common/Loader";
import { ConnectionModal } from "../modals/ConnectionModal";
import "./SchemaExplorer.css";

interface SchemaExplorerProps {
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export const SchemaExplorer = ({ onToggleCollapse, isCollapsed }: SchemaExplorerProps) => {
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
    schemaLocks,
    acquireSchemaLock,
    releaseSchemaLock,
    isSchemaLockedByMe,
    isSchemaLockedByOther,
    showNotification,
  } = useApp();

  const { isConnected, activeConnection, connect, disconnect } = useConnection();

  const [schemaListHeight, setSchemaListHeight] = useState(200);
  const [showDisconnectConfirmation, setShowDisconnectConfirmation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const [lockModal, setLockModal] = useState<{
    visible: boolean;
    schema: string | null;
    action: 'lock' | 'unlock' | null;
  }>({ visible: false, schema: null, action: null });

  const handleSchemaSelect = (schemaName: string) => selectSchema(schemaName);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = schemaListHeight;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(100, Math.min(500, dragStartHeight.current + deltaY));
      setSchemaListHeight(newHeight);
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleLockIconClick = (e: React.MouseEvent, schemaName: string) => {
    e.stopPropagation();
    if (isSchemaLockedByOther(schemaName)) return;
    const action = isSchemaLockedByMe(schemaName) ? "unlock" : "lock";
    setLockModal({ visible: true, schema: schemaName, action });
  };

  const handleLockConfirm = async () => {
    const { schema, action } = lockModal;
    setLockModal({ visible: false, schema: null, action: null });
    if (!schema) return;

    if (action === "lock") {
      const result = await acquireSchemaLock(schema);
      if (result.success) {
        showNotification(`Schema "${schema}" locked successfully`, "success");
      } else {
        showNotification((result as { success: boolean; message?: string }).message || "Failed to lock schema", "error");
      }
    } else if (action === "unlock") {
      const result = await releaseSchemaLock(schema);
      if (result.success) {
        showNotification(`Schema "${schema}" unlocked`, "success");
      } else {
        showNotification((result as { success: boolean; message?: string }).message || "Failed to unlock schema", "error");
      }
    }
  };

  const handleConnect = async (connectionData: unknown) => {
    connect(connectionData as Parameters<typeof connect>[0]);
    const schemaList = await refetchSchemas();
    if (schemaList && schemaList.length > 0) {
      setTimeout(() => selectSchema(schemaList[0]), 100);
    }
  };

  const handleDisconnect = () => setShowDisconnectConfirmation(true);

  const performDisconnect = async () => {
    await disconnect();
    setShowDisconnectConfirmation(false);
  };

  const filteredSchemas = schemas.filter((schema) =>
    schema.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isCollapsed) return null;

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

      {isConnected && (
        <div className="connection-status">
          <span className="connection-status-text">
            Connected: {activeConnection?.info?.name}
          </span>
          <button className="disconnect-button" onClick={handleDisconnect} title="Disconnect">
            ×
          </button>
        </div>
      )}

      <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search schemas..." />

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
              filteredSchemas.map((schema) => {
                const lockInfo = schemaLocks[schema];
                const lockedByMe = isSchemaLockedByMe(schema);
                const lockedByOther = isSchemaLockedByOther(schema);

                return (
                  <div
                    key={schema}
                    className={`schema-item ${selectedSchema === schema && !isAnyModalOpen ? "schema-item-selected" : ""} ${isAnyModalOpen && selectedSchema === schema ? "schema-item-modal-open" : ""} ${lockedByOther ? "schema-item-locked" : ""}`}
                    onClick={() => handleSchemaSelect(schema)}
                    title={lockedByOther ? `Locked by ${lockInfo?.userDisplayName}` : schema}
                  >
                    <FiDatabase className="schema-item-icon" />
                    <span className="schema-item-name">{schema}</span>
                    <button
                      className={`schema-lock-btn ${lockedByMe ? "schema-lock-btn--mine" : lockedByOther ? "schema-lock-btn--other" : "schema-lock-btn--unlocked"}`}
                      onClick={(e) => handleLockIconClick(e, schema)}
                      title={
                        lockedByMe
                          ? "Locked by you — click to unlock"
                          : lockedByOther
                          ? `Locked by ${lockInfo?.userDisplayName}`
                          : "Click to lock schema"
                      }
                    >
                      {lockedByMe || lockedByOther ? <FaLock /> : <FaLockOpen />}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {selectedSchema && (
            <>
              <div
                className={`explorer-resize-handle ${isDragging ? "dragging" : ""}`}
                onMouseDown={handleMouseDown}
              >
                <div className="resize-handle-line" />
              </div>
              <SchemaTree />
            </>
          )}
        </>
      )}

      {lockModal.visible && (
        <div
          className="schema-lock-modal-overlay"
          onClick={() => setLockModal({ visible: false, schema: null, action: null })}
        >
          <div className="schema-lock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schema-lock-modal-icon">
              {lockModal.action === "lock" ? "🔒" : "🔓"}
            </div>
            <h3>{lockModal.action === "lock" ? "Lock Schema" : "Unlock Schema"}</h3>
            <p>
              {lockModal.action === "lock"
                ? `Lock "${lockModal.schema}"? Other users will not be able to edit it until you unlock it.`
                : `Unlock "${lockModal.schema}"? Other users will be able to edit it again.`}
            </p>
            <div className="schema-lock-modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setLockModal({ visible: false, schema: null, action: null })}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleLockConfirm}>
                {lockModal.action === "lock" ? "Yes, Lock" : "Yes, Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setIsAnyModalOpen(false);
        }}
        onConnect={handleConnect}
      />

      {showDisconnectConfirmation && (
        <div
          className="confirmation-overlay"
          onClick={() => setShowDisconnectConfirmation(false)}
        >
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <h3>Disconnect Database</h3>
            </div>
            <div className="confirmation-body">
              <div className="confirmation-icon">⚠️</div>
              <div className="confirmation-content">
                <p>
                  <span className="current-connection">
                    Currently connected to: {activeConnection?.info?.name}
                  </span>
                </p>
                <p>
                  Are you sure you want to disconnect? You'll switch back to the default database.
                </p>
              </div>
            </div>
            <div className="confirmation-actions">
              <button
                onClick={() => setShowDisconnectConfirmation(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={performDisconnect} className="btn-primary">
                Yes, Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
