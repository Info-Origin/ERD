import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";

// Persistence utilities
const STORAGE_KEY = "reverseERD_virtualSchemas";
const TABLE_POSITIONS_KEY = "reverseERD_tablePositions";
const REAL_DB_HISTORY_KEY = "reverseERD_realDbHistory";
const BASELINE_SCHEMA_KEY = "reverseERD_baselineSchemas"; // NEW: Store baseline schemas

const saveBaselineSchema = (schemaName, baselineSchema) => {
  try {
    const stored = JSON.parse(localStorage.getItem(BASELINE_SCHEMA_KEY) || "{}");
    stored[schemaName] = {
      schema: baselineSchema,
      timestamp: Date.now(),
    };
    localStorage.setItem(BASELINE_SCHEMA_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to save baseline schema to localStorage:", error);
  }
};

const loadBaselineSchema = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(BASELINE_SCHEMA_KEY) || "{}");
    return stored[schemaName]?.schema || null;
  } catch (error) {
    console.warn("Failed to load baseline schema from localStorage:", error);
    return null;
  }
};

const clearBaselineSchema = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(BASELINE_SCHEMA_KEY) || "{}");
    delete stored[schemaName];
    localStorage.setItem(BASELINE_SCHEMA_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to clear baseline schema from localStorage:", error);
  }
};

const saveRealDbHistory = (schemaName, history) => {
  try {
    const stored = JSON.parse(localStorage.getItem(REAL_DB_HISTORY_KEY) || "{}");
    stored[schemaName] = {
      history: history,
      timestamp: Date.now(),
    };
    localStorage.setItem(REAL_DB_HISTORY_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to save real DB history to localStorage:", error);
  }
};

const loadRealDbHistory = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(REAL_DB_HISTORY_KEY) || "{}");
    return stored[schemaName]?.history || [];
  } catch (error) {
    console.warn("Failed to load real DB history from localStorage:", error);
    return [];
  }
};

const clearRealDbHistory = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(REAL_DB_HISTORY_KEY) || "{}");
    delete stored[schemaName];
    localStorage.setItem(REAL_DB_HISTORY_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to clear real DB history from localStorage:", error);
  }
};

const saveToStorage = (schemaName, virtualSchema) => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    stored[schemaName] = {
      schema: virtualSchema,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to save virtual schema to localStorage:", error);
  }
};

const saveTablePositions = (schemaName, positions) => {
  try {
    const stored = JSON.parse(localStorage.getItem(TABLE_POSITIONS_KEY) || "{}");
    stored[schemaName] = {
      positions: positions,
      timestamp: Date.now(),
    };
    localStorage.setItem(TABLE_POSITIONS_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to save table positions to localStorage:", error);
  }
};

const loadTablePositions = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(TABLE_POSITIONS_KEY) || "{}");
    return stored[schemaName]?.positions || {};
  } catch (error) {
    console.warn("Failed to load table positions from localStorage:", error);
    return {};
  }
};

const clearTablePositions = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(TABLE_POSITIONS_KEY) || "{}");
    delete stored[schemaName];
    localStorage.setItem(TABLE_POSITIONS_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to clear table positions from localStorage:", error);
  }
};

const loadFromStorage = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return stored[schemaName]?.schema || null;
  } catch (error) {
    console.warn("Failed to load virtual schema from localStorage:", error);
    return null;
  }
};

const clearFromStorage = (schemaName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete stored[schemaName];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn("Failed to clear virtual schema from localStorage:", error);
  }
};

const clearAllFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear all virtual schemas from localStorage:", error);
  }
};

const VirtualSchemaContext = createContext();

export const useVirtualSchema = () => {
  const context = useContext(VirtualSchemaContext);
  if (!context) {
    throw new Error(
      "useVirtualSchema must be used within VirtualSchemaProvider",
    );
  }
  return context;
};

