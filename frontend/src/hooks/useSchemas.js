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
      return data; // Return so callers can auto-select first schema
    } catch (err) {
      setError(err.message || "Failed to load schemas");
      console.error("Error fetching schemas:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // NEW: Allow manually setting schemas without fetching from real DB
  const setSchemasDirectly = (schemaList) => {
    setSchemas(schemaList);
    setHasLoaded(true);
  };

  // NEW: Reset hasLoaded to false (to show "Load Schemas" button again)
  const resetHasLoaded = () => {
    setSchemas([]);
    setHasLoaded(false);
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
    setSchemas: setSchemasDirectly,
    resetHasLoaded, // NEW: Reset to show "Load Schemas" button
  };
};

export default useSchemas;
