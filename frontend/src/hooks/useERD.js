import { useState, useEffect, useRef } from "react";
import erdService from "../services/schemaErdService";

/**
 * Hook to fetch and manage ERD data for a schema
 * WITH CACHING - Only fetches once per schema, reuses cached data on switch back
 * @param {string} schemaName - Name of the schema
 * @returns {Object} { erdData, loading, error, refetch }
 */
export const useERD = (schemaName) => {
  const [erdData, setERDData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cache to store fetched ERD data per schema
  const erdCacheRef = useRef({});

  const fetchERD = async (forceRefresh = false) => {
    if (!schemaName) {
      setERDData(null);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && erdCacheRef.current[schemaName]) {
      console.log(`✅ useERD: Using cached data for "${schemaName}"`);
      setERDData(erdCacheRef.current[schemaName]);
      return;
    }

    console.log(`🔄 useERD: Fetching fresh data for "${schemaName}"`);
    setLoading(true);
    setError(null);

    try {
      const data = await erdService.getERDData(schemaName);
      setERDData(data);
      
      // Store in cache
      erdCacheRef.current[schemaName] = data;
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
    refetch: fetchERD, // Can pass true to force refresh
  };
};

export default useERD;
