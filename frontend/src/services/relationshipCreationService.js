/**
 * Relationship Creation Service
 * Handles the logic for creating relationships in the virtual schema model
 */

/**
 * Generate a foreign key column name based on the parent table and column
 */
const generateFKColumnName = (parentTable, parentColumn) => {
  // MySQL Workbench style: table_name + "_" + column_name
  // e.g., users.id -> user_id, departments.dept_id -> department_dept_id
  const tableName = parentTable.toLowerCase();
  const columnName = parentColumn.toLowerCase();
  
  // If parent column is just 'id', use table_id format
  if (columnName === 'id') {
    return `${tableName}_id`;
  }
  
  // If parent column already contains table name, use as-is
  if (columnName.includes(tableName)) {
    return columnName;
  }
  
  // Otherwise combine table_column format
  return `${tableName}_${columnName}`;
};

/**
 * Create a One-to-Many relationship
 * Note: parentTable is the "1" side, childTable is the "N" side
 */
export const createOneToManyRelationship = (schemaModel, parentTable, childTable, relationshipType) => {
  const updatedSchema = JSON.parse(JSON.stringify(schemaModel)); // Deep clone
  
  // Find parent table's primary key
  const parentTableData = updatedSchema.tables[parentTable];
  const parentPKColumn = Object.entries(parentTableData.columns).find(([name, col]) => col.pk);
  
  if (!parentPKColumn) {
    throw new Error(`Parent table ${parentTable} has no primary key`);
  }
  
  const [parentPKName, parentPKData] = parentPKColumn;
  
  // Generate FK column name
  const fkColumnName = generateFKColumnName(parentTable, parentPKName);
  
  // Check if FK column already exists in child table
  const childTableData = updatedSchema.tables[childTable];
  if (childTableData.columns[fkColumnName]) {
    throw new Error(`Column ${fkColumnName} already exists in table ${childTable}`);
  }
  
  // Determine if this is a 1:1 or 1:N relationship
  const isOneToOne = relationshipType.cardinality === '1:1';
  
  // Create FK column in child table
  const fkColumn = {
    type: parentPKData.type,
    columnType: parentPKData.columnType,
    pk: false,
    fk: true,
    unique: isOneToOne, // 1:1 relationships need unique FK
    nullable: !relationshipType.isIdentifying, // Identifying = NOT NULL, Non-identifying = NULL
    isUserCreated: true // Mark as user-created
  };
  
  // Add FK column to child table
  updatedSchema.tables[childTable].columns[fkColumnName] = fkColumn;
  
  // Create relationship record
  // Store in DATABASE direction (same as backend): child -> parent (FK -> PK)
  // This matches how existing relationships from database are stored
  const relationship = {
    fromTable: childTable,     // Table with FK (child)
    fromColumn: fkColumnName,  // FK column
    toTable: parentTable,      // Table with PK (parent)
    toColumn: parentPKName,    // PK column
    type: isOneToOne ? 'ONE_TO_ONE' : 'ONE_TO_MANY',
    cardinalityType: relationshipType.cardinality, // Use the cardinality from relationshipType (1:1 or 1:N)
    constraintName: `fk_${childTable}_${fkColumnName}`,
    isUserCreated: true, // Mark as user-created
    createdAt: Date.now(), // Timestamp for "created X minutes ago"
    lineStyle: relationshipType.lineStyle,
    isIdentifying: relationshipType.isIdentifying
  };
  
  // Add to relationships array
  if (!updatedSchema.relationships) {
    updatedSchema.relationships = [];
  }
  updatedSchema.relationships.push(relationship);
  
  return updatedSchema;
};

/**
 * Create a Many-to-Many relationship
 * Note: For N:M, both tables are treated equally, but we follow the click order
 */
