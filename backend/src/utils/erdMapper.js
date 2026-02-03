export const buildSchemaModel = ({ schemaName, tables, relationships }) => {
  return {
    schemaName,
    tables,
    relationships: relationships.map((rel) => ({
      ...rel,
      type: rel.type || "ONE_TO_MANY",
    })),
  };
};
