import api from "./api";

/**
 * Fetch all schema names from the database
 * @param {string} applicationUuid - Optional application UUID to filter schemas
 * @returns {Promise<string[]>} Array of schema names
 */
export const getSchemas = async (applicationUuid) => {
  try {
    const url = applicationUuid ? `/schemas?applicationUuid=${applicationUuid}` : '/schemas';
    const data = await api.get(url);
    return data.schemas || [];
  } catch (error) {
    console.error("Failed to fetch schemas:", error);
    throw error;
  }
};

/**
 * Service object for schema operations
 */
const schemaService = {
  getSchemas,
};

export default schemaService;
