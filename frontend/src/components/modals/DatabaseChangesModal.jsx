import { useState } from 'react';
import { FiRefreshCw, FiChevronDown, FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import { Button } from '../common/Button';
import { formatChangesForDisplay } from '../../utils/databaseChangeDetector';
import './DatabaseChangesModal.css';

export const DatabaseChangesModal = ({ 
  isOpen, 
  changes, 
  onRefresh,
  isRefreshing = false
}) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['Tables', 'Columns', 'Relationships', 'Constraints']));

  if (!isOpen || !changes) return null;

  const formattedChanges = formatChangesForDisplay(changes);
  
  if (!formattedChanges || formattedChanges.length === 0) {
    return null;
  }

  const toggleSection = (sectionTitle) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const totalChanges = formattedChanges.reduce((sum, section) => sum + section.count, 0);

  return (
    <>
      {/* Backdrop - blocks all interactions */}
      <div className="database-changes-modal-backdrop" />
      
      {/* Modal */}
      <div className="database-changes-modal">
        <div className="database-changes-modal-header">
          <div className="database-changes-modal-title">
            <FiAlertCircle className="database-changes-modal-icon" />
            <h2>Database Changes Detected</h2>
          </div>
          <div className="database-changes-modal-subtitle">
            {totalChanges} change{totalChanges !== 1 ? 's' : ''} detected in the database schema. Refresh to stay in sync.
          </div>
        </div>

        <div className="database-changes-modal-body">
          <div className="database-changes-sections">
            {formattedChanges.map((section) => (
              <div key={section.title} className="database-changes-section">
                <div 
                  className="database-changes-section-header"
                  onClick={() => toggleSection(section.title)}
                >
                  <div className="database-changes-section-title">
                    {expandedSections.has(section.title) ? (
                      <FiChevronDown className="database-changes-chevron" />
                    ) : (
                      <FiChevronRight className="database-changes-chevron" />
                    )}
                    <span>{section.title}</span>
                    <span className="database-changes-count">({section.count})</span>
                  </div>
                </div>

                {expandedSections.has(section.title) && (
                  <div className="database-changes-section-content">
                    {section.items.map((item, index) => (
                      <div key={index} className={`database-change-item database-change-${item.type}`}>
                        <div className="database-change-badge">
                          {item.type === 'added' && '✅'}
                          {item.type === 'deleted' && '❌'}
                          {item.type === 'renamed' && '🔄'}
                          {item.type === 'modified' && '📝'}
                        </div>
                        <div className="database-change-content">
                          <div className="database-change-description">
                            {item.description}
                          </div>
                          {item.details && item.details.length > 0 && (
                            <div className="database-change-details">
                              {item.details.map((detail, idx) => (
                                <div key={idx} className="database-change-detail">
                                  • {detail}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="database-changes-modal-footer">
          <div className="database-changes-modal-warning">
            <FiAlertCircle size={16} />
            <span>You must refresh to continue working with the latest database structure</span>
          </div>
          <Button
            variant="primary"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="database-changes-refresh-button"
          >
            {isRefreshing ? (
              <>
                <FiRefreshCw className="spinning" />
                Refreshing...
              </>
            ) : (
              <>
                <FiRefreshCw />
                Refresh & Sync
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
};