export const createManyToManyRelationship = (schemaModel, table1, table2, relationshipType) => {
  const updatedSchema = JSON.parse(JSON.stringify(schemaModel)); // Deep clone
  
  // Find primary keys for both tables
  const table1Data = updatedSchema.tables[table1];
  const table2Data = updatedSchema.tables[table2];
  
  const table1PK = Object.entries(table1Data.columns).find(([name, col]) => col.pk);
  const table2PK = Object.entries(table2Data.columns).find(([name, col]) => col.pk);
  
  if (!table1PK || !table2PK) {
    throw new Error('Both tables must have primary keys for Many-to-Many relationship');
  }
  
  const [table1PKName, table1PKData] = table1PK;
  const [table2PKName, table2PKData] = table2PK;
  
  // Generate junction table name (alphabetical order)
  const junctionTableName = [table1, table2].sort().join('_');
  
  // Check if junction table already exists
  if (updatedSchema.tables[junctionTableName]) {
    throw new Error(`Junction table ${junctionTableName} already exists`);
  }
  
  // Generate FK column names
  const fk1ColumnName = generateFKColumnName(table1, table1PKName);
  const fk2ColumnName = generateFKColumnName(table2, table2PKName);
  
  // Create junction table
  const junctionTable = {
    name: junctionTableName,
    columns: {
      [fk1ColumnName]: {
        type: table1PKData.type,
        columnType: table1PKData.columnType,
        pk: true, // Part of composite PK
        fk: true,
        unique: false,
        nullable: false,
        isUserCreated: true,
        compositeKey: true // Mark as part of composite key
      },
      [fk2ColumnName]: {
        type: table2PKData.type,
        columnType: table2PKData.columnType,
        pk: true, // Part of composite PK
        fk: true,
        unique: false,
        nullable: false,
        isUserCreated: true,
        compositeKey: true // Mark as part of composite key
      }
    },
    isUserCreated: true // Mark entire table as user-created
  };
  
  // Add junction table to schema
  updatedSchema.tables[junctionTableName] = junctionTable;
  
  // Create two One-to-Many relationships
  // For N:M, both relationships are always identifying (solid lines)
  const relationship1 = {
    fromTable: junctionTableName,
    fromColumn: fk1ColumnName,
    toTable: table1,
    toColumn: table1PKName,
    type: 'ONE_TO_MANY',
    constraintName: `fk_${junctionTableName}_${fk1ColumnName}`,
    isUserCreated: true,
    createdAt: Date.now(), // Timestamp for "created X minutes ago"
    lineStyle: 'solid', // Many-to-Many is always identifying
    isIdentifying: true
  };
  
  const relationship2 = {
    fromTable: junctionTableName,
    fromColumn: fk2ColumnName,
    toTable: table2,
    toColumn: table2PKName,
    type: 'ONE_TO_MANY',
    constraintName: `fk_${junctionTableName}_${fk2ColumnName}`,
    isUserCreated: true,
    createdAt: Date.now(), // Timestamp for "created X minutes ago"
    lineStyle: 'solid', // Many-to-Many is always identifying
    isIdentifying: true
  };
  
  // Add relationships
  if (!updatedSchema.relationships) {
    updatedSchema.relationships = [];
  }
  updatedSchema.relationships.push(relationship1, relationship2);
  
  return updatedSchema;
};

/**
 * Main function to create a relationship based on type
 */
export const createRelationship = (schemaModel, relationshipData) => {
  const { type, parentTable, childTable } = relationshipData;
  
  try {
    if (type.cardinality === 'N:M') {
      // Many-to-Many relationship
      return createManyToManyRelationship(schemaModel, parentTable, childTable, type);
    } else {
      // One-to-One or One-to-Many relationship
      return createOneToManyRelationship(schemaModel, parentTable, childTable, type);
    }
  } catch (error) {
    console.error('❌ Failed to create relationship:', error);
    throw error;
  }
};

/**
 * Validate relationship creation
 */
export const validateRelationshipCreation = (schemaModel, parentTable, childTable, relationshipType) => {
  const errors = [];
  
  // Check if tables exist
  if (!schemaModel.tables[parentTable]) {
    errors.push(`Parent table ${parentTable} does not exist`);
  }
  
  if (!schemaModel.tables[childTable]) {
    errors.push(`Child table ${childTable} does not exist`);
  }
  
  // Check if parent has PK
  const parentTableData = schemaModel.tables[parentTable];
  if (parentTableData) {
    const hasPK = Object.values(parentTableData.columns).some(col => col.pk);
    if (!hasPK) {
      errors.push(`Parent table ${parentTable} must have a primary key`);
    }
  }
  
  // Check for self-referencing (allowed but warn)
  if (parentTable === childTable) {
    console.warn('⚠️ Creating self-referencing relationship');
  }
  
  return errors;
};