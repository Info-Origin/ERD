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