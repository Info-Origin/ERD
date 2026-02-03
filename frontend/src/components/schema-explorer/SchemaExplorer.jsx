import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { SchemaTree } from "./SchemaTree";
import { PersistenceIndicator } from "../common/PersistenceIndicator";
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

  // REMOVED: Structure editing state and functions
  // - isAddTableModalOpen, isAddColumnModalOpen, columnTableName
  // - addTable, addColumn functions

  const handleSchemaSelect = (schemaName) => {
    selectSchema(schemaName);
  };

  // REMOVED: Structure editing handlers
  // - handleAddTable, handleOpenAddColumn functions

  const filteredSchemas = schemas.filter((schema) =>
    schema.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // If collapsed, show only a thin sidebar with toggle button
  if (isCollapsed) {
    return (
      <div className="schema-explorer-collapsed">
        <div className="collapsed-toggle" onClick={onToggleCollapse} title="Expand sidebar">
          <FiDatabase />
        </div>
      </div>
    );
  }

  return (
    <div className="schema-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title" onClick={onToggleCollapse} title="Click to collapse sidebar">
          <FiDatabase /> Schemas
        </h2>
      </div>

      {selectedSchema && (
        <div className="explorer-toolbar-section">
          <PersistenceIndicator />
        </div>
      )}

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
        <div className="schemas-list">
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
                <span className="schema-item-name">{schema}</span>
              </div>
            ))
          )}
        </div>
      )}

      {selectedSchema && <SchemaTree />}
    </div>
  );
};
