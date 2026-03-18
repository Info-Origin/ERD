import api from './api';

export const getSchemas = async (applicationUuid?: string): Promise<string[]> => {
  try {
    const url = applicationUuid ? `/schemas?applicationUuid=${applicationUuid}` : '/schemas';
    const data = await api.get<{ schemas: string[] }>(url);
    return (data as unknown as { schemas: string[] }).schemas || [];
  } catch (error) {
    console.error('Failed to fetch schemas:', error);
    throw error;
  }
};

const schemaService = { getSchemas };
export default schemaService;
