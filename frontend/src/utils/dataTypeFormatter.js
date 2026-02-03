/**
 * Utility functions for formatting database data types for display
 */

/**
 * Extracts the base data type from a full type definition
 * Examples:
 * - VARCHAR(255) -> VARCHAR
 * - ENUM('INBOX','SENT','DRAFTS','STARRED','TRASH') -> ENUM
 * - INT(11) -> INT
 * - DECIMAL(10,2) -> DECIMAL
 * - TEXT -> TEXT (unchanged)
 */
export const getBaseDataType = (fullType) => {
  if (!fullType || typeof fullType !== 'string') {
    return fullType || 'UNKNOWN';
  }

  // Remove any parentheses and their contents
  const baseType = fullType.split('(')[0].trim().toUpperCase();
  
  return baseType;
};

/**
 * Formats data type for display in UI components
 * This is the main function to use in components
 */
export const formatDataTypeForDisplay = (dataType) => {
  return getBaseDataType(dataType);
};

/**
 * Gets the full data type (useful for tooltips or detailed views)
 */
export const getFullDataType = (dataType) => {
  return dataType || 'UNKNOWN';
};