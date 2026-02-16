/**
 * Bundle relationships between the same two tables if they have the same relationship type
 * (same cardinality and identifying status)
 */

/**
 * Group relationships by their type for bundling
 * @param {Array} relationships - Array of relationship objects
 * @returns {Array} - Array of bundled relationship groups
 */
export const bundleRelationships = (relationships) => {
  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Group relationships by: fromTable_toTable_cardinality_isIdentifying
  const groups = {};

  relationships.forEach((rel) => {
    // Skip self-referencing relationships (handled separately with "Self Joined" tag)
    if (rel.fromTable === rel.toTable) {
      // Add as individual relationship (not bundled)
      const selfKey = `self_${rel.fromTable}_${rel.fromColumn}_${rel.toColumn}`;
      groups[selfKey] = [rel];
      return;
    }

    // Create grouping key based on relationship type
    const cardinalityType = rel.cardinalityType || '1:N';
    const isIdentifying = rel.isIdentifying || false;
    
    // Group by: source-target pair + relationship type
    const groupKey = `${rel.fromTable}_${rel.toTable}_${cardinalityType}_${isIdentifying}`;

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(rel);
  });

  // Convert groups object to array of bundled relationships
  return Object.values(groups).map((group) => {
    if (group.length === 1) {
      // Single relationship, no bundling needed
      return {
        ...group[0],
        bundledRelationships: [group[0]], // Still wrap in array for consistency
        isBundled: false,
      };
    }

    // Multiple relationships with same type - bundle them
    return {
      ...group[0], // Use first relationship as base
      bundledRelationships: group, // Store all relationships in bundle
      isBundled: true,
      bundleCount: group.length,
    };
  });
};

/**
 * Get all FK columns involved in a bundled relationship
 * @param {Object} bundledRel - Bundled relationship object
 * @returns {Array} - Array of {fromColumn, toColumn} pairs
 */
export const getBundledColumns = (bundledRel) => {
  if (!bundledRel.bundledRelationships) {
    return [{ fromColumn: bundledRel.fromColumn, toColumn: bundledRel.toColumn }];
  }

  return bundledRel.bundledRelationships.map((rel) => ({
    fromColumn: rel.fromColumn,
    toColumn: rel.toColumn,
  }));
};
