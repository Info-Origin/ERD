import { useState, useCallback } from 'react';

interface SelectionState {
  selectedSchema: string | null;
  selectedTable: string | null;
  selectSchema: (schemaName: string) => void;
  selectTable: (tableName: string) => void;
  clearSelection: () => void;
}

export const useSelection = (): SelectionState => {
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const selectSchema = useCallback((schemaName: string) => {
    setSelectedSchema(schemaName);
    setSelectedTable(null);
  }, []);

  const selectTable = useCallback((tableName: string) => {
    setSelectedTable(tableName);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSchema(null);
    setSelectedTable(null);
  }, []);

  return { selectedSchema, selectedTable, selectSchema, selectTable, clearSelection };
};

export default useSelection;
