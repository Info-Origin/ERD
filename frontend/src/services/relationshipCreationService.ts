import type { ERDData, Relationship, RelationshipTypeDefinition } from '../types';

export interface RelationshipCreationData {
  type: RelationshipTypeDefinition;
  parentTable: string;
  childTable: string;
}

const generateFKColumnName = (parentTable: string, parentColumn: string): string => {
  const tableName = parentTable.toLowerCase();
  const columnName = parentColumn.toLowerCase();
  if (columnName === 'id') return `${tableName}_id`;
  if (columnName.includes(tableName)) return columnName;
  return `${tableName}_${columnName}`;
};

export const createOneToManyRelationship = (
  schemaModel: ERDData,
  parentTable: string,
  childTable: string,
  relationshipType: RelationshipTypeDefinition,
): ERDData => {
  const updatedSchema: ERDData = JSON.parse(JSON.stringify(schemaModel));

  const parentTableData = updatedSchema.tables[parentTable];
  const parentPKEntry = Object.entries(parentTableData.columns).find(([, col]) => col.pk);
  if (!parentPKEntry) throw new Error(`Parent table ${parentTable} has no primary key`);

  const [parentPKName, parentPKData] = parentPKEntry;
  const fkColumnName = generateFKColumnName(parentTable, parentPKName);

  const childTableData = updatedSchema.tables[childTable];
  if (childTableData.columns[fkColumnName]) {
    throw new Error(`Column ${fkColumnName} already exists in table ${childTable}`);
  }

  const isOneToOne = relationshipType.cardinality === '1:1';

  childTableData.columns[fkColumnName] = {
    type: parentPKData.type,
    columnType: parentPKData.columnType,
    pk: false,
    fk: true,
    unique: isOneToOne,
    nullable: !relationshipType.isIdentifying,
    autoIncrement: false,
    isUserCreated: true,
  };

  const relationship: Relationship = {
    fromTable: childTable,
    fromColumn: fkColumnName,
    toTable: parentTable,
    toColumn: parentPKName,
    type: isOneToOne ? 'ONE_TO_ONE' : 'ONE_TO_MANY',
    cardinalityType: relationshipType.cardinality,
    constraintName: `fk_${childTable}_${fkColumnName}`,
    isUserCreated: true,
    createdAt: Date.now(),
    isIdentifying: relationshipType.isIdentifying,
  };

  if (!updatedSchema.relationships) updatedSchema.relationships = [];
  updatedSchema.relationships.push(relationship);

  return updatedSchema;
};

export const createManyToManyRelationship = (
  schemaModel: ERDData,
  table1: string,
  table2: string,
): ERDData => {
  const updatedSchema: ERDData = JSON.parse(JSON.stringify(schemaModel));

  const table1Data = updatedSchema.tables[table1];
  const table2Data = updatedSchema.tables[table2];

  const table1PKEntry = Object.entries(table1Data.columns).find(([, col]) => col.pk);
  const table2PKEntry = Object.entries(table2Data.columns).find(([, col]) => col.pk);

  if (!table1PKEntry || !table2PKEntry) {
    throw new Error('Both tables must have primary keys for Many-to-Many relationship');
  }

  const [table1PKName, table1PKData] = table1PKEntry;
  const [table2PKName, table2PKData] = table2PKEntry;

  const junctionTableName = [table1, table2].sort().join('_');
  if (updatedSchema.tables[junctionTableName]) {
    throw new Error(`Junction table ${junctionTableName} already exists`);
  }

  const fk1ColumnName = generateFKColumnName(table1, table1PKName);
  const fk2ColumnName = generateFKColumnName(table2, table2PKName);

  updatedSchema.tables[junctionTableName] = {
    name: junctionTableName,
    columns: {
      [fk1ColumnName]: {
        type: table1PKData.type,
        pk: true,
        fk: true,
        unique: false,
        nullable: false,
        autoIncrement: false,
        isUserCreated: true,
        compositeKey: true,
      },
      [fk2ColumnName]: {
        type: table2PKData.type,
        pk: true,
        fk: true,
        unique: false,
        nullable: false,
        autoIncrement: false,
        isUserCreated: true,
        compositeKey: true,
      },
    },
    isUserCreated: true,
  };

  const now = Date.now();
  const rel1: Relationship = {
    fromTable: junctionTableName,
    fromColumn: fk1ColumnName,
    toTable: table1,
    toColumn: table1PKName,
    type: 'ONE_TO_MANY',
    constraintName: `fk_${junctionTableName}_${fk1ColumnName}`,
    isUserCreated: true,
    createdAt: now,
    isIdentifying: true,
    isJunctionRelationship: true,
  };

  const rel2: Relationship = {
    fromTable: junctionTableName,
    fromColumn: fk2ColumnName,
    toTable: table2,
    toColumn: table2PKName,
    type: 'ONE_TO_MANY',
    constraintName: `fk_${junctionTableName}_${fk2ColumnName}`,
    isUserCreated: true,
    createdAt: now,
    isIdentifying: true,
    isJunctionRelationship: true,
  };

  if (!updatedSchema.relationships) updatedSchema.relationships = [];
  updatedSchema.relationships.push(rel1, rel2);

  return updatedSchema;
};

export const createRelationship = (
  schemaModel: ERDData,
  relationshipData: RelationshipCreationData,
): ERDData => {
  const { type, parentTable, childTable } = relationshipData;
  if (type.cardinality === 'N:M') {
    return createManyToManyRelationship(schemaModel, parentTable, childTable);
  }
  return createOneToManyRelationship(schemaModel, parentTable, childTable, type);
};

export const validateRelationshipCreation = (
  schemaModel: ERDData,
  parentTable: string,
  childTable: string,
  _relationshipType: RelationshipTypeDefinition,
): string[] => {
  const errors: string[] = [];

  if (!schemaModel.tables[parentTable]) errors.push(`Parent table ${parentTable} does not exist`);
  if (!schemaModel.tables[childTable]) errors.push(`Child table ${childTable} does not exist`);

  const parentTableData = schemaModel.tables[parentTable];
  if (parentTableData) {
    const hasPK = Object.values(parentTableData.columns).some((col) => col.pk);
    if (!hasPK) errors.push(`Parent table ${parentTable} must have a primary key`);
  }

  return errors;
};
