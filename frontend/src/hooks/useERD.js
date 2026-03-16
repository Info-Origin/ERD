import { useState, useEffect, useRef } from "react";
import erdService from "../services/schemaErdService";
import persistenceService from "../services/persistenceService";
import { useConnection } from "../context/ConnectionContext";

/**
 * Hook to fetch and manage ERD data for a schema
 * PERSISTENCE-FIRST: Always loads from persistence DB, never from real DB (after first load)
 * DYNAMIC-CONNECTION: When dynamic DB is connected, loads from dynamic cache (not persistence DB)
 * @param {string} schemaName - Name of the schema
 * @returns {Object} { erdData, loading, error, refetch }
 */
export const useERD = (schemaName) => {
  const [erdData, setERDData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cache to store fetched ERD data per schema (in-memory, cleared on refresh)
  const erdCacheRef = useRef({});

  const { isDynamicConnected, getDynamicSchemaCache, setDynamicSchemaCache } = useConnection();

  const fetchERD = async (forceRefresh = false) => {
    if (!schemaName) {
      setERDData(null);
      return;
    }

    // DYNAMIC CONNECTION: If connected to a dynamic DB, use dynamic cache
    if (isDynamicConnected) {
      const dynamicCache = getDynamicSchemaCache();

      // Check dynamic cache first (Edge Case 9: schema switching while dynamic connected)
      if (!forceRefresh && dynamicCache[schemaName]) {
        setERDData(dynamicCache[schemaName]);
        return;
      }

      // Not in cache yet - fetch from dynamic DB (real DB via dynamic connection)
      setLoading(true);
      setError(null);
      try {
        const data = await erdService.getERDData(schemaName);
        setDynamicSchemaCache(schemaName, data);
        setERDData(data);
      } catch (err) {
        console.error('❌ useERD: Error fetching from dynamic DB for', schemaName, ':', err);
        setError(err.message || `Failed to load ERD for ${schemaName}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // NORMAL FLOW: Check in-memory cache first (unless force refresh)
    if (!forceRefresh && erdCacheRef.current[schemaName]) {
      console.log(`✅ useERD: Using in-memory cache for "${schemaName}"`);
      setERDData(erdCacheRef.current[schemaName]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data;
      
      // CRITICAL: Always try persistence DB first (unless force refresh)
      if (!forceRefresh) {
        const persistedData = await persistenceService.loadVirtualSchema(schemaName);
        
        if (persistedData) {
          data = persistedData;
        } else {
          // Schema not found in persistence DB
          // This means schemas haven't been loaded yet OR schema doesn't exist
          throw new Error(`Schema "${schemaName}" not found. Please load schemas first.`);
        }
      } else {
        // Force refresh - fetch from real DB (only when explicitly requested)
        console.log(`🔄 useERD: Force refresh - Fetching from real DB for "${schemaName}"`);
        data = await erdService.getERDData(schemaName);
      }
      
      setERDData(data);
      
      // Store in in-memory cache
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
  }, [schemaName, isDynamicConnected]);

  return {
    erdData,
    loading,
    error,
    refetch: fetchERD,
  };
};

export default useERD;
