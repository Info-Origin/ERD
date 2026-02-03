import { useState, useEffect } from "react";
import erdService from "../services/schemaErdService";

/**
 * Hook to fetch and manage ERD data for a schema
 * @param {string} schemaName - Name of the schema
 * @returns {Object} { erdData, loading, error, refetch }
 */
export const useERD = (schemaName) => {
  const [erdData, setERDData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchERD = async () => {
    if (!schemaName) {
      setERDData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await erdService.getERDData(schemaName);
      setERDData(data);
    } catch (err) {
      console.error('❌ useERD: Error fetching ERD for', schemaName, ':', err);
      setError(err.message || `Failed to load ERD for ${schemaName}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchERD();
  }, [schemaName]);

  return {
    erdData,
    loading,
    error,
    refetch: fetchERD,
  };
};

export default useERD;
