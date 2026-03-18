import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSchemas } from '../hooks/useSchemas';
import { useERD } from '../hooks/useERD';
import { useSelection } from '../hooks/useSelection';
import { useDebounce } from '../hooks/useDebounce';
import { useVirtualSchema } from './VirtualSchemaContext';
import { useConnection } from './ConnectionContext';
import { useSchemaLocks } from '../hooks/useSchemaLocks';
import { revertFKChange } from '../utils/fkComparison';
import type { FKComparisonResult } from '../utils/fkComparison';
import { detectCircularDependencies } from '../utils/circularDependencyDetector';
import type {
  ERDData, Relationship, Notification, NotificationType,
  EditTableModalState, DatabaseChangesModalState,
  NewChangesModalState, UnsavedChangesModalState, OutOfSyncModalState,
  RelationshipDetailsModalState, RelationshipDeleteModalState, ExportPDFModalState,
  ApplicationOption, SchemaLocks, LockStatus, LoadingProgress,
} from '../types';

// ============================================================
// Context type
// ============================================================
export interface AppContextValue {
  selectedApplication: ApplicationOption;
  setSelectedApplication: (app: ApplicationOption) => void;
  reloadSchemasForApplication: (applicationUuid: string) => Promise<{ success: boolean; error?: string }>;
  isDynamicConnected: boolean;
  schemas: string[];
  schemasLoading: boolean;
  schemasError: string | null;
  schemasHasLoaded: boolean;
  refetchSchemas: () => Promise<string[]>;
  loadAllSchemasFirstTime: () => Promise<{ success: boolean; total: number; successCount: number; failCount: number }>;
  isLoadingAllSchemas: boolean;
  loadingProgress: LoadingProgress;
  schemaLocks: SchemaLocks;
  acquireSchemaLock: (schemaName: string) => Promise<{ success: boolean; lock?: { userDisplayName: string; lockedAt: string } }>;
  releaseSchemaLock: (schemaName: string) => Promise<{ success: boolean }>;
  isSchemaLockedByMe: (schemaName: string) => boolean;
  isSchemaLockedByOther: (schemaName: string) => boolean;
  refreshLocks: () => Promise<void>;
  erdData: ERDData | null;
  originalERDData: ERDData | null;
  erdLoading: boolean;
  erdError: string | null;
  refetchERD: () => Promise<void>;
  selectedSchema: string | null;
  selectedTable: string | null;
  selectSchema: (schemaName: string) => Promise<void>;
  selectTable: (tableName: string) => void;  clearSelection: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearch: string;
  highlightedRelationship: Relationship | null;
  setHighlightedRelationship: (rel: Relationship | null) => void;
  setHighlightedRelationshipWithTimer: (rel: Relationship | null) => void;
  highlightedNMRelationship: { table1: string; table2: string; junctionTable: string } | null;
  setHighlightedNMRelationship: (data: { table1: string; table2: string; junctionTable: string } | null) => void;
  setHighlightedNMRelationshipWithTimer: (data: { table1: string; table2: string; junctionTable: string } | null) => void;
  hoveredTable: string | null;
  hoverHighlightedRelationships: (Relationship & { highlightType: string; isTablePrimaryKey: boolean; isTableForeignKey: boolean })[];
  handleTableHover: (tableName: string) => void;
  handleTableHoverEnd: () => void;
  tablesInCircularDependency: string[];
  relationshipsInCircularDependency: Relationship[];
  routingMode: string;
  crowsFootMode: boolean;
  toggleCrowsFootMode: () => void;
  gridBackground: boolean;
  toggleGridBackground: () => void;
  sharedEditTableModal: EditTableModalState;
  openEditTableModal: (tableName: string, schemaName: string) => void;
  closeEditTableModal: () => void;
  registerEditTableModalRefresh: (cb: () => void) => void;
  fkComparisonModal: { isOpen: boolean; comparisonResult: FKComparisonResult | null };
  showFKComparison: (result: FKComparisonResult) => void;
  closeFKComparison: () => void;
  handleRevertFKChange: (tableName: string, columnName: string, changeType: 'added' | 'removed') => void;
  notifications: Notification[];
  showNotification: (message: string, type?: NotificationType) => void;
  removeNotification: (id: number) => void;
  deleteRelationships: (relationships: Relationship[]) => Promise<{ success: boolean; reason?: string; error?: string }>;
  relationshipDetailsModal: RelationshipDetailsModalState;
  openRelationshipDetailsModal: (relationships: Relationship[]) => void;
  closeRelationshipDetailsModal: () => void;
  relationshipDeleteModal: RelationshipDeleteModalState;
  openRelationshipDeleteModal: (relationships: Relationship[]) => void;
  closeRelationshipDeleteModal: () => void;
  exportPDFModal: ExportPDFModalState;
  openExportPDFModal: () => void;
  closeExportPDFModal: () => void;
  isAnyModalOpen: boolean;
  setIsAnyModalOpen: (v: boolean) => void;
  databaseChangesModal: DatabaseChangesModalState;
  checkForDatabaseChanges: (onComplete?: (() => void) | null, targetSchema?: string | null) => Promise<boolean>;
  handleDatabaseChangesRefresh: () => Promise<void>;
  closeDatabaseChangesModal: () => void;
  saveChangesWithDatabaseCheck: () => Promise<{ success: boolean; reason?: string }>;
  newChangesModal: NewChangesModalState;
  showNewChangesModal: () => void;
  closeNewChangesModal: () => void;
  handleRefreshFromNewChanges: () => Promise<void>;
  unsavedChangesModal: UnsavedChangesModalState;
  showUnsavedChangesModal: (targetSchema: string, onConfirm: () => void) => void;
  closeUnsavedChangesModal: () => void;
  handleSaveAndSwitch: () => void;
  handleDiscardAndSwitch: () => void;
  outOfSyncModal: OutOfSyncModalState;
  showOutOfSyncModal: () => void;
  closeOutOfSyncModal: () => void;
  handleRefreshFromOutOfSync: () => Promise<void>;
  togglePrimaryKey: (tableName: string, columnName: string) => void;
  toggleUnique: (tableName: string, columnName: string) => void;
  toggleNullable: (tableName: string, columnName: string) => void;
  [key: string]: unknown;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedRelationship, setHighlightedRelationship] = useState<Relationship | null>(null);

  const { isDynamicConnected, getDynamicPrefix, setDynamicSchemaCache } = useConnection();
  const connectionId: string | null = null;

  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoverHighlightedRelationships, setHoverHighlightedRelationships] = useState<
    (Relationship & { highlightType: string; isTablePrimaryKey: boolean; isTableForeignKey: boolean })[]
  >([]);

  const [highlightedNMRelationship, setHighlightedNMRelationship] = useState<{
    table1: string; table2: string; junctionTable: string;
  } | null>(null);
  const [nmHighlightTimer, setNMHighlightTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [highlightTimer, setHighlightTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [tablesInCircularDependency, setTablesInCircularDependency] = useState<string[]>([]);
  const [relationshipsInCircularDependency, setRelationshipsInCircularDependency] = useState<Relationship[]>([]);

  const [routingMode] = useState<string>('direct');
  const [crowsFootMode, setCrowsFootMode] = useState(false);
  const [gridBackground, setGridBackground] = useState(true);

  const [sharedEditTableModal, setSharedEditTableModal] = useState<EditTableModalState>({
    isOpen: false, tableName: null, schemaName: null,
  });
  const [editTableModalRefreshCallback, setEditTableModalRefreshCallback] = useState<(() => void) | null>(null);

  const [fkComparisonModal, setFkComparisonModal] = useState<{ isOpen: boolean; comparisonResult: FKComparisonResult | null }>({
    isOpen: false, comparisonResult: null,
  });

  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const [newChangesModal, setNewChangesModal] = useState<NewChangesModalState>({ isOpen: false });
  const [unsavedChangesModal, setUnsavedChangesModal] = useState<UnsavedChangesModalState>({
    isOpen: false, targetSchema: null, onConfirm: null,
  });
  const [outOfSyncModal, setOutOfSyncModal] = useState<OutOfSyncModalState>({ isOpen: false });

  const [selectedApplication, setSelectedApplication] = useState<ApplicationOption>(() => {
    const saved = sessionStorage.getItem('reverseERD_selectedApplication');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse saved application:', e); }
    }
    return { uuid: 'f487663908ebf11eabb6112c1e641f7d9', label: 'Info QA (dev)' };
  });

  useEffect(() => {
    if (selectedApplication) {
      sessionStorage.setItem('reverseERD_selectedApplication', JSON.stringify(selectedApplication));
    }
  }, [selectedApplication]);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now() + Math.random();
    const notification: Notification = { id, message, type };
    setNotifications((prev: Notification[]) => [...prev, notification]);
    if (type === 'success' || type === 'info') {
      setTimeout(() => removeNotification(id), 5000);
    }
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
  }, []);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { selectedSchema, selectedTable, selectSchema: originalSelectSchema, selectTable, clearSelection } = useSelection();

  const {
    schemas, loading: schemasLoading, error: schemasError, hasLoaded: schemasHasLoaded,
    refetch: refetchSchemas, setSchemas: setSchemasDirectly, resetHasLoaded: resetSchemasHasLoaded,
  } = useSchemas(false);

  const {
    schemaLocks, acquireLock: acquireSchemaLock, releaseLock: releaseSchemaLock,
    isLockedByMe: isSchemaLockedByMe, isLockedByOther: isSchemaLockedByOther, refreshLocks,
  } = useSchemaLocks(schemas);

  const { erdData, loading: erdLoading, error: erdError, refetch: refetchERD } = useERD(selectedSchema);

  const virtualSchema = useVirtualSchema();

  const [isLoadingAllSchemas, setIsLoadingAllSchemas] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ current: 0, total: 0 });

  const loadAllSchemasFirstTime = useCallback(async () => {
    setIsLoadingAllSchemas(true);
    setLoadingProgress({ current: 0, total: 0 });
    try {
      const schemaService = (await import('../services/schemaService')).default;
      const schemaList = await schemaService.getSchemas(selectedApplication.uuid);
      const erdService = (await import('../services/schemaErdService')).default;
      const { saveBaselineSchema } = await import('../utils/persistenceAdapter');
      const persistenceService = (await import('../services/persistenceService')).default;
      let successCount = 0; let failCount = 0;
      setLoadingProgress({ current: 0, total: schemaList.length });
      for (let i = 0; i < schemaList.length; i++) {
        const schemaName = schemaList[i];
        try {
          const erdDataResult = await erdService.getERDData(schemaName);
          await saveBaselineSchema(schemaName, erdDataResult, connectionId);
          await persistenceService.saveVirtualSchema(schemaName, erdDataResult);
          successCount++;
        } catch (error) {
          console.error(`Failed to load ${schemaName}:`, error);
          failCount++;
        }
        setLoadingProgress({ current: i + 1, total: schemaList.length });
      }
      setSchemasDirectly(schemaList);
      if (schemaList.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        originalSelectSchema(schemaList[0]);
      }
      return { success: true, total: schemaList.length, successCount, failCount };
    } catch (error) {
      console.error('Error loading schemas:', error);
      throw error;
    } finally {
      setIsLoadingAllSchemas(false);
    }
  }, [selectedApplication, connectionId, setSchemasDirectly, originalSelectSchema]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const token = sessionStorage.getItem('db_connection_token');
        if (token) {
          const schemaList = await refetchSchemas();
          if (schemaList && schemaList.length > 0) {
            setTimeout(() => originalSelectSchema(schemaList[0]), 100);
          }
          return;
        }
        const persistenceService = (await import('../services/persistenceService')).default;
        const schemaService = (await import('../services/schemaService')).default;
        const appSchemas = await schemaService.getSchemas(selectedApplication.uuid);
        const savedSchemas = await persistenceService.getSavedSchemas();
        const savedSchemaNames = savedSchemas.map((s: { schema_name: string }) => s.schema_name);
        const appSchemasInDB = appSchemas.filter((s: string) => savedSchemaNames.includes(s));
        if (appSchemasInDB.length > 0) {
          setSchemasDirectly(appSchemas.filter((s: string) => savedSchemaNames.includes(s)));
          const lastSelectedSchema = sessionStorage.getItem('reverseERD_lastSelectedSchema');
          const schemaToSelect = (lastSelectedSchema && appSchemasInDB.includes(lastSelectedSchema))
            ? lastSelectedSchema : appSchemasInDB[0];
          if (schemaToSelect) setTimeout(() => originalSelectSchema(schemaToSelect), 100);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    initializeApp();
  }, [selectedApplication.uuid]);

  useEffect(() => {
    const handleDynamicConnectionEnded = async (event: Event) => {
      const prefix = (event as CustomEvent).detail?.prefix;
      try {
        clearSelection();
        const persistenceService = (await import('../services/persistenceService')).default;
        const schemaService = (await import('../services/schemaService')).default;
        if (prefix) {
          const allSchemas = await persistenceService.getSavedSchemas();
          const dynamicSchemas = allSchemas.map((s: { schema_name: string }) => s.schema_name).filter((name: string) => name.startsWith(prefix));
          await Promise.allSettled(dynamicSchemas.map((name: string) => persistenceService.clearAllForSchema(name)));
        }
        const appSchemas = await schemaService.getSchemas(selectedApplication.uuid);
        const savedSchemas = await persistenceService.getSavedSchemas();
        const savedSchemaNames = savedSchemas.map((s: { schema_name: string }) => s.schema_name);
        const appSchemasInDB = appSchemas.filter((s: string) => savedSchemaNames.includes(s));
        if (appSchemasInDB.length > 0) {
          setSchemasDirectly(appSchemasInDB);
          setTimeout(() => originalSelectSchema(appSchemasInDB[0]), 100);
        } else {
          resetSchemasHasLoaded();
        }
      } catch (error) {
        console.error('Error restoring schemas after disconnect:', error);
      }
    };
    window.addEventListener('dynamic-connection-ended', handleDynamicConnectionEnded);
    return () => window.removeEventListener('dynamic-connection-ended', handleDynamicConnectionEnded);
  }, [selectedApplication.uuid]);

  const [databaseChangesModal, setDatabaseChangesModal] = useState<DatabaseChangesModalState>({
    isOpen: false, changes: null, isRefreshing: false, onComplete: null, targetSchema: null,
  });

  const checkForDatabaseChanges = useCallback(async (onComplete: (() => void) | null = null, targetSchema: string | null = null): Promise<boolean> => {
    const schemaToCheck = targetSchema || selectedSchema;
    if (!schemaToCheck) return false;
    try {
      const erdService = (await import('../services/schemaErdService')).default;
      const { detectDatabaseChanges } = await import('../utils/databaseChangeDetector');
      const { loadBaselineSchema } = await import('../utils/persistenceAdapter');
      const baselineKey = virtualSchema.connectionPrefix ? `${virtualSchema.connectionPrefix}${schemaToCheck}` : schemaToCheck;
      const baseline = await loadBaselineSchema(baselineKey, null);
      const currentRealDB = await erdService.getERDData(schemaToCheck);
      const changeResult = detectDatabaseChanges(baseline, currentRealDB);
      if (changeResult.isFirstLoad) {
        const { saveBaselineSchema } = await import('../utils/persistenceAdapter');
        await saveBaselineSchema(baselineKey, currentRealDB, null);
        return false;
      }
      if (changeResult.hasChanges) {
        setDatabaseChangesModal({ isOpen: true, changes: changeResult.changes, isRefreshing: false, onComplete, targetSchema: schemaToCheck });
        setIsAnyModalOpen(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking for database changes:', error);
      showNotification('Failed to check for database changes', 'error');
      return false;
    }
  }, [selectedSchema, showNotification, virtualSchema.connectionPrefix]);

  const handleDatabaseChangesRefresh = useCallback(async () => {
    const schemaToRefresh = databaseChangesModal.targetSchema || selectedSchema;
    if (!schemaToRefresh) return;
    setDatabaseChangesModal((prev: DatabaseChangesModalState) => ({ ...prev, isRefreshing: true }));
    try {
      const erdService = (await import('../services/schemaErdService')).default;
      const persistenceService = (await import('../services/persistenceService')).default;
      const currentRealDB = await erdService.getERDData(schemaToRefresh);
      if (schemaToRefresh === selectedSchema) {
        if (virtualSchema.setOriginalSchema) virtualSchema.setOriginalSchema(currentRealDB);
        if (virtualSchema.refreshAndMerge) {
          const mergedSchema = await virtualSchema.refreshAndMerge(currentRealDB);
          if (mergedSchema) {
            const persistenceKey = virtualSchema.connectionPrefix ? `${virtualSchema.connectionPrefix}${schemaToRefresh}` : schemaToRefresh;
            await persistenceService.saveVirtualSchema(persistenceKey, mergedSchema);
            const dbTimestamp = await persistenceService.getVirtualSchemaTimestamp(persistenceKey);
            if (dbTimestamp && virtualSchema.setLastSavedTimestamp) virtualSchema.setLastSavedTimestamp(dbTimestamp);
            if (virtualSchema.setHasUnsavedChanges) virtualSchema.setHasUnsavedChanges(false);
            if (isDynamicConnected) setDynamicSchemaCache(schemaToRefresh, currentRealDB);
          }
        }
      }
      const onComplete = databaseChangesModal.onComplete;
      setDatabaseChangesModal({ isOpen: false, changes: null, isRefreshing: false, onComplete: null, targetSchema: null });
      setIsAnyModalOpen(false);
      showNotification('Database changes synchronized successfully', 'success');
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error refreshing database changes:', error);
      showNotification('Failed to refresh database changes', 'error');
      setDatabaseChangesModal((prev: DatabaseChangesModalState) => ({ ...prev, isRefreshing: false }));
    }
  }, [selectedSchema, virtualSchema, databaseChangesModal.onComplete, databaseChangesModal.targetSchema, showNotification, isDynamicConnected, setDynamicSchemaCache]);

  const showOutOfSyncModal = useCallback(() => { setOutOfSyncModal({ isOpen: true }); setIsAnyModalOpen(true); }, []);
  const closeOutOfSyncModal = useCallback(() => { setOutOfSyncModal({ isOpen: false }); setIsAnyModalOpen(false); }, []);
  const handleRefreshFromOutOfSync = useCallback(async () => {
    const refreshed = await virtualSchema.refreshFromPersistence?.();
    showNotification(refreshed ? 'Schema refreshed. Your changes were discarded.' : 'Failed to refresh schema', refreshed ? 'info' : 'error');
    closeOutOfSyncModal();
  }, [virtualSchema, showNotification, closeOutOfSyncModal]);

  const openEditTableModal = useCallback((tableName: string, schemaName: string) => {
    if (isSchemaLockedByOther(schemaName || selectedSchema || '')) {
      const lockInfo = schemaLocks[schemaName || selectedSchema || ''];
      showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'}`, 'error');
      return;
    }
    setSharedEditTableModal({ isOpen: true, tableName, schemaName });
    setIsAnyModalOpen(true);
  }, [isSchemaLockedByOther, schemaLocks, selectedSchema, showNotification]);

  const closeEditTableModal = () => {
    setSharedEditTableModal({ isOpen: false, tableName: null, schemaName: null });
    setIsAnyModalOpen(false);
    setEditTableModalRefreshCallback(null);
  };

  const registerEditTableModalRefresh = (refreshCallback: () => void) => {
    setEditTableModalRefreshCallback(() => refreshCallback);
  };

  const showFKComparison = (comparisonResult: FKComparisonResult) => {
    setFkComparisonModal({ isOpen: true, comparisonResult });
    setIsAnyModalOpen(true);
  };

  const closeFKComparison = () => {
    setFkComparisonModal({ isOpen: false, comparisonResult: null });
    setIsAnyModalOpen(false);
  };

  const handleRevertFKChange = (tableName: string, columnName: string, changeType: 'added' | 'removed') => {
    try {
      const updatedSchema = revertFKChange(virtualSchema.workingSchema!, tableName, columnName, changeType, virtualSchema.originalSchema!);
      virtualSchema.updateWorkingSchema(updatedSchema);
      if (editTableModalRefreshCallback && sharedEditTableModal.isOpen && sharedEditTableModal.tableName === tableName) {
        editTableModalRefreshCallback();
      }
      showNotification(`Foreign key change reverted for ${tableName}.${columnName}`, 'success');
      if (fkComparisonModal.comparisonResult) {
        const updatedResult = { ...fkComparisonModal.comparisonResult };
        const tableChanges = updatedResult.changes[tableName];
        if (tableChanges) {
          if (changeType === 'added') tableChanges.added = tableChanges.added.filter((c: { columnName: string }) => c.columnName !== columnName);
          else if (changeType === 'removed') tableChanges.removed = tableChanges.removed.filter((c: { columnName: string }) => c.columnName !== columnName);
          if (tableChanges.added.length === 0 && tableChanges.removed.length === 0) {
            delete updatedResult.changes[tableName];
            updatedResult.affectedTables = updatedResult.affectedTables.filter((t: string) => t !== tableName);
          }
          updatedResult.hasChanges = Object.keys(updatedResult.changes).length > 0;
          if (!updatedResult.hasChanges) closeFKComparison();
          else setFkComparisonModal((prev: { isOpen: boolean; comparisonResult: FKComparisonResult | null }) => ({ ...prev, comparisonResult: updatedResult }));
        }
      }
    } catch (error) {
      console.error('Error reverting FK change:', error);
      showNotification(`Error reverting change: ${(error as Error).message}`, 'error');
    }
  };

  const handleTableHover = (tableName: string) => {
    if (debouncedSearch && debouncedSearch.includes('.')) return;
    const currentSchema = virtualSchema.workingSchema || erdData;
    if (!currentSchema?.relationships) { setHoveredTable(null); setHoverHighlightedRelationships([]); return; }
    setHoveredTable(tableName);
    const relatedRelationships = currentSchema.relationships.filter((rel: Relationship) => rel.fromTable === tableName || rel.toTable === tableName);
    setHoverHighlightedRelationships(relatedRelationships.map((rel: Relationship) => ({
      ...rel,
      highlightType: rel.fromTable === tableName ? 'primary' : 'foreign',
      isTablePrimaryKey: rel.fromTable === tableName,
      isTableForeignKey: rel.toTable === tableName,
    })));
  };

  const handleTableHoverEnd = () => { setHoveredTable(null); setHoverHighlightedRelationships([]); };

  const setHighlightedRelationshipWithTimer = (relationshipData: Relationship | null) => {
    if (highlightTimer) { clearTimeout(highlightTimer); setHighlightTimer(null); }
    if (relationshipData && nmHighlightTimer) { clearTimeout(nmHighlightTimer); setNMHighlightTimer(null); setHighlightedNMRelationship(null); }
    setHighlightedRelationship(relationshipData);
    if (relationshipData) {
      const newTimer = setTimeout(() => { setHighlightedRelationship(null); setHighlightTimer(null); }, 4000);
      setHighlightTimer(newTimer);
    }
  };

  const setHighlightedNMRelationshipWithTimer = (nmData: { table1: string; table2: string; junctionTable: string } | null) => {
    if (nmHighlightTimer) { clearTimeout(nmHighlightTimer); setNMHighlightTimer(null); }
    if (nmData && highlightTimer) { clearTimeout(highlightTimer); setHighlightTimer(null); setHighlightedRelationship(null); }
    setHighlightedNMRelationship(nmData);
    if (nmData) {
      const newTimer = setTimeout(() => { setHighlightedNMRelationship(null); setNMHighlightTimer(null); }, 5000);
      setNMHighlightTimer(newTimer);
    }
  };

  useEffect(() => {
    return () => {
      if (highlightTimer) clearTimeout(highlightTimer);
      if (nmHighlightTimer) clearTimeout(nmHighlightTimer);
    };
  }, [highlightTimer, nmHighlightTimer]);

  useEffect(() => {
    if (nmHighlightTimer) { clearTimeout(nmHighlightTimer); setNMHighlightTimer(null); }
    setHighlightedNMRelationship(null);
  }, [selectedSchema]);

  useEffect(() => {
    const currentSchema = virtualSchema.workingSchema || erdData;
    if (currentSchema?.relationships) {
      const circularDeps = detectCircularDependencies(currentSchema.relationships);
      setTablesInCircularDependency(circularDeps.tables);
      setRelationshipsInCircularDependency(circularDeps.relationships);
    } else {
      setTablesInCircularDependency([]);
      setRelationshipsInCircularDependency([]);
    }
  }, [virtualSchema.workingSchema, erdData]);

  const toggleCrowsFootMode = () => setCrowsFootMode((prev: boolean) => !prev);
  const toggleGridBackground = () => setGridBackground((prev: boolean) => !prev);
  const closeDatabaseChangesModal = useCallback(() => {}, []);

  const saveChangesWithDatabaseCheck = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (isSchemaLockedByOther(selectedSchema || '')) {
      const lockInfo = schemaLocks[selectedSchema || ''];
      showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot save`, 'error');
      return { success: false, reason: 'schema_locked' };
    }
    const hasDbChanges = await checkForDatabaseChanges(() => { actuallySaveChanges(); });
    if (hasDbChanges) return { success: false, reason: 'database_changes_detected' };
    return await actuallySaveChanges();
  }, [checkForDatabaseChanges, isSchemaLockedByOther, schemaLocks, selectedSchema, showNotification]);

  const actuallySaveChanges = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (virtualSchema.saveChangesToPersistence) {
      const result = await virtualSchema.saveChangesToPersistence();
      if (result.success) showNotification('Changes saved successfully!', 'success');
      else if (result.reason === 'conflict') showOutOfSyncModal();
      else if (result.reason === 'no_changes') showNotification('No changes to save', 'info');
      else showNotification('Failed to save changes', 'error');
      return result;
    }
    return { success: false, reason: 'no_save_function' };
  }, [virtualSchema, showNotification, showOutOfSyncModal]);

  useEffect(() => {
    if (erdData && !erdLoading && selectedSchema) {
      if (erdData.schemaName !== selectedSchema) return;
      const connId = isDynamicConnected ? getDynamicPrefix() : null;
      virtualSchema.initializeSchema(erdData, connId, true);
    }
  }, [erdData, erdLoading, selectedSchema, virtualSchema.initializeSchema]);

  const showNewChangesModal = useCallback(() => { setNewChangesModal({ isOpen: true }); setIsAnyModalOpen(true); }, []);
  const closeNewChangesModal = useCallback(() => { setNewChangesModal({ isOpen: false }); setIsAnyModalOpen(false); }, []);
  const handleRefreshFromNewChanges = useCallback(async () => {
    const refreshed = await virtualSchema.refreshFromPersistence?.();
    showNotification(refreshed ? 'Changes refreshed successfully!' : 'Failed to refresh changes', refreshed ? 'success' : 'error');
    closeNewChangesModal();
  }, [virtualSchema, showNotification, closeNewChangesModal]);

  const showUnsavedChangesModal = useCallback((targetSchema: string, onConfirm: () => void) => {
    setUnsavedChangesModal({ isOpen: true, targetSchema, onConfirm });
    setIsAnyModalOpen(true);
  }, []);

  const closeUnsavedChangesModal = useCallback(() => {
    setUnsavedChangesModal({ isOpen: false, targetSchema: null, onConfirm: null });
    setIsAnyModalOpen(false);
  }, []);

  const handleSaveAndSwitch = useCallback(() => {
    virtualSchema.saveChangesToPersistence?.();
    showNotification('Changes saved successfully!', 'success');
    if (unsavedChangesModal.onConfirm) unsavedChangesModal.onConfirm();
    closeUnsavedChangesModal();
  }, [virtualSchema, showNotification, unsavedChangesModal.onConfirm, closeUnsavedChangesModal]);

  const handleDiscardAndSwitch = useCallback(() => {
    if (unsavedChangesModal.onConfirm) unsavedChangesModal.onConfirm();
    closeUnsavedChangesModal();
  }, [unsavedChangesModal.onConfirm, closeUnsavedChangesModal]);

  const selectSchema = useCallback(async (schemaName: string) => {
    if (selectedSchema && schemaName !== selectedSchema && virtualSchema.hasUnsavedChanges) {
      showUnsavedChangesModal(schemaName, () => originalSelectSchema(schemaName));
    } else {
      originalSelectSchema(schemaName);
    }
  }, [selectedSchema, virtualSchema.hasUnsavedChanges, originalSelectSchema, showUnsavedChangesModal]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (virtualSchema.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [virtualSchema.hasUnsavedChanges]);

  const [relationshipDetailsModal, setRelationshipDetailsModal] = useState<RelationshipDetailsModalState>({ isOpen: false, relationships: [] });
  const [relationshipDeleteModal, setRelationshipDeleteModal] = useState<RelationshipDeleteModalState>({ isOpen: false, relationships: [] });
  const [exportPDFModal, setExportPDFModal] = useState<ExportPDFModalState>({ isOpen: false });

  const openRelationshipDetailsModal = (relationships: Relationship[]) => { setRelationshipDetailsModal({ isOpen: true, relationships }); setIsAnyModalOpen(true); };
  const closeRelationshipDetailsModal = () => { setRelationshipDetailsModal({ isOpen: false, relationships: [] }); setIsAnyModalOpen(false); };
  const openRelationshipDeleteModal = (relationships: Relationship[]) => { setRelationshipDeleteModal({ isOpen: true, relationships }); setIsAnyModalOpen(true); };
  const closeRelationshipDeleteModal = () => { setRelationshipDeleteModal({ isOpen: false, relationships: [] }); setIsAnyModalOpen(false); };
  const openExportPDFModal = () => { setExportPDFModal({ isOpen: true }); setIsAnyModalOpen(true); };
  const closeExportPDFModal = () => { setExportPDFModal({ isOpen: false }); setIsAnyModalOpen(false); };

  const deleteRelationships = async (relationships: Relationship[]): Promise<{ success: boolean; reason?: string; error?: string }> => {
    if (isDynamicConnected) { showNotification('Connected to a dynamic database — view only, cannot delete relationships', 'error'); return { success: false, reason: 'dynamic_connection_read_only' }; }
    if (isSchemaLockedByOther(selectedSchema || '')) {
      const lockInfo = schemaLocks[selectedSchema || ''];
      showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot delete relationships`, 'error');
      return { success: false, reason: 'schema_locked' };
    }
    try {
      const junctionTables = new Set<string>();
      relationships.forEach(rel => { if (rel.isJunctionRelationship && rel.junctionTable) junctionTables.add(rel.junctionTable); });
      let allRelationshipsToDelete = [...relationships];
      if (junctionTables.size > 0) {
        junctionTables.forEach(junctionTable => {
          const junctionRels = (virtualSchema.workingSchema?.relationships ?? []).filter((rel: Relationship) => rel.fromTable === junctionTable || rel.toTable === junctionTable);
          junctionRels.forEach((rel: Relationship) => {
            if (!allRelationshipsToDelete.find(r => r.fromTable === rel.fromTable && r.fromColumn === rel.fromColumn && r.toTable === rel.toTable && r.toColumn === rel.toColumn)) {
              allRelationshipsToDelete.push(rel);
            }
          });
        });
      }
      const response = await fetch(`${(import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL || 'http://localhost:4001/api'}/schemas/${selectedSchema}/relationships`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationships: allRelationshipsToDelete, junctionTables: Array.from(junctionTables) }),
      });
      if (!response.ok) throw new Error('Failed to delete relationships');
      if (virtualSchema.workingSchema) {
        const ws = virtualSchema.workingSchema;
        const updatedSchema = {
          ...ws,
          relationships: ws.relationships.filter((rel: Relationship) =>
            !allRelationshipsToDelete.some(delRel => rel.fromTable === delRel.fromTable && rel.fromColumn === delRel.fromColumn && rel.toTable === delRel.toTable && rel.toColumn === delRel.toColumn)
          ),
          tables: { ...ws.tables },
        };
        allRelationshipsToDelete.forEach(rel => {
          if (updatedSchema.tables[rel.fromTable]) {
            const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
            if (column) {
              const existsInOriginalDB = virtualSchema.originalSchema?.tables?.[rel.fromTable]?.columns?.[rel.fromColumn];
              if (column.isUserCreated && !existsInOriginalDB) delete updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
              else updatedSchema.tables[rel.fromTable].columns[rel.fromColumn] = { ...column, fk: false };
            }
          }
        });
        junctionTables.forEach(junctionTable => { if (updatedSchema.tables[junctionTable]) delete updatedSchema.tables[junctionTable]; });
        virtualSchema.updateWorkingSchema(updatedSchema);
      }
      const count = allRelationshipsToDelete.length;
      const junctionMsg = junctionTables.size > 0 ? ` and ${junctionTables.size} junction table${junctionTables.size > 1 ? 's' : ''}` : '';
      showNotification(`${count} relationship${count > 1 ? 's' : ''} deleted successfully${junctionMsg}.`, 'success');
      return { success: true };
    } catch (error) {
      console.error('Error deleting relationships:', error);
      showNotification('Failed to delete relationships: ' + (error as Error).message, 'error');
      return { success: false, error: (error as Error).message };
    }
  };

  const togglePrimaryKey = useCallback((tableName: string, columnName: string) => {
    if (isDynamicConnected) { showNotification('Connected to a dynamic database — view only, cannot edit constraints', 'error'); return; }
    if (isSchemaLockedByOther(selectedSchema || '')) { const lockInfo = schemaLocks[selectedSchema || '']; showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot edit constraints`, 'error'); return; }
    virtualSchema.togglePrimaryKey(tableName, columnName);
  }, [isDynamicConnected, isSchemaLockedByOther, schemaLocks, selectedSchema, showNotification, virtualSchema]);

  const toggleUnique = useCallback((tableName: string, columnName: string) => {
    if (isDynamicConnected) { showNotification('Connected to a dynamic database — view only, cannot edit constraints', 'error'); return; }
    if (isSchemaLockedByOther(selectedSchema || '')) { const lockInfo = schemaLocks[selectedSchema || '']; showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot edit constraints`, 'error'); return; }
    virtualSchema.toggleUnique(tableName, columnName);
  }, [isDynamicConnected, isSchemaLockedByOther, schemaLocks, selectedSchema, showNotification, virtualSchema]);

  const toggleNullable = useCallback((tableName: string, columnName: string) => {
    if (isDynamicConnected) { showNotification('Connected to a dynamic database — view only, cannot edit constraints', 'error'); return; }
    if (isSchemaLockedByOther(selectedSchema || '')) { const lockInfo = schemaLocks[selectedSchema || '']; showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot edit constraints`, 'error'); return; }
    virtualSchema.toggleNullable(tableName, columnName);
  }, [isDynamicConnected, isSchemaLockedByOther, schemaLocks, selectedSchema, showNotification, virtualSchema]);

  const reloadSchemasForApplication = useCallback(async (applicationUuid: string): Promise<{ success: boolean; error?: string }> => {
    try {
      clearSelection();
      const schemaService = (await import('../services/schemaService')).default;
      const persistenceService = (await import('../services/persistenceService')).default;
      const appSchemas = await schemaService.getSchemas(applicationUuid);
      const savedSchemas = await persistenceService.getSavedSchemas();
      const savedSchemaNames = savedSchemas.map((s: { schema_name: string }) => s.schema_name);
      const appSchemasInDB = appSchemas.filter((s: string) => savedSchemaNames.includes(s));
      if (appSchemasInDB.length > 0) {
        setSchemasDirectly(appSchemasInDB);
        setTimeout(() => originalSelectSchema(appSchemasInDB[0]), 100);
      } else {
        resetSchemasHasLoaded();
      }
      return { success: true };
    } catch (error) {
      console.error('Error reloading schemas:', error);
      showNotification('Failed to reload schemas', 'error');
      return { success: false, error: (error as Error).message };
    }
  }, [setSchemasDirectly, resetSchemasHasLoaded, originalSelectSchema, clearSelection, showNotification]);

  const value: AppContextValue = {
    selectedApplication, setSelectedApplication, reloadSchemasForApplication, isDynamicConnected,
    schemas, schemasLoading, schemasError, schemasHasLoaded, refetchSchemas,
    loadAllSchemasFirstTime, isLoadingAllSchemas, loadingProgress,
    schemaLocks, acquireSchemaLock, releaseSchemaLock, isSchemaLockedByMe, isSchemaLockedByOther, refreshLocks,
    erdData: (() => {
      if (virtualSchema.isSwitchingSchema) return null;
      if (virtualSchema.workingSchema) return virtualSchema.workingSchema;
      return erdData;
    })(),
    originalERDData: erdData,
    erdLoading: erdLoading || virtualSchema.isSwitchingSchema,
    erdError, refetchERD,
    ...virtualSchema,
    togglePrimaryKey, toggleUnique, toggleNullable,
    selectedSchema, selectedTable, selectSchema, selectTable, clearSelection,
    searchQuery, setSearchQuery, debouncedSearch,
    highlightedRelationship, setHighlightedRelationship, setHighlightedRelationshipWithTimer,
    highlightedNMRelationship, setHighlightedNMRelationship, setHighlightedNMRelationshipWithTimer,
    hoveredTable, hoverHighlightedRelationships, handleTableHover, handleTableHoverEnd,
    tablesInCircularDependency, relationshipsInCircularDependency,
    routingMode, crowsFootMode, toggleCrowsFootMode, gridBackground, toggleGridBackground,
    sharedEditTableModal, openEditTableModal, closeEditTableModal, registerEditTableModalRefresh,
    fkComparisonModal, showFKComparison, closeFKComparison, handleRevertFKChange,
    notifications, showNotification, removeNotification,
    deleteRelationships,
    relationshipDetailsModal, openRelationshipDetailsModal, closeRelationshipDetailsModal,
    relationshipDeleteModal, openRelationshipDeleteModal, closeRelationshipDeleteModal,
    exportPDFModal, openExportPDFModal, closeExportPDFModal,
    isAnyModalOpen, setIsAnyModalOpen,
    databaseChangesModal, checkForDatabaseChanges, handleDatabaseChangesRefresh, closeDatabaseChangesModal,
    saveChangesWithDatabaseCheck,
    newChangesModal, showNewChangesModal, closeNewChangesModal, handleRefreshFromNewChanges,
    unsavedChangesModal, showUnsavedChangesModal, closeUnsavedChangesModal, handleSaveAndSwitch, handleDiscardAndSwitch,
    outOfSyncModal, showOutOfSyncModal, closeOutOfSyncModal, handleRefreshFromOutOfSync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
