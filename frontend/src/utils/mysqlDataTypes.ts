export const MYSQL_DATA_TYPES = {
  NUMERIC: ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','DECIMAL','FLOAT','DOUBLE','REAL'],
  STRING: ['CHAR','VARCHAR','BINARY','VARBINARY','TINYBLOB','BLOB','MEDIUMBLOB','LONGBLOB','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT'],
  DATE_TIME: ['DATE','TIME','DATETIME','TIMESTAMP','YEAR'],
  OTHER: ['BIT','BOOLEAN','ENUM','SET','JSON','GEOMETRY','POINT','LINESTRING','POLYGON','MULTIPOINT','MULTILINESTRING','MULTIPOLYGON','GEOMETRYCOLLECTION'],
} as const;

export const ALL_MYSQL_DATA_TYPES: string[] = [
  ...MYSQL_DATA_TYPES.NUMERIC,
  ...MYSQL_DATA_TYPES.STRING,
  ...MYSQL_DATA_TYPES.DATE_TIME,
  ...MYSQL_DATA_TYPES.OTHER,
].sort();

export const DATA_TYPES_WITH_LENGTH: string[] = [
  'VARCHAR','CHAR','VARBINARY','BINARY','DECIMAL','FLOAT','DOUBLE','BIT',
  'TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT',
];

export const DATA_TYPES_WITH_DEFAULTS: string[] = [
  'TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','DECIMAL','FLOAT','DOUBLE','REAL',
  'CHAR','VARCHAR','TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT',
  'DATE','TIME','DATETIME','TIMESTAMP','YEAR','BIT','BOOLEAN','ENUM','SET','JSON',
];

export const COMMON_DEFAULTS: Record<string, string[]> = {
  INT: ['0','1','NULL'], BIGINT: ['0','1','NULL'], TINYINT: ['0','1','NULL'],
  SMALLINT: ['0','1','NULL'], MEDIUMINT: ['0','1','NULL'],
  DECIMAL: ['0.00','0','NULL'], FLOAT: ['0.0','0','NULL'], DOUBLE: ['0.0','0','NULL'],
  VARCHAR: ["''", 'NULL'], CHAR: ["''", 'NULL'],
  TEXT: ['NULL'], TINYTEXT: ['NULL'], MEDIUMTEXT: ['NULL'], LONGTEXT: ['NULL'],
  DATE: ['NULL','CURRENT_DATE'], TIME: ['NULL','CURRENT_TIME'],
  DATETIME: ['NULL','CURRENT_TIMESTAMP'], TIMESTAMP: ['CURRENT_TIMESTAMP','NULL'],
  YEAR: ['NULL'], BIT: ['0','1','NULL'], BOOLEAN: ['FALSE','TRUE','NULL'],
  JSON: ['NULL'], ENUM: ['NULL'], SET: ['NULL'],
};

export const getBaseDataType = (fullType: string): string => {
  if (!fullType) return 'VARCHAR';
  const baseType = fullType.split('(')[0].toUpperCase().trim();
  if (baseType === 'BOOL') return 'BOOLEAN';
  if (baseType === 'INTEGER') return 'INT';
  return baseType;
};

export const getTypeLength = (fullType: string): string => {
  if (!fullType) return '';
  const match = fullType.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
};

export const buildFullType = (baseType: string, length: string): string => {
  if (!baseType) return 'VARCHAR';
  if (length && length.trim() && DATA_TYPES_WITH_LENGTH.includes(baseType.toUpperCase())) {
    return `${baseType.toUpperCase()}(${length.trim()})`;
  }
  return baseType.toUpperCase();
};

export interface TypeCompatibilityResult {
  compatible: boolean;
  reason: string;
}

export const areDataTypesCompatible = (childType: string, parentType: string): TypeCompatibilityResult => {
  if (!childType || !parentType) return { compatible: false, reason: 'Missing data type' };

  const normalizeType = (type: string) =>
    type.trim().toUpperCase().replace(/\s+/g, ' ');

  const childNormalized = normalizeType(childType);
  const parentNormalized = normalizeType(parentType);

  if (childNormalized === parentNormalized) return { compatible: true, reason: 'Exact type match' };

  const childBase = getBaseDataType(childType);
  const parentBase = getBaseDataType(parentType);

  if (childBase === parentBase) {
    const childLength = getTypeLength(childType);
    const parentLength = getTypeLength(parentType);
    if (!childLength || !parentLength) return { compatible: true, reason: 'Same base type (default length)' };
    if (childLength !== parentLength) {
      return { compatible: false, reason: `Same base type but different lengths: ${childBase}(${childLength}) vs ${parentBase}(${parentLength})` };
    }
    return { compatible: true, reason: 'Same type and length' };
  }

  return { compatible: false, reason: `Incompatible types: ${childBase} cannot reference ${parentBase}. MySQL requires exact type match for foreign keys.` };
};
