import { useState } from 'react';
import { FiX, FiTrash2, FiInfo } from 'react-icons/fi';
import type { Relationship } from '../../types';
import './Modal.css';
import './RelationshipDetailsModal.css';

interface RelationshipDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  relationships: Relationship[];
  onDelete: (rels: Relationship[]) => void;
}

const formatRelationType = (rel: Relationship) => `${rel.cardinalityType || '1:N'} (${rel.isIdentifying ? 'Identifying' : 'Non-identifying'})`;

const formatTimestamp = (ts?: number) => {
  if (!ts) return 'Unknown';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

export const RelationshipDetailsModal = ({ isOpen, onClose, relationships, onDelete }: RelationshipDetailsModalProps) => {
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);

  const toggleSelection = (rel: Relationship) => {
    const key = `${rel.fromTable}.${rel.fromColumn}-${rel.toTable}.${rel.toColumn}`;
    setSelectedRelationships(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  if (!isOpen) return null;

  if (!relationships || relationships.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content relationship-details-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><h2>No Relationship Data</h2><button className="modal-close-btn" onClick={onClose}><FiX /></button></div>
          <div className="modal-body"><p>No relationship data available to display.</p></div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
        </div>
      </div>
    );
  }

  const isSingle = relationships.length === 1;
  const rel = relationships[0];
  const selfJoins = relationships.filter(r => r.fromTable === r.toTable && !(r as { isVirtualNM?: boolean }).isVirtualNM);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content relationship-details-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiInfo className="modal-title-icon" />
            <h2>{isSingle ? 'Relationship Details' : `Bundled Relationships (${relationships.length})`}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          {isSingle ? (
            <div className="relationship-details-single">
              {(rel as { isVirtualNM?: boolean }).isVirtualNM ? (
                <>
                  <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">Many-to-Many (N:M)</span></div>
                  <div className="detail-row"><span className="detail-label">Between:</span><span className="detail-value">{rel.fromTable} ↔ {rel.toTable}</span></div>
                  <div className="detail-row"><span className="detail-label">Junction Table:</span><span className="detail-value junction-table">{(rel as { junctionTable?: string }).junctionTable}</span></div>
                  <div className="detail-row"><span className="detail-label">Status:</span><span className="detail-value db-existing">Virtual (Conceptual View)</span></div>
                </>
              ) : (
                <>
                  {rel.fromTable === rel.toTable && <div className="detail-row self-join-indicator"><span className="detail-label">⚠️ Self-Join:</span><span className="detail-value">This table references itself</span></div>}
                  <div className="detail-row"><span className="detail-label">From:</span><span className="detail-value">{rel.fromTable}.{rel.fromColumn}</span></div>
                  <div className="detail-row"><span className="detail-label">To:</span><span className="detail-value">{rel.toTable}.{rel.toColumn}</span></div>
                  <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">{formatRelationType(rel)}</span></div>
                  <div className="detail-row"><span className="detail-label">Status:</span><span className={`detail-value ${rel.isUserCreated ? 'user-created' : 'db-existing'}`}>{rel.isUserCreated ? 'User-created ✓' : 'Database-existing'}</span></div>
                  {rel.isUserCreated && rel.createdAt && <div className="detail-row"><span className="detail-label">Created:</span><span className="detail-value">{formatTimestamp(rel.createdAt)}</span></div>}
                  {rel.constraintName && <div className="detail-row"><span className="detail-label">Constraint:</span><span className="detail-value constraint-name">{rel.constraintName}</span></div>}
                </>
              )}
            </div>
          ) : (
            <div className="relationship-details-multiple">
              {selfJoins.length > 0 && (
                <div className="self-join-summary">
                  <div className="self-join-header">⚠️ Self-Join Relationships Detected</div>
                  <div className="self-join-info"><strong>{selfJoins.length}</strong> self-referencing relationship{selfJoins.length > 1 ? 's' : ''} found:<ul className="self-join-list">{selfJoins.map((r, i) => <li key={i}>{r.fromTable}.{r.fromColumn} → {r.toTable}.{r.toColumn}</li>)}</ul></div>
                </div>
              )}
              {relationships.map((r, i) => {
                const key = `${r.fromTable}.${r.fromColumn}-${r.toTable}.${r.toColumn}`;
                const isSelected = selectedRelationships.includes(key);
                return (
                  <div key={key} className={`relationship-item ${isSelected ? 'selected' : ''} ${!r.isUserCreated ? 'readonly' : ''}`}>
                    {r.isUserCreated && <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(r)} className="relationship-checkbox" />}
                    <div className="relationship-item-content">
                      <div className="relationship-item-header"><span className="relationship-number">Relationship {i + 1}</span>{!r.isUserCreated && <span className="readonly-badge">🔒 Read-only</span>}</div>
                      <div className="relationship-item-details">
                        <div className="relationship-item-row">{r.fromTable}.{r.fromColumn} → {r.toTable}.{r.toColumn}</div>
                        <div className="relationship-item-meta"><span className="meta-item">{formatRelationType(r)}</span><span className="meta-item">{r.isUserCreated ? 'User-created ✓' : 'Database-existing'}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {isSingle ? (rel.isUserCreated && <button className="btn btn-danger" onClick={() => onDelete([rel])}><FiTrash2 /> Delete This Relationship</button>)
            : (selectedRelationships.length > 0 && <button className="btn btn-danger" onClick={() => onDelete(relationships.filter(r => selectedRelationships.includes(`${r.fromTable}.${r.fromColumn}-${r.toTable}.${r.toColumn}`)))}><FiTrash2 /> Delete Selected ({selectedRelationships.length})</button>)}
        </div>
      </div>
    </div>
  );
};
