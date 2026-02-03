import api from "./api";

/**
 * Fetch all schema names from the database
 * @returns {Promise<string[]>} Array of schema names
 */
export const getSchemas = async () => {
  try {
    const data = await api.get("/schemas");
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
