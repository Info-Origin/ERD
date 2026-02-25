import { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiRotateCcw, FiPlus, FiMinus, FiCheck, FiInfo } from 'react-icons/fi';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ConfirmationModal } from './ConfirmationModal';
import { BADGE_VARIANTS } from '../../utils/constants';
import { formatDataTypeForDisplay } from '../../utils/dataTypeFormatter';
import { compareForeignKeys } from '../../utils/fkComparison';
import './FKComparisonModal.css';

export const FKComparisonModal = ({ 
  isOpen, 
  onClose, 
  comparisonResult,
  baselineSchema,
  virtualSchema,
  onRevertChange
}) => {
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    tableName: null,
    columnName: null,
    changeType: null
  });
  const [currentComparison, setCurrentComparison] = useState(comparisonResult);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update comparison when props change
  useEffect(() => {
    setCurrentComparison(comparisonResult);
  }, [comparisonResult]);

  // Real-time comparison refresh when modal is open
  useEffect(() => {
    if (!isOpen || !baselineSchema || !virtualSchema) return;

    const refreshComparison = () => {
      try {
        setIsRefreshing(true);
        const freshComparison = compareForeignKeys(baselineSchema, virtualSchema);
        setCurrentComparison(freshComparison);
        
        // If no changes remain, close modal after a short delay
        if (!freshComparison.hasChanges) {
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } catch (error) {
        console.warn('Failed to refresh FK comparison:', error);
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    };

    // Initial refresh
    refreshComparison();

    // Set up interval for real-time updates
    const refreshInterval = setInterval(refreshComparison, 2000); // 2 second interval

    return () => clearInterval(refreshInterval);
  }, [isOpen, baselineSchema, virtualSchema]);

  if (!isOpen || !currentComparison?.hasChanges) return null;

  const { changes, affectedTables } = currentComparison;
  const isMultipleTables = affectedTables.length > 1;

  const toggleTableExpansion = (tableName) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleUndoClick = (tableName, columnName, changeType) => {
    setConfirmModal({
      isOpen: true,
      tableName,
      columnName,
      changeType,
      isNM: false
    });
  };

  const handleUndoNM = (junctionTable, table1, table2) => {
    setConfirmModal({
      isOpen: true,
      junctionTable,
      table1,
      table2,
      isNM: true
    });
  };

  const handleConfirmUndo = () => {
    if (confirmModal.isNM) {
      // Delete entire junction table for N:M relationship
      onRevertChange(confirmModal.junctionTable, null, 'added');
    } else {
      // Regular FK undo
      const { tableName, columnName, changeType } = confirmModal;
      onRevertChange(tableName, columnName, changeType);
    }
    setConfirmModal({ isOpen: false, tableName: null, columnName: null, changeType: null, isNM: false });
  };

  const handleCancelUndo = () => {
    setConfirmModal({ isOpen: false, tableName: null, columnName: null, changeType: null });
  };

  const renderColumnRow = (change, tableName, isBaseline = false) => {
    const { columnName, columnData, relationship, type, nmMetadata } = change;
    const isAdded = type === 'added';
    const isRemoved = type === 'removed';
    const isSynced = type === 'synced';
    const isUnchanged = type === 'baseline' || type === 'virtual';
    const isNM = nmMetadata?.isNM;

    // Determine the styling class
    let className = 'fk-comparison-column';
    if (isAdded) {
      className += ' fk-added';
    } else if (isRemoved) {
      className += ' fk-removed';
    } else if (isSynced) {
      className += ' fk-synced';
    } else {
      className += ' fk-unchanged';
    }

    // Add N:M class if applicable
    if (isNM) {
      className += ' fk-nm-relationship';
    }

    return (
      <div key={`${tableName}-${columnName}-${type}`} className={className}>
        <div className="fk-column-info">
          <div className="fk-column-header">
            <div className="fk-change-indicator">
              {isAdded && <FiPlus className="fk-added-icon" />}
              {isRemoved && <FiMinus className="fk-removed-icon" />}
              {isSynced && <FiCheck className="fk-synced-icon" />}
              {isUnchanged && <div className="fk-unchanged-icon">•</div>}
            </div>
            <span className="fk-column-name">{columnName}</span>
            <span className="fk-column-type">{formatDataTypeForDisplay(columnData.type)}</span>
            <div className="fk-column-badges">
              {columnData.fk && (
                <Badge variant={BADGE_VARIANTS.FK} className="constraint-badge-readonly">FK</Badge>
              )}
              {columnData.pk && (
                <Badge variant={BADGE_VARIANTS.PK} className="constraint-badge-readonly">PK</Badge>
              )}
              {isNM && (
                <Badge variant="info" className="constraint-badge-readonly fk-nm-badge">N:M</Badge>
              )}
              {columnData.unique && (
                <Badge variant={BADGE_VARIANTS.UNIQUE} className="constraint-badge-readonly">UQ</Badge>
              )}
              {!columnData.nullable && (
                <Badge variant={BADGE_VARIANTS.NOT_NULL} className="constraint-badge-readonly">NN</Badge>
              )}
            </div>
          </div>
          {relationship && (
            <div className="fk-relationship-info">
              <span className="fk-relationship-text">
                References: <strong>{relationship.toTable}.{relationship.toColumn}</strong>
              </span>
            </div>
          )}
          {isNM && nmMetadata && (
            <div className="fk-nm-info">
              <span className="fk-nm-text">
                Part of: <strong>{nmMetadata.displayName}</strong> (via {nmMetadata.junctionTable})
              </span>
            </div>
          )}
          {isSynced && (
            <div className="fk-synced-message">
              <span className="fk-synced-text">
                This foreign key has already been applied to the database manually.
              </span>
            </div>
          )}
        </div>
        <div className="fk-column-actions">
          {(isAdded || isRemoved) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isNM) {
                  // For N:M relationships, delete entire junction table
                  handleUndoNM(nmMetadata.junctionTable, nmMetadata.table1, nmMetadata.table2);
                } else {
                  // Regular FK undo
                  handleUndoClick(tableName, columnName, type);
                }
              }}
              className="fk-undo-button"
              title={isNM ? `Remove entire N:M relationship (${nmMetadata.displayName})` : `Undo ${isAdded ? 'addition' : 'removal'} of foreign key`}
            >
              <FiRotateCcw />
              {isNM ? 'Remove N:M' : 'Undo'}
            </Button>
          )}
          {isSynced && (
            <div className="fk-synced-indicator" title="This change has been applied externally">
              <FiInfo className="fk-info-icon" />
              <span>Synced</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to get all FKs for a schema side (baseline or virtual)
  const getAllFKsForSide = (tableChanges, isBaseline) => {
    const allFKs = [];

    if (isBaseline) {
      // For baseline (left side): show ALL FKs that exist in actual database
      // Include unchanged FKs (gray) AND removed FKs (gray) - show everything from actual DB
      tableChanges.baselineFKs.forEach(fk => {
        allFKs.push(fk);
      });
    } else {
      // For virtual (right side): show all FKs from virtual schema + removed FKs + synced FKs
      // Include unchanged FKs (gray), added FKs (green), synced FKs (blue), and removed FKs (red)
      tableChanges.virtualFKs.forEach(fk => {
        // Check if this FK was added in virtual schema
        const wasAdded = tableChanges.added.some(added => added.columnName === fk.columnName);
        // Check if this FK was synced
        const wasSynced = tableChanges.synced.some(synced => synced.columnName === fk.columnName);

        if (wasAdded) {
          // Show as added (green with undo button)
          const addedFK = tableChanges.added.find(added => added.columnName === fk.columnName);
          allFKs.push(addedFK);
        } else if (wasSynced) {
          // Show as synced (blue with info indicator)
          const syncedFK = tableChanges.synced.find(synced => synced.columnName === fk.columnName);
          allFKs.push(syncedFK);
        } else {
          // Show as unchanged (gray)
          allFKs.push(fk);
        }
      });

      // Add removed FKs to virtual side (right panel) with red highlighting
      tableChanges.removed.forEach(removedFK => {
        allFKs.push(removedFK);
      });
    }

    return allFKs;
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content fk-comparison-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Foreign Key Changes Detected</h2>
            <button id="fk-comparison-modal-close" className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            <div className="fk-comparison-summary">
              <p className="fk-summary-text">
                Foreign key changes detected across {affectedTables.length} table(s). Review the changes below and use the Undo/Remove button to revert specific changes.
              </p>
            </div>

            {isMultipleTables ? (
              <div className="fk-comparison-multi-table">
                <div className="fk-tables-list">
                  {affectedTables.map(tableName => {
                    const tableChanges = changes[tableName];
                    const isExpanded = expandedTables.has(tableName);
                    const totalChanges = tableChanges.added.length + tableChanges.removed.length + tableChanges.synced.length;

                    return (
                      <div key={tableName} className="fk-table-section">
                        <div 
                          className="fk-table-row"
                          onClick={() => toggleTableExpansion(tableName)}
                        >
                          <div className="fk-table-expand">
                            {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                          </div>
                          <div className="fk-table-info">
                            <span className="fk-table-name">{tableName}</span>
                            <span className="fk-table-summary">
                              {tableChanges.added.length > 0 && (
                                <span className="fk-added-count">+{tableChanges.added.length}</span>
                              )}
                              {tableChanges.removed.length > 0 && (
                                <span className="fk-removed-count">-{tableChanges.removed.length}</span>
                              )}
                              <span className="fk-total-count">({totalChanges} total)</span>
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="fk-table-details">
                            <div className="fk-comparison-panels">
                              <div className="fk-panel fk-baseline-panel">
                                <h5 className="fk-panel-subtitle">Actual Database Schema</h5>
                                <div className="fk-columns-list">
                                  {getAllFKsForSide(tableChanges, true).map(change => 
                                    renderColumnRow(change, tableName, true)
                                  )}
                                  {getAllFKsForSide(tableChanges, true).length === 0 && (
                                    <div className="fk-no-changes">No foreign keys in actual database</div>
                                  )}
                                </div>
                              </div>

                              <div className="fk-panel fk-virtual-panel">
                                <h5 className="fk-panel-subtitle">Virtual Schema</h5>
                                <div className="fk-columns-list">
                                  {getAllFKsForSide(tableChanges, false).map(change => 
                                    renderColumnRow(change, tableName, false)
                                  )}
                                  {getAllFKsForSide(tableChanges, false).length === 0 && (
                                    <div className="fk-no-changes">No foreign keys in virtual schema</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="fk-comparison-single-table">
                <div className="fk-table-header">
                  <h3 className="fk-table-name">{affectedTables[0]}</h3>
                  <span className="fk-change-count">
                    {changes[affectedTables[0]].added.length + changes[affectedTables[0]].removed.length + changes[affectedTables[0]].synced.length} change(s)
                  </span>
                </div>

                <div className="fk-comparison-panels">
                  <div className="fk-panel fk-baseline-panel">
                    <h4 className="fk-panel-title">Actual Database Schema</h4>
                    <div className="fk-columns-list">
                      {getAllFKsForSide(changes[affectedTables[0]], true).map(change => 
                        renderColumnRow(change, affectedTables[0], true)
                      )}
                      {getAllFKsForSide(changes[affectedTables[0]], true).length === 0 && (
                        <div className="fk-no-changes">No foreign keys in actual database</div>
                      )}
                    </div>
                  </div>

                  <div className="fk-panel fk-virtual-panel">
                    <h4 className="fk-panel-title">Virtual Schema</h4>
                    <div className="fk-columns-list">
                      {getAllFKsForSide(changes[affectedTables[0]], false).map(change => 
                        renderColumnRow(change, affectedTables[0], false)
                      )}
                      {getAllFKsForSide(changes[affectedTables[0]], false).length === 0 && (
                        <div className="fk-no-changes">No foreign keys in virtual schema</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {/* <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                const freshComparison = compareForeignKeys(baselineSchema, virtualSchema);
                setCurrentComparison(freshComparison);
                console.log('Manual refresh triggered:', freshComparison);
              }}
              title="Manually refresh comparison"
            >
              🔄 Refresh
            </Button> */}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={handleCancelUndo}
        onConfirm={handleConfirmUndo}
        title={confirmModal.isNM ? "Remove N:M Relationship" : "Confirm Undo"}
        message={
          confirmModal.isNM 
            ? `Are you sure you want to remove the entire N:M relationship between "${confirmModal.table1}" and "${confirmModal.table2}"? This will delete the junction table "${confirmModal.junctionTable}" and both foreign key relationships.`
            : `Are you sure you want to undo the ${confirmModal.changeType === 'added' ? 'addition' : 'removal'} of foreign key "${confirmModal.columnName}" in table "${confirmModal.tableName}"?`
        }
        confirmText="Yes, Remove"
        cancelText="Cancel"
        variant="primary"
      />
    </>
  );
};