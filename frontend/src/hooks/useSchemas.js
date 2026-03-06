import { useState, useEffect } from "react";
import schemaService from "../services/schemaService";

/**
 * Hook to fetch and manage schemas list
 * @param {boolean} autoFetch - Whether to automatically fetch schemas on mount (default: false)
 * @returns {Object} { schemas, loading, error, refetch }
 */
export const useSchemas = (autoFetch = false) => {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSchemas = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await schemaService.getSchemas();
      setSchemas(data);
      setHasLoaded(true);
    } catch (err) {
      setError(err.message || "Failed to load schemas");
      console.error("Error fetching schemas:", err);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Allow manually setting schemas without fetching from real DB
  const setSchemasDirectly = (schemaList) => {
    setSchemas(schemaList);
    setHasLoaded(true);
  };

  useEffect(() => {
    if (autoFetch) {
      fetchSchemas();
    }
  }, [autoFetch]);

  return {
    schemas,
    loading,
    error,
    hasLoaded,
    refetch: fetchSchemas,
    setSchemas: setSchemasDirectly, // NEW: Expose setter for manual schema list updates
  };
};

export default useSchemas;
