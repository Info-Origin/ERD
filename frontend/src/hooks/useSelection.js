import { useState, useCallback } from "react";

/**
 * Hook to manage selected schema and table state
 * Ensures sync between Schema Explorer and ERD Canvas
 * @returns {Object} Selection state and setters
 */
export const useSelection = () => {
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const selectSchema = useCallback((schemaName) => {
    setSelectedSchema(schemaName);
    setSelectedTable(null); // Clear table selection when schema changes
  }, []);

  const selectTable = useCallback((tableName) => {
    setSelectedTable(tableName);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSchema(null);
    setSelectedTable(null);
  }, []);

  return {
    selectedSchema,
    selectedTable,
    selectSchema,
    selectTable,
    clearSelection,
  };
};

export default useSelection;
