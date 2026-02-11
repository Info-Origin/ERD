import { createContext, useContext, useState, useCallback } from 'react';

const RelationshipCreationContext = createContext();

export const useRelationshipCreation = () => {
  const context = useContext(RelationshipCreationContext);
  if (!context) {
    throw new Error('useRelationshipCreation must be used within RelationshipCreationProvider');
  }
  return context;
};

export const RelationshipCreationProvider = ({ children }) => {
  const [creationMode, setCreationMode] = useState(null);
  const [selectedTables, setSelectedTables] = useState([]);
  const [relationshipType, setRelationshipType] = useState(null);

  // Relationship types matching MySQL Workbench
  const RELATIONSHIP_TYPES = {
    // Identifying relationships (solid lines)
    ONE_TO_ONE_IDENTIFYING: {
      id: 'one_to_one_identifying',
      name: '1:1 Identifying',
      description: 'One-to-One Identifying Relationship',
      lineStyle: 'solid',
      isIdentifying: true,
      cardinality: '1:1'
    },
    ONE_TO_MANY_IDENTIFYING: {
      id: 'one_to_many_identifying',
      name: '1:N Identifying',
      description: 'One-to-Many Identifying Relationship', 
      lineStyle: 'solid',
      isIdentifying: true,
      cardinality: '1:N'
    },
    MANY_TO_MANY_IDENTIFYING: {
      id: 'many_to_many_identifying',
      name: 'N:M Identifying',
      description: 'Many-to-Many Identifying Relationship',
      lineStyle: 'solid',
      isIdentifying: true,
      cardinality: 'N:M'
    },
    // Non-identifying relationships (dashed lines)
    // Note: Many-to-Many is ALWAYS identifying, so only 1:1 and 1:N have non-identifying variants
    ONE_TO_ONE_NON_IDENTIFYING: {
      id: 'one_to_one_non_identifying',
      name: '1:1 Non-Identifying', 
      description: 'One-to-One Non-Identifying Relationship',
      lineStyle: 'dashed',
      isIdentifying: false,
      cardinality: '1:1'
    },
    ONE_TO_MANY_NON_IDENTIFYING: {
      id: 'one_to_many_non_identifying', 
      name: '1:N Non-Identifying',
      description: 'One-to-Many Non-Identifying Relationship',
      lineStyle: 'dashed',
      isIdentifying: false,
      cardinality: '1:N'
    }
  };

  const startRelationshipCreation = useCallback((type) => {
    setCreationMode('RELATIONSHIP_CREATION_MODE');
    setRelationshipType(type);
    setSelectedTables([]);
  }, []);

  const selectTable = useCallback((tableName) => {
    if (creationMode !== 'RELATIONSHIP_CREATION_MODE') return;

    setSelectedTables(prev => {
      const newSelection = [...prev, tableName];
      return newSelection;
    });
  }, [creationMode]);

  const cancelRelationshipCreation = useCallback(() => {
    setCreationMode(null);
    setRelationshipType(null);
    setSelectedTables([]);
  }, []);

  const completeRelationshipCreation = useCallback(() => {
    if (selectedTables.length === 2 && relationshipType) {
      // MySQL Workbench behavior: 1st click = child (N), 2nd click = parent (1)
      const [childTable, parentTable] = selectedTables;
      
      // This will be called by the parent component to actually create the relationship
      const relationshipData = {
        type: relationshipType,
        parentTable,
        childTable,
        timestamp: Date.now()
      };
      
      // Reset state
      setCreationMode(null);
      setRelationshipType(null);
      setSelectedTables([]);
      
      return relationshipData;
    }
    return null;
  }, [selectedTables, relationshipType]);

  const value = {
    // State
    creationMode,
    selectedTables,
    relationshipType,
    RELATIONSHIP_TYPES,
    
    // Actions
    startRelationshipCreation,
    selectTable,
    cancelRelationshipCreation,
    completeRelationshipCreation,
    
    // Helpers
    isInCreationMode: creationMode === 'RELATIONSHIP_CREATION_MODE',
    isTableSelected: (tableName) => selectedTables.includes(tableName),
    getTableSelectionOrder: (tableName) => selectedTables.indexOf(tableName) + 1,
    canCompleteRelationship: selectedTables.length === 2 && relationshipType
  };

  return (
    <RelationshipCreationContext.Provider value={value}>
      {children}
    </RelationshipCreationContext.Provider>
  );
};