import { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiRotateCcw, FiPlus, FiMinus, FiCheck, FiInfo } from 'react-icons/fi';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ConfirmationModal } from './ConfirmationModal';
import { BADGE_VARIANTS } from '../../utils/constants';
import { formatDataTypeForDisplay } from '../../utils/dataTypeFormatter';
import { compareForeignKeys } from '../../utils/fkComparison';
import type { ERDData } from '../../types';
import type { FKComparisonResult } from '../../utils/fkComparison';
import './FKComparisonModal.css';

interface FKComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonResult: FKComparisonResult | null;
  baselineSchema: ERDData | null;
  virtualSchema: ERDData | null;
  onRevertChange: (tableName: string, columnName: string, changeType: 'added' | 'removed') => void;
  hasUnsavedChanges?: boolean;
}

export const FKComparisonModal = ({ isOpen, onClose, comparisonResult, baselineSchema, virtualSchema, onRevertChange }: FKComparisonModalProps) => {
  const [expandedTables, setExpandedTables] = useState(new Set<string>());
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; tableName?: string; columnName?: string; changeType?: string; isNM?: boolean; junctionTable?: string; table1?: string; table2?: string }>({ isOpen: false });
  const [currentComparison, setCurrentComparison] = useState(comparisonResult);

  useEffect(() => { setCurrentComparison(comparisonResult); }, [comparisonResult]);

  useEffect(() => {
    if (!isOpen || !baselineSchema || !virtualSchema) return;
    const refresh = () => {
      try {
        const fresh = compareForeignKeys(baselineSchema, virtualSchema);
        setCurrentComparison(fresh);
        if (!fresh.hasChanges) setTimeout(() => onClose(), 1000);
      } catch { /* ignore */ }
    };
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [isOpen, baselineSchema, virtualSchema]);

  if (!isOpen || !currentComparison?.hasChanges) return null;

  const { changes, affectedTables } = currentComparison;
  const isMultipleTables = affectedTables.length > 1;

  const toggleTable = (name: string) => {
    const next = new Set(expandedTables);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpandedTables(next);
  };

  const handleConfirmUndo = () => {
    if (confirmModal.isNM) {
      onRevertChange(confirmModal.junctionTable!, '', 'added');
    } else {
      onRevertChange(confirmModal.tableName!, confirmModal.columnName!, confirmModal.changeType as 'added' | 'removed');
    }
    setConfirmModal({ isOpen: false });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderColumnRow = (change: any, tableName: string) => {
    const { columnName, columnData, relationship, type, nmMetadata } = change;
    const isAdded = type === 'added', isRemoved = type === 'removed', isSynced = type === 'synced';
    const isUnchanged = type === 'baseline' || type === 'virtual';
    const isNM = nmMetadata?.isNM;
    let className = 'fk-comparison-column';
    if (isAdded) className += ' fk-added';
    else if (isRemoved) className += ' fk-removed';
    else if (isSynced) className += ' fk-synced';
    else className += ' fk-unchanged';
    if (isNM) className += ' fk-nm-relationship';

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
              {columnData.fk && <Badge variant={BADGE_VARIANTS.FK} className="constraint-badge-readonly">FK</Badge>}
              {columnData.pk && <Badge variant={BADGE_VARIANTS.PK} className="constraint-badge-readonly">PK</Badge>}
              {isNM && <Badge variant="info" className="constraint-badge-readonly fk-nm-badge">N:M</Badge>}
              {columnData.unique && <Badge variant={BADGE_VARIANTS.UNIQUE} className="constraint-badge-readonly">UQ</Badge>}
              {!columnData.nullable && <Badge variant={BADGE_VARIANTS.NOT_NULL} className="constraint-badge-readonly">NN</Badge>}
            </div>
          </div>
          {relationship && <div className="fk-relationship-info"><span className="fk-relationship-text">References: <strong>{relationship.toTable}.{relationship.toColumn}</strong></span></div>}
          {isNM && nmMetadata && <div className="fk-nm-info"><span className="fk-nm-text">Part of: <strong>{nmMetadata.displayName}</strong> (via {nmMetadata.junctionTable})</span></div>}
          {isSynced && <div className="fk-synced-message"><span className="fk-synced-text">This foreign key has already been applied to the database manually.</span></div>}
        </div>
        <div className="fk-column-actions">
          {(isAdded || isRemoved) && (
            <Button variant="ghost" size="sm" className="fk-undo-button"
              onClick={() => isNM ? setConfirmModal({ isOpen: true, isNM: true, junctionTable: nmMetadata.junctionTable, table1: nmMetadata.table1, table2: nmMetadata.table2 }) : setConfirmModal({ isOpen: true, tableName, columnName, changeType: type, isNM: false })}
              title={isNM ? `Remove entire N:M relationship` : `Undo ${isAdded ? 'addition' : 'removal'}`}>
              <FiRotateCcw />{isNM ? 'Remove N:M' : 'Undo'}
            </Button>
          )}
          {isSynced && <div className="fk-synced-indicator" title="Applied externally"><FiInfo className="fk-info-icon" /><span>Synced</span></div>}
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAllFKsForSide = (tableChanges: any, isBaseline: boolean) => {
    if (isBaseline) return tableChanges.baselineFKs;
    const unchanged: unknown[] = [], synced: unknown[] = [], added: unknown[] = [];
    tableChanges.virtualFKs.forEach((fk: { columnName: string }) => {
      const wasAdded = tableChanges.added.some((a: { columnName: string }) => a.columnName === fk.columnName);
      const wasSynced = tableChanges.synced.some((s: { columnName: string }) => s.columnName === fk.columnName);
      if (wasAdded) added.push(tableChanges.added.find((a: { columnName: string }) => a.columnName === fk.columnName));
      else if (wasSynced) synced.push(tableChanges.synced.find((s: { columnName: string }) => s.columnName === fk.columnName));
      else unchanged.push(fk);
    });
    added.sort((a: unknown, b: unknown) => (a as { columnName: string }).columnName.localeCompare((b as { columnName: string }).columnName));
    return [...unchanged, ...synced, ...added, ...tableChanges.removed];
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content fk-comparison-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Foreign Key Changes Detected</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="fk-comparison-summary">
              <p className="fk-summary-text">FK changes detected across {affectedTables.length} table(s). Use Undo to revert specific changes.</p>
            </div>
            {isMultipleTables ? (
              <div className="fk-comparison-multi-table">
                <div className="fk-tables-list">
                  {affectedTables.map((tableName: string) => {
                    const tc = changes[tableName];
                    const isExpanded = expandedTables.has(tableName);
                    const total = tc.added.length + tc.removed.length + tc.synced.length;
                    return (
                      <div key={tableName} className="fk-table-section">
                        <div className="fk-table-row" onClick={() => toggleTable(tableName)}>
                          <div className="fk-table-expand">{isExpanded ? <FiChevronDown /> : <FiChevronRight />}</div>
                          <div className="fk-table-info">
                            <span className="fk-table-name">{tableName}</span>
                            <span className="fk-table-summary">
                              {tc.added.length > 0 && <span className="fk-added-count">+{tc.added.length}</span>}
                              {tc.removed.length > 0 && <span className="fk-removed-count">-{tc.removed.length}</span>}
                              <span className="fk-total-count">({total} total)</span>
                            </span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="fk-table-details">
                            <div className="fk-comparison-panels">
                              <div className="fk-panel fk-baseline-panel">
                                <h5 className="fk-panel-subtitle">Actual Database Schema</h5>
                                <div className="fk-columns-list">{getAllFKsForSide(tc, true).map((c: unknown) => renderColumnRow(c, tableName))}{getAllFKsForSide(tc, true).length === 0 && <div className="fk-no-changes">No foreign keys in actual database</div>}</div>
                              </div>
                              <div className="fk-panel fk-virtual-panel">
                                <h5 className="fk-panel-subtitle">Virtual Schema</h5>
                                <div className="fk-columns-list">{getAllFKsForSide(tc, false).map((c: unknown) => renderColumnRow(c, tableName))}{getAllFKsForSide(tc, false).length === 0 && <div className="fk-no-changes">No foreign keys in virtual schema</div>}</div>
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
                  <span className="fk-change-count">{changes[affectedTables[0]].added.length + changes[affectedTables[0]].removed.length + changes[affectedTables[0]].synced.length} change(s)</span>
                </div>
                <div className="fk-comparison-panels">
                  <div className="fk-panel fk-baseline-panel">
                    <h4 className="fk-panel-title">Actual Database Schema</h4>
                    <div className="fk-columns-list">{getAllFKsForSide(changes[affectedTables[0]], true).map((c: unknown) => renderColumnRow(c, affectedTables[0]))}{getAllFKsForSide(changes[affectedTables[0]], true).length === 0 && <div className="fk-no-changes">No foreign keys in actual database</div>}</div>
                  </div>
                  <div className="fk-panel fk-virtual-panel">
                    <h4 className="fk-panel-title">Virtual Schema</h4>
                    <div className="fk-columns-list">{getAllFKsForSide(changes[affectedTables[0]], false).map((c: unknown) => renderColumnRow(c, affectedTables[0]))}{getAllFKsForSide(changes[affectedTables[0]], false).length === 0 && <div className="fk-no-changes">No foreign keys in virtual schema</div>}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer"><Button variant="secondary" onClick={onClose}>Close</Button></div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={handleConfirmUndo}
        title={confirmModal.isNM ? 'Remove N:M Relationship' : 'Confirm Undo'}
        message={confirmModal.isNM ? `Remove the N:M relationship between "${confirmModal.table1}" and "${confirmModal.table2}"? This will delete the junction table "${confirmModal.junctionTable}".` : `Undo the ${confirmModal.changeType === 'added' ? 'addition' : 'removal'} of foreign key "${confirmModal.columnName}" in table "${confirmModal.tableName}"?`}
        confirmText="Yes, Remove" cancelText="Cancel" variant="primary"
      />
    </>
  );
};
