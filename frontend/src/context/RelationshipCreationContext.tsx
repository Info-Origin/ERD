import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type {
  RelationshipTypeDefinition,
  RelationshipCreationId,
  RelationshipCreationData,
} from '../types';

const RELATIONSHIP_TYPES: Record<string, RelationshipTypeDefinition> = {
  ONE_TO_ONE_IDENTIFYING: {
    id: 'one_to_one_identifying' as RelationshipCreationId,
    name: '1:1 Identifying',
    description: 'One-to-One Identifying Relationship',
    lineStyle: 'solid',
    isIdentifying: true,
    cardinality: '1:1',
  },
  ONE_TO_MANY_IDENTIFYING: {
    id: 'one_to_many_identifying' as RelationshipCreationId,
    name: '1:N Identifying',
    description: 'One-to-Many Identifying Relationship',
    lineStyle: 'solid',
    isIdentifying: true,
    cardinality: '1:N',
  },
  MANY_TO_MANY_IDENTIFYING: {
    id: 'many_to_many_identifying' as RelationshipCreationId,
    name: 'N:M Identifying',
    description: 'Many-to-Many Identifying Relationship',
    lineStyle: 'solid',
    isIdentifying: true,
    cardinality: 'N:M',
  },
  ONE_TO_ONE_NON_IDENTIFYING: {
    id: 'one_to_one_non_identifying' as RelationshipCreationId,
    name: '1:1 Non-Identifying',
    description: 'One-to-One Non-Identifying Relationship',
    lineStyle: 'dashed',
    isIdentifying: false,
    cardinality: '1:1',
  },
  ONE_TO_MANY_NON_IDENTIFYING: {
    id: 'one_to_many_non_identifying' as RelationshipCreationId,
    name: '1:N Non-Identifying',
    description: 'One-to-Many Non-Identifying Relationship',
    lineStyle: 'dashed',
    isIdentifying: false,
    cardinality: '1:N',
  },
};

interface RelationshipCreationContextValue {
  creationMode: string | null;
  selectedTables: string[];
  relationshipType: RelationshipTypeDefinition | null;
  RELATIONSHIP_TYPES: Record<string, RelationshipTypeDefinition>;
  startRelationshipCreation: (type: RelationshipTypeDefinition) => void;
  selectTable: (tableName: string) => void;
  cancelRelationshipCreation: () => void;
  completeRelationshipCreation: () => RelationshipCreationData | null;
  isInCreationMode: boolean;
  isTableSelected: (tableName: string) => boolean;
  getTableSelectionOrder: (tableName: string) => number;
  canCompleteRelationship: boolean;
}

const RelationshipCreationContext = createContext<RelationshipCreationContextValue | undefined>(
  undefined,
);

export const useRelationshipCreation = (): RelationshipCreationContextValue => {
  const context = useContext(RelationshipCreationContext);
  if (!context)
    throw new Error('useRelationshipCreation must be used within RelationshipCreationProvider');
  return context;
};

export const RelationshipCreationProvider = ({ children }: { children: ReactNode }) => {
  const [creationMode, setCreationMode] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState<RelationshipTypeDefinition | null>(null);

  const startRelationshipCreation = useCallback((type: RelationshipTypeDefinition) => {
    setCreationMode('RELATIONSHIP_CREATION_MODE');
    setRelationshipType(type);
    setSelectedTables([]);
  }, []);

  const selectTable = useCallback(
    (tableName: string) => {
      if (creationMode !== 'RELATIONSHIP_CREATION_MODE') return;
      setSelectedTables((prev) => [...prev, tableName]);
    },
    [creationMode],
  );

  const cancelRelationshipCreation = useCallback(() => {
    setCreationMode(null);
    setRelationshipType(null);
    setSelectedTables([]);
  }, []);

  const completeRelationshipCreation = useCallback((): RelationshipCreationData | null => {
    if (selectedTables.length === 2 && relationshipType) {
      const [childTable, parentTable] = selectedTables;
      const data: RelationshipCreationData = {
        type: relationshipType,
        parentTable,
        childTable,
        timestamp: Date.now(),
      };
      setCreationMode(null);
      setRelationshipType(null);
      setSelectedTables([]);
      return data;
    }
    return null;
  }, [selectedTables, relationshipType]);

  return (
    <RelationshipCreationContext.Provider
      value={{
        creationMode,
        selectedTables,
        relationshipType,
        RELATIONSHIP_TYPES,
        startRelationshipCreation,
        selectTable,
        cancelRelationshipCreation,
        completeRelationshipCreation,
        isInCreationMode: creationMode === 'RELATIONSHIP_CREATION_MODE',
        isTableSelected: (tableName) => selectedTables.includes(tableName),
        getTableSelectionOrder: (tableName) => selectedTables.indexOf(tableName) + 1,
        canCompleteRelationship: selectedTables.length === 2 && relationshipType !== null,
      }}
    >
      {children}
    </RelationshipCreationContext.Provider>
  );
};
