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
 * Get ERD data for a schema within an application context
 */
/*
export const getERDDataByApplication = async (schemaName, applicationUuid) => {
  if (!schemaName || !applicationUuid) {
    throw new Error("Schema name and application UUID are required");
  }

  try {
    const data = await api.get(
      `/schemas/${encodeURIComponent(schemaName)}/erd/${applicationUuid}`
    );
    return data;
  } catch (error) {
    console.error(`Failed to fetch ERD for schema "${schemaName}" in application "${applicationUuid}":`, error);
    throw error;
  }
};
*/

/**
 * Get list of applications for dropdown
 */
/*
export const getApplications = async () => {
  try {
    const data = await api.get('/applications');
    return data.applications || [];
  } catch (error) {
    console.error('Failed to fetch applications:', error);
    throw error;
  }
};
*/

/**
 * Get schemas filtered by application
 */
/*
export const getSchemasByApplication = async (applicationUuid) => {
  if (!applicationUuid) {
    throw new Error("Application UUID is required");
  }

  try {
    const data = await api.get(`/schemas?applicationUuid=${applicationUuid}`);
    return data.schemas || [];
  } catch (error) {
    console.error(`Failed to fetch schemas for application "${applicationUuid}":`, error);
    throw error;
  }
};
*/

/**
 * Service object for ERD operations
 */
const erdService = {
  getERDData,
  // Ready When:
  // getERDDataByApplication,
  // getApplications,
  // getSchemasByApplication,
};

export default erdService;
