export const getBaseDataType = (fullType: string): string => {
  if (!fullType || typeof fullType !== 'string') return fullType || 'UNKNOWN';
  return fullType.split('(')[0].trim().toUpperCase();
};

export const formatDataTypeForDisplay = (dataType: string): string => getBaseDataType(dataType);

export const getFullDataType = (dataType: string): string => dataType || 'UNKNOWN';
