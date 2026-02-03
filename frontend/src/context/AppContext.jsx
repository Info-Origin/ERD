import { createContext, useContext, useState, useEffect } from "react";
import { useSchemas } from "../hooks/useSchemas";
import { useERD } from "../hooks/useERD";
import { useSelection } from "../hooks/useSelection";
import { useDebounce } from "../hooks/useDebounce";
import { useVirtualSchema } from "./VirtualSchemaContext";

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedRelationship, setHighlightedRelationship] = useState(null);
  const [routingMode] = useState('direct'); // Fixed to 'direct' stepped lines only
  const [crowsFootMode, setCrowsFootMode] = useState(false); // Toggle for crow's foot notation
  
  // Shared Edit Table Modal state
  const [sharedEditTableModal, setSharedEditTableModal] = useState({
    isOpen: false,
    tableName: null,
    schemaName: null
  });

  // Global modal state - tracks if any modal is open
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    selectedSchema,
    selectedTable,
    selectSchema,
    selectTable,
    clearSelection,
  } = useSelection();

  const {
    schemas,
    loading: schemasLoading,
    error: schemasError,
    refetch: refetchSchemas,
  } = useSchemas();
  const {
    erdData,
    loading: erdLoading,
    error: erdError,
    refetch: refetchERD,
  } = useERD(selectedSchema);

  // Virtual schema context
  const virtualSchema = useVirtualSchema();

  // Initialize virtual schema when ERD data loads
  useEffect(() => {
    if (erdData && !erdLoading && selectedSchema) {
      virtualSchema.initializeSchema(erdData);
    }
  }, [erdData, erdLoading, selectedSchema, virtualSchema.initializeSchema]);

  // Shared Edit Table Modal functions
  const openEditTableModal = (tableName, schemaName) => {
    setSharedEditTableModal({
      isOpen: true,
      tableName,
      schemaName
    });
    setIsAnyModalOpen(true);
  };

  const closeEditTableModal = () => {
    setSharedEditTableModal({
      isOpen: false,
      tableName: null,
      schemaName: null
    });
    setIsAnyModalOpen(false);
  };

  // Toggle crow's foot notation mode
  const toggleCrowsFootMode = () => {
    setCrowsFootMode(prev => !prev);
  };

  const value = {
    // Schemas
    schemas,
    schemasLoading,
    schemasError,
    refetchSchemas,

    // ERD Data (with race condition protection during schema switching)
    erdData: virtualSchema.isSwitchingSchema ? null : (virtualSchema.workingSchema || erdData),
    originalERDData: erdData,
    erdLoading: erdLoading || virtualSchema.isSwitchingSchema,
    erdError,
    refetchERD,

    // Virtual Schema
    ...virtualSchema,

    // Selection
    selectedSchema,
    selectedTable,
    selectSchema,
    selectTable,
    clearSelection,

    // Search
    searchQuery,
    setSearchQuery,
    debouncedSearch,

    // Relationship highlighting
    highlightedRelationship,
    setHighlightedRelationship,

    // Routing mode (fixed to direct)
    routingMode,

    // Crow's foot notation mode
    crowsFootMode,
    toggleCrowsFootMode,

    // Shared Edit Table Modal
    sharedEditTableModal,
    openEditTableModal,
    closeEditTableModal,

    // Global modal state
    isAnyModalOpen,
    setIsAnyModalOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