export const VirtualSchemaProvider = ({ children }) => {
  const [originalSchema, setOriginalSchema] = useState(null);
  const [workingSchema, setWorkingSchema] = useState(null);
  const [isModified, setIsModified] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentSchemaName, setCurrentSchemaName] = useState(null);
  const [tablePositions, setTablePositions] = useState({});
  const [isSwitchingSchema, setIsSwitchingSchema] = useState(false);
  const [realDbHistory, setRealDbHistory] = useState([]); // Track real DB changes over time
  const historyIndexRef = useRef(-1);

  // Keep ref in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Auto-save to localStorage when working schema changes
  useEffect(() => {
    if (workingSchema && currentSchemaName && isModified) {
      saveToStorage(currentSchemaName, workingSchema);
    }
  }, [workingSchema, currentSchemaName, isModified]);

  // Auto-save table positions
  useEffect(() => {
    if (currentSchemaName && Object.keys(tablePositions).length > 0) {
      saveTablePositions(currentSchemaName, tablePositions);
    }
  }, [tablePositions, currentSchemaName]);

  // Merge real database schema with virtual schema changes
  const mergeSchemas = useCallback((realSchema, virtualSchema, originalSchema = null, dbHistory = []) => {
    // SIMPLIFIED MERGE STRATEGY:
    // 1. Start with real DB schema (source of truth for structure)
    // 2. Apply virtual modifications (user changes like PK, constraints, relationships)
    // 3. Remove columns that existed in original but are now deleted from real DB
    // 4. Keep user-added columns that never existed in real DB
    
    // Start with real schema as base
    const merged = JSON.parse(JSON.stringify(realSchema));
    
    // Process each table
    Object.keys(virtualSchema.tables).forEach(tableName => {
      const virtualTable = virtualSchema.tables[tableName];
      const realTable = realSchema.tables[tableName];
      const originalTable = originalSchema?.tables?.[tableName];
      
      if (realTable) {
        // Table exists in both real and virtual schemas
        
        // Start with real table structure
        merged.tables[tableName] = {
          ...realTable,
          columns: {}
        };
        
        // Step 1: Add all columns from real DB (these are current and valid)
        Object.keys(realTable.columns).forEach(columnName => {
          const realColumn = realTable.columns[columnName];
          const virtualColumn = virtualTable.columns[columnName];
          
          if (virtualColumn) {
            // Column exists in both - merge virtual changes with real structure
            merged.tables[tableName].columns[columnName] = {
              ...realColumn, // Keep real DB structure (type, etc.)
              ...virtualColumn, // Apply virtual modifications (PK, constraints, etc.)
              // Ensure critical real DB properties are preserved
              type: realColumn.type, // Always use real DB type
              autoIncrement: realColumn.autoIncrement, // Always use real DB AI
            };
          } else {
            // Column exists in real but not in virtual - add as-is
            merged.tables[tableName].columns[columnName] = realColumn;
          }
        });
        
        // Step 2: Handle virtual-only columns (user-added or deleted from real DB)
        Object.keys(virtualTable.columns).forEach(columnName => {
          if (!realTable.columns[columnName]) {
            // Column exists in virtual but not in current real DB
            const virtualColumn = virtualTable.columns[columnName];
            const existedInOriginal = originalTable?.columns?.[columnName];
            
            if (existedInOriginal) {
              // Column existed in original real DB but is now deleted from real DB
              // PRIORITY: Real DB deletions take precedence - remove it
              // Don't add to merged schema
            } else {
              // Column never existed in real DB - it's user-added, keep it
              // BUT: Double-check by looking at the baseline schema more carefully
              const baselineSchema = originalSchema;
              const baselineTable = baselineSchema?.tables?.[tableName];
              const existedInBaseline = baselineTable?.columns?.[columnName];
              
              if (existedInBaseline) {
                // Column existed in baseline but not in current real DB - it was deleted
                // Don't add to merged schema
              } else {
                // Column truly never existed in real DB - it's user-added, keep it
                merged.tables[tableName].columns[columnName] = virtualColumn;
              }
            }
          }
        });
        
      } else if (originalSchema?.tables?.[tableName]) {
        // Table existed in original but not in current real DB - it was deleted
        // Don't add to merged schema
      } else {
        // Table never existed in real DB - check baseline more carefully
        const baselineSchema = originalSchema;
        const existedInBaseline = baselineSchema?.tables?.[tableName];
        
        if (existedInBaseline) {
          // Table existed in baseline but not in current real DB - it was deleted
          // Don't add to merged schema
        } else {
          // Table never existed in real DB - it's user-added
          merged.tables[tableName] = virtualTable;
        }
      }
    });
    
    // Add any new tables from real DB that aren't in virtual
    Object.keys(realSchema.tables).forEach(tableName => {
      if (!virtualSchema.tables[tableName]) {
        merged.tables[tableName] = realSchema.tables[tableName];
      }
    });
    
    // Clean up relationships that reference deleted tables/columns
    const validRelationships = (merged.relationships || []).filter(rel => {
      const fromTableExists = merged.tables[rel.fromTable];
      const toTableExists = merged.tables[rel.toTable];
      const fromColumnExists = fromTableExists?.columns[rel.fromColumn];
      const toColumnExists = toTableExists?.columns[rel.toColumn];
      
      const isValid = fromTableExists && toTableExists && fromColumnExists && toColumnExists;
      return isValid;
    });
    
    // Merge relationships from virtual schema (user-added relationships)
    const virtualRelationships = virtualSchema.relationships || [];
    const relationshipMap = new Map();
    
    // Add valid relationships
    validRelationships.forEach(rel => {
      const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
      relationshipMap.set(key, rel);
    });
    
    // Add virtual relationships (will override if same key)
    virtualRelationships.forEach(rel => {
      const fromTableExists = merged.tables[rel.fromTable];
      const toTableExists = merged.tables[rel.toTable];
      const fromColumnExists = fromTableExists?.columns[rel.fromColumn];
      const toColumnExists = toTableExists?.columns[rel.toColumn];
      
      if (fromTableExists && toTableExists && fromColumnExists && toColumnExists) {
        const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
        relationshipMap.set(key, rel);
      }
    });
    
    merged.relationships = Array.from(relationshipMap.values());
    
    // Keep virtual schema metadata
    merged.schemaName = virtualSchema.schemaName || realSchema.schemaName;
    
    return merged;
  }, []);

  // Get merge summary for debugging
  const getMergeSummary = useCallback((realSchema, virtualSchema) => {
    if (!realSchema || !virtualSchema) return null;
    
    const realTables = Object.keys(realSchema.tables || {});
    const virtualTables = Object.keys(virtualSchema.tables || {});
    const newRealTables = realTables.filter(t => !virtualSchema.tables[t]);
    const userAddedTables = virtualTables.filter(t => !realSchema.tables[t]);
    const modifiedTables = realTables.filter(t => virtualSchema.tables[t]);
    
    return {
      newFromDatabase: newRealTables,
      addedByUser: userAddedTables,
      modifiedByUser: modifiedTables,
      totalTables: Math.max(realTables.length, virtualTables.length)
    };
  }, []);

  // Initialize virtual schema from original or localStorage
  const initializeSchema = useCallback((erdData) => {
    if (!erdData) return;

    const schemaName = erdData.schemaName;
    
    // If switching to a different schema, prepare new schema data first, then switch atomically
    if (currentSchemaName && currentSchemaName !== schemaName) {
      // Set switching state to prevent race conditions
      setIsSwitchingSchema(true);
      
      // Prepare new schema data
      const savedTablePositions = loadTablePositions(schemaName);
      
      // Apply FK detection to schema based on relationships
      const applyFKDetection = (schema) => {
        const updatedSchema = JSON.parse(JSON.stringify(schema));
        
        // Reset FK flags first
        Object.values(updatedSchema.tables).forEach(table => {
          Object.values(table.columns).forEach(column => {
            column.fk = false;
            column.isPkAndFk = false;
          });
        });

        // Apply FK detection based on relationships
        (updatedSchema.relationships || []).forEach((rel) => {
          if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
            const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
            column.fk = true;
            if (column.pk) {
              column.isPkAndFk = true;
            }
          }
        });

        return updatedSchema;
      };

      // Prepare new working schema
      const savedSchema = loadFromStorage(schemaName);
      
      let newWorkingSchema;
      let newHistory;
      let newHistoryIndex;
      let newIsModified;

      if (savedSchema) {
        // MERGE STRATEGY: Combine real DB schema with virtual schema changes
        // For schema switching, we need to build the history context
        const switchingRealDbHistory = [{
          timestamp: Date.now(),
          tables: Object.keys(erdData.tables || {}),
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        
        const originalRealSchema = erdData; // For switching, current erdData is the baseline
        const mergedSchema = mergeSchemas(erdData, savedSchema, originalRealSchema, switchingRealDbHistory);
        
        // Apply FK detection to merged schema to ensure relationships are properly marked
        newWorkingSchema = applyFKDetection(mergedSchema);
        newHistory = [JSON.parse(JSON.stringify(erdData)), newWorkingSchema];
        newHistoryIndex = 1;
        newIsModified = true;
      } else {
        newWorkingSchema = JSON.parse(JSON.stringify(erdData));
        newHistory = [newWorkingSchema];
        newHistoryIndex = 0;
        newIsModified = false;
      }

      // ATOMIC UPDATE - Set all state at once to prevent race conditions
      setCurrentSchemaName(schemaName);
      setOriginalSchema(erdData);
      setTablePositions(savedTablePositions);
      setWorkingSchema(newWorkingSchema);
      setHistory(newHistory);
      setHistoryIndex(newHistoryIndex);
      historyIndexRef.current = newHistoryIndex;
      setIsModified(newIsModified);
      setIsSwitchingSchema(false); // Clear switching state
      
      return; // Early return for schema switching
    }
    
    // Initial schema load (not switching)
    setCurrentSchemaName(schemaName);
    setOriginalSchema(erdData);
    
    // CRITICAL: Save the baseline schema for future comparisons
    // This represents the FIRST real DB state we saw for this schema
    let baselineSchema = loadBaselineSchema(schemaName);
    if (!baselineSchema) {
      // First time loading this schema - save it as baseline
      saveBaselineSchema(schemaName, erdData);
      baselineSchema = erdData;
    }
    
    // Track real DB history for better merge decisions - do this BEFORE merging
    const updatedRealDbHistory = (() => {
      const currentRealTables = Object.keys(erdData.tables || {});
      
      // Load existing history from localStorage
      const existingHistory = loadRealDbHistory(schemaName);
      
      // If this is a completely new schema, initialize history
      if (currentSchemaName !== schemaName) {
        const newHistory = [{
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        saveRealDbHistory(schemaName, newHistory);
        return newHistory;
      }
      
      // If we have no history yet for this schema, initialize it
      if (existingHistory.length === 0) {
        const newHistory = [{
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        saveRealDbHistory(schemaName, newHistory);
        return newHistory;
      }
      
      // Check if real DB has changed since last time
      const lastEntry = existingHistory[existingHistory.length - 1];
      const lastRealTables = lastEntry.tables;
      
      const tablesChanged = currentRealTables.length !== lastRealTables.length ||
        !currentRealTables.every(table => lastRealTables.includes(table)) ||
        !lastRealTables.every(table => currentRealTables.includes(table));
      
      if (tablesChanged) {
        const updatedHistory = [...existingHistory, {
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        
        // Keep history manageable (last 50 entries)
        const trimmedHistory = updatedHistory.slice(-50);
        
        saveRealDbHistory(schemaName, trimmedHistory);
        return trimmedHistory;
      }
      
      // No changes, return existing history
      return existingHistory;
    })();
    
    // Update the history state
    setRealDbHistory(updatedRealDbHistory);

    // Load table positions from localStorage
    const savedTablePositions = loadTablePositions(schemaName);
    setTablePositions(savedTablePositions);

    // Apply FK detection to schema based on relationships
    const applyFKDetection = (schema) => {
      const updatedSchema = JSON.parse(JSON.stringify(schema));
      
      // Reset FK flags first
      Object.values(updatedSchema.tables).forEach(table => {
        Object.values(table.columns).forEach(column => {
          column.fk = false;
          column.isPkAndFk = false;
        });
      });

      // Apply FK detection based on relationships
      (updatedSchema.relationships || []).forEach((rel) => {
        if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
          const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
          column.fk = true;
          if (column.pk) {
            column.isPkAndFk = true;
          }
        }
      });

      return updatedSchema;
    };

    // Try to load from localStorage first
    const savedSchema = loadFromStorage(schemaName);
    
    if (savedSchema) {
      // MERGE STRATEGY: Combine real DB schema with virtual schema changes
      // CRITICAL: Use the persistent baseline schema for comparison
      
      // DYNAMIC BASELINE UPDATE: If real DB has new tables that aren't in baseline,
      // update the baseline to include them. This ensures that when they're later
      // deleted, they'll be properly detected as deletions.
      const realTables = Object.keys(erdData.tables || {});
      const baselineTables = Object.keys(baselineSchema?.tables || {});
      const newTablesInReal = realTables.filter(table => !baselineTables.includes(table));
      
      if (newTablesInReal.length > 0) {
        // Create updated baseline that includes new real tables
        const updatedBaseline = JSON.parse(JSON.stringify(baselineSchema || {}));
        if (!updatedBaseline.tables) updatedBaseline.tables = {};
        
        newTablesInReal.forEach(tableName => {
          updatedBaseline.tables[tableName] = erdData.tables[tableName];
        });
        
        // Save updated baseline
        saveBaselineSchema(schemaName, updatedBaseline);
        baselineSchema = updatedBaseline;
      }
      
      const mergedSchema = mergeSchemas(erdData, savedSchema, baselineSchema, updatedRealDbHistory);
      
      // Apply FK detection to merged schema to ensure relationships are properly marked
      const updatedSchema = applyFKDetection(mergedSchema);
      setWorkingSchema(updatedSchema);
      setHistory([JSON.parse(JSON.stringify(erdData)), updatedSchema]);
      setHistoryIndex(1);
      historyIndexRef.current = 1;
      setIsModified(true);
    } else {
      const clonedSchema = JSON.parse(JSON.stringify(erdData));
      setWorkingSchema(clonedSchema);
      setHistory([clonedSchema]);
      setHistoryIndex(0);
      historyIndexRef.current = 0;
      setIsModified(false);
    }
  }, [currentSchemaName]); // Add currentSchemaName to dependencies

  // Force refresh and merge with current real DB state
  const refreshAndMerge = useCallback(async (newRealSchema) => {
    if (!workingSchema || !currentSchemaName) return;

    try {
      // CRITICAL FIX: Use the persistent baseline schema for comparison
      // This ensures that deleted tables/columns are properly detected
      let baselineSchema = loadBaselineSchema(currentSchemaName);
      
      if (!baselineSchema) {
        // If no baseline exists, use the current originalSchema and save it
        baselineSchema = originalSchema;
        if (baselineSchema) {
          saveBaselineSchema(currentSchemaName, baselineSchema);
        }
      }
      
      // DYNAMIC BASELINE UPDATE: If real DB has new tables that aren't in baseline,
      // update the baseline to include them. This ensures that when they're later
      // deleted, they'll be properly detected as deletions.
      const realTables = Object.keys(newRealSchema.tables || {});
      const baselineTables = Object.keys(baselineSchema?.tables || {});
      const newTablesInReal = realTables.filter(table => !baselineTables.includes(table));
      
      if (newTablesInReal.length > 0) {
        // Create updated baseline that includes new real tables
        const updatedBaseline = JSON.parse(JSON.stringify(baselineSchema || {}));
        if (!updatedBaseline.tables) updatedBaseline.tables = {};
        
        newTablesInReal.forEach(tableName => {
          updatedBaseline.tables[tableName] = newRealSchema.tables[tableName];
        });
        
        // Save updated baseline
        saveBaselineSchema(currentSchemaName, updatedBaseline);
        baselineSchema = updatedBaseline;
      }
      
      // Merge the new real schema with current virtual changes
      const mergedSchema = mergeSchemas(newRealSchema, workingSchema, baselineSchema, realDbHistory);
      
      // Apply FK detection
      const applyFKDetection = (schema) => {
        const updatedSchema = JSON.parse(JSON.stringify(schema));
        
        // Reset FK flags first
        Object.values(updatedSchema.tables).forEach(table => {
          Object.values(table.columns).forEach(column => {
            column.fk = false;
            column.isPkAndFk = false;
          });
        });

        // Apply FK detection based on relationships
        (updatedSchema.relationships || []).forEach((rel) => {
          if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
            const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
            column.fk = true;
            if (column.pk) {
              column.isPkAndFk = true;
            }
          }
        });

        return updatedSchema;
      };

      const finalSchema = applyFKDetection(mergedSchema);
      
      // Update state - DO NOT update originalSchema here, keep it as the stable baseline
      setWorkingSchema(finalSchema);
      setHistory([JSON.parse(JSON.stringify(baselineSchema || newRealSchema)), finalSchema]);
      setHistoryIndex(1);
      setIsModified(true);
      
      return finalSchema;
    } catch (error) {
      console.error('Error in refreshAndMerge:', error);
      throw error;
    }
  }, [workingSchema, currentSchemaName, realDbHistory, originalSchema, mergeSchemas]);

  // Force refresh from backend (ignore localStorage)
  const forceRefreshFromBackend = useCallback(() => {
    if (originalSchema && currentSchemaName) {
      const clonedOriginal = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      setHistory([clonedOriginal]);
      setHistoryIndex(0);
      setIsModified(false);
      clearFromStorage(currentSchemaName);
    }
  }, [originalSchema, currentSchemaName]);

  // Add to history for undo/redo
  const addToHistory = useCallback(
    (newSchema) => {
      setHistory(prevHistory => {
        const currentIndex = historyIndexRef.current;
        const newHistory = prevHistory.slice(0, currentIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newSchema)));
        return newHistory;
      });
      setHistoryIndex(prevIndex => prevIndex + 1);
    },
    [],
  );

  // Update working schema
  const updateWorkingSchema = useCallback(
    (newSchema) => {
      setWorkingSchema(newSchema);
      addToHistory(newSchema);
      setIsModified(true);
    },
    [addToHistory],
  );

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousState = history[newIndex];
      setWorkingSchema(JSON.parse(JSON.stringify(previousState)));
      setIsModified(newIndex !== 0);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      setWorkingSchema(JSON.parse(JSON.stringify(nextState)));
      setIsModified(true);
    }
  }, [history, historyIndex]);

  // Reset to original
  const resetToOriginal = useCallback(() => {
    if (originalSchema && currentSchemaName) {
      const clonedOriginal = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      setHistory([clonedOriginal]);
      setHistoryIndex(0);
      setIsModified(false);
      clearFromStorage(currentSchemaName);
      clearBaselineSchema(currentSchemaName); // Clear baseline so it gets reset
    }
  }, [originalSchema, currentSchemaName]);

  // Clear virtual schema
  const clearVirtualSchema = useCallback(() => {
    if (currentSchemaName) {
      clearFromStorage(currentSchemaName);
      clearRealDbHistory(currentSchemaName);
      clearBaselineSchema(currentSchemaName); // Clear baseline as well
    }
    setWorkingSchema(null);
    setOriginalSchema(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsModified(false);
    setCurrentSchemaName(null);
    setRealDbHistory([]);
  }, [currentSchemaName]);

  // Clear ALL virtual schemas (for global refresh)
  const clearAllVirtualSchemas = useCallback(() => {
    clearAllFromStorage();
    setWorkingSchema(null);
    setOriginalSchema(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsModified(false);
    setCurrentSchemaName(null);
  }, []);

  // TABLE OPERATIONS

  const addTable = useCallback(
    (tableName) => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };

      if (newSchema.tables[tableName]) {
        throw new Error(`Table "${tableName}" already exists`);
      }

      newSchema.tables[tableName] = {
        name: tableName,
        columns: {},
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const deleteTable = useCallback(
    (tableName) => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };
      delete newSchema.tables[tableName];

      // Remove relationships involving this table
      newSchema.relationships = (newSchema.relationships || []).filter(
        (rel) => rel.fromTable !== tableName && rel.toTable !== tableName,
      );

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const renameTable = useCallback(
    (oldName, newName) => {
      if (!workingSchema) return;

      if (workingSchema.tables[newName]) {
        throw new Error(`Table "${newName}" already exists`);
      }

      const newSchema = { ...workingSchema };

      // Rename in tables
      newSchema.tables[newName] = {
        ...newSchema.tables[oldName],
        name: newName,
      };
      delete newSchema.tables[oldName];

      // Update relationships
      newSchema.relationships = (newSchema.relationships || []).map((rel) => ({
        ...rel,
        fromTable: rel.fromTable === oldName ? newName : rel.fromTable,
        toTable: rel.toTable === oldName ? newName : rel.toTable,
      }));

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // COLUMN OPERATIONS

  const addColumn = useCallback(
    (tableName, columnName, columnData = {}) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };

      if (newSchema.tables[tableName].columns[columnName]) {
        throw new Error(
          `Column "${columnName}" already exists in table "${tableName}"`,
        );
      }

      newSchema.tables[tableName] = {
        ...newSchema.tables[tableName],
        columns: {
          ...newSchema.tables[tableName].columns,
          [columnName]: {
            name: columnName,
            type: columnData.type || "VARCHAR(255)",
            pk: columnData.pk || false,
            fk: columnData.fk || false,
            unique: columnData.unique || false,
            nullable: columnData.nullable !== undefined ? columnData.nullable : true,
            defaultValue: columnData.defaultValue || null,
          },
        },
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const deleteColumn = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };
      delete newSchema.tables[tableName].columns[columnName];

      // Remove relationships involving this column
      newSchema.relationships = (newSchema.relationships || []).filter(
        (rel) =>
          !(rel.fromTable === tableName && rel.fromColumn === columnName) &&
          !(rel.toTable === tableName && rel.toColumn === columnName),
      );

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const updateColumn = useCallback(
    (tableName, columnName, updates) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };

      newSchema.tables[tableName] = {
        ...newSchema.tables[tableName],
        columns: {
          ...newSchema.tables[tableName].columns,
          [columnName]: {
            ...newSchema.tables[tableName].columns[columnName],
            ...updates,
          },
        },
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const renameColumn = useCallback(
    (tableName, oldName, newName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      if (workingSchema.tables[tableName].columns[newName]) {
        throw new Error(
          `Column "${newName}" already exists in table "${tableName}"`,
        );
      }

      const newSchema = { ...workingSchema };
      const column = newSchema.tables[tableName].columns[oldName];

      newSchema.tables[tableName].columns[newName] = {
        ...column,
        name: newName,
      };
      delete newSchema.tables[tableName].columns[oldName];

      // Update relationships
      newSchema.relationships = (newSchema.relationships || []).map((rel) => ({
        ...rel,
        fromColumn:
          rel.fromTable === tableName && rel.fromColumn === oldName
            ? newName
            : rel.fromColumn,
        toColumn:
          rel.toTable === tableName && rel.toColumn === oldName
            ? newName
            : rel.toColumn,
      }));

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // CONSTRAINT OPERATIONS

  const togglePrimaryKey = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };
      const column = newSchema.tables[tableName].columns[columnName];

      // Remove PK from other columns if setting this one as PK
      if (!column.pk) {
        Object.keys(newSchema.tables[tableName].columns).forEach((col) => {
          newSchema.tables[tableName].columns[col].pk = false;
        });
      }

      newSchema.tables[tableName].columns[columnName] = {
        ...column,
        pk: !column.pk,
        nullable: !column.pk ? false : column.nullable, // PK cannot be nullable
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const toggleUnique = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };
      const column = newSchema.tables[tableName].columns[columnName];

      newSchema.tables[tableName].columns[columnName] = {
        ...column,
        unique: !column.unique,
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const toggleNullable = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };
      const column = newSchema.tables[tableName].columns[columnName];

      newSchema.tables[tableName].columns[columnName] = {
        ...column,
        nullable: !column.nullable,
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // RELATIONSHIP OPERATIONS

  const addRelationship = useCallback(
    (fromTable, fromColumn, toTable, toColumn, type = "ONE_TO_MANY") => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };

      if (!newSchema.relationships) {
        newSchema.relationships = [];
      }

      // Check if relationship already exists
      const exists = newSchema.relationships.some(
        (rel) =>
          rel.fromTable === fromTable &&
          rel.fromColumn === fromColumn &&
          rel.toTable === toTable &&
          rel.toColumn === toColumn,
      );

      if (exists) {
        throw new Error("Relationship already exists");
      }

      newSchema.relationships.push({
        id: uuidv4(),
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        type,
      });

      // Mark fromColumn as FK
      if (newSchema.tables[fromTable]?.columns[fromColumn]) {
        newSchema.tables[fromTable].columns[fromColumn].fk = true;
      }

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const deleteRelationship = useCallback(
    (relationshipId) => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };

      const rel = newSchema.relationships.find((r) => r.id === relationshipId);
      if (rel) {
        // Check if this was the only FK reference for this column
        const otherRefs = newSchema.relationships.filter(
          (r) =>
            r.id !== relationshipId &&
            r.fromTable === rel.fromTable &&
            r.fromColumn === rel.fromColumn,
        );

        if (
          otherRefs.length === 0 &&
          newSchema.tables[rel.fromTable]?.columns[rel.fromColumn]
        ) {
          newSchema.tables[rel.fromTable].columns[rel.fromColumn].fk = false;
        }
      }

      newSchema.relationships = newSchema.relationships.filter(
        (r) => r.id !== relationshipId,
      );

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // NEW: Advanced relationship creation methods
  const createVirtualRelationship = useCallback(
    async (relationshipData) => {
      if (!workingSchema) return;

      try {
        // Import the relationship creation service
        const { createRelationship, validateRelationshipCreation } = await import('../services/relationshipCreationService.js');
        
        // Validate the relationship
        const errors = validateRelationshipCreation(
          workingSchema, 
          relationshipData.parentTable, 
          relationshipData.childTable, 
          relationshipData.type
        );

        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }

        // Create the relationship and update schema
        const updatedSchema = createRelationship(workingSchema, relationshipData);
        updateWorkingSchema(updatedSchema);

        return true;
        
      } catch (error) {
        throw error;
      }
    },
    [workingSchema, updateWorkingSchema],
  );

  // Table position operations
  const updateTablePosition = useCallback((tableName, position) => {
    setTablePositions(prev => ({
      ...prev,
      [tableName]: position
    }));
  }, []);

  const clearAllTablePositions = useCallback(() => {
    if (currentSchemaName) {
      clearTablePositions(currentSchemaName);
      setTablePositions({});
    }
  }, [currentSchemaName]);

  // Clean up off-screen table positions
  const cleanupOffScreenPositions = useCallback(() => {
    if (!currentSchemaName) return;
    
    const maxDistance = 2000;
    const cleanedPositions = {};
    let hasChanges = false;
    
    Object.entries(tablePositions).forEach(([tableName, position]) => {
      const distance = Math.sqrt(position.x * position.x + position.y * position.y);
      if (distance <= maxDistance) {
        cleanedPositions[tableName] = position;
      } else {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setTablePositions(cleanedPositions);
    }
  }, [currentSchemaName, tablePositions]);

  const value = {
    // State
    originalSchema,
    workingSchema,
    isModified,
    isSwitchingSchema,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    tablePositions,

    // Core operations
    initializeSchema,
    resetToOriginal,
    forceRefreshFromBackend,
    refreshAndMerge,
    clearVirtualSchema,
    clearAllVirtualSchemas,
    undo,
    redo,

    // Table operations
    addTable,
    deleteTable,
    renameTable,

    // Column operations
    addColumn,
    deleteColumn,
    updateColumn,
    renameColumn,

    // Constraint operations
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,

    // Relationship operations
    addRelationship,
    deleteRelationship,
    createVirtualRelationship, // NEW: Advanced relationship creation

    // Table position operations
    updateTablePosition,
    clearAllTablePositions,
    cleanupOffScreenPositions,

    // Utility functions
    getMergeSummary,
  };

  return (
    <VirtualSchemaContext.Provider value={value}>
      {children}
    </VirtualSchemaContext.Provider>
  );
};
