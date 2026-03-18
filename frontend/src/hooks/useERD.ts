import { useState, useEffect, useRef } from 'react';
import erdService from '../services/schemaErdService';
import persistenceService from '../services/persistenceService';
import { useConnection } from '../context/ConnectionContext';
import type { ERDData } from '../types';

interface UseERDReturn {
  erdData: ERDData | null;
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
}

export const useERD = (schemaName: string | null): UseERDReturn => {
  const [erdData, setERDData] = useState<ERDData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const erdCacheRef = useRef<Record<string, ERDData>>({});

  const { isDynamicConnected, getDynamicSchemaCache, setDynamicSchemaCache } = useConnection();

  const fetchERD = async (forceRefresh = false) => {
    if (!schemaName) {
      setERDData(null);
      return;
    }

    if (isDynamicConnected) {
      const dynamicCache = getDynamicSchemaCache();
      if (!forceRefresh && dynamicCache[schemaName]) {
        setERDData(dynamicCache[schemaName]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await erdService.getERDData(schemaName);
        setDynamicSchemaCache(schemaName, data);
        setERDData(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `Failed to load ERD for ${schemaName}`;
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!forceRefresh && erdCacheRef.current[schemaName]) {
      setERDData(erdCacheRef.current[schemaName]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: ERDData;
      if (!forceRefresh) {
        const persisted = await persistenceService.loadVirtualSchema(schemaName);
        if (persisted) {
          data = persisted;
        } else {
          throw new Error(`Schema "${schemaName}" not found. Please load schemas first.`);
        }
      } else {
        data = await erdService.getERDData(schemaName);
      }
      setERDData(data);
      erdCacheRef.current[schemaName] = data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to load ERD for ${schemaName}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchERD();
  }, [schemaName, isDynamicConnected]);

  return { erdData, loading, error, refetch: fetchERD };
};

export default useERD;
