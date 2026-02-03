/**
 * Filter schemas and tables based on search query
 * @param {Object} erdData - Full ERD data
 * @param {string} query - Search query
 * @returns {Object} Filtered data
 */
export const filterERDData = (erdData, query) => {
  if (!query || !query.trim()) {
    return erdData;
  }

  const lowerQuery = query.toLowerCase().trim();

  if (!erdData || !erdData.tables) {
    return erdData;
  }

  const filteredTables = Object.entries(erdData.tables).reduce(
    (acc, [tableName, tableData]) => {
      // Check if table name matches
      const tableMatches = tableName.toLowerCase().includes(lowerQuery);

      // Check if any column name matches
      const columnMatches = Object.keys(tableData.columns || {}).some(
        (colName) => colName.toLowerCase().includes(lowerQuery),
      );

      if (tableMatches || columnMatches) {
        acc[tableName] = tableData;
      }

      return acc;
    },
    {},
  );

  return {
    ...erdData,
    tables: filteredTables,
  };
};

/**
 * Filter schemas list
 * @param {string[]} schemas - Array of schema names
 * @param {string} query - Search query
 * @returns {string[]} Filtered schemas
 */
export const filterSchemas = (schemas, query) => {
  if (!query || !query.trim()) {
    return schemas;
  }

  const lowerQuery = query.toLowerCase().trim();
  return schemas.filter((schema) => schema.toLowerCase().includes(lowerQuery));
};
