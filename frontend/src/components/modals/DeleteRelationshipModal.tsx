import { FiX, FiAlertTriangle } from 'react-icons/fi';
import type { Relationship } from '../../types';
import './Modal.css';
import './DeleteRelationshipModal.css';

interface DeleteRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  relationships: Relationship[];
  onConfirm: (rels: Relationship[]) => void;
}

export const DeleteRelationshipModal = ({ isOpen, onClose, relationships, onConfirm }: DeleteRelationshipModalProps) => {
  if (!isOpen || !relationships || relationships.length === 0) return null;

  const isSingle = relationships.length === 1;
  const junctionTables = new Set<string>();
  relationships.forEach(rel => { if (rel.isJunctionRelationship && rel.junctionTable) junctionTables.add(rel.junctionTable); });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content delete-relationship-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiAlertTriangle className="modal-title-icon warning" />
            <h2>Delete Relationship{isSingle ? '' : 's'}?</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <div className="delete-confirmation-content">
            <p className="confirmation-message">You are about to delete {isSingle ? 'this relationship' : `${relationships.length} relationships`}:</p>
            <div className="relationships-to-delete">
              {relationships.map((rel, i) => (
                <div key={i} className="relationship-to-delete-item">
                  <span className="relationship-arrow">•</span>
                  <span className="relationship-text">{rel.fromTable}.{rel.fromColumn} → {rel.toTable}.{rel.toColumn}</span>
                  <span className="relationship-type">({rel.cardinalityType || '1:N'})</span>
                </div>
              ))}
            </div>
            <div className="warning-box">
              <div className="warning-header"><FiAlertTriangle className="warning-icon" /><span className="warning-title">This will:</span></div>
              <ul className="warning-list">
                <li>Drop foreign key constraint{isSingle ? '' : 's'}</li>
                <li>Remove FK flag from column{isSingle ? '' : 's'}</li>
                {junctionTables.size > 0 && <li className="critical">Drop junction table{junctionTables.size > 1 ? 's' : ''}: {Array.from(junctionTables).join(', ')}</li>}
                <li>Update ERD diagram</li>
              </ul>
            </div>
            <div className="undo-notice"><span className="undo-icon">↶</span>You can undo this action using the Undo button in the toolbar.</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => onConfirm(relationships)}>Delete Relationship{isSingle ? '' : 's'}</button>
        </div>
      </div>
    </div>
  );
};
