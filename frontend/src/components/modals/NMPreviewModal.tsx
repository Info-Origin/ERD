import { FiX, FiInfo, FiTable, FiKey, FiLink } from 'react-icons/fi';
import './Modal.css';
import './NMPreviewModal.css';

interface NMPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  table1: string;
  table1Column: string;
  table2: string;
  table2Column: string;
  junctionTableName: string;
  fk1Name: string;
  fk2Name: string;
  table1Type: string;
  table2Type: string;
}

export const NMPreviewModal = ({ isOpen, onClose, onConfirm, table1, table1Column, table2, table2Column, junctionTableName, fk1Name, fk2Name, table1Type, table2Type }: NMPreviewModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content nm-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiInfo className="modal-title-icon" style={{ color: '#9333ea' }} />
            <h2>Create Many-to-Many Relationship</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <div className="nm-preview-content">
            <div className="nm-preview-description">
              <p>This will create a Many-to-Many (N:M) relationship between:</p>
              <div className="nm-tables-preview">
                <span className="nm-table-name">{table1}</span>
                <span className="nm-arrow">↔</span>
                <span className="nm-table-name">{table2}</span>
              </div>
            </div>
            <div className="nm-preview-section">
              <h3><FiTable /> Junction Table</h3>
           
              <div className="nm-junction-preview">
                <div className="nm-junction-header">
                  <FiTable className="junction-icon" />
                  <span className="junction-table-name">{junctionTableName}</span>
                  <span className="junction-badge">New Table</span>
                </div>
                <div className="nm-junction-columns">
                  <div className="nm-junction-column">
                    <FiKey className="column-icon pk-icon" /><FiLink className="column-icon fk-icon" />
                    <span className="column-name">{fk1Name}</span>
                    <span className="column-type">{table1Type}</span>
                    <span className="column-badge">PK, FK</span>
                  </div>
                  <div className="nm-junction-column">
                    <FiKey className="column-icon pk-icon" /><FiLink className="column-icon fk-icon" />
                    <span className="column-name">{fk2Name}</span>
                    <span className="column-type">{table2Type}</span>
                    <span className="column-badge">PK, FK</span>
                  </div>
                </div>
                <div className="nm-junction-note"><span className="note-icon">ℹ️</span>Composite Primary Key: Both columns together form the primary key</div>
              </div>
            </div>
            <div className="nm-preview-section">
              <h3><FiLink /> Relationships</h3>
              <div className="nm-relationships-preview">
                <div className="nm-relationship-item">
                  <span className="rel-from">{junctionTableName}.{fk1Name}</span>
                  <span className="rel-arrow">→</span>
                  <span className="rel-to">{table1}.{table1Column}</span>
                  <span className="rel-type">1:N Identifying</span>
                </div>
                <div className="nm-relationship-item">
                  <span className="rel-from">{junctionTableName}.{fk2Name}</span>
                  <span className="rel-arrow">→</span>
                  <span className="rel-to">{table2}.{table2Column}</span>
                  <span className="rel-type">1:N Identifying</span>
                </div>
              </div>
            </div>
            <div className="nm-preview-warning">
              <span className="warning-icon">⚠️</span>
              <div className="warning-content"><strong>Note:</strong> This operation cannot be undone individually.</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Create N:M Relationship</button>
        </div>
      </div>
    </div>
  );
};
