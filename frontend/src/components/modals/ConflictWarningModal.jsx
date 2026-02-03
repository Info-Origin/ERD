import { useState } from 'react';
import './ConflictWarningModal.css';

export const ConflictWarningModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  conflicts, 
  cascadingChanges, 
  affectedTables,
  changeDescription 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  const hasConflicts = conflicts && conflicts.length > 0;
  const hasCascading = cascadingChanges && cascadingChanges.length > 0;
  const hasBlocking = conflicts && conflicts.some(c => c.blocking);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '🚫';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      default: return 'ℹ️';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'var(--error-color)';
      case 'HIGH': return 'var(--warning-color)';
      case 'MEDIUM': return 'var(--info-color)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="conflict-warning-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {hasConflicts ? 'Conflicts Detected' : 'Change Confirmation'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {/* Simple Conflict Message */}
          {hasConflicts ? (
            <div className="simple-conflict-message">
              <div className="warning-icon">⚠️</div>
              <p>Conflicts detected. Do you still want to change?</p>
            </div>
          ) : (
            <div className="simple-change-message">
              <div className="info-icon">🔄</div>
              <p>Do you want to apply this change?</p>
            </div>
          )}

          {/* Affected Tables - Simple List */}
          {affectedTables && affectedTables.length > 0 && (
            <div className="simple-affected-tables">
              <p><strong>Affected Tables:</strong> {affectedTables.join(', ')}</p>
            </div>
          )}

          {/* Details Toggle */}
          <button 
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>

          {/* Detailed Information - All details moved here */}
          {showDetails && (
            <div className="details-section">
              {/* Change Description */}
              <div className="change-description">
                <h4>Proposed Change:</h4>
                <p>{changeDescription}</p>
              </div>

              {/* Conflicts Details */}
              {hasConflicts && (
                <div className="conflicts-section">
                  <h4>Conflict Details:</h4>
                  <div className="conflicts-list">
                    {conflicts.map((conflict, index) => (
                      <div 
                        key={index} 
                        className={`conflict-item severity-${conflict.severity.toLowerCase()}`}
                      >
                        <div className="conflict-header">
                          <span className="severity-icon">
                            {getSeverityIcon(conflict.severity)}
                          </span>
                          <span className="conflict-type">{conflict.type.replace(/_/g, ' ')}</span>
                          <span 
                            className="severity-badge"
                            style={{ color: getSeverityColor(conflict.severity) }}
                          >
                            {conflict.severity}
                          </span>
                        </div>
                        <p className="conflict-message">{conflict.message}</p>
                        {conflict.details && (
                          <p className="conflict-details">{conflict.details}</p>
                        )}
                        {conflict.affectedTable && (
                          <div className="affected-info">
                            Affects: <span className="table-name">{conflict.affectedTable}.{conflict.affectedColumn}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cascading Changes Details */}
              {hasCascading && (
                <div className="cascading-changes">
                  <h4>Cascading Changes:</h4>
                  <p>This change will automatically update related columns to maintain referential integrity:</p>
                  <div className="cascading-list">
                    {cascadingChanges.map((change, index) => (
                      <div key={index} className="cascading-item">
                        <div className="cascade-direction">
                          {change.cascadeDirection === 'FK_TO_PK' && (
                            <span className="direction-badge fk-to-pk">FK → PK</span>
                          )}
                          {change.cascadeDirection === 'PK_TO_OTHER_FKS' && (
                            <span className="direction-badge pk-to-fk">PK → FK</span>
                          )}
                          {!change.cascadeDirection && (
                            <span className="direction-badge default">CASCADE</span>
                          )}
                        </div>
                        <span className="table-name">{change.tableName}.{change.columnName}</span>
                        <span className="type-change">
                          {change.oldType} → {change.newType}
                        </span>
                        <span className="reason">{change.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Details JSON */}
              <div className="technical-details">
                <h4>Technical Details:</h4>
                <pre className="details-json">
                  {JSON.stringify({ conflicts, cascadingChanges }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            {hasBlocking ? 'Close' : 'Cancel'}
          </button>
          {!hasBlocking && (
            <button className="btn-primary" onClick={onConfirm}>
              {hasConflicts ? 'Apply Changes' : 'Confirm'}
            </button>
          )}
          {hasBlocking && (
            <>
              <button 
                className="btn-warning" 
                onClick={onConfirm}
                title="Force apply changes despite critical conflicts"
              >
                Force Apply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};