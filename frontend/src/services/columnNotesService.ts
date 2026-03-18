import type { ColumnNotes } from '../types';

const API_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4001';

export const getColumnNotes = async (schemaName: string): Promise<ColumnNotes> => {
  try {
    const response = await fetch(`${API_URL}/api/column-notes/${schemaName}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch column notes');
    return data.notes || {};
  } catch (error) {
    console.error('Error fetching column notes:', error);
    return {};
  }
};

export const getTableColumnNotes = async (
  schemaName: string,
  tableName: string,
): Promise<Record<string, string>> => {
  try {
    const response = await fetch(`${API_URL}/api/column-notes/${schemaName}/${tableName}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch table column notes');
    return data.notes || {};
  } catch (error) {
    console.error('Error fetching table column notes:', error);
    return {};
  }
};

export const saveColumnNote = async (
  schemaName: string,
  tableName: string,
  columnName: string,
  note: string,
): Promise<void> => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}/${columnName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save column note');
  } catch (error) {
    console.error('Error saving column note:', error);
    throw error;
  }
};

export const deleteColumnNote = async (
  schemaName: string,
  tableName: string,
  columnName: string,
): Promise<void> => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}/${columnName}`,
      { method: 'DELETE' },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete column note');
  } catch (error) {
    console.error('Error deleting column note:', error);
    throw error;
  }
};

export const deleteTableNotes = async (schemaName: string, tableName: string): Promise<void> => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}`,
      { method: 'DELETE' },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete table notes');
  } catch (error) {
    console.error('Error deleting table notes:', error);
    throw error;
  }
};
