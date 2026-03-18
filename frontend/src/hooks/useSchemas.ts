import { useState, useEffect } from 'react';
import schemaService from '../services/schemaService';

interface UseSchemasReturn {
  schemas: string[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  refetch: () => Promise<string[]>;
  setSchemas: (schemaList: string[]) => void;
  resetHasLoaded: () => void;
}

export const useSchemas = (autoFetch = false): UseSchemasReturn => {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSchemas = async (): Promise<string[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await schemaService.getSchemas();
      setSchemas(data);
      setHasLoaded(true);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load schemas';
      setError(message);
      console.error('Error fetching schemas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const setSchemasDirectly = (schemaList: string[]) => {
    setSchemas(schemaList);
    setHasLoaded(true);
  };

  const resetHasLoaded = () => {
    setSchemas([]);
    setHasLoaded(false);
  };

  useEffect(() => {
    if (autoFetch) fetchSchemas();
  }, [autoFetch]);

  return {
    schemas,
    loading,
    error,
    hasLoaded,
    refetch: fetchSchemas,
    setSchemas: setSchemasDirectly,
    resetHasLoaded,
  };
};

export default useSchemas;
