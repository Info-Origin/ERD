import { useState, useEffect } from "react";
import schemaService from "../services/schemaService";

/**
 * Hook to fetch and manage schemas list
 * @returns {Object} { schemas, loading, error, refetch }
 */
export const useSchemas = () => {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchemas = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await schemaService.getSchemas();
      setSchemas(data);
    } catch (err) {
      setError(err.message || "Failed to load schemas");
      console.error("Error fetching schemas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  return {
    schemas,
    loading,
    error,
    refetch: fetchSchemas,
  };
};

export default useSchemas;
