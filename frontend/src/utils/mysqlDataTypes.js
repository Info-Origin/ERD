// Comprehensive MySQL Data Types for EditTableModal
export const MYSQL_DATA_TYPES = {
  // Numeric Types
  NUMERIC: [
    'TINYINT',
    'SMALLINT', 
    'MEDIUMINT',
    'INT',
    'BIGINT',
    'DECIMAL',
    'FLOAT',
    'DOUBLE',
    'REAL'
  ],
  
  // String Types
  STRING: [
    'CHAR',
    'VARCHAR',
    'BINARY',
    'VARBINARY',
    'TINYBLOB',
    'BLOB',
    'MEDIUMBLOB',
    'LONGBLOB',
    'TINYTEXT',
    'TEXT',
    'MEDIUMTEXT',
    'LONGTEXT'
  ],
  
  // Date and Time Types
  DATE_TIME: [
    'DATE',
    'TIME',
    'DATETIME',
    'TIMESTAMP',
    'YEAR'
  ],
  
  // Other Types
  OTHER: [
    'BIT',
    'BOOLEAN',
    'ENUM',
    'SET',
    'JSON',
    'GEOMETRY',
    'POINT',
    'LINESTRING',
    'POLYGON',
    'MULTIPOINT',
    'MULTILINESTRING',
    'MULTIPOLYGON',
    'GEOMETRYCOLLECTION'
  ]
};

// Flattened list for dropdown
export const ALL_MYSQL_DATA_TYPES = [
  ...MYSQL_DATA_TYPES.NUMERIC,
  ...MYSQL_DATA_TYPES.STRING,
  ...MYSQL_DATA_TYPES.DATE_TIME,
  ...MYSQL_DATA_TYPES.OTHER
].sort();

// Data types that commonly have length/precision parameters
export const DATA_TYPES_WITH_LENGTH = [
  'VARCHAR',
  'CHAR',
  'VARBINARY',
  'BINARY',
  'DECIMAL',
  'FLOAT',
  'DOUBLE',
  'BIT',
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT',
  'INT',
  'BIGINT'
];

// Data types that support default values
export const DATA_TYPES_WITH_DEFAULTS = [
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT', 
  'INT',
  'BIGINT',
  'DECIMAL',
  'FLOAT',
  'DOUBLE',
  'REAL',
  'CHAR',
  'VARCHAR',
  'TEXT',
  'TINYTEXT',
  'MEDIUMTEXT',
  'LONGTEXT',
  'DATE',
  'TIME',
  'DATETIME',
  'TIMESTAMP',
  'YEAR',
  'BIT',
  'BOOLEAN',
  'ENUM',
  'SET',
  'JSON'
];

// Common default values by data type
export const COMMON_DEFAULTS = {
  'INT': ['0', '1', 'NULL'],
  'BIGINT': ['0', '1', 'NULL'],
  'TINYINT': ['0', '1', 'NULL'],
  'SMALLINT': ['0', '1', 'NULL'],
  'MEDIUMINT': ['0', '1', 'NULL'],
  'DECIMAL': ['0.00', '0', 'NULL'],
  'FLOAT': ['0.0', '0', 'NULL'],
  'DOUBLE': ['0.0', '0', 'NULL'],
  'VARCHAR': ["''", 'NULL'],
  'CHAR': ["''", 'NULL'],
  'TEXT': ['NULL'],
  'TINYTEXT': ['NULL'],
  'MEDIUMTEXT': ['NULL'],
  'LONGTEXT': ['NULL'],
  'DATE': ['NULL', 'CURRENT_DATE'],
  'TIME': ['NULL', 'CURRENT_TIME'],
  'DATETIME': ['NULL', 'CURRENT_TIMESTAMP'],
  'TIMESTAMP': ['CURRENT_TIMESTAMP', 'NULL'],
  'YEAR': ['NULL'],
  'BIT': ['0', '1', 'NULL'],
  'BOOLEAN': ['FALSE', 'TRUE', 'NULL'],
  'JSON': ['NULL'],
  'ENUM': ['NULL'],
  'SET': ['NULL']
};

// Extract base data type from full type definition
export const getBaseDataType = (fullType) => {
  if (!fullType) return 'VARCHAR';
  
  // Handle types like VARCHAR(255), DECIMAL(10,2), etc.
  const baseType = fullType.split('(')[0].toUpperCase().trim();
  
  // Handle some common variations
  if (baseType === 'BOOL') return 'BOOLEAN';
  if (baseType === 'INTEGER') return 'INT';
  
  return baseType;
};

// Get length/precision from full type definition
export const getTypeLength = (fullType) => {
  if (!fullType) return '';
  
  const match = fullType.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
};

// Build full type definition from base type and length
export const buildFullType = (baseType, length) => {
  if (!baseType) return 'VARCHAR';
  
  if (length && length.trim() && DATA_TYPES_WITH_LENGTH.includes(baseType.toUpperCase())) {
    return `${baseType.toUpperCase()}(${length.trim()})`;
  }
  
  return baseType.toUpperCase();
};

/**
 * Check if two data types are compatible for foreign key relationships
 * MySQL requires EXACT type match including length, unsigned, etc.
 * @param {string} childType - Child column data type (e.g., "INT(11)", "VARCHAR(255)")
 * @param {string} parentType - Parent column data type
 * @returns {Object} { compatible: boolean, reason: string }
 */
export const areDataTypesCompatible = (childType, parentType) => {
  if (!childType || !parentType) {
    return { compatible: false, reason: 'Missing data type' };
  }

  // Normalize types for comparison (trim and uppercase)
  const normalizeType = (type) => {
    return type.trim().toUpperCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/UNSIGNED/g, 'UNSIGNED') // Normalize unsigned keyword
      .replace(/ZEROFILL/g, 'ZEROFILL'); // Normalize zerofill keyword
  };

  const childNormalized = normalizeType(childType);
  const parentNormalized = normalizeType(parentType);

  // MySQL requires EXACT match for foreign keys
  if (childNormalized === parentNormalized) {
    return { compatible: true, reason: 'Exact type match' };
  }

  // Check if only difference is default length (MySQL adds default lengths)
  // For example: INT is stored as INT(11), BIGINT as BIGINT(20)
  const childBase = getBaseDataType(childType);
  const parentBase = getBaseDataType(parentType);
  
  if (childBase === parentBase) {
    // Same base type, check if difference is just default length
    const childLength = getTypeLength(childType);
    const parentLength = getTypeLength(parentType);
    
    // If one has no length and other has default length, consider compatible
    if (!childLength || !parentLength) {
      return { compatible: true, reason: 'Same base type (default length)' };
    }
    
    // If lengths are different, not compatible
    if (childLength !== parentLength) {
      return { 
        compatible: false, 
        reason: `Same base type but different lengths: ${childBase}(${childLength}) vs ${parentBase}(${parentLength})` 
      };
    }
    
    return { compatible: true, reason: 'Same type and length' };
  }

  // Not compatible - different base types
  return { 
    compatible: false, 
    reason: `Incompatible types: ${childBase} cannot reference ${parentBase}. MySQL requires exact type match for foreign keys.` 
  };
};
