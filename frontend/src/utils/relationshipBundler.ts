import type { Relationship } from '../types';

export interface BundledRelationship extends Relationship {
  bundledRelationships: Relationship[];
  isBundled: boolean;
  bundleCount?: number;
}

export const bundleRelationships = (relationships: Relationship[]): BundledRelationship[] => {
  if (!relationships || relationships.length === 0) return [];

  const groups: Record<string, Relationship[]> = {};

  relationships.forEach((rel) => {
    if (rel.fromTable === rel.toTable) {
      const selfKey = `self_${rel.fromTable}_${rel.fromColumn}_${rel.toColumn}`;
      groups[selfKey] = [rel];
      return;
    }
    const cardinalityType = rel.cardinalityType || '1:N';
    const isIdentifying = rel.isIdentifying || false;
    const groupKey = `${rel.fromTable}_${rel.toTable}_${cardinalityType}_${isIdentifying}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(rel);
  });

  return Object.values(groups).map((group) => {
    if (group.length === 1) return { ...group[0], bundledRelationships: [group[0]], isBundled: false };
    return { ...group[0], bundledRelationships: group, isBundled: true, bundleCount: group.length };
  });
};

export const getBundledColumns = (bundledRel: BundledRelationship): Array<{ fromColumn: string; toColumn: string }> => {
  if (!bundledRel.bundledRelationships) {
    return [{ fromColumn: bundledRel.fromColumn, toColumn: bundledRel.toColumn }];
  }
  return bundledRel.bundledRelationships.map((rel) => ({ fromColumn: rel.fromColumn, toColumn: rel.toColumn }));
};
