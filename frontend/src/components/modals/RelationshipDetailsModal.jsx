import { useState } from 'react';
import { FiX, FiTrash2, FiInfo } from 'react-icons/fi';
import './Modal.css';
import './RelationshipDetailsModal.css';

export const RelationshipDetailsModal = ({ 
  isOpen, 
  onClose, 
  relationships, 
  onDelete 
}) => {
  const [selectedRelationships, setSelectedRelationships] = useState([]);

  const handleToggleSelection = (rel) => {
    const key = `${rel.fromTable}.${rel.fromColumn}-${rel.toTable}.${rel.toColumn}`;
    setSelectedRelationships(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleDeleteSelected = () => {
    const relsToDelete = relationships.filter(rel => {
      const key = `${rel.fromTable}.${rel.fromColumn}-${rel.toTable}.${rel.toColumn}`;
      return selectedRelationships.includes(key);
    });
    onDelete(relsToDelete);
  };

  const handleDeleteSingle = () => {
    onDelete([relationship]);
  };

  const formatRelationType = (rel) => {
    const cardinality = rel.cardinalityType || '1:N';
    const identifying = rel.isIdentifying ? 'Identifying' : 'Non-identifying';
    return `${cardinality} (${identifying})`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (!isOpen) return null;
  
  if (!relationships || relationships.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content relationship-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>No Relationship Data</h2>
            <button className="modal-close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>
          <div className="modal-body">
            <p>No relationship data available to display.</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSingleRelationship = relationships.length === 1;
  const relationship = relationships[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content relationship-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiInfo className="modal-title-icon" />
            <h2>
              {isSingleRelationship 
                ? 'Relationship Details' 
                : `Bundled Relationships (${relationships.length})`}
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {isSingleRelationship ? (
            // Single relationship view
            <div className="relationship-details-single">
              <div className="detail-row">
                <span className="detail-label">From:</span>
                <span className="detail-value">
                  {relationship.fromTable}.{relationship.fromColumn}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">To:</span>
                <span className="detail-value">
                  {relationship.toTable}.{relationship.toColumn}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{formatRelationType(relationship)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`detail-value ${relationship.isUserCreated ? 'user-created' : 'db-existing'}`}>
                  {relationship.isUserCreated ? 'User-created ✓' : 'Database-existing'}
                </span>
              </div>
              {relationship.isUserCreated && relationship.createdAt && (
                <div className="detail-row">
                  <span className="detail-label">Created:</span>
                  <span className="detail-value">{formatTimestamp(relationship.createdAt)}</span>
                </div>
              )}
              {relationship.constraintName && (
                <div className="detail-row">
                  <span className="detail-label">Constraint:</span>
                  <span className="detail-value constraint-name">{relationship.constraintName}</span>
                </div>
              )}
            </div>
          ) : (
            // Multiple relationships view
            <div className="relationship-details-multiple">
              {relationships.map((rel, index) => {
                const key = `${rel.fromTable}.${rel.fromColumn}-${rel.toTable}.${rel.toColumn}`;
                const isSelected = selectedRelationships.includes(key);
                const canDelete = rel.isUserCreated;

                return (
                  <div 
                    key={key} 
                    className={`relationship-item ${isSelected ? 'selected' : ''} ${!canDelete ? 'readonly' : ''}`}
                  >
                    {canDelete && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(rel)}
                        className="relationship-checkbox"
                      />
                    )}
                    <div className="relationship-item-content">
                      <div className="relationship-item-header">
                        <span className="relationship-number">Relationship {index + 1}</span>
                        {!canDelete && <span className="readonly-badge">🔒 Read-only</span>}
                      </div>
                      <div className="relationship-item-details">
                        <div className="relationship-item-row">
                          {rel.fromTable}.{rel.fromColumn} → {rel.toTable}.{rel.toColumn}
                        </div>
                        <div className="relationship-item-meta">
                          <span className="meta-item">{formatRelationType(rel)}</span>
                          <span className="meta-item">
                            {rel.isUserCreated ? 'User-created ✓' : 'Database-existing'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {isSingleRelationship ? (
            relationship.isUserCreated && (
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteSingle}
              >
                <FiTrash2 /> Delete This Relationship
              </button>
            )
          ) : (
            selectedRelationships.length > 0 && (
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteSelected}
              >
                <FiTrash2 /> Delete Selected ({selectedRelationships.length})
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
