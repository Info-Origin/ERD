import type { SchemaModel, TablesMap, Relationship } from "../types/index.js";

interface BuildSchemaModelParams {
  schemaName: string;
  tables: TablesMap;
  relationships: Relationship[];
}

export const buildSchemaModel = ({
  schemaName,
  tables,
  relationships,
}: BuildSchemaModelParams): SchemaModel => {
  return {
    schemaName,
    tables,
    relationships: relationships.map((rel) => ({
      ...rel,
      type: rel.type || "ONE_TO_MANY",
    })),
  };
};
