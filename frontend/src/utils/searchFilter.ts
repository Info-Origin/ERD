import type { ERDData } from '../types';

export const filterERDData = (erdData: ERDData | null, query: string): ERDData | null => {
  if (!query?.trim() || !erdData?.tables) return erdData;
  const lowerQuery = query.toLowerCase().trim();

  const filteredTables = Object.fromEntries(
    Object.entries(erdData.tables).filter(
      ([tableName, tableData]) =>
        tableName.toLowerCase().includes(lowerQuery) ||
        Object.keys(tableData.columns || {}).some((col) =>
          col.toLowerCase().includes(lowerQuery),
        ),
    ),
  );

  return { ...erdData, tables: filteredTables };
};

export const filterSchemas = (schemas: string[], query: string): string[] => {
  if (!query?.trim()) return schemas;
  const lowerQuery = query.toLowerCase().trim();
  return schemas.filter((s) => s.toLowerCase().includes(lowerQuery));
};
