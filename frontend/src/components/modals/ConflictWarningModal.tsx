import { useState } from 'react';
import './ConflictWarningModal.css';

interface Conflict {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | string;
  message: string;
  details?: string;
  blocking?: boolean;
  affectedTable?: string;
  affectedColumn?: string;
}

interface CascadingChange {
  tableName: string;
  columnName: string;
  oldType?: string;
  newType: string;
  reason: string;
  cascadeDirection?: string;
}

interface ConflictWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflicts?: Conflict[];
  cascadingChanges?: CascadingChange[];
  affectedTables?: string[];
  changeDescription?: string;
}

const getSeverityIcon = (s: string) => ({ CRITICAL: '🚫', HIGH: '⚠️', MEDIUM: '⚡' }[s] ?? 'ℹ️');
const getSeverityColor = (s: string) => ({ CRITICAL: 'var(--error-color)', HIGH: 'var(--warning-color)', MEDIUM: 'var(--info-color)' }[s] ?? 'var(--text-secondary)');

export const ConflictWarningModal = ({ isOpen, onClose, onConfirm, conflicts = [], cascadingChanges = [], affectedTables = [], changeDescription }: ConflictWarningModalProps) => {
  const [showDetails, setShowDetails] = useState(false);
  if (!isOpen) return null;

  const hasConflicts = conflicts.length > 0;
  const hasCascading = cascadingChanges.length > 0;
  const hasBlocking = conflicts.some(c => c.blocking);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="conflict-warning-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{hasConflicts ? 'Conflicts Detected' : 'Change Confirmation'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {hasConflicts
            ? <div className="simple-conflict-message"><div className="warning-icon">⚠️</div><p>Conflicts detected. Do you still want to change?</p></div>
            : <div className="simple-change-message"><div className="info-icon">🔄</div><p>Do you want to apply this change?</p></div>}
          {affectedTables.length > 0 && <div className="simple-affected-tables"><p><strong>Affected Tables:</strong> {affectedTables.join(', ')}</p></div>}
          <button className="details-toggle" onClick={() => setShowDetails(!showDetails)}>{showDetails ? 'Hide Details' : 'View Details'}</button>
          {showDetails && (
            <div className="details-section">
              {changeDescription && <div className="change-description"><h4>Proposed Change:</h4><p>{changeDescription}</p></div>}
              {hasConflicts && (
                <div className="conflicts-section">
                  <h4>Conflict Details:</h4>
                  <div className="conflicts-list">
                    {conflicts.map((c, i) => (
                      <div key={i} className={`conflict-item severity-${c.severity.toLowerCase()}`}>
                        <div className="conflict-header">
                          <span className="severity-icon">{getSeverityIcon(c.severity)}</span>
                          <span className="conflict-type">{c.type.replace(/_/g, ' ')}</span>
                          <span className="severity-badge" style={{ color: getSeverityColor(c.severity) }}>{c.severity}</span>
                        </div>
                        <p className="conflict-message">{c.message}</p>
                        {c.details && <p className="conflict-details">{c.details}</p>}
                        {c.affectedTable && <div className="affected-info">Affects: <span className="table-name">{c.affectedTable}.{c.affectedColumn}</span></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasCascading && (
                <div className="cascading-changes">
                  <h4>Cascading Changes:</h4>
                  <div className="cascading-list">
                    {cascadingChanges.map((ch, i) => (
                      <div key={i} className="cascading-item">
                        <div className="cascade-direction">
                          {ch.cascadeDirection === 'FK_TO_PK' && <span className="direction-badge fk-to-pk">FK → PK</span>}
                          {ch.cascadeDirection === 'PK_TO_OTHER_FKS' && <span className="direction-badge pk-to-fk">PK → FK</span>}
                          {!ch.cascadeDirection && <span className="direction-badge default">CASCADE</span>}
                        </div>
                        <span className="table-name">{ch.tableName}.{ch.columnName}</span>
                        <span className="type-change">{ch.oldType} → {ch.newType}</span>
                        <span className="reason">{ch.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="technical-details">
                <h4>Technical Details:</h4>
                <pre className="details-json">{JSON.stringify({ conflicts, cascadingChanges }, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{hasBlocking ? 'Close' : 'Cancel'}</button>
          {!hasBlocking && <button className="btn-primary" onClick={onConfirm}>{hasConflicts ? 'Apply Changes' : 'Confirm'}</button>}
          {hasBlocking && <button className="btn-warning" onClick={onConfirm} title="Force apply changes despite critical conflicts">Force Apply</button>}
        </div>
      </div>
    </div>
  );
};
