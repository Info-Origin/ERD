import api from './api';
import type { ERDData } from '../types';

export const getERDData = async (schemaName: string): Promise<ERDData> => {
  if (!schemaName) {
    throw new Error('Schema name is required');
  }
  try {
    const data = await api.get(`/schemas/${encodeURIComponent(schemaName)}/erd`);
    return data as unknown as ERDData;
  } catch (error) {
    console.error(`Failed to fetch ERD for schema "${schemaName}":`, error);
    throw error;
  }
};

const erdService = { getERDData };
export default erdService;
