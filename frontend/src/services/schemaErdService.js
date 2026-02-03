import api from "./api";

/**
 * Fetch ERD data for a specific schema
 * @param {string} schemaName - Name of the schema
 * @returns {Promise<Object>} ERD data with tables and relationships
 */
export const getERDData = async (schemaName) => {
  if (!schemaName) {
    throw new Error("Schema name is required");
  }

  try {
    const data = await api.get(
      `/schemas/${encodeURIComponent(schemaName)}/erd`,
    );
    
    return data;
  } catch (error) {
    console.error(`Failed to fetch ERD for schema "${schemaName}":`, error);
    throw error;
  }
};

/**
 * Service object for ERD operations
 */
const erdService = {
  getERDData,
};

export default erdService;
