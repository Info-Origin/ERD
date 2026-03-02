const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

// Get all column notes for a schema
export const getColumnNotes = async (schemaName) => {
  try {
    const response = await fetch(`${API_URL}/api/column-notes/${schemaName}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch column notes');
    }
    
    return data.notes || {};
  } catch (error) {
    console.error('Error fetching column notes:', error);
    return {};
  }
};

// Get column notes for a specific table
export const getTableColumnNotes = async (schemaName, tableName) => {
  try {
    const response = await fetch(`${API_URL}/api/column-notes/${schemaName}/${tableName}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch table column notes');
    }
    
    return data.notes || {};
  } catch (error) {
    console.error('Error fetching table column notes:', error);
    return {};
  }
};

// Save or update a column note
export const saveColumnNote = async (schemaName, tableName, columnName, note) => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}/${columnName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save column note');
    }
    
    return data;
  } catch (error) {
    console.error('Error saving column note:', error);
    throw error;
  }
};

// Delete a column note
export const deleteColumnNote = async (schemaName, tableName, columnName) => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}/${columnName}`,
      {
        method: 'DELETE',
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete column note');
    }
    
    return data;
  } catch (error) {
    console.error('Error deleting column note:', error);
    throw error;
  }
};

// Delete all notes for a table
export const deleteTableNotes = async (schemaName, tableName) => {
  try {
    const response = await fetch(
      `${API_URL}/api/column-notes/${schemaName}/${tableName}`,
      {
        method: 'DELETE',
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete table notes');
    }
    
    return data;
  } catch (error) {
    console.error('Error deleting table notes:', error);
    throw error;
  }
};
