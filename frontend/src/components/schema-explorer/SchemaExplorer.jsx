import { useState, useRef, useEffect } from "react";
import { SearchBar } from "./SearchBar";
import { SchemaTree } from "./SchemaTree";
import { useApp } from "../../context/AppContext";
import { FiDatabase } from "react-icons/fi";
import { Loader } from "../common/Loader";
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
  } = useApp();

  const [schemaListHeight, setSchemaListHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
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
      </div>

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
    </div>
  );
};
